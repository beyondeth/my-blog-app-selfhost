'use client';

import { useState, useEffect, forwardRef } from 'react';
import { FiMail, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { useEmailVerification } from '@/hooks/useEmailVerification';

interface EmailVerificationProps {
  email: string;
  onVerified: (sessionToken: string) => void;
  onEmailChange: (email: string) => void;
  disabled?: boolean;
  className?: string;
}

export const EmailVerification = forwardRef<HTMLInputElement, EmailVerificationProps>(function EmailVerification(
  { email, onVerified, onEmailChange, disabled = false, className = '' },
  ref
) {
  const { state, sendCode, verifyCode, resendCode } = useEmailVerification();
  const [code, setCode] = useState('');

  // 인증 완료 시 콜백 호출
  useEffect(() => {
    if (state.step === 'verified' && state.sessionToken) {
      onVerified(state.sessionToken);
    }
  }, [state.step, state.sessionToken, onVerified]);

  // 타이머 포맷팅
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const handleSendCode = async () => {
    await sendCode(email);
  };

  const handleVerifyCode = async () => {
    await verifyCode(email, code);
  };

  const handleResendCode = async () => {
    setCode('');
    await resendCode(email);
  };

  return (
    <div className="space-y-4">
      {/* 이메일 입력 필드 */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          이메일
        </label>
        <div className="relative">
          <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            ref={ref}
            type="email"
            id="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            disabled={disabled || state.step !== 'input'}
            className={`w-full pl-10 pr-32 py-3 border rounded-md focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all ${
              state.error && state.step === 'input' ? 'border-red-300 bg-red-50' : 'border-gray-300'
            } ${state.step !== 'input' ? 'bg-gray-50' : ''} ${className}`}
            placeholder="이메일을 입력하세요"
            required
          />
          {state.step === 'input' && (
            <button
              type="button"
              onClick={handleSendCode}
              disabled={state.isLoading || !email}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {state.isLoading ? '발송 중...' : '인증 코드 발급'}
            </button>
          )}
          {state.step === 'verified' && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <FiCheck className="w-5 h-5 text-green-500" />
            </div>
          )}
        </div>
      </div>

      {/* 인증 코드 입력 필드 */}
      {state.step === 'verify' && (
        <div className="space-y-3 animate-fadeIn">
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              disabled={state.isLoading}
              className={`flex-1 px-3 py-3 border rounded-md text-center text-lg font-mono tracking-wider focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all ${
                state.error ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="인증 코드 6자리"
              autoFocus
            />
            <button
              type="button"
              onClick={handleVerifyCode}
              disabled={state.isLoading || code.length !== 6}
              className="px-5 py-3 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {state.isLoading ? '확인중...' : '인증'}
            </button>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={state.isLoading}
              className="px-5 py-3 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              재발급
            </button>
          </div>
          
          {/* 타이머 */}
          {state.timer > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                남은 시간: <span className="font-mono font-medium">{formatTime(state.timer)}</span>
              </span>
              {state.attemptCount > 0 && (
                <span className="text-orange-600">
                  시도 횟수: {state.attemptCount}/3
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 인증 완료 메시지 */}
      {state.step === 'verified' && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center gap-2 animate-fadeIn">
          <FiCheck className="w-4 h-4" />
          <span className="text-sm font-medium">이메일 인증이 완료되었습니다.</span>
        </div>
      )}

      {/* 에러 메시지 */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md flex items-center gap-2 text-sm animate-fadeIn">
          <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
    </div>
  );
});