import { Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AxiosError } from "axios";

/**
 * 토스페이먼츠 에러 응답 인터페이스
 */
interface TossErrorResponse {
  code: string;
  message: string;
}

/**
 * 빌링키 발급 응답
 */
export interface TossBillingKeyResponse {
  billingKey: string;
  customerKey: string;
  authenticatedAt: string;
  method: string;
  card?: {
    issuerCode: string;
    acquirerCode: string;
    number: string;
    cardType: string;
    ownerType: string;
  };
}

/**
 * 결제 승인 응답
 */
export interface TossPaymentResponse {
  paymentKey: string;
  orderId: string;
  /** 결제 상태: READY, IN_PROGRESS, DONE, CANCELED, PARTIAL_CANCELED, ABORTED, EXPIRED */
  status: string;
  /** 결제 유형: NORMAL, BILLING, BRANDPAY */
  type?: string;
  totalAmount: number;
  /** 현재 환불 가능 금액 */
  balanceAmount?: number;
  method: string;
  requestedAt: string;
  approvedAt: string;
  card?: {
    issuerCode: string;
    acquirerCode?: string;
    /** 부분 마스킹된 카드번호 (예: 457973**********) */
    number: string;
    /** 신용/체크/기프트/미확인 */
    cardType: string;
    /** 개인/법인/미확인 */
    ownerType?: string;
    installmentPlanMonths?: number;
    /** 카드 승인번호 — 카드영수증(매출전표)에 표시 */
    approveNo?: string;
    /** 매입 상태: READY, REQUESTED, COMPLETED, CANCEL_REQUESTED, CANCELED */
    acquireStatus?: string;
  };
  /** 카드 매출전표 URL — 소비자에게 반드시 제공 */
  receipt?: {
    url: string;
  };
  /** 결제 실패 정보 */
  failure?: {
    code: string;
    message: string;
  };
  /** 취소 이력 배열 */
  cancels?: Array<{
    cancelAmount: number;
    cancelReason: string;
    canceledAt: string;
    transactionKey: string;
  }>;
}

/**
 * 빌링 결제 요청 파라미터
 */
export interface TossBillingChargeParams {
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
  customerEmail?: string;
  customerName?: string;
  /** 비과세 금액 (기본 0) */
  taxFreeAmount?: number;
}

/**
 * 토스페이먼츠 REST API HTTP 클라이언트
 *
 * Base URL: https://api.tosspayments.com/v1
 * 인증: Basic Auth (base64(secretKey:))
 * 에러 매핑: Toss 에러 코드 → NestJS HttpException
 */
@Injectable()
export class TossApiClient {
  private readonly logger = new Logger(TossApiClient.name);
  private readonly baseUrl = "https://api.tosspayments.com/v1";
  private readonly authHeader: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    // Basic Auth 헤더 생성: base64(secretKey:) — 콜론 필수
    const secretKey = this.configService.get<string>("TOSS_SECRET_KEY", "");
    const encoded = Buffer.from(`${secretKey}:`).toString("base64");
    this.authHeader = `Basic ${encoded}`;
  }

  /**
   * 결제 승인 (일회성 결제)
   * POST /v1/payments/confirm
   *
   * 프론트엔드에서 결제창 완료 후 paymentKey, orderId, amount를 받아 최종 승인
   */
  async confirmPayment(
    paymentKey: string,
    orderId: string,
    amount: number,
  ): Promise<TossPaymentResponse> {
    return this.request<TossPaymentResponse>("POST", "/payments/confirm", {
      paymentKey,
      orderId,
      amount,
    });
  }

  /**
   * 빌링키 발급 (정기결제용)
   * POST /v1/billing/authorizations/issue
   *
   * 프론트엔드 requestBillingAuth 성공 후 authKey로 빌링키 획득
   */
  async issueBillingKey(
    authKey: string,
    customerKey: string,
  ): Promise<TossBillingKeyResponse> {
    return this.request<TossBillingKeyResponse>(
      "POST",
      "/billing/authorizations/issue",
      { authKey, customerKey },
    );
  }

  /**
   * 빌링 결제 승인 (정기결제 청구)
   * POST /v1/billing/{billingKey}
   *
   * 저장된 빌링키로 실제 결제 실행 (스케줄러에서 호출)
   */
  async chargeBilling(
    billingKey: string,
    params: TossBillingChargeParams,
  ): Promise<TossPaymentResponse> {
    // Idempotency-Key로 중복 결제 방지
    const idempotencyKey = `billing_${params.orderId}`;
    return this.request<TossPaymentResponse>(
      "POST",
      `/billing/${billingKey}`,
      { ...params },
      { "Idempotency-Key": idempotencyKey },
    );
  }

  /**
   * 결제 취소/환불
   * POST /v1/payments/{paymentKey}/cancel
   */
  async cancelPayment(
    paymentKey: string,
    cancelReason: string,
    cancelAmount?: number,
  ): Promise<TossPaymentResponse> {
    const body: Record<string, unknown> = { cancelReason };
    if (cancelAmount !== undefined) {
      body.cancelAmount = cancelAmount;
    }
    return this.request<TossPaymentResponse>(
      "POST",
      `/payments/${paymentKey}/cancel`,
      body,
    );
  }

  /**
   * 결제 조회
   * GET /v1/payments/{paymentKey}
   */
  async getPayment(paymentKey: string): Promise<TossPaymentResponse> {
    return this.request<TossPaymentResponse>(
      "GET",
      `/payments/${paymentKey}`,
    );
  }

  /**
   * 빌링키 조회
   * GET /v1/billing/authorizations/{billingKey}
   */
  async getBillingKey(billingKey: string): Promise<TossBillingKeyResponse> {
    return this.request<TossBillingKeyResponse>(
      "GET",
      `/billing/authorizations/${billingKey}`,
    );
  }

  /**
   * 빌링키 삭제 (토스 측 빌링키 완전 삭제)
   * DELETE /v1/billing/{billingKey}
   *
   * 토스 공식 스펙: 삭제 후 해당 빌링키로 결제 불가
   * 응답: 200 OK (body 비어있음)
   */
  async deleteBillingKey(billingKey: string): Promise<void> {
    await this.request<void>("DELETE", `/billing/${billingKey}`);
  }

  /**
   * 공통 HTTP 요청 메서드
   * 에러 매핑, 로깅, 재시도 로직 통합
   */
  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    data?: Record<string, unknown> | object,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      "Content-Type": "application/json",
      ...extraHeaders,
    };

    try {
      let response;
      if (method === "GET") {
        response = await firstValueFrom(this.httpService.get<T>(url, { headers }));
      } else if (method === "DELETE") {
        response = await firstValueFrom(this.httpService.delete<T>(url, { headers }));
      } else {
        response = await firstValueFrom(this.httpService.post<T>(url, data, { headers }));
      }
      return response.data;
    } catch (error) {
      this.handleTossError(error as AxiosError<TossErrorResponse>, path);
    }
  }

  /**
   * 토스 에러 코드를 NestJS HttpException으로 매핑
   * https://docs.tosspayments.com/reference/error-codes
   */
  private handleTossError(
    error: AxiosError<TossErrorResponse>,
    path: string,
  ): never {
    const tossError = error.response?.data;
    const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
    const code = tossError?.code || "UNKNOWN_ERROR";
    const message = tossError?.message || "토스페이먼츠 요청 실패";

    this.logger.error(
      `[TossAPI] ${path} failed: ${code} - ${message} (HTTP ${status})`,
    );

    // 에러 코드별 HTTP 상태 매핑
    const statusMap: Record<string, HttpStatus> = {
      INVALID_API_KEY: HttpStatus.UNAUTHORIZED,
      UNAUTHORIZED_KEY: HttpStatus.UNAUTHORIZED,
      FORBIDDEN_REQUEST: HttpStatus.FORBIDDEN,
      NOT_FOUND_PAYMENT: HttpStatus.NOT_FOUND,
      NOT_FOUND_BILLING_KEY: HttpStatus.NOT_FOUND,
      ALREADY_PROCESSED_PAYMENT: HttpStatus.CONFLICT,
      DUPLICATED_ORDER_ID: HttpStatus.CONFLICT,
      INVALID_REQUEST: HttpStatus.BAD_REQUEST,
      EXCEED_MAX_AMOUNT: HttpStatus.BAD_REQUEST,
      BELOW_MIN_AMOUNT: HttpStatus.BAD_REQUEST,
      NOT_AVAILABLE_PAYMENT: HttpStatus.SERVICE_UNAVAILABLE,
    };

    const httpStatus = statusMap[code] || status;

    throw new HttpException(
      {
        statusCode: httpStatus,
        message,
        tossCode: code,
      },
      httpStatus,
    );
  }
}
