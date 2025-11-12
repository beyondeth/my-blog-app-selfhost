'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProviderV2';
import { AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { SocialLoginGroup } from '@/components/auth/SocialLoginGroup';
import Image from 'next/image';
import { useTheme } from 'next-themes';

/**
 * 로그인 페이지 메인 컴포넌트
 * useSearchParams를 사용하므로 Suspense로 감싸야 함
 */
function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, refreshUser } = useAuth();
  const { resolvedTheme } = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const MAX_LOGIN_ATTEMPTS = 5;

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const [validationErrors, setValidationErrors] = useState({
    email: '',
    password: ''
  });

  // 삭제된 계정 에러 상태
  const [accountDeletedError, setAccountDeletedError] = useState<{
    message: string;
    remainingDays: number;
  } | null>(null);

  // OAuth 콜백 에러 처리
  useEffect(() => {
    const error = searchParams.get('error');
    const message = searchParams.get('message');

    if (error && message) {
      // URL 파라미터에서 메시지 디코딩
      const decodedMessage = decodeURIComponent(message);

      if (error === 'account_deleted') {
        setAccountDeletedError({
          message: decodedMessage,
          remainingDays: 0
        });
      } else {
        toast.error(decodedMessage || '로그인에 실패했습니다.');
      }

      // URL에서 에러 파라미터 제거
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear validation error when user starts typing
    if (validationErrors[name as keyof typeof validationErrors]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1차 방어: 이미 처리 중이면 무시
    if (isSubmitting) {
      return;
    }

    // Check for too many failed attempts
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      toast.error('로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    // Validation
    const errors = {
      email: '',
      password: ''
    };

    if (!formData.email) {
      errors.email = '이메일을 입력해주세요';
    } else if (!validateEmail(formData.email)) {
      errors.email = '올바른 이메일 형식이 아닙니다';
    }

    if (!formData.password) {
      errors.password = '비밀번호를 입력해주세요';
    }

    if (errors.email || errors.password) {
      setValidationErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      // returnUrl 파라미터 확인 (OAuth 콜백 대기 중인 경우)
      const returnUrl = searchParams.get('returnUrl');

      // 로그인 요청 - returnUrl을 보내지 않음 (프론트엔드에서만 처리)
      await login(formData);

      // 로그인 직후 user 정보 새로고침하여 약관 동의 필드 최신화
      // ConsentGuard 타이밍 이슈 방지 (회원가입과 동일한 처리)
      await refreshUser();

      // OAuth 콜백 URL인 경우 직접 리다이렉트 (localhost:7777/callback)
      if (returnUrl && returnUrl.includes('localhost:7777/callback')) {
        window.location.href = returnUrl;
        return;
      }

      // 일반적인 경우 기존 로직 사용
      const redirectTo = returnUrl || sessionStorage.getItem('redirectAfterLogin') || '/';
      sessionStorage.removeItem('redirectAfterLogin');
      router.push(redirectTo);
    } catch (error: any) {
      console.error('Login failed:', error);

      // 삭제된 계정 에러 체크
      if (error.response?.code === 'ACCOUNT_DELETED' || error.code === 'ACCOUNT_DELETED') {
        setAccountDeletedError({
          message: error.response?.message || error.message || '계정이 삭제되었습니다.',
          remainingDays: error.response?.remainingDays || error.remainingDays || 0,
        });
        setFormData(prev => ({ ...prev, password: '' }));
        setIsSubmitting(false);
        return;
      }

      // Increment failed login attempts
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);

      // Clear password on failed login
      setFormData(prev => ({ ...prev, password: '' }));

      const errorMessage = error.message || '이메일 또는 비밀번호가 일치하지 않습니다';

      // 시도 횟수 표시 메시지
      const displayMessage = newAttempts < MAX_LOGIN_ATTEMPTS
        ? `${errorMessage} (${newAttempts}/${MAX_LOGIN_ATTEMPTS} 시도)`
        : errorMessage;

      toast.error(displayMessage);
      setValidationErrors(prev => ({ ...prev, password: displayMessage }));
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

      <div className="relative flex items-center justify-center min-h-screen px-2 sm:px-4 lg:px-8 py-4 sm:py-0">
        <div className="w-full max-w-3xl">
          {/* 뒤로가기 버튼 */}
          <button
            onClick={() => router.back()}
            className="mb-2 sm:mb-4 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {/* 통합된 로그인 카드 - Resend 스타일 */}
          <div className="auth-card rounded-2xl px-1 py-4 sm:py-8 fade-in-up">
            {/* 로고와 타이틀 - 카드 내부로 이동 */}
            <div className="text-center mb-4 sm:mb-8 w-full">
              <div className="inline-flex items-center justify-center mb-2 sm:mb-4">
                <Image
                  src="/assets/logo.svg"
                  alt="Logo"
                  width={48}
                  height={48}
                  priority
                  className="object-contain sm:w-16 sm:h-16"
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                다시 만나서 반가워요
              </h1>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                계정으로 <span className="font-medium">로그인</span>하세요
              </p>
            </div>

            {/* 삭제된 계정 경고 */}
            {accountDeletedError && (
              <div className="mb-3 sm:mb-6 p-4 sm:p-5 rounded-lg bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 w-full shake">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm sm:text-base font-semibold text-red-900 dark:text-red-200 mb-1">
                      계정이 삭제되었습니다
                    </h3>
                    <p className="text-xs sm:text-sm text-red-800 dark:text-red-300 mb-3">
                      {accountDeletedError.message}
                    </p>
                    {accountDeletedError.remainingDays === 0 && (
                      <Link
                        href="/register"
                        className="inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 rounded-lg transition-colors"
                      >
                        회원가입 페이지로 이동
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 에러 메시지들 */}
            {loginAttempts >= MAX_LOGIN_ATTEMPTS && (
              <div className="mb-3 sm:mb-6 p-3 sm:p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 shake w-full">
                <div className="flex items-start gap-2 sm:gap-3">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="text-xs sm:text-sm text-red-800 dark:text-red-300">
                    로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.
                  </div>
                </div>
              </div>
            )}

            {loginAttempts > 2 && loginAttempts < MAX_LOGIN_ATTEMPTS && (
              <div className="mb-3 sm:mb-6 p-3 sm:p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 w-full">
                <div className="flex items-start gap-2 sm:gap-3">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="text-xs sm:text-sm text-amber-800 dark:text-amber-300">
                    {MAX_LOGIN_ATTEMPTS - loginAttempts}회 시도 가능합니다.
                  </div>
                </div>
              </div>
            )}

            {/* 섹션 1: OAuth 로그인 */}
            <div className="w-full">
              <SocialLoginGroup
                providers={['google', 'github']}
                disabled={isSubmitting || loginAttempts >= MAX_LOGIN_ATTEMPTS}
              />
            </div>

            {/* 섹션 구분선 - 중요한 시각적 구분 역할 */}
            <div className="auth-divider my-3 sm:my-6 w-full text-xs sm:text-sm">or</div>

            {/* 섹션 2: 이메일/비밀번호 로그인 */}
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-5 w-full">
              {/* 이메일 필드 */}
              <div className="space-y-1 sm:space-y-2">
                <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                  이메일
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="vangogh@example.com"
                  className={`w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg auth-input text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 outline-none ${
                    validationErrors.email ? 'border-red-500 dark:border-red-400' : ''
                  } ${validationErrors.email ? 'shake' : ''}`}
                  disabled={isSubmitting}
                />
                {validationErrors.email && (
                  <p className="text-xs sm:text-sm text-red-600 dark:text-red-400">
                    {validationErrors.email}
                  </p>
                )}
              </div>

              {/* 비밀번호 필드 */}
              <div className="space-y-1 sm:space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    비밀번호
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
                  >
                    비밀번호를 잊으셨나요?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={`w-full px-4 sm:px-6 py-2.5 sm:py-3 pr-10 sm:pr-12 rounded-lg auth-input text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 outline-none ${
                      validationErrors.password ? 'border-red-500 dark:border-red-400' : ''
                    } ${validationErrors.password ? 'shake' : ''}`}
                    disabled={isSubmitting}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSubmit(e as any);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </button>
                </div>
                {validationErrors.password && (
                  <p className="text-xs sm:text-sm text-red-600 dark:text-red-400">
                    {validationErrors.password}
                  </p>
                )}
              </div>

              {/* 로그인 버튼 */}
              <button
                type="submit"
                disabled={isSubmitting || !formData.email || !formData.password || loginAttempts >= MAX_LOGIN_ATTEMPTS}
                className={`w-full py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg font-medium text-sm sm:text-base transition-all ${
                  formData.email && formData.password && !isSubmitting && loginAttempts < MAX_LOGIN_ATTEMPTS
                    ? 'auth-button-primary'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin h-3.5 w-3.5 sm:h-4 sm:w-4 border-2 border-white border-t-transparent rounded-full" />
                    로그인 중...
                  </span>
                ) : (
                  '이메일로 로그인'
                )}
              </button>
            </form>

            {/* Footer - Sign up 링크 */}
            <div className="mt-4 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700 w-full">
              <p className="text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                계정이 없으신가요?{' '}
                <Link
                  href="/register"
                  className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
                >
                  회원가입
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 로그인 페이지 (Suspense 래퍼)
 *
 * Next.js 16: fallback={null}은 하이드레이션 에러 발생
 * → 최소한의 로딩 상태를 제공해야 함
 */
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}