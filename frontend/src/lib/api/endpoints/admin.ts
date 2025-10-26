/**
 * Admin API 엔드포인트
 * @description 관리자 전용 API 호출 함수들
 */

import { ApiClient } from '../client';

// 삭제된 사용자 타입
export interface DeletedUser {
  id: string;
  email: string;
  username: string;
  deletedAt: Date;
  scheduledDeletionAt: Date;
  daysRemaining: number; // 남은 삭제 대기 일수
  role: string;
  createdAt: Date;
}

// 삭제된 사용자 목록 응답
export interface DeletedUsersResponse {
  data: DeletedUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 사용자 복구 응답
export interface RestoreUserResponse {
  message: string;
  user: any;
}

// 영구 삭제 응답
export interface PermanentDeleteResponse {
  message: string;
}

/**
 * Admin API 클래스
 */
export class AdminAPI {
  constructor(private client: ApiClient) {}

  /**
   * 삭제된 사용자 목록 조회
   */
  async getDeletedUsers(params?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<DeletedUsersResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const queryString = queryParams.toString();
    const url = `/admin/users/deleted${queryString ? `?${queryString}` : ''}`;

    return this.client.get<DeletedUsersResponse>(url);
  }

  /**
   * 삭제된 사용자 복구
   */
  async restoreUser(userId: string): Promise<RestoreUserResponse> {
    return this.client.post<RestoreUserResponse>(`/admin/users/${userId}/restore`);
  }

  /**
   * 사용자 즉시 영구 삭제
   */
  async permanentDeleteUser(userId: string): Promise<PermanentDeleteResponse> {
    return this.client.delete<PermanentDeleteResponse>(`/admin/users/${userId}/permanent`);
  }
}

/**
 * Admin API 인스턴스 생성 함수
 */
export function createAdminAPI(client: ApiClient): AdminAPI {
  return new AdminAPI(client);
}
