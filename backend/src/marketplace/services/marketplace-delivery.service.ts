import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { DeliveryItem } from "../entities/delivery-item.entity";
import { ProductDetail } from "../entities/product-detail.entity";
import { Order } from "../entities/order.entity";
import { OrderStatus } from "../../common/enums/order-status.enum";

/**
 * 마켓플레이스 배송 항목 관리 서비스
 *
 * 판매자: 배송 항목 CRUD + 순서 변경
 * 구매자: 구매한 상품의 배송 항목 조회
 */
@Injectable()
export class MarketplaceDeliveryService {
  private readonly logger = new Logger(MarketplaceDeliveryService.name);

  constructor(
    @InjectRepository(DeliveryItem)
    private readonly deliveryItemRepository: Repository<DeliveryItem>,
    @InjectRepository(ProductDetail)
    private readonly productDetailRepository: Repository<ProductDetail>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 판매자: 배송 항목 추가
   * 소유권 검증 후 DeliveryItem 생성 + deliveryItemCount 원자적 증가
   */
  async addDeliveryItem(
    sellerId: string,
    productDetailId: string,
    dto: {
      type: "content_html" | "file" | "external_link";
      label: string;
      contentHtml?: string;
      fileKey?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      externalUrl?: string;
    },
  ): Promise<DeliveryItem> {
    const productDetail = await this.validateSellerOwnership(
      sellerId,
      productDetailId,
    );

    // type별 필수 필드 검증
    if (dto.type === "file" && !dto.fileKey) {
      throw new BadRequestException("파일 타입은 fileKey가 필수입니다");
    }
    if (dto.type === "content_html" && !dto.contentHtml) {
      throw new BadRequestException("콘텐츠 타입은 contentHtml이 필수입니다");
    }
    if (dto.type === "external_link" && !dto.externalUrl) {
      throw new BadRequestException("외부 링크 타입은 externalUrl이 필수입니다");
    }

    // 다음 sortOrder 계산
    const maxSort = await this.deliveryItemRepository
      .createQueryBuilder("di")
      .select("MAX(di.sortOrder)", "max")
      .where("di.productDetailId = :id", { id: productDetailId })
      .getRawOne();
    const nextSort = (maxSort?.max ?? -1) + 1;

    const item = this.deliveryItemRepository.create({
      productDetailId,
      type: dto.type,
      label: dto.label,
      sortOrder: nextSort,
      contentHtml: dto.contentHtml || null,
      fileKey: dto.fileKey || null,
      fileName: dto.fileName || null,
      fileSize: dto.fileSize || null,
      mimeType: dto.mimeType || null,
      externalUrl: dto.externalUrl || null,
    });

    const saved = await this.deliveryItemRepository.save(item);

    // deliveryItemCount 원자적 증가
    await this.productDetailRepository.increment(
      { id: productDetailId },
      "deliveryItemCount",
      1,
    );

    // deliveryType 자동 판별
    await this.updateDeliveryType(productDetail.id);

    this.logger.log(
      `배송 항목 추가: productDetailId=${productDetailId}, type=${dto.type}, label=${dto.label}`,
    );

    return saved;
  }

  /**
   * 판매자: 배송 항목 수정
   */
  async updateDeliveryItem(
    sellerId: string,
    itemId: string,
    dto: {
      label?: string;
      contentHtml?: string;
      fileKey?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      externalUrl?: string;
      isActive?: boolean;
    },
  ): Promise<DeliveryItem> {
    const item = await this.findItemWithOwnershipCheck(sellerId, itemId);

    Object.assign(item, dto);
    const saved = await this.deliveryItemRepository.save(item);

    // isActive 변경 시 deliveryItemCount 재계산
    if (dto.isActive !== undefined) {
      await this.recalculateDeliveryItemCount(item.productDetailId);
    }

    return saved;
  }

  /**
   * 판매자: 배송 항목 삭제
   */
  async removeDeliveryItem(sellerId: string, itemId: string): Promise<void> {
    const item = await this.findItemWithOwnershipCheck(sellerId, itemId);
    const productDetailId = item.productDetailId;

    await this.deliveryItemRepository.remove(item);

    // deliveryItemCount 재계산
    await this.recalculateDeliveryItemCount(productDetailId);
    await this.updateDeliveryType(productDetailId);
  }

  /**
   * 판매자: 배송 항목 순서 변경
   */
  async reorderDeliveryItems(
    sellerId: string,
    productDetailId: string,
    itemIds: string[],
  ): Promise<void> {
    await this.validateSellerOwnership(sellerId, productDetailId);

    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < itemIds.length; i++) {
        await manager.update(DeliveryItem, itemIds[i], { sortOrder: i });
      }
    });
  }

  /**
   * 구매자: 구매한 상품의 배송 항목 조회
   * Order 소유권 + PAID 상태 검증
   */
  async getDeliveryItemsForBuyer(
    buyerId: string,
    orderId: string,
  ): Promise<DeliveryItem[]> {
    const order = await this.orderRepository.findOne({
      where: { orderId, buyerId, status: OrderStatus.PAID },
    });

    if (!order) {
      throw new NotFoundException("구매 내역을 찾을 수 없습니다");
    }

    const productDetail = await this.productDetailRepository.findOne({
      where: { postId: order.productPostId },
    });

    if (!productDetail) {
      throw new NotFoundException("상품 정보를 찾을 수 없습니다");
    }

    return this.deliveryItemRepository.find({
      where: { productDetailId: productDetail.id, isActive: true },
      order: { sortOrder: "ASC" },
    });
  }

  /**
   * 상품의 배송 항목 조회 (소유자 또는 구매자용)
   */
  async getDeliveryItems(productDetailId: string): Promise<DeliveryItem[]> {
    return this.deliveryItemRepository.find({
      where: { productDetailId, isActive: true },
      order: { sortOrder: "ASC" },
    });
  }

  // ── Private ──

  private async validateSellerOwnership(
    sellerId: string,
    productDetailId: string,
  ): Promise<ProductDetail> {
    const productDetail = await this.productDetailRepository.findOne({
      where: { id: productDetailId },
      relations: ["post"],
    });

    if (!productDetail) {
      throw new NotFoundException("상품을 찾을 수 없습니다");
    }

    if (productDetail.post?.authorId !== sellerId) {
      throw new ForbiddenException("본인의 상품만 관리할 수 있습니다");
    }

    return productDetail;
  }

  private async findItemWithOwnershipCheck(
    sellerId: string,
    itemId: string,
  ): Promise<DeliveryItem> {
    const item = await this.deliveryItemRepository.findOne({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException("배송 항목을 찾을 수 없습니다");
    }

    await this.validateSellerOwnership(sellerId, item.productDetailId);
    return item;
  }

  private async recalculateDeliveryItemCount(
    productDetailId: string,
  ): Promise<void> {
    const count = await this.deliveryItemRepository.count({
      where: { productDetailId, isActive: true },
    });
    await this.productDetailRepository.update(productDetailId, {
      deliveryItemCount: count,
    });
  }

  /** deliveryType 자동 판별: content/file/mixed */
  private async updateDeliveryType(productDetailId: string): Promise<void> {
    const items = await this.deliveryItemRepository.find({
      where: { productDetailId, isActive: true },
      select: ["type"],
    });

    const types = new Set(items.map((i) => i.type));
    let deliveryType: "content" | "file" | "mixed" = "content";

    if (types.has("file") && (types.has("content_html") || types.has("external_link"))) {
      deliveryType = "mixed";
    } else if (types.has("file")) {
      deliveryType = "file";
    }

    await this.productDetailRepository.update(productDetailId, { deliveryType });
  }
}
