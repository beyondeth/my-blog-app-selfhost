"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

/** 결제 완료 후 백엔드에서 반환하는 구독 정보 */
interface SubscriptionResult {
  tier: string;
  billingCycle: string;
  amount: number;
  paymentKey: string;
  startDate?: string;
  endDate?: string;
  nextBillingDate?: string;
  planName?: string;
}

/** 플랜 tier를 사용자 친화적 이름으로 변환 */
function getTierDisplayName(tier: string): string {
  const map: Record<string, string> = {
    free: "Free",
    starter: "Starter",
    pro: "Pro",
    enterprise: "Enterprise",
  };
  return map[tier?.toLowerCase()] || tier;
}

/** 빌링 주기를 한국어로 변환 */
function getBillingCycleLabel(cycle: string): string {
  return cycle === "yearly" ? "연간" : "월간";
}

/** 금액 포맷팅 (원화) */
function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

/** 날짜 포맷팅 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateStr));
}

/**
 * 토스페이먼츠 빌링인증 성공 페이지
 *
 * 토스 결제창에서 카드 인증 완료 후 리다이렉트되는 페이지
 * URL 쿼리에서 authKey, customerKey를 추출하여 백엔드로 전송
 * 백엔드에서 빌링키 발급 + 첫 결제 실행 후 결과를 화면에 표시
 */
export default function TossSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<SubscriptionResult | null>(null);

  /** 중복 호출 방지: useRef + sessionStorage 이중 방어 */
  const isProcessing = useRef(false);

  useEffect(() => {
    const confirmBillingAuth = async () => {
      const authKey = searchParams.get("authKey");
      const customerKey = searchParams.get("customerKey");
      const tier = searchParams.get("tier");
      const billingCycle = searchParams.get("billingCycle");

      if (!authKey || !customerKey || !tier || !billingCycle) {
        setStatus("error");
        setErrorMessage("필수 파라미터가 누락되었습니다");
        return;
      }

      // ── 중복 호출 방지 (새로고침, 뒤로가기, StrictMode 대응) ──
      // 1) useRef: React StrictMode 더블 마운트 + 동일 렌더 내 재실행 방지
      if (isProcessing.current) return;
      isProcessing.current = true;

      // 2) sessionStorage: 브라우저 새로고침/뒤로가기 시에도 유지
      const storageKey = `toss_confirm_${authKey}`;
      const cached = sessionStorage.getItem(storageKey);
      if (cached) {
        try {
          const cachedResult = JSON.parse(cached) as SubscriptionResult;
          setResult(cachedResult);
          setStatus("success");
          return;
        } catch {
          // 캐시 파싱 실패 시 무시하고 진행
        }
      }

      try {
        const response = await fetch(
          `${API_URL}/subscription/toss/billing-auth/confirm`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              authKey,
              customerKey,
              tier,
              billingCycle,
            }),
          },
        );

        const data = await response.json();

        if (data.success) {
          const subscriptionResult: SubscriptionResult = {
            tier: data.data?.subscription?.tier || tier,
            billingCycle: data.data?.subscription?.billingCycle || billingCycle,
            amount: data.data?.amount || 0,
            paymentKey: data.data?.paymentKey || "",
            startDate: data.data?.subscription?.startDate,
            endDate: data.data?.subscription?.endDate,
            nextBillingDate: data.data?.subscription?.nextBillingDate,
            planName: data.data?.subscription?.plan?.displayName || data.data?.subscription?.plan?.name,
          };
          setResult(subscriptionResult);
          setStatus("success");

          // sessionStorage에 결과 캐시 (새로고침 시 재사용)
          try {
            sessionStorage.setItem(storageKey, JSON.stringify(subscriptionResult));
          } catch {
            // sessionStorage 쓰기 실패는 무시
          }
        } else {
          setStatus("error");
          setErrorMessage(data.message || "결제 처리 중 오류가 발생했습니다");
        }
      } catch {
        // 네트워크 에러 시 — 결제가 이미 성공했을 수 있으므로 안내 메시지 수정
        setStatus("error");
        setErrorMessage(
          "서버 연결에 실패했습니다. 결제가 이미 처리되었을 수 있으니, 새로고침 후 확인하거나 고객센터에 문의해주세요.",
        );
      }
    };

    confirmBillingAuth();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="max-w-md w-full">
        {/* ── 로딩 상태 ── */}
        {status === "loading" && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <div className="w-10 h-10 border-3 border-zinc-200 dark:border-zinc-700 border-t-zinc-900 dark:border-t-zinc-100 rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
              결제를 처리하고 있습니다
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              잠시만 기다려주세요...
            </p>
          </div>
        )}

        {/* ── 성공 상태 — 결제 내역 표시 ── */}
        {status === "success" && result && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* 상단 성공 헤더 */}
            <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 text-center">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-5 h-5 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                구독이 시작되었습니다
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                결제가 정상적으로 완료되었습니다
              </p>
            </div>

            {/* 결제 내역 */}
            <div className="px-6 py-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">플랜</span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {result.planName || getTierDisplayName(result.tier)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">결제 주기</span>
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {getBillingCycleLabel(result.billingCycle)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">결제 금액</span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                  ₩{formatAmount(result.amount)}
                </span>
              </div>

              {/* 구분선 */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">구독 시작일</span>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {formatDate(result.startDate)}
                  </span>
                </div>
              </div>

              {result.nextBillingDate && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">다음 결제일</span>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {formatDate(result.nextBillingDate)}
                  </span>
                </div>
              )}

              {result.paymentKey && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">결제 번호</span>
                  <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                    {result.paymentKey.slice(0, 20)}...
                  </span>
                </div>
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-3">
              <Link
                href="/settings/blog"
                className="flex-1 flex h-10 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                블로그 설정
              </Link>
              <Link
                href="/"
                className="flex-1 flex h-10 items-center justify-center rounded-lg bg-zinc-900 dark:bg-white text-sm font-medium text-white dark:text-zinc-900 transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-100"
              >
                홈으로
              </Link>
            </div>
          </div>
        )}

        {/* ── 에러 상태 ── */}
        {status === "error" && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
              결제 처리 실패
            </h2>
            <p className="text-sm text-red-500 dark:text-red-400 mt-2">
              {errorMessage}
            </p>
            <button
              onClick={() => router.push("/pricing")}
              className="mt-5 px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
