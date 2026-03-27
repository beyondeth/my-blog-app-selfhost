import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ConfigService } from "@nestjs/config";
import { Order } from "../entities/order.entity";
import { ProductDetail } from "../entities/product-detail.entity";
import { OrderStatus } from "../../common/enums/order-status.enum";

/** 다운로드 횟수 제한 */
const MAX_DOWNLOADS = 5;
/** presigned URL 만료 시간 (초) */
const URL_EXPIRY_SECONDS = 3600; // 1시간

/**
 * 마켓플레이스 보안 파일 전달 서비스
 *
 * Gumroad 모델 기반:
 * - S3 presigned URL로 임시 다운로드 링크 발급 (1시간 만료)
 * - 다운로드 횟수 제한 (최대 5회)
 * - 구매 확인된 사용자만 다운로드 가능
 * - 다운로드 이력 추적 (order.metadata에 기록)
 */
@Injectable()
export class MarketplaceDownloadService {
  private readonly logger = new Logger(MarketplaceDownloadService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(ProductDetail)
    private readonly productDetailRepository: Repository<ProductDetail>,
    private readonly configService: ConfigService,
  ) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>("AWS_REGION", "ap-northeast-2"),
      credentials: {
        accessKeyId: this.configService.get<string>("AWS_ACCESS_KEY_ID", ""),
        secretAccessKey: this.configService.get<string>(
          "AWS_SECRET_ACCESS_KEY",
          "",
        ),
      },
    });
    this.bucketName = this.configService.get<string>(
      "AWS_S3_BUCKET",
      "codebase-blog",
    );
  }

  /**
   * 구매자에게 보안 다운로드 URL 발급
   *
   * 검증 순서:
   * 1. 주문 존재 + 구매자 본인 확인
   * 2. 주문 상태 PAID 확인
   * 3. 상품이 파일 전달 타입인지 확인
   * 4. 다운로드 횟수 제한 확인
   * 5. S3 presigned URL 생성 (1시간 만료)
   * 6. 다운로드 이력 기록
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
    // 1. 주문 조회 + 구매자 확인
    const order = await this.orderRepository.findOne({
      where: { orderId, buyerId },
    });

    if (!order) {
      throw new NotFoundException("주문을 찾을 수 없습니다");
    }

    // 2. 결제 완료 확인
    if (order.status !== OrderStatus.PAID) {
      throw new ForbiddenException("결제가 완료된 주문만 다운로드할 수 있습니다");
    }

    // 3. 상품 상세 조회 + 파일 전달 타입 확인
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

    // 4. 다운로드 횟수 확인
    const metadata = (order.metadata || {}) as Record<string, any>;
    const downloadCount = metadata.downloadCount || 0;

    if (downloadCount >= MAX_DOWNLOADS) {
      throw new ForbiddenException(
        `다운로드 횟수를 초과했습니다 (최대 ${MAX_DOWNLOADS}회). 고객센터에 문의해주세요.`,
      );
    }

    // 5. S3 presigned URL 생성
    const s3Key = this.extractS3Key(productDetail.digitalDeliveryUrl);
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: URL_EXPIRY_SECONDS,
    });

    // 6. 다운로드 횟수 원자적 증가 (레이스 컨디션 방지)
    await this.orderRepository
      .createQueryBuilder()
      .update()
      .set({
        metadata: () => `
          COALESCE(metadata, '{}'::jsonb)
          || jsonb_build_object(
            'downloadCount', (COALESCE((metadata->>'downloadCount')::int, 0) + 1),
            'maxDownloads', ${MAX_DOWNLOADS}
          )
        `,
      })
      .where("id = :id", { id: order.id })
      .execute();

    // 업데이트된 횟수 조회
    const updated = await this.orderRepository.findOne({ where: { id: order.id }, select: ["metadata"] });
    const newDownloadCount = (updated?.metadata as any)?.downloadCount || downloadCount + 1;

    this.logger.log(
      `다운로드 URL 발급: orderId=${orderId}, count=${newDownloadCount}/${MAX_DOWNLOADS}`,
    );

    return {
      downloadUrl,
      expiresIn: URL_EXPIRY_SECONDS,
      downloadCount: newDownloadCount,
      maxDownloads: MAX_DOWNLOADS,
      remainingDownloads: MAX_DOWNLOADS - newDownloadCount,
    };
  }

  /**
   * digitalDeliveryUrl에서 S3 key 추출
   * URL 형태: https://bucket.s3.region.amazonaws.com/key 또는 순수 key
   */
  private extractS3Key(url: string): string {
    let key: string;
    try {
      const parsed = new URL(url);
      key = parsed.pathname.startsWith("/")
        ? parsed.pathname.substring(1)
        : parsed.pathname;
    } catch {
      // URL이 아니면 에러 (경로 탈출 방지)
      throw new BadRequestException("유효하지 않은 다운로드 URL 형식입니다");
    }

    // 경로 탈출 방어: ".." 포함 시 거부
    if (key.includes("..") || key.startsWith("/")) {
      throw new BadRequestException("유효하지 않은 파일 경로입니다");
    }

    return key;
  }
}
