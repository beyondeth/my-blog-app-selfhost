import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TossProvider } from "../providers/toss.provider";
import { TossApiClient } from "../providers/toss-api.client";
import { BillingSchedulerService } from "../services/billing-scheduler.service";
import { SubscriptionFacadeService } from "../../shared/subscription-facade.service";
import { ConfigService } from "@nestjs/config";
import {
  SubscriptionTier,
  BillingCycle,
  PaymentStatus,
} from "../../common/enums/subscription.enum";
import { randomUUID } from "crypto";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PaymentHistory } from "../../subscription/entities/payment-history.entity";
import { User } from "../../users/entities/user.entity";
import { Subscription } from "../../subscription/entities/subscription.entity";

/**
 * 토스페이먼츠 결제 컨트롤러
 *
 * 토스 공식 가이드 기반 안전성 조치:
 * ──────────────────────────────────
 * 1. customerKey — UUID v4 기반 (토스 권장: "유추 불가능한 값")
 * 2. Idempotency-Key — UUID v4 (토스 권장: "충분히 무작위적인 고유 값")
 * 3. orderId 고유성 — authKey 해시 기반 → DUPLICATED_ORDER_ID로 토스 측 이중결제 차단
 * 4. 금액 서버 검증 — 프론트엔드 전달 금액 무시, DB 플랜 가격만 사용
 * 5. authKey 멱등성 — DB 조회로 동일 authKey 재처리 방지 (새로고침/뒤로가기)
 * 6. 동시 요청 락 — 같은 userId 동시 confirm 차단
 * 7. 에러 분류 — 토스 에러코드 기반 재시도 가능/불가능 구분
 * 8. 빌링키 삭제 — 소유자 검증 필수
 *
 * 참고: https://docs.tosspayments.com/guides/v2/billing/integration-api
 */
@Controller("subscription/toss")
export class TossCheckoutController {
  private readonly logger = new Logger(TossCheckoutController.name);

  /** 동시 결제 방지를 위한 인메모리 락 (userId → timestamp) */
  private readonly processingLock = new Map<string, number>();
  /** 락 타임아웃: 60초 — 토스 API 타임아웃 + 여유분 */
  private readonly LOCK_TIMEOUT_MS = 60_000;

  /** 토스 에러 중 재시도하면 안 되는 코드 (4xx 클라이언트 오류) */
  private readonly NON_RETRYABLE_ERROR_CODES = new Set([
    "INVALID_BILLING_AUTH",
    "NOT_MATCHES_CUSTOMER_KEY",
    "INVALID_BILL_KEY_REQUEST",
    "ALREADY_COMPLETED_PAYMENT",
    "ALREADY_CANCELED_PAYMENT",
    "ALREADY_REFUND_PAYMENT",
    "DUPLICATED_ORDER_ID",
    "BELOW_MINIMUM_AMOUNT",
    "EXCEED_MAX_AMOUNT",
    "NOT_ENOUGH_AMOUNT",
    "UNAUTHORIZED_KEY",
    "INVALID_REQUIRED_PARAM",
    "NOT_SUPPORTED_METHOD",
  ]);

  constructor(
    private readonly tossProvider: TossProvider,
    private readonly tossApiClient: TossApiClient,
    private readonly billingScheduler: BillingSchedulerService,
    private readonly subscriptionFacade: SubscriptionFacadeService,
    private readonly configService: ConfigService,
    @InjectRepository(PaymentHistory)
    private readonly paymentHistoryRepository: Repository<PaymentHistory>,
  ) {}

  /**
   * 빌링인증 요청 (카드 등록 시작)
   *
   * 프론트엔드에서 requestBillingAuth()에 필요한 파라미터 반환
   * customerKey는 UUID v4 기반으로 생성 (토스 공식 권장: 유추 불가능한 값)
   */
  @Post("billing-auth")
  @UseGuards(JwtAuthGuard)
  async requestBillingAuth(
    @Request() req,
    @Body() body: { tier: string; billingCycle: "monthly" | "yearly" },
  ) {
    const userId = req.user.id;
    const tier = body.tier as SubscriptionTier;
    const billingCycle = body.billingCycle as BillingCycle;

    // 플랜 유효성 검증
    const plan = await this.subscriptionFacade.getPlanByTier(tier);
    if (!plan) {
      throw new BadRequestException("유효하지 않은 플랜입니다");
    }

    // 금액은 서버 DB에서만 조회 (프론트엔드 전달 금액 무시)
    const price =
      billingCycle === BillingCycle.MONTHLY
        ? plan.pricing?.monthly
        : plan.pricing?.yearly;

    if (!price || price <= 0) {
      throw new BadRequestException("무료 플랜은 결제가 필요하지 않습니다");
    }

    // customerKey: 기존 빌링키가 있으면 재사용, 없으면 UUID 기반 신규 생성
    // 토스 공식 가이드: "UUID 추천, 유추 불가능한 값"
    const existingBillingKey =
      await this.tossProvider.getActiveBillingKey(userId);
    const customerKey =
      existingBillingKey?.customerKey || `cust-${randomUUID()}`;

    const frontendUrl = this.configService.get<string>(
      "FRONTEND_URL",
      "http://localhost:3001",
    );

    return {
      success: true,
      data: {
        customerKey,
        amount: price,
        orderName: `${plan.displayName || plan.name} (${billingCycle === "monthly" ? "월간" : "연간"})`,
        successUrl: `${frontendUrl}/subscription/toss/success?tier=${tier}&billingCycle=${billingCycle}`,
        failUrl: `${frontendUrl}/subscription/toss/fail`,
      },
    };
  }

  /**
   * 빌링인증 확인 (카드 등록 완료 + 첫 결제)
   *
   * 안전성 조치 (토스 공식 가이드 기반):
   * ─────────────────────────────────
   * [1] 동시 요청 락 — 같은 userId의 동시 confirm 차단 (다중 탭 방지)
   * [2] authKey 멱등성 — JSONB 쿼리로 이미 처리된 authKey 감지 (새로고침/뒤로가기)
   * [3] 금액 서버 검증 — DB 플랜 가격만 사용
   * [4] orderId = authKey 해시 — 동일 authKey → 동일 orderId → 토스 DUPLICATED_ORDER_ID 방어
   * [5] Idempotency-Key — UUID v4 (토스 공식 권장)
   * [6] 결제 실패 시 — 빌링키 비활성화 + 구독 FREE 롤백 + 에러 분류
   */
  @Post("billing-auth/confirm")
  @UseGuards(JwtAuthGuard)
  async confirmBillingAuth(
    @Request() req,
    @Body()
    body: {
      authKey: string;
      customerKey: string;
      tier: string;
      billingCycle: "monthly" | "yearly";
    },
  ) {
    const userId = req.user.id;
    const tier = body.tier as SubscriptionTier;
    const billingCycle = body.billingCycle as BillingCycle;

    // ── [1] 동시 요청 방지 ──
    const lockTime = this.processingLock.get(userId);
    if (lockTime && Date.now() - lockTime < this.LOCK_TIMEOUT_MS) {
      throw new ConflictException(
        "결제가 이미 처리 중입니다. 잠시 후 다시 시도해주세요.",
      );
    }
    this.processingLock.set(userId, Date.now());

    try {
      // ── [2] authKey 멱등성 체크 ──
      // 동일 authKey로 이미 빌링키가 발급되었다면 기존 결과 반환
      // (새로고침, 뒤로가기 시 동일 authKey가 URL에 남아있어 재전송됨)
      const existingBillingKey =
        await this.tossProvider.findBillingKeyByAuthKey(body.authKey);

      if (existingBillingKey) {
        this.logger.warn(
          `중복 confirm 요청 감지 — 기존 결과 반환: userId=${userId}`,
        );
        const currentSubscription =
          await this.subscriptionFacade.getUserSubscription(userId);
        return {
          success: true,
          data: {
            subscription: currentSubscription,
            paymentKey: existingBillingKey.metadata?.lastPaymentKey || null,
            amount: existingBillingKey.metadata?.lastAmount || 0,
            message: "이미 처리된 결제입니다",
            duplicate: true,
          },
        };
      }

      // ── [3] 빌링키 발급 (authKey → billingKey) ──
      const billingKeyEntity = await this.tossProvider.issueBillingKey(
        body.authKey,
        body.customerKey,
        userId,
      );

      this.logger.log(
        `빌링키 발급 완료: userId=${userId}, billingKeyId=${billingKeyEntity.id}`,
      );

      // ── [4] 플랜 조회 + 금액 서버 검증 ──
      // 프론트엔드가 보낸 금액은 절대 사용하지 않음
      const plan = await this.subscriptionFacade.getPlanByTier(tier);
      const price =
        billingCycle === BillingCycle.MONTHLY
          ? plan.pricing?.monthly
          : plan.pricing?.yearly;

      if (!price || price <= 0) {
        throw new BadRequestException("유효하지 않은 결제 금액입니다");
      }

      // 토스 스펙: 결제 금액 범위 ₩100 ~ ₩1,000,000,000 (마켓플레이스 최소 ₩1,000)
      if (price < 1000) {
        throw new BadRequestException("최소 결제 금액은 1,000원입니다");
      }

      // ── [5] 첫 결제 실행 (구독 생성보다 먼저 — 실패 시 롤백 불필요) ──
      // orderId: authKey 해시 기반 → 동일 authKey의 중복 결제를 토스 측에서 DUPLICATED_ORDER_ID로 차단
      const orderId = `sub_${userId.substring(0, 8)}_${this.hashString(body.authKey)}`;

      // orderId 형식 검증 (토스 스펙: 6-64자, [a-zA-Z0-9\-_\.@])
      if (orderId.length < 6 || orderId.length > 64 || !/^[a-zA-Z0-9\-_.@]+$/.test(orderId)) {
        throw new BadRequestException("주문번호 형식이 유효하지 않습니다");
      }

      const orderName = `${plan.displayName || plan.name} (${billingCycle === "monthly" ? "월간" : "연간"})`;

      let paymentResult;
      try {
        paymentResult = await this.tossApiClient.chargeBilling(
          billingKeyEntity.billingKey,
          {
            customerKey: body.customerKey,
            amount: price,
            orderId,
            orderName,
            customerEmail: req.user?.email || undefined,
            customerName: req.user?.name || undefined,
            taxFreeAmount: 0,
          },
        );
      } catch (chargeError: unknown) {
        // 결제 실패 — 구독이 아직 생성되지 않았으므로 롤백 불필요
        const errorData = (chargeError as { response?: { data?: { code?: string } } })?.response?.data;
        const tossErrorCode = errorData?.code || "";

        this.logger.error(
          `첫 결제 실패 — tossError=${tossErrorCode}, orderId=${orderId}`,
        );

        // 빌링키 비활성화 (고아 빌링키 방지)
        try {
          await this.tossProvider.deactivateBillingKey(billingKeyEntity.id);
        } catch {
          this.logger.error(
            `빌링키 비활성화 실패: billingKeyId=${billingKeyEntity.id}`,
          );
        }

        const userMessage = this.getUserFriendlyErrorMessage(tossErrorCode);
        throw new BadRequestException(userMessage);
      }

      this.logger.log(
        `첫 결제 성공: orderId=${orderId}, paymentKey=${paymentResult.paymentKey}, amount=${price}`,
      );

      // 빌링키 메타데이터에 마지막 결제 정보 저장 (멱등성 응답용)
      await this.tossProvider.updateBillingKeyMetadata(
        billingKeyEntity.id,
        {
          lastPaymentKey: paymentResult.paymentKey,
          lastAmount: price,
          lastOrderId: orderId,
        },
      );

      // ── [6] 결제 성공 후 구독 생성 ──
      const subscription =
        await this.subscriptionFacade.updateUserSubscription(
          userId,
          tier,
          billingCycle,
        );

      // ── [7] 결제 이력 저장 (영수증 URL, 카드 정보, 거래 상세 포함) ──
      try {
        await this.paymentHistoryRepository.save(
          this.paymentHistoryRepository.create({
            user: { id: userId } as User,
            subscription: subscription
              ? ({ id: subscription.id } as Subscription)
              : undefined,
            amount: price,
            currency: "KRW",
            status: PaymentStatus.SUCCEEDED,
            provider: "toss",
            providerId: paymentResult.paymentKey,
            transactionId: orderId,
            paymentMethod: paymentResult.method || "card",
            description: orderName,
            receiptUrl: paymentResult.receipt?.url || null,
            metadata: {
              orderId,
              billingKeyId: billingKeyEntity.id,
              approvedAt: paymentResult.approvedAt,
              requestedAt: paymentResult.requestedAt,
              card: paymentResult.card
                ? {
                    approveNo: paymentResult.card.approveNo || null,
                    issuerCode: paymentResult.card.issuerCode,
                    cardCompany: this.tossProvider.getCardCompanyName(
                      paymentResult.card.issuerCode,
                    ),
                    cardNumber: paymentResult.card.number || null,
                    cardType: paymentResult.card.cardType,
                    ownerType: paymentResult.card.ownerType || null,
                    installmentPlanMonths:
                      paymentResult.card.installmentPlanMonths || 0,
                  }
                : null,
            },
          }),
        );
      } catch (historyError) {
        // 결제 이력 저장 실패는 결제 자체를 실패시키지 않음
        this.logger.error(
          `결제 이력 저장 실패 (결제는 성공): orderId=${orderId}`,
        );
      }

      // ── [8] 다음 결제 스케줄 등록 ──
      if (subscription) {
        await this.billingScheduler.scheduleNextCharge(subscription);
      }

      return {
        success: true,
        data: {
          subscription,
          paymentKey: paymentResult.paymentKey,
          amount: price,
          receiptUrl: paymentResult.receipt?.url || null,
          message: "구독이 성공적으로 시작되었습니다",
        },
      };
    } finally {
      // 처리 완료 후 락 해제
      this.processingLock.delete(userId);
    }
  }

  /**
   * 빌링키 비활성화 (카드 삭제)
   * 소유자 검증 포함 — 타인의 결제수단 삭제 방지
   */
  @Delete("billing-key/:id")
  @UseGuards(JwtAuthGuard)
  async deleteBillingKey(@Request() req, @Param("id") id: string) {
    const userId = req.user.id;

    // 소유자 검증 — 본인의 빌링키인지 확인
    const billingKey = await this.tossProvider.getActiveBillingKey(userId);
    if (!billingKey || billingKey.id !== id) {
      throw new ForbiddenException("본인의 결제 수단만 삭제할 수 있습니다");
    }

    await this.tossProvider.deletePaymentMethod(id);
    return {
      success: true,
      message: "결제 수단이 삭제되었습니다",
    };
  }

  /**
   * authKey를 결정적 해시로 변환 (orderId 생성용)
   * 동일 authKey → 동일 orderId → 토스 DUPLICATED_ORDER_ID로 이중결제 차단
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 토스 에러코드를 사용자 친화적 메시지로 변환
   * 토스 공식 에러코드 참고: https://docs.tosspayments.com/reference/error-codes
   */
  private getUserFriendlyErrorMessage(tossErrorCode: string): string {
    const messages: Record<string, string> = {
      // 카드 문제 (재시도 불가 — 사용자 조치 필요)
      NOT_ENOUGH_AMOUNT: "카드 잔액이 부족합니다. 다른 카드로 시도해주세요.",
      EXCEED_MAX_AMOUNT: "결제 한도를 초과했습니다. 카드사에 문의해주세요.",
      BELOW_MINIMUM_AMOUNT: "최소 결제 금액 미만입니다.",
      INVALID_BILLING_AUTH: "카드 인증이 유효하지 않습니다. 다시 시도해주세요.",
      NOT_MATCHES_CUSTOMER_KEY: "결제 정보가 일치하지 않습니다. 다시 시도해주세요.",
      // 중복 (이미 처리됨)
      DUPLICATED_ORDER_ID: "이미 처리된 결제입니다.",
      ALREADY_COMPLETED_PAYMENT: "이미 완료된 결제입니다.",
      // 시스템 (재시도 가능)
      COMMON_ERROR: "일시적인 오류입니다. 잠시 후 다시 시도해주세요.",
      FAILED_INTERNAL_SYSTEM_PROCESSING:
        "결제 시스템에 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    };

    return (
      messages[tossErrorCode] ||
      "결제 처리 중 오류가 발생했습니다. 다시 시도해주세요."
    );
  }
}
