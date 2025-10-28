'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import Link from 'next/link';
import { toast } from 'sonner';
import Image from 'next/image';
import { useTheme } from 'next-themes';

/**
 * OAuth 로그인 후 약관 동의 페이지
 * 소셜 로그인 사용자가 최초 로그인 시 필수 약관 동의를 받는 페이지
 */
export default function ConsentPage() {
  const router = useRouter();
  const { user, isLoading, refreshUser } = useAuth();
  const { resolvedTheme } = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [consents, setConsents] = useState({
    isOver14: false,
    termsAccepted: false,
    privacyAccepted: false,
    marketingOptIn: false,
    newsletterOptIn: false,
    allAccepted: false,
  });

  // 로딩 중이면 로딩 화면 표시
  // OAuth 직후 user 정보가 로드될 때까지 대기
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-100 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 로딩 완료 후 user가 없으면 로그인 페이지로 리다이렉트
  if (!user) {
    router.push('/login');
    return null;
  }

  // 이미 약관 동의를 완료한 경우 메인 페이지로 리다이렉트
  if (user.termsAcceptedAt && user.privacyAcceptedAt) {
    router.push('/');
    return null;
  }

  /**
   * 개별 체크박스 변경 핸들러
   */
  const handleConsentChange = (key: keyof typeof consents) => {
    if (key === 'allAccepted') {
      // 전체 동의 토글
      const newValue = !consents.allAccepted;
      setConsents({
        isOver14: newValue,
        termsAccepted: newValue,
        privacyAccepted: newValue,
        marketingOptIn: newValue,
        newsletterOptIn: newValue,
        allAccepted: newValue,
      });
    } else {
      // 개별 체크박스 토글
      const newConsents = {
        ...consents,
        [key]: !consents[key],
      };

      // 전체 동의 상태 업데이트 (모든 항목이 체크되어 있으면 전체 동의도 체크)
      newConsents.allAccepted =
        newConsents.isOver14 &&
        newConsents.termsAccepted &&
        newConsents.privacyAccepted &&
        newConsents.marketingOptIn &&
        newConsents.newsletterOptIn;

      setConsents(newConsents);
    }
  };

  /**
   * 약관 동의 제출 핸들러
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 필수 항목 검증
    if (!consents.isOver14) {
      setError('만 14세 이상만 가입할 수 있습니다.');
      return;
    }

    if (!consents.termsAccepted || !consents.privacyAccepted) {
      setError('필수 약관에 모두 동의해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/consent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            isOver14: consents.isOver14,
            termsAccepted: consents.termsAccepted,
            privacyAccepted: consents.privacyAccepted,
            marketingOptIn: consents.marketingOptIn,
            newsletterOptIn: consents.newsletterOptIn,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '약관 동의 처리에 실패했습니다');
      }

      toast.success('약관 동의가 완료되었습니다!');

      // 사용자 정보 새로고침
      await refreshUser();

      // 메인 페이지로 강제 이동 (ConsentGuard 우회)
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || '약관 동의 처리 중 오류가 발생했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* 그라디언트 배경 효과 */}
      <div className="auth-gradient-light dark:hidden" />
      <div className="auth-gradient-dark hidden dark:block" />

      {/* 블러 오브 효과 */}
      <div className="blur-orb blur-orb-1 opacity-20 dark:opacity-10" />
      <div className="blur-orb blur-orb-2 opacity-20 dark:opacity-10" />

      <div className="relative flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-2xl">
          <div className="auth-card rounded-2xl p-8 fade-in-up">
            {/* 로고와 타이틀 */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center mb-4">
                <Image
                  src="/assets/logo.svg"
                  alt="Logo"
                  width={64}
                  height={64}
                  priority
                  className="object-contain"
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                약관 동의
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                서비스 이용을 위해 약관에 동의해주세요
              </p>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 shake">
                <div className="text-sm text-red-800 dark:text-red-300">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 약관 동의 섹션 */}
              <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                {/* 전체 동의 */}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consents.allAccepted}
                    onChange={() => handleConsentChange('allAccepted')}
                    className="mt-1 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    전체 동의
                  </span>
                </label>

                <div className="ml-6 space-y-2">
                  {/* 만 14세 이상 (필수) */}
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consents.isOver14}
                      onChange={() => handleConsentChange('isOver14')}
                      className="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="text-red-500">*</span> (필수) 본인은 만 14세 이상입니다
                    </span>
                  </label>

                  {/* 이용약관 (필수) */}
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consents.termsAccepted}
                      onChange={() => handleConsentChange('termsAccepted')}
                      className="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="text-red-500">*</span> (필수){' '}
                      <Link
                        href="/legal/terms"
                        target="_blank"
                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        이용약관
                      </Link>
                      에 동의합니다
                    </span>
                  </label>

                  {/* 개인정보 처리방침 (필수) */}
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consents.privacyAccepted}
                      onChange={() => handleConsentChange('privacyAccepted')}
                      className="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="text-red-500">*</span> (필수){' '}
                      <Link
                        href="/legal/privacy"
                        target="_blank"
                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        개인정보 처리방침
                      </Link>
                      에 동의합니다
                    </span>
                  </label>

                  {/* 마케팅 수신 동의 (선택) */}
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consents.marketingOptIn}
                      onChange={() => handleConsentChange('marketingOptIn')}
                      className="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      (선택) 마케팅 정보 수신에 동의합니다{' '}
                      <Link
                        href="/legal/marketing-consent"
                        target="_blank"
                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        (자세히 보기)
                      </Link>
                    </span>
                  </label>

                  {/* 뉴스레터 수신 동의 (선택) */}
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consents.newsletterOptIn}
                      onChange={() => handleConsentChange('newsletterOptIn')}
                      className="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      (선택) 뉴스레터 수신에 동의합니다{' '}
                      <Link
                        href="/legal/newsletter-consent"
                        target="_blank"
                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        (자세히 보기)
                      </Link>
                    </span>
                  </label>
                </div>
              </div>

              {/* 동의 버튼 */}
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  !consents.isOver14 ||
                  !consents.termsAccepted ||
                  !consents.privacyAccepted
                }
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                  !isSubmitting &&
                  consents.isOver14 &&
                  consents.termsAccepted &&
                  consents.privacyAccepted
                    ? 'auth-button-primary'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    처리 중...
                  </span>
                ) : (
                  '동의하고 계속하기'
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                동의함으로써{' '}
                <Link href="/legal/terms" className="text-gray-700 dark:text-gray-300 underline">
                  이용약관
                </Link>
                {' '}및{' '}
                <Link href="/legal/privacy" className="text-gray-700 dark:text-gray-300 underline">
                  개인정보 처리방침
                </Link>
                에 동의하게 됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
