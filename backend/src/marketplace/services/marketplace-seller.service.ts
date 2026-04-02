import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Order } from "../entities/order.entity";
import { ProductDetail } from "../entities/product-detail.entity";
import { Post } from "../../posts/entities/post.entity";
import { RefundRequest } from "../entities/refund-request.entity";
import { OrderStatus } from "../../common/enums/order-status.enum";
import { RefundStatus } from "../entities/refund-request.entity";

/**
 * 판매자 대시보드 서비스
 * 매출 요약, 주문 목록, 상품 관리
 */
@Injectable()
export class MarketplaceSellerService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(ProductDetail)
    private readonly productDetailRepository: Repository<ProductDetail>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(RefundRequest)
    private readonly refundRequestRepository: Repository<RefundRequest>,
  ) {}

  /**
   * 판매자 대시보드 요약
   * 최소 쿼리: 집계는 원자적 SQL로 한 번에 조회
   */
  async getDashboard(sellerId: string) {
    // 1. 매출 요약 (단일 집계 쿼리)
    const salesSummary = await this.orderRepository
      .createQueryBuilder("o")
      .select("COUNT(*)", "totalOrders")
      .addSelect("COALESCE(SUM(o.amount), 0)", "totalRevenue")
      .addSelect("COALESCE(SUM(o.platformFee), 0)", "totalPlatformFee")
      .addSelect("COALESCE(SUM(o.sellerRevenue), 0)", "totalSellerRevenue")
      .where("o.sellerId = :sellerId", { sellerId })
      .andWhere("o.status = :status", { status: OrderStatus.PAID })
      .getRawOne();

    // 2. 이번 달 매출 (별도 쿼리 — 기간 필터)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlySummary = await this.orderRepository
      .createQueryBuilder("o")
      .select("COUNT(*)", "monthlyOrders")
      .addSelect("COALESCE(SUM(o.sellerRevenue), 0)", "monthlyRevenue")
      .where("o.sellerId = :sellerId", { sellerId })
      .andWhere("o.status = :status", { status: OrderStatus.PAID })
      .andWhere("o.createdAt >= :startOfMonth", { startOfMonth })
      .getRawOne();

    // 3. 상품 수
    const productCount = await this.postRepository.count({
      where: {
        authorId: sellerId,
        postType: "product" as any,
        isPublished: true,
        isDeleted: false,
      },
    });

    // 4. 대기 중인 환불 요청 수
    const pendingRefunds = await this.refundRequestRepository.count({
      where: {
        sellerId,
        status: RefundStatus.PENDING as any,
      },
    });

    return {
      totalOrders: Number(salesSummary.totalOrders),
      totalRevenue: Number(salesSummary.totalRevenue),
      totalPlatformFee: Number(salesSummary.totalPlatformFee),
      totalSellerRevenue: Number(salesSummary.totalSellerRevenue),
      monthlyOrders: Number(monthlySummary.monthlyOrders),
      monthlyRevenue: Number(monthlySummary.monthlyRevenue),
      productCount,
      pendingRefunds,
    };
  }

  /**
   * 판매자 주문 목록
   * 최소 JOIN: 구매자 username + 상품 제목만
   */
  async getSellerOrders(sellerId: string, limit = 20, cursor?: string) {
    const qb = this.orderRepository
      .createQueryBuilder("o")
      .leftJoin("o.buyer", "buyer")
      .addSelect(["buyer.id", "buyer.username"])
      .leftJoin("o.productPost", "p")
      .addSelect(["p.id", "p.title", "p.slug"])
      .where("o.sellerId = :sellerId", { sellerId })
      .orderBy("o.createdAt", "DESC")
      .take(limit + 1);

    if (cursor) {
      qb.andWhere("o.createdAt < :cursor", { cursor: new Date(cursor) });
    }

    const orders = await qb.getMany();
    const hasMore = orders.length > limit;
    if (hasMore) orders.pop();

    return {
      orders,
      nextCursor: hasMore && orders.length > 0
        ? orders[orders.length - 1].createdAt.toISOString()
        : null,
      hasMore,
    };
  }

  /**
   * 판매자 상품 목록
   */
  async getSellerProducts(sellerId: string) {
    return this.postRepository
      .createQueryBuilder("p")
      .innerJoinAndSelect("p.productDetail", "pd")
      .where("p.authorId = :sellerId", { sellerId })
      .andWhere("p.postType = :type", { type: "product" })
      .andWhere("p.isDeleted = false")
      .orderBy("p.createdAt", "DESC")
      .getMany();
  }

  /**
   * 상품 판매 중지/재개
   */
  async toggleProductActive(sellerId: string, postId: string) {
    const product = await this.postRepository.findOne({
      where: { id: postId, authorId: sellerId, postType: "product" as any },
      relations: ["productDetail"],
    });

    if (!product?.productDetail) {
      throw new Error("상품을 찾을 수 없습니다");
    }

    const newActive = !product.productDetail.isActive;
    await this.productDetailRepository.update(
      { postId },
      { isActive: newActive },
    );

    return { isActive: newActive };
  }
}
