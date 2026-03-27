import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { createHmac } from "crypto";
import {
  PaymentProvider,
  CreateCustomerOptions,
  CreateCheckoutSessionOptions,
  CheckoutSessionResponse,
  CreateSubscriptionOptions,
  SubscriptionResponse,
  PaymentMethod,
  WebhookEvent,
} from "../interfaces/payment-provider.interface";
import { TossApiClient } from "./toss-api.client";
import { TossBillingKey } from "../entities/toss-billing-key.entity";
import { ConfigService } from "@nestjs/config";

/**
 * 토스페이먼츠 결제 제공자
 *
 * PaymentProvider 인터페이스 구현
 * Stripe와 달리 토스는 구독을 서버에서 관리하지 않으므로
 * billingKey 기반으로 정기결제를 직접 스케줄링해야 함
 */
@Injectable()
export class TossProvider implements PaymentProvider {
  private readonly logger = new Logger(TossProvider.name);

  constructor(
    private readonly tossApiClient: TossApiClient,
    @InjectRepository(TossBillingKey)
    private readonly billingKeyRepository: Repository<TossBillingKey>,
    private readonly configService: ConfigService,
  ) {}

  getName(): string {
    return "toss";
  }

  /**
   * 고객 생성
   * 토스는 별도 고객 생성 API가 없으므로 customerKey만 생성하여 반환
   */
  async createCustomer(options: CreateCustomerOptions): Promise<string> {
    const customerKey = `toss_user_${options.metadata?.userId || Date.now()}`;
    this.logger.debug(`[Toss] CustomerKey 생성: ${customerKey}`);
    return customerKey;
  }

  async getCustomer(customerId: string): Promise<any> {
    // 토스는 고객 조회 API 없음 — DB에서 조회
    return { id: customerId, provider: "toss" };
  }

  async updateCustomer(
    customerId: string,
    _updates: Partial<CreateCustomerOptions>,
  ): Promise<void> {
    // 토스는 고객 업데이트 API 없음
    this.logger.debug(`[Toss] Customer 업데이트 (no-op): ${customerId}`);
  }

  async deleteCustomer(customerId: string): Promise<void> {
    // 토스는 고객 삭제 API 없음 — 빌링키 비활성화로 대체
    await this.billingKeyRepository.update(
      { customerKey: customerId },
      { isActive: false },
    );
    this.logger.debug(`[Toss] Customer 삭제 (빌링키 비활성화): ${customerId}`);
  }

  /**
   * 체크아웃 세션 생성
   * 토스는 프론트엔드에서 직접 SDK 호출이므로,
   * 빌링인증에 필요한 파라미터를 반환
   */
  async createCheckoutSession(
    options: CreateCheckoutSessionOptions,
  ): Promise<CheckoutSessionResponse> {
    const customerKey =
      options.customerId || `toss_user_${options.metadata?.userId}`;
    return {
      id: `toss_session_${Date.now()}`,
      url: "", // 토스는 프론트엔드 SDK로 결제창 호출
      status: "pending",
      customerId: customerKey,
      subscriptionId: undefined,
    };
  }

  /**
   * 구독 생성
   * 빌링키로 첫 결제를 실행하여 구독 시작
   */
  async createSubscription(
    options: CreateSubscriptionOptions,
  ): Promise<SubscriptionResponse> {
    // 빌링키 조회
    const billingKey = await this.billingKeyRepository.findOne({
      where: { customerKey: options.customerId, isActive: true },
      order: { createdAt: "DESC" },
    });

    if (!billingKey) {
      throw new Error("활성 빌링키가 없습니다. 카드 등록을 먼저 진행하세요.");
    }

    return {
      id: `toss_sub_${billingKey.id}`,
      customerId: options.customerId,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  }

  /**
   * 구독 조회
   * 토스는 구독 객체가 없으므로 DB 기반으로 상태 반환
   */
  async getSubscription(subscriptionId: string): Promise<SubscriptionResponse> {
    return {
      id: subscriptionId,
      customerId: "",
      status: "active",
    };
  }

  async updateSubscription(
    subscriptionId: string,
    updates: any,
  ): Promise<SubscriptionResponse> {
    return {
      id: subscriptionId,
      customerId: "",
      status: updates.status || "active",
    };
  }

  /**
   * 구독 취소
   * 내부 스케줄만 취소 (토스에는 구독 취소 API가 없음)
   */
  async cancelSubscription(
    subscriptionId: string,
    immediately = false,
  ): Promise<void> {
    this.logger.debug(
      `[Toss] 구독 취소: ${subscriptionId}, 즉시: ${immediately}`,
    );
  }

  async resumeSubscription(subscriptionId: string): Promise<void> {
    this.logger.debug(`[Toss] 구독 재개: ${subscriptionId}`);
  }

  /**
   * 결제 수단 목록 조회
   * 사용자의 활성 빌링키에서 카드 정보 반환
   */
  async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    const billingKeys = await this.billingKeyRepository.find({
      where: { customerKey: customerId, isActive: true },
      order: { createdAt: "DESC" },
    });

    return billingKeys.map((bk) => ({
      id: bk.id,
      type: "card",
      last4: bk.cardNumber?.replace(/[^0-9]/g, "").slice(-4),
      brand: bk.cardCompany,
    }));
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<void> {
    // 모든 빌링키를 비활성화 후 선택된 것만 활성화
    await this.billingKeyRepository.update(
      { customerKey: customerId },
      { isActive: false },
    );
    await this.billingKeyRepository.update(
      { id: paymentMethodId },
      { isActive: true },
    );
  }

  /**
   * 결제 수단 삭제 — 토스 API에서 빌링키 삭제 후 DB 비활성화
   * 토스 스펙: DELETE /v1/billing/{billingKey} 호출 필수
   */
  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    // DB에서 빌링키 조회
    const billingKeyEntity = await this.billingKeyRepository.findOne({
      where: { id: paymentMethodId },
    });

    if (billingKeyEntity?.billingKey) {
      // 토스 API에 빌링키 삭제 요청
      try {
        await this.tossApiClient.deleteBillingKey(billingKeyEntity.billingKey);
        this.logger.log(
          `토스 빌링키 삭제 완료: id=${paymentMethodId}`,
        );
      } catch (error) {
        // 토스에서 이미 삭제된 경우 등 — DB는 비활성화 진행
        this.logger.warn(
          `토스 빌링키 삭제 실패 (DB 비활성화는 진행): id=${paymentMethodId}, error=${error}`,
        );
      }
    }

    // DB 비활성화
    await this.billingKeyRepository.update(
      { id: paymentMethodId },
      { isActive: false },
    );
  }

  async listInvoices(_customerId: string, _limit = 10): Promise<any[]> {
    // 인보이스는 PaymentHistory에서 조회 — 여기서는 빈 배열
    return [];
  }

  /**
   * 환불 처리
   * POST /v1/payments/{paymentKey}/cancel
   */
  async createRefund(paymentKey: string, amount?: number): Promise<any> {
    const result = await this.tossApiClient.cancelPayment(
      paymentKey,
      "사용자 환불 요청",
      amount,
    );
    return {
      id: `refund_${paymentKey}`,
      amount: amount || result.totalAmount,
      status: "succeeded",
      created: new Date(),
    };
  }

  /**
   * 웹훅 서명 검증
   * HMAC SHA-256으로 서명 검증
   */
  verifyWebhookSignature(payload: any, signature: string): boolean {
    const webhookSecret = this.configService.get<string>(
      "TOSS_WEBHOOK_SECRET_KEY",
      "",
    );
    if (!webhookSecret) {
      this.logger.warn("[Toss] 웹훅 시크릿 키가 설정되지 않음");
      return false;
    }

    try {
      const body =
        typeof payload === "string" ? payload : JSON.stringify(payload);
      const hmac = createHmac("sha256", webhookSecret)
        .update(body)
        .digest("base64");
      return hmac === signature;
    } catch {
      return false;
    }
  }

  /**
   * 웹훅 이벤트 파싱
   * 토스 웹훅 이벤트를 내부 WebhookEvent 포맷으로 변환
   */
  parseWebhookEvent(payload: any): WebhookEvent {
    return {
      id: payload.eventType + "_" + Date.now(),
      type: payload.eventType || "unknown",
      data: payload.data || payload,
      created: new Date(payload.createdAt || Date.now()),
    };
  }

  /**
   * 토스 카드사 issuerCode → 카드사 이름 매핑
   * 토스 공식 문서 기반: https://docs.tosspayments.com/reference/codes#카드사-코드
   */
  private readonly CARD_ISSUER_MAP: Record<string, string> = {
    "3K": "기업BC",
    "46": "광주은행",
    "71": "롯데카드",
    "30": "KDB산업은행",
    "31": "BC카드",
    "51": "삼성카드",
    "38": "새마을금고",
    "41": "신한카드",
    "62": "신협",
    "36": "씨티카드",
    "33": "우리BC카드(구 우리카드)",
    "W1": "우리카드",
    "37": "우체국예금보험",
    "39": "저축은행중앙회",
    "35": "전북은행",
    "42": "제주은행",
    "15": "카카오뱅크",
    "3A": "케이뱅크",
    "24": "토스뱅크",
    "21": "하나카드",
    "61": "현대카드",
    "11": "KB국민카드",
    "91": "NH농협카드",
    "34": "Sh수협은행",
    "6D": "다이너스 클럽",
    "4M": "마스터카드",
    "3C": "유니온페이",
    "7A": "아메리칸 익스프레스",
    "4J": "JCB",
    "4V": "VISA",
  };

  /** issuerCode를 카드사 이름으로 변환 (외부에서도 사용) */
  getCardCompanyName(issuerCode?: string): string {
    if (!issuerCode) return "카드";
    return this.CARD_ISSUER_MAP[issuerCode] || issuerCode;
  }

  // === 토스 전용 메서드 ===

  /**
   * 빌링키 발급 및 저장
   * requestBillingAuth 성공 후 호출
   */
  async issueBillingKey(
    authKey: string,
    customerKey: string,
    userId: string,
  ): Promise<TossBillingKey> {
    // 토스 API로 빌링키 발급
    const response = await this.tossApiClient.issueBillingKey(
      authKey,
      customerKey,
    );

    // DB에 빌링키 저장 (API 성공 후 DB 실패 시 로깅 — 토스는 idempotent하므로 재발급 가능)
    try {
      const billingKey = this.billingKeyRepository.create({
        userId,
        customerKey,
        billingKey: response.billingKey,
        cardCompany: this.getCardCompanyName(response.card?.issuerCode),
        // 카드 번호는 마지막 4자리만 저장 (PCI-DSS 준수 — 전체 카드번호 저장 금지)
      cardNumber: response.card?.number
        ? `****${response.card.number.replace(/[^0-9]/g, "").slice(-4)}`
        : null,
        cardType: response.card?.cardType,
        isActive: true,
        authenticatedAt: new Date(response.authenticatedAt),
        metadata: { method: response.method, authKey },
      });

      return await this.billingKeyRepository.save(billingKey);
    } catch (dbError) {
      this.logger.error(
        `[Toss] 빌링키 DB 저장 실패 (API 발급은 성공): billingKey=${response.billingKey}, error=${dbError}`,
      );
      throw dbError;
    }
  }

  /**
   * 사용자의 활성 빌링키 조회
   */
  async getActiveBillingKey(userId: string): Promise<TossBillingKey | null> {
    return this.billingKeyRepository.findOne({
      where: { userId, isActive: true },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * authKey로 이미 발급된 빌링키 조회 (멱등성 체크용)
   *
   * 동일 authKey로 중복 confirm 요청이 오면 기존 빌링키 반환
   * PostgreSQL JSONB 연산자(->>)로 정확한 매칭 수행
   */
  async findBillingKeyByAuthKey(
    authKey: string,
  ): Promise<TossBillingKey | null> {
    return this.billingKeyRepository
      .createQueryBuilder("bk")
      .where("bk.metadata->>'authKey' = :authKey", { authKey })
      .getOne();
  }

  /**
   * 빌링키 메타데이터 업데이트 (마지막 결제 정보 저장)
   * 멱등성 응답 시 이전 결제 결과를 반환하기 위해 사용
   */
  async updateBillingKeyMetadata(
    billingKeyId: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    const billingKey = await this.billingKeyRepository.findOne({
      where: { id: billingKeyId },
    });
    if (billingKey) {
      billingKey.metadata = { ...billingKey.metadata, ...metadata };
      await this.billingKeyRepository.save(billingKey);
    }
  }

  /**
   * 빌링키 비활성화
   * 결제 실패 시 고아 빌링키 방지를 위해 호출
   */
  async deactivateBillingKey(billingKeyId: string): Promise<void> {
    await this.billingKeyRepository.update(billingKeyId, {
      isActive: false,
    });
    this.logger.log(`빌링키 비활성화 완료: id=${billingKeyId}`);
  }
}
