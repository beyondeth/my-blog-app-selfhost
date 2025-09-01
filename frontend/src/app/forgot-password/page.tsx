'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, Mail, ArrowLeft, LogIn } from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSocialAccount, setIsSocialAccount] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const MAX_ATTEMPTS = 3;

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Rate limiting
    if (attemptCount >= MAX_ATTEMPTS) {
      toast.error('너무 많은 시도입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    // Email validation
    if (!email) {
      toast.error('이메일을 입력해주세요');
      return;
    }

    if (!validateEmail(email)) {
      toast.error('올바른 이메일 형식이 아닙니다');
      return;
    }

    setIsSubmitting(true);

    try {
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
        // 보안을 위해 계정 존재 여부와 관계없이 동일한 메시지 표시
        toast.success('이메일을 확인해주세요');
      } else {
        // 소셜 로그인 계정인 경우
        if (response.status === 400 && data.message?.includes('소셜 로그인')) {
          setIsSocialAccount(true);
          toast.info('소셜 로그인 계정입니다');
        } else {
          // 일반적인 성공 메시지 (보안상 계정 존재 여부 숨김)
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

  // 소셜 로그인 계정 안내 화면
  if (isSocialAccount) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md">
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
              {/* Google Login */}
              <button
                type="button"
                onClick={() => window.location.href = 'http://localhost:3000/api/v1/auth/google'}
                className="w-full flex items-center justify-center px-5 py-3 bg-white hover:bg-gray-50 rounded-full border border-gray-300 text-sm font-medium text-gray-700 transition-all shadow-sm"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                구글로 로그인
              </button>

              {/* Kakao Login */}
              <button
                type="button"
                onClick={() => window.location.href = 'http://localhost:3000/api/v1/auth/kakao'}
                className="w-full flex items-center justify-center px-5 py-3 bg-[#FEE500] hover:bg-[#FDD835] rounded-full text-sm font-semibold text-black/85 transition-all shadow-sm"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3C6.48 3 2 6.32 2 10.5c0 2.66 1.82 5 4.57 6.32l-.72 2.68c-.07.26.18.5.44.37l3.13-1.57c.52.07 1.05.1 1.58.1 5.52 0 10-3.32 10-7.4S17.52 3 12 3z" fill="black"/>
                </svg>
                카카오로 로그인
              </button>
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
    );
  }

  // 이메일 발송 완료 화면
  if (isSubmitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md">
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
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일을 입력하세요"
                disabled={attemptCount >= MAX_ATTEMPTS}
              />
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
              <strong>참고:</strong> 소셜 로그인(Google, Kakao)으로 가입하신 경우 
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
  );
}