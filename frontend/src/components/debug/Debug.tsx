'use client';

import { useAuthDebug } from '@/hooks/useAuthDebug';

/**
 * 개발 환경 디버그 컴포넌트
 *
 * @description
 * - useAuthDebug 훅을 래핑하여 프로바이더 계층 내부에서 실행
 * - UI를 렌더링하지 않고 디버그 기능만 활성화
 * - 개발 환경에서만 동작
 */
export function Debug() {
  // 개발 환경에서만 인증 상태 디버깅 활성화
  if (process.env.NODE_ENV === 'development') {
    useAuthDebug();
  }

  // UI를 렌더링하지 않음
  return null;
}