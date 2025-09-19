/**
 * 인증 이벤트 시스템
 * @description 전역 인증 상태 변경을 앱 전체에 전파하기 위한 이벤트 시스템
 * WebSocket, React Query, 기타 컴포넌트들 간의 인증 상태 동기화
 */

/**
 * 인증 이벤트 타입
 */
export type AuthEventType =
  | 'login'           // 로그인 성공
  | 'logout'          // 로그아웃
  | 'token-refreshed' // 토큰 갱신 완료
  | 'auth-error';     // 인증 오류 발생

/**
 * 인증 이벤트 페이로드 타입
 */
export interface AuthEventPayload {
  login: { user: any };           // 로그인 시 사용자 정보
  logout: undefined;               // 로그아웃은 페이로드 없음
  'token-refreshed': undefined;    // 토큰 갱신은 페이로드 없음
  'auth-error': { error: string }; // 오류 메시지
}

/**
 * 이벤트 리스너 타입
 */
export type AuthEventListener<T extends AuthEventType> = (
  payload?: AuthEventPayload[T]
) => void;

/**
 * 인증 이벤트 관리 클래스
 * @description 싱글톤 패턴으로 전역 인증 이벤트를 관리
 * 여러 컴포넌트와 서비스 간 인증 상태 동기화를 담당
 */
class AuthEventEmitter {
  /**
   * 이벤트별 리스너 저장소
   * @description Map을 사용하여 각 이벤트 타입별로 리스너 Set 관리
   */
  private listeners: Map<AuthEventType, Set<AuthEventListener<any>>> = new Map();

  /**
   * 이벤트 리스너 등록
   * @param event - 구독할 이벤트 타입
   * @param callback - 이벤트 발생 시 실행할 콜백
   * @returns 구독 해제 함수
   *
   * @example
   * ```typescript
   * const unsubscribe = authEvents.on('login', (payload) => {
   *   console.log('사용자 로그인:', payload.user);
   * });
   *
   * // 컴포넌트 언마운트 시
   * unsubscribe();
   * ```
   */
  on<T extends AuthEventType>(
    event: T,
    callback: AuthEventListener<T>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const eventListeners = this.listeners.get(event)!;
    eventListeners.add(callback);

    // 구독 해제 함수 반환
    return () => {
      eventListeners.delete(callback);

      // 리스너가 없으면 Map에서 제거 (메모리 관리)
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * 이벤트 발생
   * @param event - 발생시킬 이벤트 타입
   * @param payload - 이벤트 페이로드
   *
   * @description 등록된 모든 리스너를 실행하며, 각 리스너의 오류는 격리 처리
   */
  emit<T extends AuthEventType>(
    event: T,
    payload?: AuthEventPayload[T]
  ): void {
    const eventListeners = this.listeners.get(event);

    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(payload);
        } catch (error) {
          // 리스너 오류가 다른 리스너나 앱에 영향을 주지 않도록 격리
          console.error(`[AuthEvent] ${event} 리스너 실행 중 오류:`, error);
        }
      });
    }

    // 디버깅용 로그 (프로덕션에서는 제거 가능)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AuthEvent] ${event} 이벤트 발생`, payload);
    }
  }

  /**
   * 특정 이벤트의 리스너 제거
   * @param event - 이벤트 타입
   * @param callback - 제거할 특정 리스너 (없으면 모든 리스너 제거)
   */
  off<T extends AuthEventType>(
    event: T,
    callback?: AuthEventListener<T>
  ): void {
    if (!callback) {
      // 해당 이벤트의 모든 리스너 제거
      this.listeners.delete(event);
    } else {
      // 특정 리스너만 제거
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);

        // 리스너가 없으면 Map에서 제거
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    }
  }

  /**
   * 모든 이벤트 리스너 제거
   * @description 앱 종료 시 또는 테스트 환경에서 사용
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * 현재 등록된 리스너 수 조회 (디버깅용)
   * @param event - 특정 이벤트 타입 (없으면 전체)
   * @returns 리스너 수
   */
  getListenerCount(event?: AuthEventType): number {
    if (event) {
      return this.listeners.get(event)?.size || 0;
    }

    let total = 0;
    this.listeners.forEach(set => {
      total += set.size;
    });
    return total;
  }
}

/**
 * 전역 인증 이벤트 관리자 인스턴스
 * @description 앱 전체에서 공유되는 싱글톤 인스턴스
 */
export const authEvents = new AuthEventEmitter();

// ==================== 헬퍼 함수 ====================
// 자주 사용하는 이벤트 발생을 위한 편의 함수들

/**
 * 로그인 이벤트 발생
 * @param user - 로그인한 사용자 정보
 * @description 로그인 성공 시 전역으로 알림
 */
export const emitLogin = (user: any): void => {
  authEvents.emit('login', { user });
};

/**
 * 로그아웃 이벤트 발생
 * @description 로그아웃 시 전역으로 알림
 */
export const emitLogout = (): void => {
  authEvents.emit('logout');
};

/**
 * 토큰 갱신 이벤트 발생
 * @description 액세스 토큰이 갱신되었음을 전역으로 알림
 */
export const emitTokenRefreshed = (): void => {
  authEvents.emit('token-refreshed');
};

/**
 * 인증 오류 이벤트 발생
 * @param error - 오류 메시지
 * @description 인증 관련 오류 발생 시 전역으로 알림
 */
export const emitAuthError = (error: string): void => {
  authEvents.emit('auth-error', { error });
};

// ==================== React Hook 헬퍼 ====================

/**
 * React 컴포넌트에서 인증 이벤트 구독을 위한 커스텀 훅
 * @param event - 구독할 이벤트 타입
 * @param callback - 이벤트 핸들러
 *
 * @example
 * ```typescript
 * import { useEffect } from 'react';
 * import { authEvents } from '@/lib/auth/events';
 *
 * function MyComponent() {
 *   useEffect(() => {
 *     const unsubscribe = authEvents.on('logout', () => {
 *       // 로그아웃 시 처리
 *       router.push('/login');
 *     });
 *
 *     return unsubscribe; // 컴포넌트 언마운트 시 자동 구독 해제
 *   }, []);
 * }
 * ```
 */
export function useAuthEvent<T extends AuthEventType>(
  event: T,
  callback: AuthEventListener<T>
): void {
  // React Hook으로 사용하려면 useEffect 내에서 직접 사용
  // 이 함수는 가이드라인으로만 제공
  if (typeof window === 'undefined') return; // SSR 환경 체크

  // 실제 사용은 컴포넌트에서 useEffect와 함께
  console.warn('useAuthEvent는 useEffect 내에서 사용하세요');
}