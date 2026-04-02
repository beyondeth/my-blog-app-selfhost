import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Order } from "../entities/order.entity";
import { ProductDetail } from "../entities/product-detail.entity";
import {
  RefundRequest,
  RefundStatus,
  RefundReasonCategory,
} from "../entities/refund-request.entity";
import { TossApiClient } from "../../payment/providers/toss-api.client";
import { OrderStatus } from "../../common/enums/order-status.enum";

/** 환불 가능 기간 (일) */
const REFUND_WINDOW_DAYS = 7;
/** 판매자 응답 대기 시간 (일) — 초과 시 고객센터 에스컬레이션 */
const SELLER_RESPONSE_DAYS = 7;

/**
 * 마켓플레이스 환불 서비스
 *
 * 전자상거래법 17조 준수:
 * - 디지털 콘텐츠 열람 후 환불 불가
 * - 미리보기 제공 의무 (이미 구현)
 * - 환불 처리 3영업일 이내
 */
@Injectable()
export class MarketplaceRefundService {
  private readonly logger = new Logger(MarketplaceRefundService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(ProductDetail)
    private readonly productDetailRepository: Repository<ProductDetail>,
    @InjectRepository(RefundRequest)
    private readonly refundRequestRepository: Repository<RefundRequest>,
    private readonly tossApiClient: TossApiClient,
  ) {}

  /**
   * 환불 자격 자동 검증
   */
  async validateRefundEligibility(orderIdOrProductPostId: string, buyerId: string) {
    // orderId 또는 productPostId 어느 것으로든 조회 가능
    let order = await this.orderRepository.findOne({
      where: { orderId: orderIdOrProductPostId, buyerId },
    });
    if (!order) {
      order = await this.orderRepository.findOne({
        where: { productPostId: orderIdOrProductPostId, buyerId },
      });
    }

    if (!order) {
      throw new NotFoundException("주문을 찾을 수 없습니다");
    }

    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException("결제 완료된 주문만 환불할 수 있습니다");
    }

    const reasons: string[] = [];
    const metadata = (order.metadata || {}) as Record<string, any>;

    // 기간 확인 (구매 후 7일 — 날짜 기반 정확한 계산)
    const purchaseDate = new Date(order.createdAt);
    const refundDeadline = new Date(purchaseDate);
    refundDeadline.setDate(refundDeadline.getDate() + REFUND_WINDOW_DAYS);
    const isExpired = Date.now() > refundDeadline.getTime();
    const daysSincePurchase = Math.ceil(
      (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (isExpired) {
      reasons.push(`구매 후 ${REFUND_WINDOW_DAYS}일이 경과하여 환불 기간이 만료되었습니다`);
    }

    // 콘텐츠 열람 확인
    const contentAccessed = !!metadata.contentAccessed;
    if (contentAccessed) {
      reasons.push("전체 콘텐츠를 이미 열람하여 환불이 불가합니다 (전자상거래법 17조)");
    }

    // 파일 다운로드 확인
    const downloadCount = metadata.downloadCount || 0;
    if (downloadCount > 0) {
      reasons.push("디지털 파일을 이미 다운로드하여 환불이 불가합니다");
    }

    // 중복 환불 요청 확인
    const existingRequest = await this.refundRequestRepository.findOne({
      where: { orderId: order.id },
    });
    if (existingRequest) {
      reasons.push("이미 환불 요청이 접수되어 있습니다");
    }

    return {
      eligible: reasons.length === 0,
      reasons,
      contentAccessed,
      downloadCount,
      daysSincePurchase,
    };
  }

  /**
   * 환불 요청 생성
   */
  async requestRefund(
    buyerId: string,
    orderId: string,
    reason: string,
    reasonCategory: RefundReasonCategory,
  ) {
    // 자격 검증
    const eligibility = await this.validateRefundEligibility(orderId, buyerId);

    // 상품 결함/허위 표시는 법적으로 환불 의무 → 자격 검증 우회
    const isForcedRefund =
      reasonCategory === RefundReasonCategory.PRODUCT_DEFECT ||
      reasonCategory === RefundReasonCategory.NOT_AS_DESCRIBED;

    if (!eligibility.eligible && !isForcedRefund) {
      throw new BadRequestException({
        message: "환불 자격이 충족되지 않습니다",
        reasons: eligibility.reasons,
      });
    }

    // 주문 조회 (orderId 또는 productPostId)
    let order = await this.orderRepository.findOne({
      where: { orderId, buyerId },
    });
    if (!order) {
      order = await this.orderRepository.findOne({
        where: { productPostId: orderId, buyerId },
      });
    }
    if (!order) throw new NotFoundException("주문을 찾을 수 없습니다");

    // 환불 요청 생성
    try {
      const refundRequest = this.refundRequestRepository.create({
        orderId: order.id,
        buyerId,
        sellerId: order.sellerId,
        reason,
        reasonCategory,
        status: RefundStatus.PENDING,
        metadata: {
          eligibility,
          forcedRefund: isForcedRefund,
          orderAmount: order.amount,
        },
      });

      const saved = await this.refundRequestRepository.save(refundRequest);

      this.logger.log(
        `환불 요청 생성: requestId=${saved.id}, orderId=${orderId}, forced=${isForcedRefund}`,
      );

      return saved;
    } catch (error: any) {
      if (error?.code === "23505") {
        throw new ConflictException("이미 환불 요청이 접수되어 있습니다");
      }
      throw error;
    }
  }

  /**
   * 판매자 환불 승인
   */
  async approveRefund(refundRequestId: string, sellerId: string) {
    const request = await this.getRefundRequest(refundRequestId);

    if (request.sellerId !== sellerId) {
      throw new ForbiddenException("본인의 상품에 대한 환불 요청만 처리할 수 있습니다");
    }

    if (request.status === RefundStatus.ESCALATED) {
      throw new BadRequestException("관리자에게 에스컬레이션된 환불 요청입니다. 고객센터에 문의해주세요.");
    }
    if (request.status !== RefundStatus.PENDING) {
      throw new BadRequestException("대기 중인 환불 요청만 승인할 수 있습니다");
    }

    request.status = RefundStatus.APPROVED;
    request.respondedAt = new Date();
    await this.refundRequestRepository.save(request);

    // 즉시 환불 처리
    return this.processRefund(request);
  }

  /**
   * 판매자 환불 거부
   */
  async rejectRefund(
    refundRequestId: string,
    sellerId: string,
    response: string,
  ) {
    const request = await this.getRefundRequest(refundRequestId);

    if (request.sellerId !== sellerId) {
      throw new ForbiddenException("본인의 상품에 대한 환불 요청만 처리할 수 있습니다");
    }

    if (request.status === RefundStatus.ESCALATED) {
      throw new BadRequestException("관리자에게 에스컬레이션된 환불 요청입니다. 고객센터에 문의해주세요.");
    }
    if (request.status !== RefundStatus.PENDING) {
      throw new BadRequestException("대기 중인 환불 요청만 거부할 수 있습니다");
    }

    request.status = RefundStatus.REJECTED;
    request.sellerResponse = response;
    request.respondedAt = new Date();
    await this.refundRequestRepository.save(request);

    return request;
  }

  /**
   * 환불 처리 (토스 결제 취소 + DB 업데이트)
   */
  private async processRefund(request: RefundRequest) {
    const order = await this.orderRepository.findOne({
      where: { id: request.orderId },
    });

    if (!order || !order.paymentKey) {
      throw new BadRequestException("결제 정보를 찾을 수 없습니다");
    }

    // 1. 토스 결제 취소
    try {
      await this.tossApiClient.cancelPayment(
        order.paymentKey,
        `환불: ${request.reason}`,
        order.amount,
      );
    } catch (error) {
      this.logger.error(
        `토스 환불 실패: orderId=${order.orderId}, error=${error}`,
      );
      throw new BadRequestException("결제 취소 처리에 실패했습니다. 고객센터에 문의해주세요.");
    }

    // 2. Order 상태 업데이트
    order.status = OrderStatus.REFUNDED;
    order.refundedAt = new Date();
    order.refundReason = request.reason;
    await this.orderRepository.save(order);

    // 3. ProductDetail.salesCount, totalRevenue 원자적 차감
    await this.productDetailRepository
      .createQueryBuilder()
      .update()
      .set({
        salesCount: () => 'GREATEST("salesCount" - 1, 0)',
        totalRevenue: () => `GREATEST("totalRevenue" - ${order.amount}, 0)`,
      })
      .where("postId = :postId", { postId: order.productPostId })
      .execute();

    // 4. RefundRequest 상태 업데이트
    request.status = RefundStatus.PROCESSED;
    request.processedAt = new Date();
    await this.refundRequestRepository.save(request);

    this.logger.log(
      `환불 처리 완료: requestId=${request.id}, orderId=${order.orderId}, amount=${order.amount}`,
    );

    return { request, order };
  }

  /**
   * 판매자 무응답 감지 (매일 실행)
   * 7일 경과 시 자동 환불이 아닌 고객센터 에스컬레이션 처리
   * → 관리자가 수동으로 판단 후 승인/거부
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async escalateExpiredRequests() {
    const cutoff = new Date(
      Date.now() - SELLER_RESPONSE_DAYS * 24 * 60 * 60 * 1000,
    );

    const expiredRequests = await this.refundRequestRepository.find({
      where: {
        status: RefundStatus.PENDING as any,
        createdAt: LessThan(cutoff),
      },
    });

    for (const request of expiredRequests) {
      try {
        // 자동 환불이 아닌 에스컬레이션 상태로 변경
        request.status = RefundStatus.ESCALATED;
        request.metadata = {
          ...request.metadata,
          escalated: true,
          escalatedAt: new Date().toISOString(),
          escalationReason: `판매자 ${SELLER_RESPONSE_DAYS}일 무응답`,
        };
        await this.refundRequestRepository.save(request);

        this.logger.warn(
          `환불 요청 에스컬레이션: requestId=${request.id}, 판매자 ${SELLER_RESPONSE_DAYS}일 무응답 — 고객센터 확인 필요`,
        );
      } catch (error) {
        this.logger.error(
          `에스컬레이션 처리 실패: requestId=${request.id}`,
        );
      }
    }
  }

  /** 구매자의 환불 요청 목록 */
  async getBuyerRefundRequests(buyerId: string) {
    return this.refundRequestRepository.find({
      where: { buyerId },
      order: { createdAt: "DESC" },
      relations: ["order"],
    });
  }

  /** 판매자가 받은 환불 요청 목록 */
  async getSellerRefundRequests(sellerId: string) {
    return this.refundRequestRepository.find({
      where: { sellerId },
      order: { createdAt: "DESC" },
      relations: ["order"],
    });
  }

  /** 환불 요청 상세 조회 */
  private async getRefundRequest(id: string): Promise<RefundRequest> {
    const request = await this.refundRequestRepository.findOne({
      where: { id },
    });
    if (!request) throw new NotFoundException("환불 요청을 찾을 수 없습니다");
    return request;
  }
}
