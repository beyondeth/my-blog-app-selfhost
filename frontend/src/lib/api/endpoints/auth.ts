/**
 * 인증 관련 API 엔드포인트
 * @description 로그인, 회원가입, 로그아웃 등 인증 관련 모든 API 메서드
 */

import type { ApiClient } from '../client';
import type {
  AuthResponse,
  LoginForm,
  RegisterForm,
  RefreshSession,
  User
} from '../types';

/**
 * 인증 API 클래스
 * @description ApiClient를 확장하여 인증 관련 메서드 추가
 */
export class AuthAPI {
  constructor(private client: ApiClient) {}

  /**
   * 로그인
   * @param credentials - 로그인 폼 데이터 (이메일, 비밀번호)
   * @returns 인증 응답 (사용자 정보 포함)
   * @description 성공 시 HttpOnly 쿠키로 JWT 토큰 자동 설정
   */
  async login(credentials: LoginForm): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/login', credentials);
    // 쿠키 기반 인증이므로 별도 토큰 저장 불필요
    return response;
  }

  /**
   * 회원가입
   * @param userData - 회원가입 폼 데이터
   * @returns 인증 응답 (사용자 정보 포함)
   * @description 성공 시 자동 로그인 처리
   */
  async register(userData: RegisterForm): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/register', userData);
    // 회원가입 후 자동 로그인 - 쿠키 자동 설정
    return response;
  }

  /**
   * 로그아웃
   * @description 서버 세션 종료 및 쿠키 제거
   */
  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } finally {
      // 레거시 localStorage 정리 (마이그레이션 호환성)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
      }
    }
  }

  /**
   * 현재 사용자 정보 조회
   * @returns 로그인된 사용자 정보
   * @throws 401 - 인증되지 않은 사용자
   */
  async getProfile(): Promise<User> {
    return this.client.get<User>('/auth/me');
  }

  /**
   * 토큰 갱신
   * @returns 갱신 성공 여부
   * @description 쿠키의 JWT 토큰을 새로운 토큰으로 갱신
   */
  async refreshToken(): Promise<void> {
    await this.client.post('/auth/refresh');
    // 쿠키가 자동으로 업데이트됨
  }

  async listSessions(): Promise<RefreshSession[]> {
    return this.client.get<RefreshSession[]>('/auth/sessions');
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.client.delete(`/auth/sessions/${sessionId}`);
  }

  async revokeAllSessions(): Promise<void> {
    await this.client.post('/auth/sessions/revoke-all');
  }

  /**
   * OAuth 로그인 - Google
   * @deprecated useOAuth hook 또는 SocialLoginButton 컴포넌트 사용 권장
   */
  googleAuth(): void {
    if (typeof window !== 'undefined') {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      window.location.href = `${apiUrl}/auth/google`;
    }
  }

  /**
   * OAuth 로그인 - Kakao
   * @deprecated useOAuth hook 또는 SocialLoginButton 컴포넌트 사용 권장
   */
  kakaoAuth(): void {
    if (typeof window !== 'undefined') {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      window.location.href = `${apiUrl}/auth/kakao`;
    }
  }

  /**
   * OAuth 로그인 - GitHub
   * @deprecated useOAuth hook 또는 SocialLoginButton 컴포넌트 사용 권장
   */
  githubAuth(): void {
    if (typeof window !== 'undefined') {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      window.location.href = `${apiUrl}/auth/github`;
    }
  }
}

/**
 * AuthAPI 인스턴스 생성 헬퍼
 * @param client - ApiClient 인스턴스
 * @returns AuthAPI 인스턴스
 */
export function createAuthAPI(client: ApiClient): AuthAPI {
  return new AuthAPI(client);
}
