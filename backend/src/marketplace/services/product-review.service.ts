import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { ProductReview } from "../entities/product-review.entity";
import { ProductDetail } from "../entities/product-detail.entity";
import { Order } from "../entities/order.entity";
import { OrderStatus } from "../../common/enums/order-status.enum";

/**
 * 상품 리뷰 서비스
 *
 * - 구매 확인 후에만 리뷰 작성 가능
 * - 구매자당 상품 1리뷰 제한
 * - 리뷰 생성/수정/삭제 시 ProductDetail.averageRating, reviewCount 재계산
 */
@Injectable()
export class ProductReviewService {
  private readonly logger = new Logger(ProductReviewService.name);

  constructor(
    @InjectRepository(ProductReview)
    private readonly reviewRepository: Repository<ProductReview>,
    @InjectRepository(ProductDetail)
    private readonly productDetailRepository: Repository<ProductDetail>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 리뷰 작성 (구매 인증 필수)
   */
  async createReview(
    buyerId: string,
    dto: {
      productPostId: string;
      orderId: string;
      rating: number;
      content?: string;
      images?: { fileKey: string; fileName: string }[];
    },
  ): Promise<ProductReview> {
    // 평점 범위 검증
    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException("평점은 1~5 사이여야 합니다");
    }

    // 콘텐츠 길이 제한
    if (dto.content && dto.content.length > 2000) {
      throw new BadRequestException("리뷰는 2000자를 초과할 수 없습니다");
    }

    // 구매 확인
    const order = await this.orderRepository.findOne({
      where: {
        orderId: dto.orderId,
        buyerId,
        productPostId: dto.productPostId,
        status: OrderStatus.PAID,
      },
    });

    if (!order) {
      throw new ForbiddenException("구매 확인된 상품에만 리뷰를 작성할 수 있습니다");
    }

    // 자기 상품 리뷰 방지
    if (order.sellerId === buyerId) {
      throw new ForbiddenException("본인 상품에는 리뷰를 작성할 수 없습니다");
    }

    // 중복 리뷰 확인
    const existing = await this.reviewRepository.findOne({
      where: { productPostId: dto.productPostId, buyerId },
    });

    if (existing) {
      throw new ConflictException("이미 이 상품에 리뷰를 작성했습니다");
    }

    const review = this.reviewRepository.create({
      productPostId: dto.productPostId,
      buyerId,
      orderId: dto.orderId,
      rating: dto.rating,
      content: dto.content || null,
      images: dto.images || [],
      isVerifiedPurchase: true,
    });

    const saved = await this.reviewRepository.save(review);

    // 역정규화 평점 재계산
    await this.recalculateProductRating(dto.productPostId);

    this.logger.log(
      `리뷰 생성: productPostId=${dto.productPostId}, rating=${dto.rating}, buyer=${buyerId.substring(0, 8)}...`,
    );

    return saved;
  }

  /**
   * 리뷰 수정
   */
  async updateReview(
    buyerId: string,
    reviewId: string,
    dto: { rating?: number; content?: string },
  ): Promise<ProductReview> {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId, buyerId },
    });

    if (!review) {
      throw new NotFoundException("리뷰를 찾을 수 없습니다");
    }

    if (dto.rating !== undefined) {
      if (dto.rating < 1 || dto.rating > 5) {
        throw new BadRequestException("평점은 1~5 사이여야 합니다");
      }
      review.rating = dto.rating;
    }

    if (dto.content !== undefined) {
      if (dto.content.length > 2000) {
        throw new BadRequestException("리뷰는 2000자를 초과할 수 없습니다");
      }
      review.content = dto.content;
    }

    review.metadata = {
      ...((review.metadata as Record<string, unknown>) || {}),
      editedAt: new Date().toISOString(),
      editCount:
        (((review.metadata as Record<string, unknown>)?.editCount as number) || 0) + 1,
    };

    const saved = await this.reviewRepository.save(review);
    await this.recalculateProductRating(review.productPostId);

    return saved;
  }

  /**
   * 판매자: 리뷰에 응답
   */
  async respondToReview(
    sellerId: string,
    reviewId: string,
    response: string,
  ): Promise<ProductReview> {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId },
      relations: ["order"],
    });

    if (!review) {
      throw new NotFoundException("리뷰를 찾을 수 없습니다");
    }

    if (review.order?.sellerId !== sellerId) {
      throw new ForbiddenException("본인 상품의 리뷰에만 응답할 수 있습니다");
    }

    review.sellerResponse = response;
    review.sellerRespondedAt = new Date();

    return this.reviewRepository.save(review);
  }

  /**
   * 상품 리뷰 목록 (공개, 커서 페이지네이션)
   */
  async getProductReviews(
    productPostId: string,
    cursor?: string,
    limit: number = 10,
  ): Promise<{
    reviews: ProductReview[];
    summary: {
      averageRating: number;
      reviewCount: number;
      ratingDistribution: Record<number, number>;
    };
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const qb = this.reviewRepository
      .createQueryBuilder("r")
      .leftJoin("r.buyer", "buyer")
      .addSelect(["buyer.id", "buyer.username"])
      .where("r.productPostId = :productPostId", { productPostId })
      .andWhere("r.isHidden = false")
      .orderBy("r.createdAt", "DESC")
      .take(limit + 1);

    if (cursor) {
      qb.andWhere("r.createdAt < :cursor", { cursor: new Date(cursor) });
    }

    const reviews = await qb.getMany();
    const hasMore = reviews.length > limit;
    if (hasMore) reviews.pop();

    // 평점 분포 집계
    const distribution = await this.reviewRepository
      .createQueryBuilder("r")
      .select("r.rating", "rating")
      .addSelect("COUNT(*)", "count")
      .where("r.productPostId = :productPostId", { productPostId })
      .andWhere("r.isHidden = false")
      .groupBy("r.rating")
      .getRawMany<{ rating: number; count: string }>();

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;
    let totalCount = 0;
    for (const d of distribution) {
      const count = parseInt(d.count, 10);
      ratingDistribution[d.rating] = count;
      totalRating += d.rating * count;
      totalCount += count;
    }

    return {
      reviews,
      summary: {
        averageRating: totalCount > 0 ? Math.round((totalRating / totalCount) * 100) / 100 : 0,
        reviewCount: totalCount,
        ratingDistribution,
      },
      nextCursor: hasMore && reviews.length > 0
        ? reviews[reviews.length - 1].createdAt.toISOString()
        : null,
      hasMore,
    };
  }

  /**
   * 관리자: 리뷰 숨김
   */
  async hideReview(reviewId: string, reason: string): Promise<void> {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException("리뷰를 찾을 수 없습니다");

    review.isHidden = true;
    review.hiddenReason = reason;
    await this.reviewRepository.save(review);

    await this.recalculateProductRating(review.productPostId);
  }

  /**
   * 역정규화 평점 재계산
   * AVG + COUNT를 ProductDetail에 반영
   */
  private async recalculateProductRating(
    productPostId: string,
  ): Promise<void> {
    const result = await this.reviewRepository
      .createQueryBuilder("r")
      .select("AVG(r.rating)", "avg")
      .addSelect("COUNT(*)", "count")
      .where("r.productPostId = :productPostId", { productPostId })
      .andWhere("r.isHidden = false")
      .getRawOne<{ avg: string | null; count: string }>();

    const avgRating = result?.avg ? parseFloat(result.avg) : 0;
    const reviewCount = result?.count ? parseInt(result.count, 10) : 0;

    await this.productDetailRepository.update(
      { postId: productPostId },
      {
        averageRating: Math.round(avgRating * 100) / 100,
        reviewCount,
      },
    );
  }
}
