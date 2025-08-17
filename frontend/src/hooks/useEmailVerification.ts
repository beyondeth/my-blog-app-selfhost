import { useState, useCallback, useEffect, useRef } from 'react';

interface EmailVerificationState {
  step: 'input' | 'verify' | 'verified';
  isLoading: boolean;
  error: string | null;
  timer: number;
  attemptCount: number;
  sessionToken: string | null;
}

export function useEmailVerification() {
  const [state, setState] = useState<EmailVerificationState>({
    step: 'input',
    isLoading: false,
    error: null,
    timer: 0,
    attemptCount: 0,
    sessionToken: null,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
          return { ...prev, timer: 0, step: 'input', error: '인증 코드가 만료되었습니다.' };
        }
        return { ...prev, timer: prev.timer - 1 };
      });
    }, 1000);
  }, []);

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
      setState(prev => ({ ...prev, error: '유효한 이메일 주소를 입력해주세요.' }));
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
          throw new Error(data.message || '이미 등록된 이메일입니다. 로그인 페이지에서 로그인해주세요.');
        }
        throw new Error(data.message || '인증 코드 발송에 실패했습니다.');
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
        error: error.message || '인증 코드 발송에 실패했습니다.',
      }));
      return false;
    }
  }, [startTimer]);

  // 인증 코드 검증
  const verifyCode = useCallback(async (email: string, code: string) => {
    // 코드 유효성 검사
    if (!code || code.length !== 6) {
      setState(prev => ({ ...prev, error: '6자리 인증 코드를 입력해주세요.' }));
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
          error: data.message || '인증 코드가 일치하지 않습니다.',
          attemptCount: newAttemptCount,
        }));

        // 3회 실패 시 재발급 필요
        if (newAttemptCount >= 3) {
          setState(prev => ({
            ...prev,
            step: 'input',
            error: '최대 시도 횟수를 초과했습니다. 인증 코드를 재발급해주세요.',
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
        error: error.message || '인증 코드 검증에 실패했습니다.',
      }));
      return false;
    }
  }, [state.attemptCount]);

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
          throw new Error(data.message || '이미 등록된 이메일입니다. 로그인 페이지에서 로그인해주세요.');
        }
        throw new Error(data.message || '인증 코드 재발송에 실패했습니다.');
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
        error: error.message || '인증 코드 재발송에 실패했습니다.',
      }));
      return false;
    }
  }, [startTimer]);

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