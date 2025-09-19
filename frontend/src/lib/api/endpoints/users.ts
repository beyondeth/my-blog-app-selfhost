/**
 * 사용자 관련 API 엔드포인트
 * @description 프로필, 설정, API 키 관리 등 사용자 관련 기능
 */

import type { ApiClient } from '../client';
import type {
  User,
  UpdateProfileDto,
  NotificationSettings,
  SecuritySettings,
  ChangePasswordDto,
  TwoFactorSetupResponse,
  ApiKey
} from '../types';

/**
 * API 키 생성 데이터
 */
export interface CreateApiKeyDto {
  name: string;
  description?: string;
  blogId: string;
}

/**
 * 사용자 API 클래스
 * @description 사용자 프로필 및 설정 관련 모든 API 메서드
 */
export class UsersAPI {
  constructor(private client: ApiClient) {}

  /**
   * 프로필 정보 수정
   * @param data - 수정할 프로필 데이터
   * @returns 수정된 사용자 정보
   */
  async updateProfile(data: UpdateProfileDto): Promise<User> {
    return this.client.put<User>('/users/profile', data);
  }

  /**
   * 알림 설정 조회
   * @returns 현재 알림 설정
   */
  async getNotificationSettings(): Promise<NotificationSettings> {
    return this.client.get<NotificationSettings>('/users/settings/notifications');
  }

  /**
   * 알림 설정 수정
   * @param settings - 수정할 알림 설정
   * @returns 수정된 알림 설정
   */
  async updateNotificationSettings(
    settings: Partial<NotificationSettings>
  ): Promise<NotificationSettings> {
    return this.client.put<NotificationSettings>(
      '/users/settings/notifications',
      settings
    );
  }

  /**
   * 보안 설정 조회
   * @returns 현재 보안 설정
   */
  async getSecuritySettings(): Promise<SecuritySettings> {
    return this.client.get<SecuritySettings>('/users/settings/security');
  }

  /**
   * 비밀번호 변경
   * @param data - 비밀번호 변경 데이터
   * @description 현재 비밀번호 확인 후 새 비밀번호로 변경
   */
  async changePassword(data: ChangePasswordDto): Promise<void> {
    await this.client.put('/users/change-password', data);
  }

  /**
   * 2단계 인증 활성화
   * @returns QR 코드 및 비밀 키
   * @description Google Authenticator 등과 연동
   */
  async enableTwoFactor(): Promise<TwoFactorSetupResponse> {
    return this.client.post<TwoFactorSetupResponse>('/users/2fa/enable');
  }

  /**
   * 2단계 인증 코드 검증
   * @param token - OTP 토큰
   * @description 2FA 설정 완료를 위한 검증
   */
  async verifyTwoFactor(token: string): Promise<void> {
    await this.client.post('/users/2fa/verify', { token });
  }

  /**
   * 2단계 인증 비활성화
   * @param password - 사용자 비밀번호
   * @description 보안을 위해 비밀번호 재확인
   */
  async disableTwoFactor(password: string): Promise<void> {
    await this.client.post('/users/2fa/disable', { password });
  }

  // API 키 관리

  /**
   * API 키 목록 조회
   * @returns 사용자의 모든 API 키
   */
  async getApiKeys(): Promise<ApiKey[]> {
    return this.client.get<ApiKey[]>('/api-keys');
  }

  /**
   * 블로그별 API 키 조회
   * @param blogId - 블로그 ID
   * @returns 해당 블로그의 API 키 목록
   */
  async getApiKeysByBlog(blogId: string): Promise<ApiKey[]> {
    return this.client.get<ApiKey[]>(`/api-keys/blog/${blogId}`);
  }

  /**
   * API 키 생성
   * @param data - API 키 생성 데이터
   * @returns 생성된 API 키 (키 값은 생성 시에만 반환)
   * @description 생성된 키는 다시 조회할 수 없으므로 안전하게 보관 필요
   */
  async createApiKey(data: CreateApiKeyDto): Promise<ApiKey> {
    return this.client.post<ApiKey>('/api-keys', data);
  }

  /**
   * API 키 활성화/비활성화 토글
   * @param id - API 키 ID
   * @returns 수정된 API 키 정보
   */
  async toggleApiKey(id: string): Promise<ApiKey> {
    return this.client.put<ApiKey>(`/api-keys/${id}/toggle`);
  }

  /**
   * API 키 삭제
   * @param id - API 키 ID
   * @description 삭제된 키는 복구 불가능
   */
  async deleteApiKey(id: string): Promise<void> {
    await this.client.delete(`/api-keys/${id}`);
  }
}

/**
 * UsersAPI 인스턴스 생성 헬퍼
 * @param client - ApiClient 인스턴스
 * @returns UsersAPI 인스턴스
 */
export function createUsersAPI(client: ApiClient): UsersAPI {
  return new UsersAPI(client);
}