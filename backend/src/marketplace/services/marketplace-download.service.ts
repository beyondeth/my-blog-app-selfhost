import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Order } from "../entities/order.entity";
import { ProductDetail } from "../entities/product-detail.entity";
import { DeliveryItem } from "../entities/delivery-item.entity";
import { OrderStatus } from "../../common/enums/order-status.enum";
import { R2Service } from "../../files/services/r2.service";

/** 다운로드 세션 제한 (5세션, 각 세션에서 모든 파일 다운로드 가능) */
const MAX_DOWNLOAD_SESSIONS = 5;
/** presigned URL 만료 시간 (초) */
const URL_EXPIRY_SECONDS = 3600; // 1시간
/** 같은 세션으로 간주하는 시간 (밀리초) — 10분 이내 재다운로드는 횟수 미증가 */
const SESSION_WINDOW_MS = 10 * 60 * 1000;

/**
 * 마켓플레이스 보안 파일 전달 서비스
 *
 * S3Service를 통해 OCI Object Storage / AWS S3 모두 지원
 * - presigned URL로 임시 다운로드 링크 발급 (1시간 만료)
 * - 다운로드 횟수 제한 (최대 5회)
 * - 구매 확인된 사용자만 다운로드 가능
 */
@Injectable()
export class MarketplaceDownloadService {
  private readonly logger = new Logger(MarketplaceDownloadService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(ProductDetail)
    private readonly productDetailRepository: Repository<ProductDetail>,
    @InjectRepository(DeliveryItem)
    private readonly deliveryItemRepository: Repository<DeliveryItem>,
    private readonly r2Service: R2Service,
  ) {}

  /**
   * 레거시: 주문 단위 다운로드 (digitalDeliveryUrl 기반)
   */
  async getSecureDownloadUrl(
    buyerId: string,
    orderId: string,
  ): Promise<{
    downloadUrl: string;
    expiresIn: number;
    downloadCount: number;
    maxDownloads: number;
    remainingDownloads: number;
  }> {
    const order = await this.validateOrderAccess(buyerId, orderId);

    const productDetail = await this.productDetailRepository.findOne({
      where: { postId: order.productPostId },
    });

    if (!productDetail) {
      throw new NotFoundException("상품 정보를 찾을 수 없습니다");
    }

    if (
      productDetail.deliveryType !== "file" ||
      !productDetail.digitalDeliveryUrl
    ) {
      throw new BadRequestException(
        "이 상품은 파일 다운로드 형식이 아닙니다",
      );
    }

    const newDownloadCount = await this.checkAndIncrementDownloadSession(order.id);

    const s3Key = this.extractS3Key(productDetail.digitalDeliveryUrl);
    const downloadUrl =
      await this.r2Service.generatePresignedDownloadUrl(s3Key);

    this.logger.log(
      `다운로드 URL 발급: orderId=${orderId}, count=${newDownloadCount}/${MAX_DOWNLOAD_SESSIONS}`,
    );

    return {
      downloadUrl,
      expiresIn: URL_EXPIRY_SECONDS,
      downloadCount: newDownloadCount,
      maxDownloads: MAX_DOWNLOAD_SESSIONS,
      remainingDownloads: MAX_DOWNLOAD_SESSIONS - newDownloadCount,
    };
  }

  /**
   * DeliveryItem 기반 개별 파일 다운로드 URL 발급
   *
   * S3Service 사용 → OCI / AWS 모두 지원
   */
  async getSecureItemDownloadUrl(
    buyerId: string,
    orderId: string,
    deliveryItemId: string,
  ): Promise<{
    downloadUrl: string;
    expiresIn: number;
    downloadCount: number;
    maxDownloads: number;
    remainingDownloads: number;
    fileName: string;
  }> {
    const order = await this.validateOrderAccess(buyerId, orderId);

    // DeliveryItem 조회 + 해당 주문의 상품 소속 확인
    const item = await this.deliveryItemRepository
      .createQueryBuilder("item")
      .innerJoin("product_details", "pd", "pd.id = item.productDetailId")
      .where("item.id = :itemId", { itemId: deliveryItemId })
      .andWhere("pd.postId = :postId", { postId: order.productPostId })
      .andWhere("item.type = :type", { type: "file" })
      .andWhere("item.isActive = true")
      .getRawOne();

    if (!item) {
      throw new NotFoundException("다운로드 가능한 파일을 찾을 수 없습니다");
    }

    const fileKey = item.item_fileKey as string;
    const fileName = (item.item_fileName as string) || "download";

    if (!fileKey) {
      throw new BadRequestException("파일이 아직 준비되지 않았습니다");
    }

    // 경로 탈출 방어
    if (fileKey.includes("..") || fileKey.startsWith("/")) {
      throw new BadRequestException("유효하지 않은 파일 경로입니다");
    }

    const newDownloadCount = await this.checkAndIncrementDownloadSession(order.id);

    // S3Service의 내부 클라이언트로 Content-Disposition 포함 presigned URL 생성
    const downloadUrl =
      await this.r2Service.generatePresignedDownloadUrlWithDisposition(
        fileKey,
        fileName,
      );

    this.logger.log(
      `아이템 다운로드 URL 발급: orderId=${orderId}, itemId=${deliveryItemId}, file=${fileName}, count=${newDownloadCount}/${MAX_DOWNLOAD_SESSIONS}`,
    );

    return {
      downloadUrl,
      expiresIn: URL_EXPIRY_SECONDS,
      downloadCount: newDownloadCount,
      maxDownloads: MAX_DOWNLOAD_SESSIONS,
      remainingDownloads: MAX_DOWNLOAD_SESSIONS - newDownloadCount,
      fileName,
    };
  }

  /** 주문 접근 권한 검증 (구매자 + PAID 상태) */
  private async validateOrderAccess(
    buyerId: string,
    orderId: string,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { orderId, buyerId },
    });
    if (!order) {
      throw new NotFoundException("주문을 찾을 수 없습니다");
    }
    if (order.status !== OrderStatus.PAID) {
      throw new ForbiddenException(
        "결제가 완료된 주문만 다운로드할 수 있습니다",
      );
    }
    return order;
  }

  /**
   * 세션 기반 다운로드 횟수 관리
   *
   * 같은 세션(10분 이내) 재다운로드 → 횟수 미증가 (모든 파일 자유롭게 다운로드)
   * 새 세션 → 횟수 +1 (최대 5세션)
   *
   * 이렇게 하면 5파일 상품을 한번에 받아도 1세션으로 카운트
   */
  private async checkAndIncrementDownloadSession(
    orderPkId: string,
  ): Promise<number> {
    // 현재 메타데이터 조회
    const order = await this.orderRepository.findOne({
      where: { id: orderPkId },
      select: ["metadata"],
    });

    const metadata = (order?.metadata || {}) as Record<string, unknown>;
    const downloadCount = (metadata.downloadCount as number) || 0;
    const lastDownloadAt = metadata.lastDownloadAt as string | undefined;

    // 같은 세션인지 확인 (10분 이내)
    if (lastDownloadAt) {
      const elapsed = Date.now() - new Date(lastDownloadAt).getTime();
      if (elapsed < SESSION_WINDOW_MS) {
        // 같은 세션 — 횟수 미증가, 타임스탬프만 갱신
        await this.orderRepository
          .createQueryBuilder()
          .update()
          .set({
            metadata: () => `
              COALESCE(metadata, '{}'::jsonb)
              || jsonb_build_object('lastDownloadAt', '"${new Date().toISOString()}"'::jsonb)
            `,
          })
          .where("id = :id", { id: orderPkId })
          .execute();

        return downloadCount;
      }
    }

    // 새 세션 — 횟수 증가 (원자적, TOCTOU 방지)
    const incrementResult = await this.orderRepository
      .createQueryBuilder()
      .update()
      .set({
        metadata: () => `
          COALESCE(metadata, '{}'::jsonb)
          || jsonb_build_object(
            'downloadCount', (COALESCE((metadata->>'downloadCount')::int, 0) + 1),
            'maxDownloads', ${MAX_DOWNLOAD_SESSIONS},
            'lastDownloadAt', '"${new Date().toISOString()}"'::jsonb
          )
        `,
      })
      .where("id = :id", { id: orderPkId })
      .andWhere(
        "COALESCE((metadata->>'downloadCount')::int, 0) < :max",
        { max: MAX_DOWNLOAD_SESSIONS },
      )
      .execute();

    if (incrementResult.affected === 0) {
      throw new ForbiddenException(
        `다운로드 횟수를 초과했습니다 (최대 ${MAX_DOWNLOAD_SESSIONS}회). 고객센터에 문의해주세요.`,
      );
    }

    return downloadCount + 1;
  }

  /** digitalDeliveryUrl에서 S3 key 추출 (레거시 호환) */
  private extractS3Key(url: string): string {
    let key: string;
    try {
      const parsed = new URL(url);
      key = parsed.pathname.startsWith("/")
        ? parsed.pathname.substring(1)
        : parsed.pathname;
    } catch {
      throw new BadRequestException("유효하지 않은 다운로드 URL 형식입니다");
    }

    if (key.includes("..") || key.startsWith("/")) {
      throw new BadRequestException("유효하지 않은 파일 경로입니다");
    }

    return key;
  }
}
