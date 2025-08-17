'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { LoginForm } from '@/types/index';
import { FiEye, FiEyeOff, FiMail, FiLock, FiArrowLeft } from 'react-icons/fi';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, isAuthenticated, clearError } = useAuth();
  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState(''); // 로컬 에러 상태
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  // 이미 로그인된 사용자는 홈으로 리다이렉트 - Context7 모범 사례: 조건부 실행
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading]); // router 의존성 제거 (안정적인 함수)

  // 컴포넌트 마운트 시 전역 에러 상태 초기화
  useEffect(() => {
    clearError();
  }, [clearError]);

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!formData.email) {
      errors.email = '이메일을 입력해주세요.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = '올바른 이메일 형식을 입력해주세요.';
    }

    if (!formData.password) {
      errors.password = '비밀번호를 입력해주세요.';
    } else if (formData.password.length < 6) {
      errors.password = '비밀번호는 최소 6자 이상이어야 합니다.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // 입력 시 해당 필드의 유효성 검사 에러 제거
    if (validationErrors[name as keyof typeof validationErrors]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setLoginError(''); // 이전 에러 초기화
    
    try {
      await login(formData);
      // 성공 시 useEffect에서 리다이렉트 처리
    } catch (error: any) {
      // 로컬 에러 상태에 저장
      setLoginError(error.message || '로그인에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
          >
            <FiArrowLeft className="mr-2 w-4 h-4" />
            Back
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-12">
            <p className="mt-4 text-gray-600">로그인하여 계속하세요</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {loginError}
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                이메일
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-3 border rounded-md focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all ${
                    validationErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="이메일을 입력하세요"
                  required
                />
              </div>
              {validationErrors.email && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-12 py-3 border rounded-md focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all ${
                    validationErrors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="비밀번호를 입력하세요"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
              {validationErrors.password && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gray-900 text-white py-3 px-4 rounded-md hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSubmitting ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* OAuth Buttons */}
          <div className="mt-6 space-y-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">또는</span>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => window.location.href = 'http://localhost:3000/api/v1/auth/google'}
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 로그인
            </button>
            
            <button
              type="button"
              onClick={() => window.location.href = 'http://localhost:3000/api/v1/auth/kakao'}
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-yellow-400 hover:bg-yellow-500 transition-colors"
            >
              <span className="mr-2 text-lg">💬</span>
              카카오로 로그인
            </button>
          </div>

          {/* Links */}
          <div className="mt-8 text-center space-y-4">
            <p className="text-sm text-gray-600">
              계정이 없으신가요?{' '}
              <Link 
                href="/register" 
                className="text-gray-900 font-medium hover:underline"
                onClick={(e) => {
                  // 회원가입 페이지로 이동 시 상태 완전 초기화를 위해 강제 새로고침
                  if (window.location.pathname === '/register') {
                    e.preventDefault();
                    window.location.href = '/register';
                  }
                }}
              >
                회원가입
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 