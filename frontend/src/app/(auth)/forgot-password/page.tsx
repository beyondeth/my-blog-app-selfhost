'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, Mail, ArrowLeft, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { SocialLoginButton } from '@/components/auth/SocialLoginButton';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSocialAccount, setIsSocialAccount] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [emailError, setEmailError] = useState('');
  const MAX_ATTEMPTS = 3;

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setEmailError('');

    // Rate limiting
    if (attemptCount >= MAX_ATTEMPTS) {
      toast.error('너무 많은 시도입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    // Email validation
    if (!email) {
      setEmailError('이메일을 입력해주세요');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('올바른 이메일 형식이 아닙니다');
      return;
    }

    setIsSubmitting(true);

    try {
      // 먼저 이메일 존재 여부 확인
      const checkResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/check-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        }
      );

      const checkData = await checkResponse.json();

      if (!checkResponse.ok || !checkData.success) {
        setEmailError('존재하지 않는 이메일입니다');
        return;
      }

      // 이메일이 존재하지 않는 경우
      if (!checkData.exists) {
        setEmailError('존재하지 않는 이메일입니다');
        setAttemptCount(prev => prev + 1);
        return;
      }

      // 이메일이 존재하는 경우 비밀번호 재설정 요청
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/forgot-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setIsSubmitted(true);
        toast.success('이메일을 확인해주세요');
      } else {
        // 소셜 로그인 계정인 경우 (보안을 위해 일반 에러로 처리)
        if (response.status === 400 && data.message?.includes('소셜 로그인')) {
          setIsSubmitted(true);
          toast.success('이메일을 확인해주세요'); // 소셜 계정임을 숨김
        } else {
          setIsSubmitted(true);
          toast.success('이메일을 확인해주세요');
        }
      }

      setAttemptCount(prev => prev + 1);
    } catch (error) {
      console.error('Password reset request failed:', error);
      toast.error('요청 처리 중 오류가 발생했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clear error when email changes
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setEmailError('');
  };

  // 소셜 로그인 계정 안내 화면
  if (isSocialAccount) {
    return (
      <>
        {/* 그라디언트 배경 효과 */}
        <div className="auth-gradient-light dark:hidden fixed inset-0 -z-10" />
        <div className="auth-gradient-dark hidden dark:block fixed inset-0 -z-10" />
        {/* 블러 오브 효과 */}
        <div className="blur-orb blur-orb-1 opacity-20 dark:opacity-10 fixed inset-0 -z-10" />
        <div className="blur-orb blur-orb-2 opacity-20 dark:opacity-10 fixed inset-0 -z-10" />

        <div className="relative w-full max-w-lg mx-auto">
          {/* 뒤로가기 버튼 */}
          <button
            onClick={() => router.back()}
            className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600">
                <LogIn className="h-5 w-5" />
                소셜 로그인 계정입니다
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm text-blue-800 font-medium mb-2">
                  해당 이메일은 소셜 로그인으로 가입된 계정입니다.
                </p>
                <p className="text-sm text-blue-700">
                  비밀번호 재설정이 필요하지 않으며, 아래 방법으로 로그인해주세요:
                </p>
              </div>

              <div className="space-y-2.5">
                <SocialLoginButton provider="google" />
                {/* <SocialLoginButton provider="kakao" /> */}
                <SocialLoginButton provider="github" />
              </div>

              <div className="text-xs text-gray-500 pt-3 border-t">
                <p>• 소셜 로그인 계정은 별도의 비밀번호가 없습니다</p>
                <p>• 연결된 소셜 계정으로 직접 로그인해주세요</p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setIsSocialAccount(false);
                    setEmail('');
                    setEmailError('');
                    setAttemptCount(0);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  다른 이메일 시도
                </Button>
                <Button
                  onClick={() => router.push('/login')}
                  className="flex-1"
                >
                  로그인 페이지로
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // 이메일 발송 완료 화면
  if (isSubmitted) {
    return (
      <>
        {/* 그라디언트 배경 효과 */}
        <div className="auth-gradient-light dark:hidden fixed inset-0 -z-10" />
        <div className="auth-gradient-dark hidden dark:block fixed inset-0 -z-10" />
        {/* 블러 오브 효과 */}
        <div className="blur-orb blur-orb-1 opacity-20 dark:opacity-10 fixed inset-0 -z-10" />
        <div className="blur-orb blur-orb-2 opacity-20 dark:opacity-10 fixed inset-0 -z-10" />

        <div className="relative w-full max-w-lg mx-auto">
          {/* 뒤로가기 버튼 */}
          <button
            onClick={() => router.back()}
            className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                이메일을 확인해주세요
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded p-4">
                <p className="text-sm text-green-800">
                  입력하신 이메일 주소로 비밀번호 재설정 링크를 발송했습니다.
                </p>
                <p className="text-sm text-green-800 mt-2">
                  이메일이 도착하지 않은 경우:
                </p>
                <ul className="text-sm text-green-800 mt-1 ml-4 list-disc">
                  <li>스팸 메일함을 확인해주세요</li>
                  <li>이메일 주소가 정확한지 확인해주세요</li>
                  <li>소셜 로그인 계정은 비밀번호 재설정이 불가능합니다</li>
                </ul>
              </div>

              <div className="text-xs text-gray-500">
                <p>• 링크는 15분간 유효합니다</p>
                <p>• 보안을 위해 한 번만 사용 가능합니다</p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setIsSubmitted(false);
                    setEmail('');
                    setEmailError('');
                    setAttemptCount(0);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  다시 시도
                </Button>
                <Button
                  onClick={() => router.push('/login')}
                  className="flex-1"
                >
                  로그인으로 돌아가기
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      {/* 그라디언트 배경 효과 */}
      <div className="auth-gradient-light dark:hidden fixed inset-0 -z-10" />
      <div className="auth-gradient-dark hidden dark:block fixed inset-0 -z-10" />
      {/* 블러 오브 효과 */}
      <div className="blur-orb blur-orb-1 opacity-20 dark:opacity-10 fixed inset-0 -z-10" />
      <div className="blur-orb blur-orb-2 opacity-20 dark:opacity-10 fixed inset-0 -z-10" />

      <div className="relative w-full max-w-lg mx-auto">
        {/* 뒤로가기 버튼 */}
        <button
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              비밀번호 찾기
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600">
              가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
            </div>

            {attemptCount >= MAX_ATTEMPTS && (
              <div className="bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  너무 많은 시도입니다. 잠시 후 다시 시도해주세요.
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="이메일을 입력하세요"
                  disabled={attemptCount >= MAX_ATTEMPTS}
                  className={emailError ? 'border-red-500' : ''}
                />
                {emailError && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-start gap-1">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    {emailError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !email || attemptCount >= MAX_ATTEMPTS}
                className="w-full flex items-center justify-center px-5 py-3 bg-black hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-full text-sm font-semibold text-white transition-all shadow-sm"
              >
                {isSubmitting ? '처리 중...' : '재설정 링크 보내기'}
              </button>
            </form>

            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-xs text-blue-800">
                <strong>참고:</strong> 소셜 로그인(Google, Kakao, GitHub)으로 가입하신 경우
                비밀번호 재설정이 필요하지 않습니다. 해당 서비스로 직접 로그인해주세요.
              </p>
            </div>

            <div className="text-center pt-3 border-t">
              <Link
                href="/login"
                className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                로그인으로 돌아가기
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}