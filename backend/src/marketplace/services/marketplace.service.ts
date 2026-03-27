import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Post } from "../../posts/entities/post.entity";
import { ProductDetail } from "../entities/product-detail.entity";
import { DeliveryItem } from "../entities/delivery-item.entity";
import { Order } from "../entities/order.entity";
import { BrowseMarketplaceDto } from "../dto/browse-marketplace.dto";
import { OrderStatus } from "../../common/enums/order-status.enum";
import { RefundRequest } from "../entities/refund-request.entity";
import {
  ProductCategory,
  ProductCategoryLabel,
} from "../../common/enums/product-category.enum";
import {
  extractPreviewContent,
  extractTableOfContents,
} from "../utils/preview-extractor";

/**
 * 마켓플레이스 서비스
 *
 * 상품 목록 조회, 검색, 필터링 담당
 * 성능 최적화: QueryBuilder로 필요한 컬럼만 SELECT, N+1 방지
 */
@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(ProductDetail)
    private readonly productDetailRepository: Repository<ProductDetail>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(RefundRequest)
    private readonly refundRequestRepository: Repository<RefundRequest>,
    @InjectRepository(DeliveryItem)
    private readonly deliveryItemRepository: Repository<DeliveryItem>,
  ) {}

  /**
   * 마켓플레이스 상품 목록 조회
   *
   * 최적화 포인트:
   * - posts + product_details만 INNER JOIN (author는 id+username만 LEFT JOIN)
   * - Partial Index 활용: postType='product' 조건
   * - cursor 기반 페이지네이션 (offset 없이 성능 보장)
   */
  async browse(dto: BrowseMarketplaceDto) {
    const { limit = 20, category, search, sort, priceMin, priceMax, cursor } = dto;

    const qb = this.postRepository
      .createQueryBuilder("p")
      .innerJoinAndSelect("p.productDetail", "pd")
      .leftJoin("p.author", "a")
      .addSelect(["a.id", "a.username"])
      .where("p.postType = :type", { type: "product" })
      .andWhere("p.isPublished = true")
      .andWhere("p.isDeleted = false")
      .andWhere("pd.isActive = true");

    // 카테고리 필터
    if (category) {
      qb.andWhere("pd.productCategory = :category", { category });
    }

    // 가격 범위 필터
    if (priceMin !== undefined) {
      qb.andWhere("pd.price >= :priceMin", { priceMin });
    }
    if (priceMax !== undefined) {
      qb.andWhere("pd.price <= :priceMax", { priceMax });
    }

    // 검색 (제목 + excerpt)
    if (search) {
      qb.andWhere("(p.title ILIKE :search OR p.excerpt ILIKE :search)", {
        search: `%${search}%`,
      });
    }

    // cursor 페이지네이션
    if (cursor) {
      qb.andWhere("p.createdAt < :cursor", { cursor: new Date(cursor) });
    }

    // 정렬
    switch (sort) {
      case "popular":
        qb.orderBy("pd.salesCount", "DESC").addOrderBy("p.createdAt", "DESC");
        break;
      case "price_low":
        qb.orderBy("pd.price", "ASC").addOrderBy("p.createdAt", "DESC");
        break;
      case "price_high":
        qb.orderBy("pd.price", "DESC").addOrderBy("p.createdAt", "DESC");
        break;
      default: // recent
        qb.orderBy("p.createdAt", "DESC");
    }

    qb.take(limit + 1); // +1로 다음 페이지 존재 여부 확인

    const products = await qb.getMany();
    const hasMore = products.length > limit;
    if (hasMore) products.pop();

    const nextCursor =
      hasMore && products.length > 0
        ? products[products.length - 1].createdAt.toISOString()
        : null;

    return {
      products: products.map((p) => this.toListResponse(p)),
      nextCursor,
      hasMore,
    };
  }

  /**
   * 카테고리별 상품 수 조회 (Redis 캐시 권장 — 여기서는 DB 직접 조회)
   */
  async getCategoryCounts(): Promise<
    Array<{ category: ProductCategory; label: string; count: number }>
  > {
    const counts = await this.productDetailRepository
      .createQueryBuilder("pd")
      .select("pd.productCategory", "category")
      .addSelect("COUNT(*)", "count")
      .innerJoin("pd.post", "p")
      .where("pd.isActive = true")
      .andWhere("p.isPublished = true")
      .andWhere("p.isDeleted = false")
      .andWhere("p.postType = :type", { type: "product" })
      .groupBy("pd.productCategory")
      .getRawMany();

    return counts.map((c) => ({
      category: c.category as ProductCategory,
      label: ProductCategoryLabel[c.category as ProductCategory] || c.category,
      count: Number(c.count),
    }));
  }

  /**
   * 상품 상세 조회
   * - 미구매 시: previewContent만 반환 (본문은 게이팅)
   * - 구매 완료 시: 전체 본문 + 다운로드 URL 반환
   */
  async getProductDetail(slug: string, userId?: string) {
    const product = await this.postRepository
      .createQueryBuilder("p")
      .innerJoinAndSelect("p.productDetail", "pd")
      .leftJoinAndSelect("p.author", "a")
      .leftJoin("a.profile", "profile")
      .addSelect(["profile.profileImage", "profile.bio"])
      .leftJoinAndSelect("p.blog", "b")
      .where("p.slug = :slug", { slug })
      .andWhere("p.postType = :type", { type: "product" })
      .andWhere("p.isDeleted = false")
      .getOne();

    if (!product) {
      throw new NotFoundException("상품을 찾을 수 없습니다");
    }

    // 구매 여부 확인 + 환불에 필요한 orderId 함께 조회
    let hasPurchased = false;
    let purchaseOrderId: string | null = null;
    if (userId) {
      const order = await this.orderRepository.findOne({
        where: {
          buyerId: userId,
          productPostId: product.id,
          status: OrderStatus.PAID,
        },
        select: ["id", "orderId"],
      });
      hasPurchased = !!order;
      purchaseOrderId = order?.orderId || null;
    }

    // 환불 요청 상태 확인
    let refundStatus: string | null = null;
    if (hasPurchased && userId && purchaseOrderId) {
      const refundReq = await this.refundRequestRepository.findOne({
        where: { buyerId: userId },
        select: ["status"],
        order: { createdAt: "DESC" },
      });
      refundStatus = refundReq?.status || null;
    }

    // 환불 완료 시 hasPurchased를 false로 (재구매 가능하도록)
    if (refundStatus === 'processed') {
      // Order가 REFUNDED 상태이므로 hasPurchased는 이미 false일 수 있지만 명시적으로
      hasPurchased = false;
      refundStatus = null; // 환불 완료 후에는 재구매 가능 상태
    }

    // 본인 상품인지 확인
    const isOwner = userId === product.authorId;

    // 구매자가 전문 콘텐츠를 열람하면 contentAccessed 플래그 동기 기록 (환불 자격 검증용)
    // 반드시 콘텐츠 반환 전에 완료 — 비동기 시 환불 레이스 컨디션 발생
    if (hasPurchased && !isOwner && userId) {
      try {
        await this.orderRepository
          .createQueryBuilder()
          .update()
          .set({
            metadata: () =>
              `COALESCE(metadata, '{}'::jsonb) || '{"contentAccessed": true}'::jsonb`,
          })
          .where('"buyerId" = :buyerId', { buyerId: userId })
          .andWhere('"productPostId" = :productPostId', {
            productPostId: product.id,
          })
          .andWhere("status = :status", { status: OrderStatus.PAID })
          .execute();
      } catch {
        // 열람 추적 실패는 무시 — 상품 조회를 방해하지 않음
      }
    }

    // 미리보기 콘텐츠 결정 (우선순위: previewContent > preview-end 파싱 > 앞 30% 추출)
    const previewContent = product.productDetail?.previewContent
      || extractPreviewContent(product.content)
      || null;

    // 목차 추출 (구매 전에도 전체 구성 파악 가능)
    const tableOfContents = extractTableOfContents(product.content);

    // 3-Layer 콘텐츠 모델:
    //   Layer 1 (공개): descriptionHtml (없으면 Post.content 폴백)
    //   Layer 2 (미리보기): previewContent
    //   Layer 3 (구매자 전용): DeliveryItem[]
    const descriptionHtml =
      product.productDetail?.descriptionHtml || product.content;

    // 구매자/소유자에게만 배송 항목 반환
    let deliveryItems: DeliveryItem[] | undefined;
    if (hasPurchased || isOwner) {
      deliveryItems = await this.deliveryItemRepository.find({
        where: { productDetailId: product.productDetail.id, isActive: true },
        order: { sortOrder: "ASC" },
      });
    }

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      excerpt: product.excerpt,
      // 공개 마케팅 설명 (모든 사용자에게 표시)
      descriptionHtml,
      // 하위 호환: 기존 content 필드 유지
      content: hasPurchased || isOwner
        ? product.content
        : previewContent,
      isFullContent: hasPurchased || isOwner,
      tableOfContents,
      thumbnailImageId: product.thumbnailImageId,
      createdAt: product.createdAt,
      author: product.author
        ? {
            id: product.author.id,
            username: product.author.username,
          }
        : null,
      blog: product.blog
        ? { id: product.blog.id, slug: product.blog.slug, alias: product.blog.alias }
        : null,
      productDetail: {
        price: product.productDetail.price,
        currency: product.productDetail.currency,
        productCategory: product.productDetail.productCategory,
        categoryLabel:
          ProductCategoryLabel[product.productDetail.productCategory] ||
          product.productDetail.productCategory,
        salesCount: product.productDetail.salesCount,
        deliveryType: product.productDetail.deliveryType,
        deliveryItemCount: product.productDetail.deliveryItemCount || 0,
        digitalDeliveryUrl:
          hasPurchased || isOwner
            ? product.productDetail.digitalDeliveryUrl
            : null,
        isActive: product.productDetail.isActive,
      },
      // 구매자/소유자 전용: 배송 항목
      deliveryItems,
      hasPurchased,
      orderId: hasPurchased ? purchaseOrderId : null,
      isOwner,
      refundStatus,
    };
  }

  /**
   * 구매한 상품 ID 목록 조회 (bulk — N+1 방지)
   */
  async getPurchasedProductIds(
    buyerId: string,
    productPostIds: string[],
  ): Promise<Set<string>> {
    if (!productPostIds.length) return new Set();

    const orders = await this.orderRepository.find({
      where: {
        buyerId,
        productPostId: In(productPostIds),
        status: OrderStatus.PAID,
      },
      select: ["productPostId"],
    });

    return new Set(orders.map((o) => o.productPostId));
  }

  /** 목록 응답 형태로 변환 (최소 필드만) */
  private toListResponse(post: Post) {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      thumbnailImageId: post.thumbnailImageId,
      createdAt: post.createdAt,
      author: post.author
        ? { id: post.author.id, username: post.author.username }
        : null,
      productDetail: post.productDetail
        ? {
            price: post.productDetail.price,
            currency: post.productDetail.currency,
            productCategory: post.productDetail.productCategory,
            categoryLabel:
              ProductCategoryLabel[post.productDetail.productCategory] ||
              post.productDetail.productCategory,
            salesCount: post.productDetail.salesCount,
          }
        : null,
    };
  }
}
