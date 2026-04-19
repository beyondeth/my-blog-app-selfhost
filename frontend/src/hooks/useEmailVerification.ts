import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocaleContext } from '@/providers/LocaleProvider';

interface EmailVerificationState {
  step: 'input' | 'verify' | 'verified';
  isLoading: boolean;
  error: string | null;
  timer: number;
  attemptCount: number;
  sessionToken: string | null;
}

export function useEmailVerification() {
  const { locale } = useLocaleContext();
  const [state, setState] = useState<EmailVerificationState>({
    step: 'input',
    isLoading: false,
    error: null,
    timer: 0,
    attemptCount: 0,
    sessionToken: null,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasHangul = useCallback(
    (value: string | null | undefined) => Boolean(value && /[가-힣]/.test(value)),
    [],
  );
  const pickMessage = useCallback(
    (message: string | null | undefined, fallback: string) => {
      if (!message) {
        return fallback;
      }

      if (locale === 'en' && hasHangul(message)) {
        return fallback;
      }

      return message;
    },
    [hasHangul, locale],
  );

  const copy = {
    invalidEmail:
      locale === 'ko' ? '유효한 이메일 주소를 입력해주세요.' : 'Enter a valid email address.',
    expiredCode:
      locale === 'ko' ? '인증 코드가 만료되었습니다.' : 'The verification code expired.',
    sendFailed:
      locale === 'ko' ? '인증 코드 발송에 실패했습니다.' : 'We could not send the verification code.',
    resendFailed:
      locale === 'ko' ? '인증 코드 재발송에 실패했습니다.' : 'We could not resend the verification code.',
    emailExists:
      locale === 'ko'
        ? '이미 등록된 이메일입니다. 로그인 페이지에서 로그인해주세요.'
        : 'An account already exists for this email. Please sign in instead.',
    invalidCode:
      locale === 'ko' ? '6자리 인증 코드를 입력해주세요.' : 'Enter the 6-digit verification code.',
    incorrectCode:
      locale === 'ko' ? '인증 코드가 일치하지 않습니다.' : 'The verification code is incorrect.',
    verifyFailed:
      locale === 'ko' ? '인증 코드 검증에 실패했습니다.' : 'We could not verify the code.',
    tooManyAttempts:
      locale === 'ko'
        ? '최대 시도 횟수를 초과했습니다. 인증 코드를 재발급해주세요.'
        : 'Too many attempts. Request a new verification code and try again.',
  } as const;

  // 타이머 시작
  const startTimer = useCallback(() => {
    setState(prev => ({ ...prev, timer: 300 })); // 5분 (300초)
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.timer <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return { ...prev, timer: 0, step: 'input', error: copy.expiredCode };
        }
        return { ...prev, timer: prev.timer - 1 };
      });
    }, 1000);
  }, [copy.expiredCode]);

  // 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // 인증 코드 발송
  const sendCode = useCallback(async (email: string) => {
    // 이메일 유효성 검사
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setState(prev => ({ ...prev, error: copy.invalidEmail }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/email/send-code`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        // 409 Conflict - 이미 존재하는 이메일
        if (response.status === 409 || data.code === 'EMAIL_ALREADY_EXISTS') {
          throw new Error(copy.emailExists);
        }
        throw new Error(pickMessage(data.message, copy.sendFailed));
      }

      setState(prev => ({
        ...prev,
        step: 'verify',
        isLoading: false,
        error: null,
        attemptCount: 0,
      }));

      startTimer();
      return true;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: pickMessage(error.message, copy.sendFailed),
      }));
      return false;
    }
  }, [copy.emailExists, copy.invalidEmail, copy.sendFailed, pickMessage, startTimer]);

  // 인증 코드 검증
  const verifyCode = useCallback(async (email: string, code: string) => {
    // 코드 유효성 검사
    if (!code || code.length !== 6) {
      setState(prev => ({ ...prev, error: copy.invalidCode }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/email/verify-code`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ email, code }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        const newAttemptCount = state.attemptCount + 1;
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: pickMessage(data.message, copy.incorrectCode),
          attemptCount: newAttemptCount,
        }));

        // 3회 실패 시 재발급 필요
        if (newAttemptCount >= 3) {
          setState(prev => ({
            ...prev,
            step: 'input',
            error: copy.tooManyAttempts,
          }));
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
        return false;
      }

      // 인증 성공
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setState(prev => ({
        ...prev,
        step: 'verified',
        isLoading: false,
        error: null,
        sessionToken: data.sessionToken,
      }));

      return true;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: pickMessage(error.message, copy.verifyFailed),
      }));
      return false;
    }
  }, [copy.incorrectCode, copy.invalidCode, copy.tooManyAttempts, copy.verifyFailed, pickMessage, state.attemptCount]);

  // 인증 코드 재발송
  const resendCode = useCallback(async (email: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/email/resend-code`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        // 409 Conflict - 이미 존재하는 이메일
        if (response.status === 409 || data.code === 'EMAIL_ALREADY_EXISTS') {
          throw new Error(copy.emailExists);
        }
        throw new Error(pickMessage(data.message, copy.resendFailed));
      }

      setState(prev => ({
        ...prev,
        step: 'verify',
        isLoading: false,
        error: null,
        attemptCount: 0,
      }));

      startTimer();
      return true;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: pickMessage(error.message, copy.resendFailed),
      }));
      return false;
    }
  }, [copy.emailExists, copy.resendFailed, pickMessage, startTimer]);

  // 상태 초기화
  const reset = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState({
      step: 'input',
      isLoading: false,
      error: null,
      timer: 0,
      attemptCount: 0,
      sessionToken: null,
    });
  }, []);

  return {
    state,
    sendCode,
    verifyCode,
    resendCode,
    reset,
  };
}
