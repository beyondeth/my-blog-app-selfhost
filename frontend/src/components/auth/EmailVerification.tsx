'use client';

import { useState, useEffect, forwardRef } from 'react';
import { Mail, Check, AlertCircle } from 'lucide-react';
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
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          이메일
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
          <input
            ref={ref}
            type="email"
            id="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            disabled={disabled || state.step !== 'input'}
            className={`w-full pl-10 pr-32 py-3 rounded-lg auth-input text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 outline-none ${
              state.error && state.step === 'input' ? 'border-red-500 dark:border-red-400' : ''
            } ${state.step !== 'input' ? 'opacity-60' : ''} ${className}`}
            placeholder="vangogh@example.com"
            required
          />
          {state.step === 'input' && (
            <button
              type="button"
              onClick={handleSendCode}
              disabled={state.isLoading || !email}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-md text-sm font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {state.isLoading ? '발송 중...' : '인증 코드 발급'}
            </button>
          )}
          {state.step === 'verified' && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30">
              <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
          )}
        </div>
      </div>

      {/* 인증 코드 입력 필드 */}
      {state.step === 'verify' && (
        <div className="space-y-3 fade-in-up">
          {/* 인증 코드 입력창 - 위아래 필드와 동일한 너비 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              인증 코드
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              disabled={state.isLoading}
              className={`w-full px-4 py-3 rounded-lg text-center text-lg font-mono tracking-wider auth-input text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 outline-none ${
                state.error ? 'border-red-500 dark:border-red-400' : ''
              }`}
              placeholder="인증 코드 6자리"
              autoFocus
            />
          </div>

          {/* 버튼들 - 아래 줄에 깔끔하게 배치 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleVerifyCode}
              disabled={state.isLoading || code.length !== 6}
              className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                state.isLoading || code.length !== 6
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'auth-button-primary'
              }`}
            >
              {state.isLoading ? '확인중...' : '인증'}
            </button>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={state.isLoading}
              className="flex-1 py-3 social-login-btn rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              재발급
            </button>
          </div>

          {/* 타이머 */}
          {state.timer > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                남은 시간: <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">{formatTime(state.timer)}</span>
              </span>
              {state.attemptCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  시도 횟수: {state.attemptCount}/3
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 인증 완료 메시지 */}
      {state.step === 'verified' && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg flex items-center gap-2 fade-in-up">
          <Check className="w-5 h-5" />
          <span className="text-sm font-medium">이메일 인증이 완료되었습니다.</span>
        </div>
      )}

      {/* 에러 메시지 */}
      {state.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm fade-in-up shake">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
    </div>
  );
});