/**
 * API 관련 타입 정의
 * @description API 클라이언트에서 사용하는 모든 타입들을 중앙화하여 관리합니다.
 * SaaS 플랫폼의 다중 사용자 환경을 고려한 타입 설계
 */

import type {
  User,
  AuthResponse,
  LoginForm,
  RegisterForm,
  ApiResponse,
  ApiError,
  PaginatedResponse,
  Post,
  PostForm,
  CreatePostRequest,
  Comment,
  CommentForm,
  FileUpload,
  CreateUploadUrlDto,
  UploadCompleteDto,
  PresignedUrlResponse,
  FileStats,
  Blog
} from '@/types';

/**
 * 블로그 생성/수정 폼 타입
 */
export interface BlogForm {
  name: string;
  slug: string;
  description?: string;
  isPublic?: boolean;
  allowComments?: boolean;
}

/**
 * API 클라이언트 설정 타입
 * @description 각 사용자별 독립적인 API 클라이언트 생성을 위한 설정
 */
export interface ApiClientConfig {
  /** 사용자 ID - 멀티 테넌시 환경에서 사용자별 격리를 위해 사용 */
  userId?: string;
  /** API 기본 URL */
  baseURL?: string;
  /** 요청 타임아웃 (밀리초) */
  timeout?: number;
  /** 쿠키 자동 전송 여부 (인증용) */
  withCredentials?: boolean;
}

/**
 * 토큰 갱신 응답 타입
 */
export interface RefreshTokenResponse {
  /** 새로운 액세스 토큰 (쿠키로 자동 설정됨) */
  accessToken?: string;
  /** 갱신 성공 여부 */
  success: boolean;
}

export interface RefreshSession {
  id: string;
  familyId: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
}

/**
 * API 키 관리 타입
 */
export interface ApiKey {
  id: string;
  name: string;
  description?: string;
  blogId: string;
  key?: string; // 생성 시에만 반환
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

/**
 * 알림 설정 타입
 */
export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
  marketingEmails: boolean;
}

/**
 * 보안 설정 타입
 */
export interface SecuritySettings {
  twoFactorEnabled: boolean;
  lastPasswordChange: string;
  activeSessions: number;
}

/**
 * 프로필 업데이트 타입
 */
export interface UpdateProfileDto {
  username?: string;
  email?: string;
  bio?: string;
  profileImage?: string;
}

/**
 * 비밀번호 변경 타입
 */
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * 2FA 활성화 응답 타입
 */
export interface TwoFactorSetupResponse {
  qrCode: string;
  secret: string;
}

// Re-export commonly used types
export type {
  User,
  AuthResponse,
  LoginForm,
  RegisterForm,
  ApiResponse,
  ApiError,
  PaginatedResponse,
  Post,
  PostForm,
  CreatePostRequest,
  Comment,
  CommentForm,
  FileUpload,
  CreateUploadUrlDto,
  UploadCompleteDto,
  PresignedUrlResponse,
  FileStats,
  Blog
};
