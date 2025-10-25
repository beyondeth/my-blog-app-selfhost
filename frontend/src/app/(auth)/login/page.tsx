'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProviderV2';
import { AlertCircle, Eye, EyeOff, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { SocialLoginGroup } from '@/components/auth/SocialLoginGroup';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authMethodHint, setAuthMethodHint] = useState<any>(null);
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

  // Check auth method when email loses focus
  const handleEmailBlur = async () => {
    if (!formData.email || !validateEmail(formData.email)) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/check-auth-method`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email })
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          setAuthMethodHint({
            exists: true,
            authMethod: data.authMethod,  // 'password' | 'oauth' | 'both'
            message: data.message
          });

          // OAuth만 사용 가능한 경우 알림 표시
          if (data.authMethod === 'oauth') {
            toast.info(data.message);
          }
        } else {
          setAuthMethodHint({
            exists: false,
            message: '계정이 없습니다. 회원가입을 진행해주세요.'
          });
        }
      }
    } catch (error) {
      console.error('Failed to check auth method:', error);
    }
  };

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
      toast.success('로그인 성공!');

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

      // Increment failed login attempts
      setLoginAttempts(prev => prev + 1);

      // Clear password on failed login
      setFormData(prev => ({ ...prev, password: '' }));

      const errorMessage = error.message || '로그인에 실패했습니다';
      toast.error(errorMessage);

      if (errorMessage.includes('비밀번호')) {
        setValidationErrors(prev => ({ ...prev, password: errorMessage }));
      } else {
        setValidationErrors(prev => ({ ...prev, email: errorMessage }));
      }
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

      <div className="relative flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* 통합된 로그인 카드 - Resend 스타일 */}
          <div className="auth-card rounded-2xl p-8 fade-in-up">
            {/* 로고와 타이틀 - 카드 내부로 이동 */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 mb-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                <Sparkles className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                다시 만나서 반가워요
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                계정으로 <span className="font-medium">로그인</span>하세요
              </p>
            </div>

            {/* 에러 메시지들 */}
            {loginAttempts >= MAX_LOGIN_ATTEMPTS && (
              <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 shake">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="text-sm text-red-800 dark:text-red-300">
                    로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.
                  </div>
                </div>
              </div>
            )}

            {loginAttempts > 2 && loginAttempts < MAX_LOGIN_ATTEMPTS && (
              <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-300">
                    {MAX_LOGIN_ATTEMPTS - loginAttempts}회 시도 가능합니다.
                  </div>
                </div>
              </div>
            )}

            {/* 섹션 1: OAuth 로그인 */}
            <div className="mb-6">
              <SocialLoginGroup
                providers={['google', /* 'kakao', */ 'github']}
                disabled={isSubmitting || loginAttempts >= MAX_LOGIN_ATTEMPTS}
              />
            </div>

            {/* 섹션 구분선 - 중요한 시각적 구분 역할 */}
            <div className="auth-divider mb-6">또는</div>

            {/* 섹션 2: 이메일/비밀번호 로그인 */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 이메일 필드 */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  이메일
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleEmailBlur}
                  placeholder="example@email.com"
                  className={`w-full px-4 py-3 rounded-lg auth-input text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 outline-none ${
                    validationErrors.email ? 'border-red-500 dark:border-red-400' : ''
                  } ${validationErrors.email ? 'shake' : ''}`}
                  disabled={isSubmitting}
                />
                {authMethodHint && !validationErrors.email && (
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    💡 {authMethodHint.message}
                  </p>
                )}
                {validationErrors.email && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {validationErrors.email}
                  </p>
                )}
              </div>

              {/* 비밀번호 필드 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    비밀번호
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
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
                    className={`w-full px-4 py-3 pr-12 rounded-lg auth-input text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 outline-none ${
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
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {validationErrors.password && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {validationErrors.password}
                  </p>
                )}
              </div>

              {/* 로그인 버튼 */}
              <button
                type="submit"
                disabled={isSubmitting || !formData.email || !formData.password || loginAttempts >= MAX_LOGIN_ATTEMPTS}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                  formData.email && formData.password && !isSubmitting && loginAttempts < MAX_LOGIN_ATTEMPTS
                    ? 'auth-button-primary'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    로그인 중...
                  </span>
                ) : (
                  '이메일로 로그인'
                )}
              </button>
            </form>

            {/* Footer - Terms와 Sign up 링크 */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-3">
                로그인함으로써{' '}
                <Link href="/legal/terms" className="text-gray-700 dark:text-gray-300 underline">
                  이용약관
                </Link>
                {' '}및{' '}
                <Link href="/legal/privacy" className="text-gray-700 dark:text-gray-300 underline">
                  개인정보 처리방침
                </Link>
                에 동의하게 됩니다.
              </p>
              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
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