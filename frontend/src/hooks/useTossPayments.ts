"use client";

import { useCallback, useRef } from "react";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

if (!TOSS_CLIENT_KEY) {
  // 개발 환경에서만 경고, 프로덕션에서는 에러
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[TossPayments] NEXT_PUBLIC_TOSS_CLIENT_KEY 환경변수가 설정되지 않았습니다",
    );
  }
  console.warn(
    "[TossPayments] NEXT_PUBLIC_TOSS_CLIENT_KEY 미설정 — .env.local에 추가하세요",
  );
}

/**
 * 토스페이먼츠 SDK 초기화 훅
 *
 * 결제창 방식 (ck/sk 키) — requestBillingAuth() 사용
 * 구독 정기결제를 위한 빌링키 발급에 사용
 */
export function useTossPayments() {
  const tossRef = useRef<Awaited<ReturnType<typeof loadTossPayments>> | null>(
    null,
  );

  /**
   * SDK 인스턴스 초기화 (lazy)
   */
  const getInstance = useCallback(async () => {
    if (!TOSS_CLIENT_KEY) {
      throw new Error("토스페이먼츠 클라이언트 키가 설정되지 않았습니다");
    }
    if (!tossRef.current) {
      tossRef.current = await loadTossPayments(TOSS_CLIENT_KEY!);
    }
    return tossRef.current;
  }, []);

  /**
   * 빌링인증 요청 (카드 등록)
   * 토스 결제창으로 리다이렉트되어 카드 인증 후 successUrl로 돌아옴
   */
  const requestBillingAuth = useCallback(
    async (params: {
      customerKey: string;
      successUrl: string;
      failUrl: string;
    }) => {
      const toss = await getInstance();
      const payment = toss.payment({ customerKey: params.customerKey });

      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: params.successUrl,
        failUrl: params.failUrl,
      });
    },
    [getInstance],
  );

  /**
   * 일회성 결제 요청 (마켓플레이스용 — Phase B)
   */
  const requestPayment = useCallback(
    async (params: {
      orderId: string;
      orderName: string;
      amount: number;
      customerKey: string;
      successUrl: string;
      failUrl: string;
    }) => {
      const toss = await getInstance();
      const payment = toss.payment({ customerKey: params.customerKey });

      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: params.amount },
        orderId: params.orderId,
        orderName: params.orderName,
        successUrl: params.successUrl,
        failUrl: params.failUrl,
      });
    },
    [getInstance],
  );

  return {
    requestBillingAuth,
    requestPayment,
  };
}
