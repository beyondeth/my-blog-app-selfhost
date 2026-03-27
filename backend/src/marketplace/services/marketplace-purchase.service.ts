import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { Post } from "../../posts/entities/post.entity";
import { ProductDetail } from "../entities/product-detail.entity";
import { Order } from "../entities/order.entity";
import { User } from "../../users/entities/user.entity";
import { PaymentHistory } from "../../subscription/entities/payment-history.entity";
import { TossApiClient } from "../../payment/providers/toss-api.client";
import { OrderStatus } from "../../common/enums/order-status.enum";
import { PaymentStatus } from "../../common/enums/subscription.enum";

/**
 * 마켓플레이스 구매 서비스
 *
 * 안전성 조치 (토스 공식 가이드 + 구독 결제 패턴 재사용):
 * 1. UNIQUE(buyerId, productPostId) — DB 레벨 중복 구매 방지
 * 2. orderId 유니크 — 토스 DUPLICATED_ORDER_ID 방어
 * 3. 인메모리 락 — 동일 orderId 동시 confirm 차단
 * 4. 금액 서버 검증 — product_details.price만 사용
 * 5. salesCount 원자적 증가 — 레이스 컨디션 방지
 */
@Injectable()
export class MarketplacePurchaseService {
  private readonly logger = new Logger(MarketplacePurchaseService.name);

  /** 동시 결제 방지 (orderId → timestamp) */
  private readonly processingLock = new Map<string, number>();
  private readonly LOCK_TIMEOUT_MS = 60_000;

  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(ProductDetail)
    private readonly productDetailRepository: Repository<ProductDetail>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(PaymentHistory)
    private readonly paymentHistoryRepository: Repository<PaymentHistory>,
    private readonly tossApiClient: TossApiClient,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 구매 준비 — 주문 생성 + 토스 결제 파라미터 반환
   *
   * 멱등성: 이미 결제 완료된 주문이 있으면 기존 결과 반환
   */
  async preparePurchase(buyerId: string, productPostId: string) {
    // 1. 상품 조회 (최소 JOIN)
    const product = await this.postRepository
      .createQueryBuilder("p")
      .innerJoinAndSelect("p.productDetail", "pd")
      .where("p.id = :id", { id: productPostId })
      .andWhere("p.postType = :type", { type: "product" })
      .andWhere("p.isPublished = true")
      .andWhere("p.isDeleted = false")
      .andWhere("pd.isActive = true")
      .getOne();

    if (!product || !product.productDetail) {
      throw new NotFoundException("상품을 찾을 수 없거나 판매 중지된 상품입니다");
    }

    // 2. 판매자 본인 구매 차단
    if (product.authorId === buyerId) {
      throw new ForbiddenException("본인의 상품은 구매할 수 없습니다");
    }

    // 3. 이미 구매한 상품인지 확인 (멱등성)
    // 환불된 주문(REFUNDED)은 무시 → 재구매 가능
    const existingOrder = await this.orderRepository.findOne({
      where: { buyerId, productPostId },
      order: { createdAt: "DESC" },
    });

    if (existingOrder) {
      if (existingOrder.status === OrderStatus.PAID) {
        // 이미 결제 완료 — 기존 주문 반환
        return {
          alreadyPurchased: true,
          order: existingOrder,
        };
      }
      // 환불된 주문은 재구매 허용 — 기존 UNIQUE 제약 때문에 삭제 후 새 주문 생성
      if (existingOrder.status === OrderStatus.REFUNDED || existingOrder.status === OrderStatus.FAILED || existingOrder.status === OrderStatus.CANCELLED) {
        await this.orderRepository.remove(existingOrder);
      }
      if (existingOrder.status === OrderStatus.PENDING) {
        // 결제 대기 중인 주문 재사용
        return this.buildPaymentParams(existingOrder, product);
      }
    }

    // 4. 주문 생성
    const orderId = `mkt_${buyerId.substring(0, 8)}_${randomUUID().substring(0, 12)}`;
    const price = product.productDetail.price;
    const commissionRate = Number(product.productDetail.commissionRate);
    const platformFee = Math.round(price * commissionRate / 100);
    const sellerRevenue = price - platformFee;

    const order = this.orderRepository.create({
      orderId,
      buyerId,
      sellerId: product.authorId,
      productPostId,
      amount: price,
      platformFee,
      sellerRevenue,
      currency: product.productDetail.currency,
      status: OrderStatus.PENDING,
    });

    try {
      await this.orderRepository.save(order);
    } catch (error: any) {
      // UNIQUE(buyerId, productPostId) 위반 — 동시 요청
      if (error?.code === "23505") {
        throw new ConflictException("이미 처리 중인 구매 요청이 있습니다");
      }
      throw error;
    }

    return this.buildPaymentParams(order, product);
  }

  /**
   * 구매 확인 — 토스 일회성 결제 승인 + 주문 완료
   */
  async confirmPurchase(
    buyerId: string,
    paymentKey: string,
    orderId: string,
    frontendAmount: number,
  ) {
    // 1. 동시 요청 방지
    const lockTime = this.processingLock.get(orderId);
    if (lockTime && Date.now() - lockTime < this.LOCK_TIMEOUT_MS) {
      throw new ConflictException("결제가 이미 처리 중입니다");
    }
    this.processingLock.set(orderId, Date.now());

    try {
      // 2. 주문 조회
      const order = await this.orderRepository.findOne({
        where: { orderId, buyerId },
      });

      if (!order) {
        throw new NotFoundException("주문을 찾을 수 없습니다");
      }

      // 이미 결제 완료 (멱등성) — 상품/판매자 정보 포함하여 반환
      if (order.status === OrderStatus.PAID) {
        const populatedOrder = await this.orderRepository.findOne({
          where: { orderId },
          relations: ["productPost", "seller"],
        });
        return { order: populatedOrder || order, alreadyPaid: true };
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException("결제할 수 없는 주문 상태입니다");
      }

      // 3. 금액 서버 검증 — DB의 실제 가격 사용
      const productDetail = await this.productDetailRepository.findOne({
        where: { postId: order.productPostId },
      });

      if (!productDetail) {
        throw new NotFoundException("상품 정보를 찾을 수 없습니다");
      }

      const serverAmount = productDetail.price;

      // 프론트엔드 금액과 서버 금액 비교 (변조 감지)
      if (frontendAmount !== serverAmount) {
        this.logger.warn(
          `금액 불일치 감지: frontend=${frontendAmount}, server=${serverAmount}, orderId=${orderId}`,
        );
      }

      // 4. 토스 결제 승인 (서버 금액 사용)
      const paymentResult = await this.tossApiClient.confirmPayment(
        paymentKey,
        orderId,
        serverAmount,
      );

      // 5. 주문 상태 업데이트
      order.status = OrderStatus.PAID;
      order.paymentKey = paymentKey;
      order.receiptUrl = paymentResult.receipt?.url || null;
      order.metadata = {
        approvedAt: paymentResult.approvedAt,
        method: paymentResult.method,
        card: paymentResult.card
          ? {
              approveNo: paymentResult.card.approveNo,
              issuerCode: paymentResult.card.issuerCode,
              cardNumber: paymentResult.card.number,
              cardType: paymentResult.card.cardType,
            }
          : null,
      };

      await this.orderRepository.save(order);

      // 6. salesCount, totalRevenue 원자적 증가
      await this.productDetailRepository
        .createQueryBuilder()
        .update()
        .set({
          salesCount: () => '"salesCount" + 1',
          totalRevenue: () => `"totalRevenue" + ${serverAmount}`,
        })
        .where("postId = :postId", { postId: order.productPostId })
        .execute();

      // 7. PaymentHistory 생성 (기존 엔티티 재사용)
      try {
        await this.paymentHistoryRepository.save(
          this.paymentHistoryRepository.create({
            userId: buyerId,
            amount: serverAmount,
            currency: "KRW",
            status: PaymentStatus.SUCCEEDED,
            provider: "toss",
            providerId: paymentKey,
            transactionId: orderId,
            paymentMethod: paymentResult.method || "card",
            description: `마켓플레이스 구매`,
            receiptUrl: paymentResult.receipt?.url || null,
            metadata: {
              type: "marketplace_purchase",
              orderId,
              productPostId: order.productPostId,
              sellerId: order.sellerId,
              platformFee: order.platformFee,
              sellerRevenue: order.sellerRevenue,
            },
          }),
        );
      } catch {
        // 결제 이력 저장 실패는 구매 자체를 실패시키지 않음
        this.logger.error(`결제 이력 저장 실패: orderId=${orderId}`);
      }

      this.logger.log(
        `마켓플레이스 구매 완료: orderId=${orderId}, amount=${serverAmount}, buyer=${buyerId}`,
      );

      // 상품명/판매자 포함하여 프론트엔드에 반환
      const populatedOrder = await this.orderRepository.findOne({
        where: { orderId },
        relations: ["productPost", "seller"],
      });

      return { order: populatedOrder || order, alreadyPaid: false };
    } catch (error) {
      // 결제 실패 시 주문 상태 업데이트
      try {
        await this.orderRepository.update(
          { orderId },
          { status: OrderStatus.FAILED },
        );
      } catch {
        this.logger.error(`주문 실패 상태 업데이트 실패: orderId=${orderId}`);
      }
      throw error;
    } finally {
      this.processingLock.delete(orderId);
    }
  }

  /**
   * 내 구매 내역 조회
   */
  async getMyPurchases(buyerId: string, limit = 20) {
    const orders = await this.orderRepository
      .createQueryBuilder("o")
      .leftJoin("o.productPost", "p")
      .addSelect(["p.id", "p.title", "p.slug", "p.thumbnailImageId"])
      .leftJoin("o.seller", "s")
      .addSelect(["s.id", "s.username"])
      .where("o.buyerId = :buyerId", { buyerId })
      .andWhere("o.status IN (:...statuses)", {
        statuses: [OrderStatus.PAID, OrderStatus.REFUNDED],
      })
      .orderBy("o.createdAt", "DESC")
      .take(limit)
      .getMany();

    return orders;
  }

  /** 토스 결제 파라미터 빌드 */
  private buildPaymentParams(order: Order, product: Post) {
    const frontendUrl = this.configService.get<string>(
      "FRONTEND_URL",
      "http://localhost:3001",
    );
    const customerKey = `cust-${randomUUID()}`;

    return {
      alreadyPurchased: false,
      orderId: order.orderId,
      amount: order.amount,
      orderName: product.title || "마켓플레이스 상품",
      customerKey,
      successUrl: `${frontendUrl}/marketplace/purchase/success?orderId=${order.orderId}`,
      failUrl: `${frontendUrl}/marketplace/purchase/fail?orderId=${order.orderId}`,
    };
  }
}
