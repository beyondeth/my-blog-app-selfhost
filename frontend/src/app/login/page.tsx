'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
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
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/check-method`,
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
            provider: data.authProvider,
            message: data.message,
            hasPassword: data.hasPassword
          });
          
          // If user should use OAuth, highlight that button
          if (data.authProvider !== 'local' && !data.hasPassword) {
            // User registered with OAuth and has no password
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
      toast.error('Too many failed attempts. Please try again later.');
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
      await login(formData);
      toast.success('로그인 성공!');
      
      // Navigate based on user role or preference
      const redirectTo = sessionStorage.getItem('redirectAfterLogin') || '/';
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
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            로그인
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-5 py-5">
          {loginAttempts >= MAX_LOGIN_ATTEMPTS && (
            <div className="bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
              <div className="text-sm text-red-800">
                로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.
              </div>
            </div>
          )}
          {loginAttempts > 2 && loginAttempts < MAX_LOGIN_ATTEMPTS && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                {MAX_LOGIN_ATTEMPTS - loginAttempts}회 시도 가능합니다.
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleEmailBlur}
              name="email"
              placeholder="이메일을 입력하세요"
            />
            {authMethodHint && !validationErrors.email && (
              <p className="mt-1 text-sm text-blue-600">💡 {authMethodHint.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                name="password"
                placeholder="비밀번호를 입력하세요"
                className="pr-10"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmit(e as any);
                  }
                }}
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

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.email || !formData.password || loginAttempts >= MAX_LOGIN_ATTEMPTS}
            className="w-full flex items-center justify-center px-5 py-3 bg-black hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-full text-sm font-semibold text-white transition-all shadow-sm"
          >
            {isSubmitting ? '로그인 중...' : '로그인'}
          </button>

          {/* OAuth Section */}
          <div className="space-y-3">
            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">또는</span>
              </div>
            </div>

            {/* OAuth Buttons */}
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
          </div>


          {/* Links */}
          <div className="text-center pt-3 border-t">
            <p className="text-sm text-gray-600">
              계정이 없으신가요?{' '}
              <Link 
                href="/register" 
                className="text-gray-900 font-medium hover:underline"
              >
                회원가입
              </Link>
              {' / '}
              <Link 
                href="/forgot-password" 
                className="text-gray-900 font-medium hover:underline"
              >
                비밀번호 찾기
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}