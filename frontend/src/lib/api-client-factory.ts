import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { apiLogger } from '@/utils/logger';
import {
  AuthResponse,
  LoginForm,
  RegisterForm,
  User,
  ApiError,
  PaginatedResponse,
  Post,
  Comment,
  PostForm,
  CommentForm,
  FileUpload,
  CreateUploadUrlDto,
  UploadCompleteDto,
  PresignedUrlResponse,
  FileStats
} from '../types/index';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * ApiClient 클래스 - 싱글톤 패턴 제거, 팩토리 패턴 사용
 * 각 사용자별로 독립적인 인스턴스 생성
 */
export class ApiClient {
  private client: AxiosInstance;
  private userId?: string;

  constructor(userId?: string) {
    this.userId = userId;
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      withCredentials: true, // 쿠키 전송을 위해 필요
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // 요청 인터셉터
    this.client.interceptors.request.use(
      (config) => {
        // 보안 강화된 로거 사용
        apiLogger.apiRequest(config.method?.toUpperCase() || 'GET', config.url || '');
        return config;
      },
      (error) => {
        apiLogger.error('Request interceptor error', error);
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터 - refreshTokenPromise 제거
    this.client.interceptors.response.use(
      (response) => {
        apiLogger.apiResponse(response.status, response.config.url || '');
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // 토큰 갱신을 시도하지 않아야 하는 경우들
        const skipRefreshUrls = [
          '/auth/login',
          '/auth/register',
          '/auth/refresh',
          '/auth/logout',
        ];

        const shouldSkipRefresh =
          skipRefreshUrls.some(url => originalRequest.url?.includes(url)) ||
          originalRequest._retry ||
          error.response?.status !== 401;

        if (shouldSkipRefresh) {
          return Promise.reject(error);
        }

        // 401 에러이고 재시도하지 않은 경우에만 토큰 갱신 시도
        originalRequest._retry = true;

        try {
          // 토큰 갱신 시도
          await this.performTokenRefresh();
          // 원래 요청 재시도
          return this.client(originalRequest);
        } catch (refreshError) {
          // 토큰 갱신 실패 시 에러 전파
          return Promise.reject(error);
        }
      }
    );
  }

  private async performTokenRefresh(): Promise<void> {
    try {
      await this.client.post('/auth/refresh');
      // 쿠키가 자동으로 업데이트됨
    } catch (error) {
      apiLogger.error('Token refresh failed');
      throw error;
    }
  }

  private handleError(error: any): ApiError {
    const status = error.response?.status;

    // 401, 404 에러는 정상적인 상황이므로 로그에서 제외
    if (status !== 401 && status !== 404) {
      apiLogger.error('API Error', {
        url: error.config?.url,
        method: error.config?.method,
        status: status,
      });
    }

    const apiError: ApiError = {
      message: error.response?.data?.message || error.message || 'An error occurred',
      statusCode: status || 500,
      error: error.response?.data?.error,
      details: error.response?.data?.details,
    };

    return apiError;
  }

  // Generic request method
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client(config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Auth API
  async login(credentials: LoginForm): Promise<AuthResponse> {
    return this.request<AuthResponse>({
      method: 'POST',
      url: '/auth/login',
      data: credentials,
    });
  }

  async register(userData: RegisterForm): Promise<AuthResponse> {
    return this.request<AuthResponse>({
      method: 'POST',
      url: '/auth/register',
      data: userData,
    });
  }

  async getProfile(): Promise<User> {
    return this.request<User>({
      method: 'GET',
      url: '/users/profile',
    });
  }

  async logout(): Promise<void> {
    return this.request({
      method: 'POST',
      url: '/auth/logout',
    });
  }

  // Posts API
  async getPosts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    blogSlug?: string;
  }): Promise<PaginatedResponse<Post>> {
    return this.request<PaginatedResponse<Post>>({
      method: 'GET',
      url: '/posts',
      params,
    });
  }

  async getPost(id: string): Promise<Post> {
    return this.request<Post>({
      method: 'GET',
      url: `/posts/${id}`,
    });
  }

  async getPostBySlug(slug: string): Promise<Post> {
    return this.request<Post>({
      method: 'GET',
      url: `/posts/slug/${slug}`,
    });
  }

  async createPost(data: PostForm): Promise<Post> {
    return this.request<Post>({
      method: 'POST',
      url: '/posts',
      data,
    });
  }

  async updatePost(id: string, data: Partial<PostForm>): Promise<Post> {
    return this.request<Post>({
      method: 'PATCH',
      url: `/posts/${id}`,
      data,
    });
  }

  async deletePost(id: string): Promise<void> {
    return this.request<void>({
      method: 'DELETE',
      url: `/posts/${id}`,
    });
  }

  async toggleLike(id: string): Promise<{ liked: boolean }> {
    return this.request<{ liked: boolean }>({
      method: 'POST',
      url: `/posts/${id}/like`,
    });
  }

  async batchUpdateLikes(batch: Record<string, boolean>): Promise<void> {
    return Promise.resolve();
  }

  // Comments API
  async getComments(postId: string): Promise<Comment[]> {
    return this.request<Comment[]>({
      method: 'GET',
      url: `/comments/post/${postId}`,
    });
  }

  async createComment(data: CommentForm): Promise<Comment> {
    return this.request<Comment>({
      method: 'POST',
      url: '/comments',
      data,
    });
  }

  async updateComment(id: string, content: string): Promise<Comment> {
    return this.request<Comment>({
      method: 'PUT',
      url: `/comments/${id}`,
      data: { content },
    });
  }

  async deleteComment(id: string): Promise<void> {
    return this.request<void>({
      method: 'DELETE',
      url: `/comments/${id}`,
    });
  }

  async toggleCommentLike(id: string): Promise<{ liked: boolean; likesCount: number; dislikesCount: number }> {
    return this.request<{ liked: boolean; likesCount: number; dislikesCount: number }>({
      method: 'POST',
      url: `/comments/${id}/like`,
    });
  }

  async toggleCommentDislike(id: string): Promise<{ disliked: boolean; likesCount: number; dislikesCount: number }> {
    return this.request<{ disliked: boolean; likesCount: number; dislikesCount: number }>({
      method: 'POST',
      url: `/comments/${id}/dislike`,
    });
  }

  // Files API
  async createUploadUrl(data: CreateUploadUrlDto): Promise<PresignedUrlResponse> {
    return this.request<PresignedUrlResponse>({
      method: 'POST',
      url: '/files/upload-url',
      data,
    });
  }

  async uploadComplete(data: UploadCompleteDto): Promise<FileUpload> {
    return this.request<FileUpload>({
      method: 'POST',
      url: '/files/upload-complete',
      data,
    });
  }

  async uploadFileToS3(file: File, uploadUrl: string): Promise<void> {
    // S3에 직접 업로드 (Presigned URL 사용)
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }
  }

  async getUserFiles(params?: {
    fileType?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<FileUpload>> {
    return this.request<PaginatedResponse<FileUpload>>({
      method: 'GET',
      url: '/files',
      params,
    });
  }

  async getFile(id: number): Promise<FileUpload> {
    return this.request<FileUpload>({
      method: 'GET',
      url: `/files/${id}`,
    });
  }

  async getFileDownloadUrl(id: number): Promise<{ downloadUrl: string }> {
    return this.request<{ downloadUrl: string }>({
      method: 'GET',
      url: `/files/${id}/download-url`,
    });
  }

  async deleteFile(id: string): Promise<void> {
    return this.request<void>({
      method: 'DELETE',
      url: `/files/${id}`,
    });
  }

  async getFileStats(): Promise<FileStats> {
    return this.request<FileStats>({
      method: 'GET',
      url: '/files/stats',
    });
  }

  // 통합 파일 업로드 메서드
  async uploadFile(
    file: File,
    fileType: 'image' | 'document' | 'video' | 'general' = 'general'
  ): Promise<FileUpload> {
    try {
      apiLogger.debug('uploadFile started', {
        fileName: file.name,
        fileType,
      });

      // 1. Presigned URL 요청
      const uploadData: CreateUploadUrlDto = {
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        fileType,
      };

      apiLogger.debug('Requesting presigned URL', uploadData);
      const presignedResponse = await this.createUploadUrl(uploadData);
      apiLogger.debug('Presigned URL response received');

      // 2. S3에 파일 업로드
      await this.uploadFileToS3(file, presignedResponse.uploadUrl);

      // 3. 업로드 완료 알림
      const completeData: UploadCompleteDto = {
        fileKey: presignedResponse.fileKey,
        fileUrl: `https://myblogdata84.s3.us-east-1.amazonaws.com/${presignedResponse.fileKey}`,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        fileType: fileType
      };

      apiLogger.debug('Uploading file', { name: file.name, type: file.type, size: file.size });
      return await this.uploadComplete(completeData);
    } catch (error) {
      apiLogger.error('File upload failed', error);
      throw error;
    }
  }

  // Profile Management
  async updateProfile(data: {
    username?: string;
    email?: string;
    bio?: string;
    profileImage?: string;
  }): Promise<User> {
    return this.request<User>({
      method: 'PUT',
      url: '/users/profile',
      data,
    });
  }

  // Settings Management
  async getNotificationSettings(): Promise<any> {
    return this.request<any>({
      method: 'GET',
      url: '/users/settings/notifications',
    });
  }

  async updateNotificationSettings(settings: {
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    weeklyDigest?: boolean;
    marketingEmails?: boolean;
  }): Promise<any> {
    return this.request<any>({
      method: 'PUT',
      url: '/users/settings/notifications',
      data: settings,
    });
  }

  async getSecuritySettings(): Promise<any> {
    return this.request<any>({
      method: 'GET',
      url: '/users/settings/security',
    });
  }

  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<void> {
    return this.request<void>({
      method: 'PUT',
      url: '/users/change-password',
      data,
    });
  }

  async enableTwoFactor(): Promise<{ qrCode: string; secret: string }> {
    return this.request<{ qrCode: string; secret: string }>({
      method: 'POST',
      url: '/users/2fa/enable',
    });
  }

  async verifyTwoFactor(token: string): Promise<void> {
    return this.request<void>({
      method: 'POST',
      url: '/users/2fa/verify',
      data: { token },
    });
  }

  async disableTwoFactor(password: string): Promise<void> {
    return this.request<void>({
      method: 'POST',
      url: '/users/2fa/disable',
      data: { password },
    });
  }

  // API Keys Management
  async getApiKeys(): Promise<any[]> {
    return this.request<any[]>({
      method: 'GET',
      url: '/api-keys',
    });
  }

  async getApiKeysByBlog(blogId: string): Promise<any[]> {
    return this.request<any[]>({
      method: 'GET',
      url: `/api-keys/blog/${blogId}`,
    });
  }

  async createApiKey(data: { name: string; description?: string; blogId: string }): Promise<any> {
    return this.request<any>({
      method: 'POST',
      url: '/api-keys',
      data,
    });
  }

  async toggleApiKey(id: string): Promise<any> {
    return this.request<any>({
      method: 'PUT',
      url: `/api-keys/${id}/toggle`,
    });
  }

  async deleteApiKey(id: string): Promise<void> {
    return this.request<void>({
      method: 'DELETE',
      url: `/api-keys/${id}`,
    });
  }

  // Blogs API
  async getBlogs(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<any>> {
    return this.request<PaginatedResponse<any>>({
      method: 'GET',
      url: '/blogs',
      params,
    });
  }

  async createBlog(data: {
    name: string;
    slug: string;
    description?: string;
  }): Promise<any> {
    return this.request<any>({
      method: 'POST',
      url: '/blogs',
      data,
    });
  }

  async getMyBlogs(): Promise<any[]> {
    return this.request<any[]>({
      method: 'GET',
      url: '/blogs/my-blogs',
    });
  }

  async getBlogBySlug(slug: string): Promise<any> {
    return this.request<any>({
      method: 'GET',
      url: `/blogs/slug/${slug}`,
    });
  }

  async updateBlog(id: string, data: Partial<{
    name: string;
    slug: string;
    description?: string;
  }>): Promise<any> {
    return this.request<any>({
      method: 'PATCH',
      url: `/blogs/${id}`,
      data,
    });
  }

  async deleteBlog(id: string): Promise<void> {
    return this.request<void>({
      method: 'DELETE',
      url: `/blogs/${id}`,
    });
  }

  // OAuth methods
  googleAuth(): void {
    if (typeof window !== 'undefined') {
      window.location.href = `${API_BASE_URL}/auth/google`;
    }
  }

  kakaoAuth(): void {
    if (typeof window !== 'undefined') {
      window.location.href = `${API_BASE_URL}/auth/kakao`;
    }
  }

  githubAuth(): void {
    if (typeof window !== 'undefined') {
      window.location.href = `${API_BASE_URL}/auth/github`;
    }
  }
}

/**
 * 팩토리 함수 - 새로운 ApiClient 인스턴스 생성
 * @param userId 사용자 ID (선택적)
 * @returns ApiClient 인스턴스
 */
export function createApiClient(userId?: string): ApiClient {
  return new ApiClient(userId);
}

/**
 * 기본 ApiClient 인스턴스 (비로그인 사용자용)
 * 주의: 이는 전역 공유 인스턴스이므로 사용자별 상태를 저장하지 않음
 */
export const defaultApiClient = createApiClient();