import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Post } from "../../posts/entities/post.entity";
import { ProductDetail } from "../../marketplace/entities/product-detail.entity";
import { Order } from "../../marketplace/entities/order.entity";
import {
  RefundRequest,
  RefundStatus,
} from "../../marketplace/entities/refund-request.entity";
import { OrderStatus } from "../../common/enums/order-status.enum";
import { TossApiClient } from "../../payment/providers/toss-api.client";

/**
 * 관리자 마켓플레이스 서비스
 * 플랫폼 전체 거래 관제, 상품 관리, 환불 강제 처리
 */
@Injectable()
export class AdminMarketplaceService {
  private readonly logger = new Logger(AdminMarketplaceService.name);

  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(ProductDetail)
    private readonly productDetailRepository: Repository<ProductDetail>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(RefundRequest)
    private readonly refundRequestRepository: Repository<RefundRequest>,
    private readonly tossApiClient: TossApiClient,
  ) {}

  /**
   * 플랫폼 전체 통계 — 서브쿼리로 한 번에 집계
   */
  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [stats] = await this.orderRepository.query(`
      SELECT
        (SELECT COUNT(*) FROM product_details) as "totalProducts",
        (SELECT COUNT(*) FROM product_details WHERE "isActive" = true) as "activeProducts",
        (SELECT COUNT(*) FROM orders WHERE status = 'paid') as "totalOrders",
        (SELECT COALESCE(SUM(amount), 0) FROM orders WHERE status = 'paid') as "totalRevenue",
        (SELECT COALESCE(SUM("platformFee"), 0) FROM orders WHERE status = 'paid') as "platformRevenue",
        (SELECT COUNT(DISTINCT "sellerId") FROM orders WHERE status = 'paid') as "totalSellers",
        (SELECT COUNT(*) FROM refund_requests WHERE status = 'pending') as "pendingRefunds",
        (SELECT COUNT(*) FROM refund_requests WHERE status = 'pending' AND metadata->>'escalated' = 'true') as "escalatedRefunds",
        (SELECT COUNT(*) FROM orders WHERE status = 'paid' AND "createdAt" >= $1) as "todayOrders",
        (SELECT COALESCE(SUM(amount), 0) FROM orders WHERE status = 'paid' AND "createdAt" >= $1) as "todayRevenue"
    `, [today]);

    return {
      totalProducts: Number(stats.totalProducts),
      activeProducts: Number(stats.activeProducts),
      totalOrders: Number(stats.totalOrders),
      totalRevenue: Number(stats.totalRevenue),
      platformRevenue: Number(stats.platformRevenue),
      totalSellers: Number(stats.totalSellers),
      pendingRefunds: Number(stats.pendingRefunds),
      escalatedRefunds: Number(stats.escalatedRefunds),
      todayOrders: Number(stats.todayOrders),
      todayRevenue: Number(stats.todayRevenue),
    };
  }

  /**
   * 매출 트렌드 — 기간별 집계
   */
  async getAnalytics(days = 30) {
    const result = await this.orderRepository.query(
      `
      SELECT
        DATE("createdAt") as date,
        COUNT(*)::int as orders,
        COALESCE(SUM(amount), 0)::int as revenue,
        COALESCE(SUM("platformFee"), 0)::int as "platformFee"
      FROM orders
      WHERE status = 'paid'
        AND "createdAt" >= NOW() - $1::int * INTERVAL '1 day'
      GROUP BY DATE("createdAt")
      ORDER BY date
      `,
      [days],
    );
    return result;
  }

  /**
   * 전체 상품 목록
   */
  async getProducts(params: {
    category?: string;
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const qb = this.postRepository
      .createQueryBuilder("p")
      .innerJoinAndSelect("p.productDetail", "pd")
      .leftJoin("p.author", "a")
      .addSelect(["a.id", "a.username", "a.email"])
      .where("p.postType = :type", { type: "product" })
      .andWhere("p.isDeleted = false");

    if (params.category) {
      qb.andWhere("pd.productCategory = :category", {
        category: params.category,
      });
    }
    if (params.isActive !== undefined) {
      qb.andWhere("pd.isActive = :isActive", { isActive: params.isActive });
    }
    if (params.search) {
      qb.andWhere("p.title ILIKE :search", { search: `%${params.search}%` });
    }

    const [products, total] = await qb
      .orderBy("p.createdAt", "DESC")
      .take(params.limit || 20)
      .skip(params.offset || 0)
      .getManyAndCount();

    return { products, total };
  }

  /**
   * 상품 강제 활성화/비활성화
   */
  async forceToggleProduct(
    postId: string,
    isActive: boolean,
    reason: string,
  ) {
    const pd = await this.productDetailRepository.findOne({
      where: { postId },
    });
    if (!pd) throw new NotFoundException("상품을 찾을 수 없습니다");

    pd.isActive = isActive;
    pd.metadata = {
      ...pd.metadata,
      adminAction: { isActive, reason, at: new Date().toISOString() },
    };
    await this.productDetailRepository.save(pd);

    this.logger.log(
      `관리자 상품 상태 변경: postId=${postId}, isActive=${isActive}, reason=${reason}`,
    );
    return pd;
  }

  /**
   * 전체 주문 목록
   */
  async getOrders(params: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const qb = this.orderRepository
      .createQueryBuilder("o")
      .leftJoin("o.buyer", "buyer")
      .addSelect(["buyer.id", "buyer.username", "buyer.email"])
      .leftJoin("o.seller", "seller")
      .addSelect(["seller.id", "seller.username"])
      .leftJoin("o.productPost", "p")
      .addSelect(["p.id", "p.title", "p.slug"]);

    if (params.status) {
      qb.andWhere("o.status = :status", { status: params.status });
    }
    if (params.search) {
      qb.andWhere(
        "(o.orderId ILIKE :search OR p.title ILIKE :search OR buyer.username ILIKE :search)",
        { search: `%${params.search}%` },
      );
    }

    const [orders, total] = await qb
      .orderBy("o.createdAt", "DESC")
      .take(params.limit || 20)
      .skip(params.offset || 0)
      .getManyAndCount();

    return { orders, total };
  }

  /**
   * 환불 요청 목록 (에스컬레이션 포함)
   */
  async getRefundRequests(params: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const qb = this.refundRequestRepository
      .createQueryBuilder("r")
      .leftJoinAndSelect("r.order", "o")
      .leftJoin("r.buyer", "buyer")
      .addSelect(["buyer.id", "buyer.username"])
      .leftJoin("r.seller", "seller")
      .addSelect(["seller.id", "seller.username"]);

    if (params.status) {
      qb.andWhere("r.status = :status", { status: params.status });
    }

    const [requests, total] = await qb
      .orderBy("r.createdAt", "DESC")
      .take(params.limit || 20)
      .skip(params.offset || 0)
      .getManyAndCount();

    return { requests, total };
  }

  /**
   * 관리자 강제 환불 승인
   */
  async forceApproveRefund(refundRequestId: string, adminId: string) {
    const request = await this.refundRequestRepository.findOne({
      where: { id: refundRequestId },
    });
    if (!request) throw new NotFoundException("환불 요청을 찾을 수 없습니다");

    const order = await this.orderRepository.findOne({
      where: { id: request.orderId },
    });
    if (!order?.paymentKey) {
      throw new BadRequestException("결제 정보를 찾을 수 없습니다");
    }

    // 토스 환불 처리
    await this.tossApiClient.cancelPayment(
      order.paymentKey,
      `관리자 강제 환불: ${request.reason}`,
      order.amount,
    );

    // Order 상태 업데이트
    order.status = OrderStatus.REFUNDED;
    order.refundedAt = new Date();
    order.refundReason = `관리자 강제 환불 (${request.reason})`;
    await this.orderRepository.save(order);

    // salesCount, totalRevenue 원자적 차감
    await this.productDetailRepository
      .createQueryBuilder()
      .update()
      .set({
        salesCount: () => 'GREATEST("salesCount" - 1, 0)',
        totalRevenue: () => `GREATEST("totalRevenue" - ${order.amount}, 0)`,
      })
      .where("postId = :postId", { postId: order.productPostId })
      .execute();

    // RefundRequest 업데이트
    request.status = RefundStatus.PROCESSED;
    request.processedAt = new Date();
    request.metadata = {
      ...request.metadata,
      forcedByAdmin: adminId,
    };
    await this.refundRequestRepository.save(request);

    this.logger.log(
      `관리자 강제 환불 처리: requestId=${refundRequestId}, adminId=${adminId}`,
    );
    return { request, order };
  }

  /**
   * 관리자 강제 환불 거부
   */
  async forceRejectRefund(
    refundRequestId: string,
    adminId: string,
    reason: string,
  ) {
    const request = await this.refundRequestRepository.findOne({
      where: { id: refundRequestId },
    });
    if (!request) throw new NotFoundException("환불 요청을 찾을 수 없습니다");

    request.status = RefundStatus.REJECTED;
    request.sellerResponse = `관리자 거부: ${reason}`;
    request.respondedAt = new Date();
    request.metadata = {
      ...request.metadata,
      rejectedByAdmin: adminId,
      adminRejectReason: reason,
    };
    await this.refundRequestRepository.save(request);

    return request;
  }

  /**
   * 판매자 목록 + 매출 순위
   */
  async getSellers(limit = 20) {
    const sellers = await this.orderRepository.query(
      `
      SELECT
        u.id,
        u.username,
        u.email,
        COUNT(DISTINCT o.id)::int as "orderCount",
        COUNT(DISTINCT pd."postId")::int as "productCount",
        COALESCE(SUM(o.amount), 0)::int as "totalRevenue",
        COALESCE(SUM(o."sellerRevenue"), 0)::int as "totalSellerRevenue"
      FROM orders o
      INNER JOIN users u ON u.id = o."sellerId"
      LEFT JOIN product_details pd ON pd."postId" = o."productPostId"
      WHERE o.status = 'paid'
      GROUP BY u.id, u.username, u.email
      ORDER BY "totalRevenue" DESC
      LIMIT $1
      `,
      [limit],
    );
    return sellers;
  }
}
