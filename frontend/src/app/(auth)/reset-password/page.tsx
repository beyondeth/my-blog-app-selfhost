'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, AlertCircle, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * 비밀번호 재설정 페이지 메인 컴포넌트
 * useSearchParams를 사용하므로 Suspense로 감싸야 함
 */
function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  const [error, setError] = useState<string | null>(null);

  // Token validation on mount
  useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/validate-reset-token`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
          }
        );

        if (response.ok) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
        }
      } catch (error) {
        console.error('Token validation failed:', error);
        setTokenValid(false);
      }
    };

    if (!token) {
      setTokenValid(false);
      return;
    }

    validateToken();
  }, [token]);

  // Password strength calculation
  useEffect(() => {
    const strength = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    setPasswordStrength(strength);
    if (error) setError(null); // Clear error on input change
  }, [password, error]);

  const validatePassword = () => {
    setError(null);

    if (password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다');
      return false;
    }

    const strength = Object.values(passwordStrength).filter(Boolean).length;
    if (strength < 3) {
      setError('비밀번호가 너무 약합니다');
      return false;
    }

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validatePassword()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            newPassword: password,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        // Toast removed as per request
        
        // 3초 후 로그인 페이지로 이동
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        if (data.message?.includes('expired')) {
          setError('링크가 만료되었습니다. 다시 요청해주세요.');
          setTokenValid(false);
        } else if (data.message?.includes('invalid')) {
          setError('유효하지 않은 링크입니다.');
          setTokenValid(false);
        } else {
          setError(data.message || '비밀번호 변경에 실패했습니다');
        }
      }
    } catch (error) {
      console.error('Password reset failed:', error);
      setError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Invalid or missing token
  if (tokenValid === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              유효하지 않은 링크
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다.
            </p>
            <ul className="text-sm text-gray-600 list-disc ml-5">
              <li>링크는 15분간만 유효합니다</li>
              <li>링크는 한 번만 사용 가능합니다</li>
              <li>이메일의 전체 링크를 복사했는지 확인해주세요</li>
            </ul>
            <div className="flex gap-3">
              <Button
                onClick={() => router.push('/forgot-password')}
                variant="outline"
                className="flex-1"
              >
                다시 요청하기
              </Button>
              <Button
                onClick={() => router.push('/login')}
                className="flex-1"
              >
                로그인으로
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              비밀번호 변경 완료
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              비밀번호가 성공적으로 변경되었습니다.
              잠시 후 로그인 페이지로 이동합니다.
            </p>
            <Button
              onClick={() => router.push('/login')}
              className="w-full"
            >
              지금 로그인하기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (tokenValid === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Main form
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            새 비밀번호 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                새 비밀번호
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="새 비밀번호를 입력하세요"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호 확인
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호를 다시 입력하세요"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Password strength indicator */}
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs font-medium text-gray-700 mb-2">비밀번호 강도:</p>
              <div className="space-y-1">
                <div className={`text-xs flex items-center gap-1 ${passwordStrength.length ? 'text-green-600' : 'text-gray-400'}`}>
                  {passwordStrength.length ? '✓' : '○'} 8자 이상
                </div>
                <div className={`text-xs flex items-center gap-1 ${passwordStrength.uppercase ? 'text-green-600' : 'text-gray-400'}`}>
                  {passwordStrength.uppercase ? '✓' : '○'} 대문자 포함
                </div>
                <div className={`text-xs flex items-center gap-1 ${passwordStrength.lowercase ? 'text-green-600' : 'text-gray-400'}`}>
                  {passwordStrength.lowercase ? '✓' : '○'} 소문자 포함
                </div>
                <div className={`text-xs flex items-center gap-1 ${passwordStrength.number ? 'text-green-600' : 'text-gray-400'}`}>
                  {passwordStrength.number ? '✓' : '○'} 숫자 포함
                </div>
                <div className={`text-xs flex items-center gap-1 ${passwordStrength.special ? 'text-green-600' : 'text-gray-400'}`}>
                  {passwordStrength.special ? '✓' : '○'} 특수문자 포함
                </div>
              </div>
            </div>

            {/* Error Message Inline */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-start gap-2 mb-4">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !password || !confirmPassword}
              className="w-full flex items-center justify-center px-5 py-3 bg-black hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-full text-sm font-semibold text-white transition-all shadow-sm"
            >
              {isSubmitting ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>

          <div className="text-center pt-3 border-t">
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              로그인으로 돌아가기
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 비밀번호 재설정 페이지 (Suspense 래퍼)
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}