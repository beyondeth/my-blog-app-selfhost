"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { EmailVerification } from '@/components/auth/EmailVerification';
import { FiEye, FiEyeOff, FiLock, FiUser, FiArrowLeft, FiMail } from 'react-icons/fi';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, clearError } = useAuth();
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

  // 컴포넌트 마운트 시 상태 초기화
  useEffect(() => {
    // 전역 에러 상태 초기화
    clearError();
    
    // 모든 상태를 초기값으로 리셋
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError('');
    setFieldErrors({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    });
    setIsSubmitting(false);
    setIsEmailVerified(false);
    setEmailVerificationToken('');
    setShakeField(null);
  }, []); // 빈 의존성 배열 - 컴포넌트 마운트 시에만 실행

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.email || !formData.password) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (!isEmailVerified) {
      setError('이메일 인증을 완료해주세요.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
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
      await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        emailVerificationToken
      });
      router.push('/');
    } catch (error: any) {
      // 에러 메시지에 따라 적절한 필드에 에러 표시
      const message = error.message || '회원가입에 실패했습니다.';
      
      // "이미 사용 중인 'Park'입니다" 형태의 메시지 체크
      if (message.includes("이미 사용 중인") && message.includes("입니다")) {
        setFieldErrors(prev => ({ ...prev, username: message }));
        focusErrorField('username');
      } else if (message.includes('이미 존재하는 회원') || message.includes('이미 등록된 이메일')) {
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
            <p className="mt-4 text-gray-600">새 계정을 만들어보세요</p>
          </div>

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                사용자명
              </label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  ref={usernameRef}
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-3 border rounded-md focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all ${
                    fieldErrors.username ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  } ${
                    shakeField === 'username' ? 'animate-shake' : ''
                  }`}
                  placeholder="사용자명을 입력하세요"
                  required
                />
              </div>
              {fieldErrors.username && (
                <p className="mt-2 text-sm text-red-600">{fieldErrors.username}</p>
              )}
            </div>

            {/* Email Field with Verification */}
            <div>
              <EmailVerification
                email={formData.email}
                onVerified={handleEmailVerified}
                onEmailChange={handleEmailChange}
                disabled={isSubmitting}
                ref={emailRef}
                className={shakeField === 'email' ? 'animate-shake' : ''}
              />
              {fieldErrors.email && (
                <p className="mt-2 text-sm text-red-600">{fieldErrors.email}</p>
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
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-12 py-3 border rounded-md focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all ${
                    fieldErrors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  } ${
                    shakeField === 'password' ? 'animate-shake' : ''
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
              {fieldErrors.password && (
                <p className="mt-2 text-sm text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호 확인
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  ref={confirmPasswordRef}
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-12 py-3 border rounded-md focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all ${
                    fieldErrors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  } ${
                    shakeField === 'confirmPassword' ? 'animate-shake' : ''
                  }`}
                  placeholder="비밀번호를 다시 입력하세요"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="mt-2 text-sm text-red-600">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !isEmailVerified}
              className="w-full bg-gray-900 text-white py-3 px-4 rounded-md hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {!isEmailVerified ? '이메일 인증을 완료해주세요' : (isSubmitting ? '가입 중...' : '회원가입')}
            </button>
          </form>

          {/* Links */}
          <div className="mt-8 text-center space-y-4">
            <p className="text-sm text-gray-600">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" className="text-gray-900 font-medium hover:underline">
                로그인
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 