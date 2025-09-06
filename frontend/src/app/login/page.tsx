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
import { SocialLoginGroup } from '@/components/auth/SocialLoginGroup';
import Spinner from '@/components/ui/Spinner';

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
            {validationErrors.email && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
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
            {validationErrors.password && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.email || !formData.password || loginAttempts >= MAX_LOGIN_ATTEMPTS}
            className={`w-full flex items-center justify-center px-5 py-3 rounded-full text-sm font-medium transition-all ${
              formData.email && formData.password && !isSubmitting && loginAttempts < MAX_LOGIN_ATTEMPTS
                ? 'bg-black hover:bg-gray-800 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:bg-gray-100 disabled:cursor-not-allowed'
            }`}
          >
            {isSubmitting ? '로그인 중...' : '로그인'}
          </button>

          {/* OAuth Section */}
          <SocialLoginGroup 
            providers={['google', 'kakao', 'github']}
            disabled={isSubmitting || loginAttempts >= MAX_LOGIN_ATTEMPTS}
            title="또는"
          />


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