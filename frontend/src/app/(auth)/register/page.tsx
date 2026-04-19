'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProviderV2';
import { EmailVerification } from '@/components/auth/EmailVerification';
import { Eye, EyeOff, Lock, User, Check, X, ArrowLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { SocialLoginGroup } from '@/components/auth/SocialLoginGroup';
import {
  validatePasswordStrength,
  getPasswordStrengthColor,
  getPasswordStrengthWidth,
  getPasswordRequirementLabels,
} from '@/lib/password-utils';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { parseMcpScopes } from '@/lib/mcpScopes';
import { isSafeRedirectUrl } from '@/lib/utils/sanitize';
import { useLocaleContext } from '@/providers/LocaleProvider';

const AUTH_REDIRECT_BLOCKLIST = ['/login', '/register', '/forgot-password', '/reset-password'];
const HANGUL_PATTERN = /[가-힣]/;

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { href, locale } = useLocaleContext();
  const queryClient = useQueryClient();
  const { register, isLoading, clearError, refreshUser } = useAuth();
  const { resolvedTheme } = useTheme();
  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [shakeField, setShakeField] = useState<string | null>(null);

  // 비밀번호 강도 상태
  const [passwordStrength, setPasswordStrength] = useState<ReturnType<typeof validatePasswordStrength> | null>(null);

  // 약관 동의 상태
  const [consents, setConsents] = useState({
    isOver14: false,
    termsAccepted: false,
    privacyAccepted: false,
    marketingOptIn: false,
    newsletterOptIn: false,
    allAccepted: false
  });

  const isMcpOAuth = searchParams.get('mcp_oauth') === 'true';
  const mcpState = searchParams.get('state');
  const mcpCallbackUrl = searchParams.get('callback_url');
  const mcpClientName = searchParams.get('client_name') || 'Claude';
  const mcpScope = searchParams.get('scope') || 'mcp:tools';
  const requestedMcpScopes = parseMcpScopes(mcpScope);
  const passwordLabels = getPasswordRequirementLabels(locale);
  const signUpFailedFallback = locale === 'ko' ? '회원가입에 실패했습니다.' : 'Sign up failed.';
  const usernameTakenFallback =
    locale === 'ko'
      ? '이미 사용 중인 사용자명입니다.'
      : 'This display name is already taken. Choose a different one.';
  const emailTakenFallback =
    locale === 'ko'
      ? '이미 등록된 이메일입니다. 로그인 페이지에서 로그인해주세요.'
      : 'An account already exists for this email. Please sign in instead.';
  const passwordReviewFallback =
    locale === 'ko'
      ? '비밀번호 요구사항을 확인해주세요.'
      : 'Review the password requirements and try again.';

  const localizeServerMessage = (message: string | null | undefined, fallback: string) => {
    if (!message) {
      return fallback;
    }

    if (locale === 'en' && HANGUL_PATTERN.test(message)) {
      if (message.includes('이미 사용 중인')) {
        return usernameTakenFallback;
      }
      if (message.includes('이미 존재하는 회원') || message.includes('이미 등록된 이메일')) {
        return emailTakenFallback;
      }
      if (message.includes('비밀번호')) {
        return passwordReviewFallback;
      }

      return fallback;
    }

    return message;
  };

  const normalizeRedirectTarget = (target?: string | null) => {
    if (typeof window === 'undefined' || !target) {
      return '/';
    }

    const trimmed = target.trim();
    if (!trimmed) {
      return '/';
    }

    if (AUTH_REDIRECT_BLOCKLIST.some(path => trimmed === path || trimmed.startsWith(`${path}?`))) {
      return '/';
    }

    try {
      if (!isSafeRedirectUrl(trimmed)) {
        return '/';
      }
    } catch {
      return '/';
    }

    if (trimmed.startsWith('http')) {
      try {
        const parsed = new URL(trimmed);
        if (parsed.origin !== window.location.origin) {
          return '/';
        }
        return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
      } catch {
        return '/';
      }
    }

    return trimmed;
  };

  const getRedirectTargetFromParams = () => {
    if (typeof window === 'undefined') {
      return null;
    }

    const params = [searchParams.get('returnUrl'), searchParams.get('redirect')];
    for (const value of params) {
      if (!value) continue;
      try {
        if (isSafeRedirectUrl(value)) {
          return value;
        }
      } catch {
        continue;
      }
    }

    return null;
  };

  const resolveRedirectTarget = () => {
    const paramTarget = getRedirectTargetFromParams();
    const sessionTarget = typeof window !== 'undefined'
      ? sessionStorage.getItem('redirectAfterLogin')
      : null;

    return normalizeRedirectTarget(paramTarget || sessionTarget || '/');
  };

  const returnUrlParam = getRedirectTargetFromParams();
  const loginHref = isMcpOAuth && mcpState && mcpCallbackUrl
    ? `${href('/login')}?mcp_oauth=true&state=${encodeURIComponent(mcpState)}&callback_url=${encodeURIComponent(mcpCallbackUrl)}&client_name=${encodeURIComponent(mcpClientName)}&scope=${encodeURIComponent(mcpScope)}${returnUrlParam ? `&returnUrl=${encodeURIComponent(returnUrlParam)}` : ''}`
    : `${href('/login')}${returnUrlParam ? `?returnUrl=${encodeURIComponent(returnUrlParam)}` : ''}`;

  // 컴포넌트 마운트 시 전역 에러 초기화
  useEffect(() => {
    clearError();
    // clearError는 컨텍스트에서 재생성될 수 있으므로 최초 마운트에서만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MCP OAuth 컨텍스트 보존
  // - 회원가입 페이지에서 직접 로그인/소셜 가입이 진행돼도
  //   OAuth complete 단계가 이어질 수 있도록 state를 유지합니다.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isMcpOAuth || !mcpState || !mcpCallbackUrl) return;

    const mcpOAuthData = {
      state: mcpState,
      callback_url: mcpCallbackUrl,
      client_name: mcpClientName,
      scope: mcpScope,
    };

    sessionStorage.setItem('mcpOAuth', JSON.stringify(mcpOAuthData));
  }, [isMcpOAuth, mcpState, mcpCallbackUrl, mcpClientName, mcpScope]);

  // 비밀번호 강도 체크
  useEffect(() => {
    if (formData.password) {
      const strength = validatePasswordStrength(formData.password, locale);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(null);
    }
  }, [formData.password, locale]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // 필드 에러 초기화
    if (fieldErrors[name as keyof typeof fieldErrors]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    if (error) setError('');
  };

  // 에러 발생 시 해당 필드로 포커스 이동 및 애니메이션
  const focusErrorField = (fieldName: string) => {
    let fieldRef: React.RefObject<HTMLInputElement> | null = null;

    switch(fieldName) {
      case 'username':
        fieldRef = usernameRef;
        break;
      case 'email':
        fieldRef = emailRef;
        break;
      case 'password':
        fieldRef = passwordRef;
        break;
      case 'confirmPassword':
        fieldRef = confirmPasswordRef;
        break;
    }

    if (fieldRef?.current) {
      // 필드로 스크롤 및 포커스
      fieldRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        fieldRef.current?.focus();
        fieldRef.current?.select();
      }, 300);

      // 흔들림 애니메이션
      setShakeField(fieldName);
      setTimeout(() => setShakeField(null), 500);
    }
  };

  const handleEmailChange = (email: string) => {
    setFormData(prev => ({ ...prev, email }));
    // 이메일이 변경되면 인증 상태 초기화
    setIsEmailVerified(false);
    setEmailVerificationToken('');
  };

  const handleEmailVerified = (sessionToken: string) => {
    setIsEmailVerified(true);
    setEmailVerificationToken(sessionToken);
  };

  // 약관 동의 핸들러
  const handleConsentChange = (field: keyof typeof consents) => {
    if (field === 'allAccepted') {
      const newValue = !consents.allAccepted;
      setConsents({
        isOver14: newValue,
        termsAccepted: newValue,
        privacyAccepted: newValue,
        marketingOptIn: newValue,
        newsletterOptIn: newValue,
        allAccepted: newValue
      });
    } else {
      setConsents(prev => {
        const updated = { ...prev, [field]: !prev[field] };
        // 전체 동의 상태 업데이트
        updated.allAccepted =
          updated.isOver14 &&
          updated.termsAccepted &&
          updated.privacyAccepted &&
          updated.marketingOptIn &&
          updated.newsletterOptIn;
        return updated;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username || !formData.email || !formData.password) {
      setError(locale === 'ko' ? '모든 필드를 입력해주세요.' : 'Complete all required fields.');
      return;
    }

    if (!isEmailVerified) {
      setError(locale === 'ko' ? '이메일 인증을 완료해주세요.' : 'Complete email verification first.');
      return;
    }

    // 약관 동의 체크
    if (!consents.isOver14) {
      setError(locale === 'ko' ? '만 14세 이상만 가입할 수 있습니다.' : 'This service is available only to eligible users.');
      return;
    }

    if (!consents.termsAccepted || !consents.privacyAccepted) {
      setError(locale === 'ko' ? '필수 약관에 모두 동의해주세요.' : 'Please agree to the required terms.');
      return;
    }

    // 비밀번호 강도 체크
    if (!passwordStrength || !passwordStrength.isValid) {
      setError(passwordStrength?.message || (locale === 'ko' ? '비밀번호 요구사항을 확인해주세요.' : 'Check the password requirements.'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(locale === 'ko' ? '비밀번호가 일치하지 않습니다.' : 'Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setFieldErrors({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    });

    try {
      // 회원가입 - register API가 blog 정보를 포함해서 응답하므로
      // useRegister의 onSuccess에서 자동으로 캐시에 저장됨 (근본적 해결)
      await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        emailVerificationToken,
        isOver14: consents.isOver14,
        termsAccepted: consents.termsAccepted,
        privacyAccepted: consents.privacyAccepted,
        marketingOptIn: consents.marketingOptIn,
        newsletterOptIn: consents.newsletterOptIn
      });

      // 회원가입 직후 user 정보 새로고침하여 약관 동의 필드 최신화
      // ConsentGuard 타이밍 이슈 방지
      await refreshUser();

      const redirectTarget = resolveRedirectTarget();
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('redirectAfterLogin');
      }
      router.push(redirectTarget);
    } catch (error: any) {
      // 에러 메시지에 따라 적절한 필드에 에러 표시
      const message = localizeServerMessage(error.message, signUpFailedFallback);

      // "이미 사용 중인 'Park'입니다" 형태의 메시지 체크
      if (message.includes("이미 사용 중인") && message.includes("입니다")) {
        setFieldErrors(prev => ({ ...prev, username: message }));
        focusErrorField('username');
      } else if (message === usernameTakenFallback) {
        setFieldErrors(prev => ({ ...prev, username: message }));
        focusErrorField('username');
      } else if (message.includes('이미 존재하는 회원') || message.includes('이미 등록된 이메일')) {
        setFieldErrors(prev => ({ ...prev, email: message }));
        focusErrorField('email');
      } else if (message === emailTakenFallback) {
        setFieldErrors(prev => ({ ...prev, email: message }));
        focusErrorField('email');
      } else if (message.includes('비밀번호') || message.includes('password')) {
        setFieldErrors(prev => ({ ...prev, password: message }));
        focusErrorField('password');
      } else {
        // 일반적인 에러는 상단에 표시
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

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
          {/* 뒤로가기 버튼 */}
          <button
            onClick={() => router.back()}
            className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {locale === 'ko' ? '뒤로가기' : 'Back'}
          </button>

          {/* 통합된 회원가입 카드 - Resend 스타일 */}
          <div className="auth-card rounded-2xl px-1 py-4 sm:py-8 fade-in-up flex flex-col items-center">
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
                {locale === 'ko' ? '계정 만들기' : 'Create your account'}
              </h1>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {locale === 'ko' ? '이미 계정이 있으신가요?' : 'Already have an account?'}{' '}
                <Link
                  href={loginHref}
                  className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
                >
                  {locale === 'ko' ? '로그인' : 'Sign in'}
                </Link>
              </p>
            </div>

            {isMcpOAuth && mcpState && mcpCallbackUrl && (
              <div className="mb-3 sm:mb-6 w-full rounded-lg border border-indigo-200 bg-indigo-50 p-4 sm:p-5 dark:border-indigo-700 dark:bg-indigo-900/20">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-800">
                    <Lock className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm sm:text-base font-semibold text-indigo-900 dark:text-indigo-100">
                      {locale === 'ko'
                        ? `${mcpClientName} 연결을 위한 계정 준비`
                        : `Prepare your account for ${mcpClientName}`}
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-indigo-700 dark:text-indigo-300">
                      {locale === 'ko'
                        ? `회원가입 후 ${mcpClientName}가 사용할 권한은 아래와 같습니다.`
                        : `After sign up, ${mcpClientName} will request the following permissions.`}
                    </p>
                    <div className="mt-3 space-y-2">
                      {requestedMcpScopes.map((scope) => (
                        <div
                          key={scope.scope}
                          className="rounded-lg border border-indigo-100 bg-white/60 px-3 py-2 text-xs dark:border-indigo-800/60 dark:bg-indigo-950/30"
                        >
                          <p className="font-semibold text-indigo-900 dark:text-indigo-100">{scope.label}</p>
                          <p className="mt-1 text-indigo-700 dark:text-indigo-300">{scope.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 섹션 1: OAuth 회원가입 */}
            <div className="w-full">
              <SocialLoginGroup
                providers={['google', 'github']}
                disabled={isSubmitting}
              />
            </div>

            {/* 섹션 구분선 */}
            <div className="auth-divider my-3 sm:my-6 w-full text-xs sm:text-sm">{locale === 'ko' ? '또는' : 'or'}</div>

            {/* 섹션 2: 이메일 회원가입 폼 */}
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-5 w-full">
              {error && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-300 shake">
                  {error}
                </div>
              )}

              {/* 닉네임 필드 */}
              <div className="space-y-1 sm:space-y-2">
                <label htmlFor="username" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                  {locale === 'ko' ? '닉네임' : 'Display name'}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4 sm:w-5 sm:h-5" />
                  <input
                    ref={usernameRef}
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className={`w-full pl-9 sm:pl-10 pr-4 sm:pr-4 py-2.5 sm:py-3 rounded-lg auth-input text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 outline-none ${
                      fieldErrors.username ? 'border-red-500 dark:border-red-400' : ''
                    } ${shakeField === 'username' ? 'shake' : ''}`}
                    placeholder={locale === 'ko' ? '실명이 아닌 별명을 사용하세요' : 'Choose a public display name'}
                    required
                  />
                </div>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                  {locale === 'ko' ? '프로필에서 변경 가능합니다' : 'You can change this later in your profile.'}
                </p>
                {fieldErrors.username && (
                  <p className="text-xs sm:text-sm text-red-600 dark:text-red-400">{fieldErrors.username}</p>
                )}
              </div>

              {/* 이메일 필드 with 인증 */}
              <div className="space-y-2">
                <EmailVerification
                  email={formData.email}
                  onVerified={handleEmailVerified}
                  onEmailChange={handleEmailChange}
                  disabled={isSubmitting}
                  ref={emailRef}
                  className={shakeField === 'email' ? 'shake' : ''}
                />
                {fieldErrors.email && (
                  <p className="text-sm text-red-600 dark:text-red-400">{fieldErrors.email}</p>
                )}
              </div>

              {/* 비밀번호 필드 */}
              <div className="space-y-1 sm:space-y-2">
                <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                  {locale === 'ko' ? '비밀번호' : 'Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4 sm:w-5 sm:h-5" />
                  <input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full pl-9 sm:pl-10 pr-10 sm:pr-12 py-2.5 sm:py-3 rounded-lg auth-input text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 outline-none ${
                      fieldErrors.password ? 'border-red-500 dark:border-red-400' : ''
                    } ${shakeField === 'password' ? 'shake' : ''}`}
                    placeholder={locale === 'ko' ? '최소 8자 이상' : 'At least 8 characters'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-xs sm:text-sm text-red-600 dark:text-red-400">{fieldErrors.password}</p>
                )}

                {/* 비밀번호 강도 표시기 */}
                {passwordStrength && formData.password && (
                  <div className="space-y-2 fade-in-up">
                    {/* 강도 프로그레스 바 */}
                    <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          passwordStrength.strength === 'weak' ? 'bg-red-500' :
                          passwordStrength.strength === 'fair' ? 'bg-amber-500' :
                          passwordStrength.strength === 'good' ? 'bg-blue-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: getPasswordStrengthWidth(passwordStrength.score) }}
                      />
                    </div>

                    {/* 강도 메시지 */}
                    <p className={`text-xs ${getPasswordStrengthColor(passwordStrength.strength)}`}>
                      {passwordStrength.message}
                    </p>

                    {/* 체크리스트 */}
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className={`flex items-center gap-1 ${passwordStrength.hasMinLength ? 'text-green-600' : 'text-gray-400'}`}>
                        {passwordStrength.hasMinLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        <span>{passwordLabels.minLength}</span>
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.hasUpperCase ? 'text-green-600' : 'text-gray-400'}`}>
                        {passwordStrength.hasUpperCase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        <span>{passwordLabels.upperCase}</span>
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.hasLowerCase ? 'text-green-600' : 'text-gray-400'}`}>
                        {passwordStrength.hasLowerCase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        <span>{passwordLabels.lowerCase}</span>
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.hasNumber ? 'text-green-600' : 'text-gray-400'}`}>
                        {passwordStrength.hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        <span>{passwordLabels.number}</span>
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.hasSpecialChar ? 'text-green-600' : 'text-gray-400'}`}>
                        {passwordStrength.hasSpecialChar ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        <span>{passwordLabels.specialChar}</span>
                      </div>
                      <div className={`flex items-center gap-1 ${!passwordStrength.hasForbiddenChars ? 'text-green-600' : 'text-red-500'}`}>
                        {!passwordStrength.hasForbiddenChars ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        <span>{passwordLabels.noForbiddenChars}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 비밀번호 확인 필드 */}
              <div className="space-y-1 sm:space-y-2">
                <label htmlFor="confirmPassword" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                  {locale === 'ko' ? '비밀번호 확인' : 'Confirm password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4 sm:w-5 sm:h-5" />
                  <input
                    ref={confirmPasswordRef}
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`w-full pl-9 sm:pl-10 pr-10 sm:pr-12 py-2.5 sm:py-3 rounded-lg auth-input text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 outline-none ${
                      fieldErrors.confirmPassword ? 'border-red-500 dark:border-red-400' : ''
                    } ${shakeField === 'confirmPassword' ? 'shake' : ''}`}
                    placeholder={locale === 'ko' ? '비밀번호 재입력' : 'Re-enter your password'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="text-xs sm:text-sm text-red-600 dark:text-red-400">{fieldErrors.confirmPassword}</p>
                )}
              </div>

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
                    {locale === 'ko' ? '전체 동의' : 'Accept all'}
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
                      <span className="text-red-500">*</span>{' '}
                      {locale === 'ko'
                        ? '(필수) 본인은 만 14세 이상입니다'
                        : 'I confirm that I meet the minimum age requirement. (required)'}
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
                      {locale === 'ko' ? (
                        <>
                          <span className="text-red-500">*</span> (필수){' '}
                          <Link
                            href={href('/legal/terms')}
                            target="_blank"
                            className="text-indigo-600 dark:text-indigo-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            이용약관
                          </Link>
                          에 동의합니다
                        </>
                      ) : (
                        <>
                          <span className="text-red-500">*</span> I agree to the{' '}
                          <Link
                            href={href('/legal/terms')}
                            target="_blank"
                            className="text-indigo-600 dark:text-indigo-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Terms of Service
                          </Link>{' '}
                          (required)
                        </>
                      )}
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
                      {locale === 'ko' ? (
                        <>
                          <span className="text-red-500">*</span> (필수){' '}
                          <Link
                            href={href('/legal/privacy')}
                            target="_blank"
                            className="text-indigo-600 dark:text-indigo-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            개인정보 처리방침
                          </Link>
                          에 동의합니다
                        </>
                      ) : (
                        <>
                          <span className="text-red-500">*</span> I agree to the{' '}
                          <Link
                            href={href('/legal/privacy')}
                            target="_blank"
                            className="text-indigo-600 dark:text-indigo-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Privacy Policy
                          </Link>{' '}
                          (required)
                        </>
                      )}
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
                      {locale === 'ko' ? '(선택) 마케팅 정보 수신에 동의합니다' : 'Receive marketing updates (optional)'}{' '}
                      <Link
                        href={href('/legal/marketing-consent')}
                        target="_blank"
                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {locale === 'ko' ? '(자세히 보기)' : '(details)'}
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
                      {locale === 'ko' ? '(선택) 뉴스레터 수신에 동의합니다' : 'Receive the newsletter (optional)'}{' '}
                      <Link
                        href={href('/legal/newsletter-consent')}
                        target="_blank"
                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {locale === 'ko' ? '(자세히 보기)' : '(details)'}
                      </Link>
                    </span>
                  </label>
                </div>
              </div>

              {/* 회원가입 버튼 */}
              <button
                type="submit"
                disabled={isSubmitting || !isEmailVerified || !consents.isOver14 || !consents.termsAccepted || !consents.privacyAccepted}
                className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
                  !isSubmitting && isEmailVerified && consents.isOver14 && consents.termsAccepted && consents.privacyAccepted
                    ? 'auth-button-primary'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                {!isEmailVerified ? (locale === 'ko' ? '먼저 이메일을 인증해주세요' : 'Verify your email first') :
                 (!consents.isOver14 || !consents.termsAccepted || !consents.privacyAccepted) ? (locale === 'ko' ? '필수 약관에 동의해주세요' : 'Agree to the required terms') :
                  isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      {locale === 'ko' ? '계정 생성 중...' : 'Creating account...'}
                    </span>
                  ) : (
                    locale === 'ko' ? '계정 만들기' : 'Create account'
                  )
                }
              </button>
            </form>

            {/* Footer - Terms와 Login 링크 */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-3">
                {locale === 'ko' ? '회원가입함으로써 ' : 'By signing up you agree to the '}
                <Link href={href('/legal/terms')} className="text-gray-700 dark:text-gray-300 underline">
                  {locale === 'ko' ? '이용약관' : 'Terms of Service'}
                </Link>
                {locale === 'ko' ? ' 및 ' : ' and '}
                <Link href={href('/legal/privacy')} className="text-gray-700 dark:text-gray-300 underline">
                  {locale === 'ko' ? '개인정보 처리방침' : 'Privacy Policy'}
                </Link>
                {locale === 'ko' ? '에 동의하게 됩니다.' : '.'}
              </p>
              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                {locale === 'ko' ? '이미 계정이 있으신가요?' : 'Already have an account?'}{' '}
                <Link
                  href={href('/login')}
                  className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
                >
                  {locale === 'ko' ? '로그인' : 'Sign in'}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
