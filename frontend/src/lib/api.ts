import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { apiLogger } from '@/utils/logger';
import { 
  AuthResponse, 
  LoginForm, 
  RegisterForm, 
  User,
  ApiResponse, 
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

class ApiClient {
  private client: AxiosInstance;
  private refreshTokenPromise: Promise<string | null> | null = null;

  constructor() {
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
    // 요청 인터셉터 (Authorization 헤더 제거 - 쿠키 사용)
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

    // 응답 인터셉터
    this.client.interceptors.response.use(
      (response) => {
        // 보안 강화된 로거 사용
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
          await this.refreshToken();
          // 원래 요청 재시도
          return this.client(originalRequest);
        } catch (refreshError) {
          // 토큰 갱신 실패 시 로그아웃 처리
          this.handleLogout();
          return Promise.reject(error);
        }
      }
    );
  }

  // 토큰 관련 메서드들 제거 (쿠키 사용으로 불필요)
  private getStoredToken(): string | null {
    // 쿠키 기반 인증으로 변경되어 더 이상 사용하지 않음
    return null;
  }

  private setStoredToken(token: string): void {
    // 쿠키 기반 인증으로 변경되어 더 이상 사용하지 않음
    // 백엔드에서 HttpOnly 쿠키로 자동 설정됨
  }

  private removeStoredToken(): void {
    // localStorage에 저장된 기존 토큰 제거 (마이그레이션을 위해)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
    }
  }

  private async refreshToken(): Promise<string | null> {
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise;
    }

    this.refreshTokenPromise = this.performTokenRefresh();
    const result = await this.refreshTokenPromise;
    this.refreshTokenPromise = null;
    return result;
  }

  private async performTokenRefresh(): Promise<string | null> {
    try {
      await this.client.post('/auth/refresh');
      return 'refreshed'; // 쿠키가 자동으로 업데이트됨
    } catch (error) {
      apiLogger.error('Token refresh failed');
      return null;
    }
  }

  private handleLogout(): void {
    this.removeStoredToken();
    // 자동 리다이렉트하지 않고 토큰만 제거
    // 실제 로그아웃은 useAuth에서 처리
  }

  private handleError(error: any): ApiError {
    const status = error.response?.status;
    
    // 401, 404 에러는 정상적인 상황이므로 로그에서 제외
    // 401: 인증 실패 (로그아웃 상태)
    // 404: 리소스 없음 (이미 삭제된 파일 등)
    if (status !== 401 && status !== 404) {
      // 보안 강화된 로거 사용 (민감한 데이터 자동 제거)
      apiLogger.error('API Error', {
        url: error.config?.url,
        method: error.config?.method,
        status: status,
        // data는 민감할 수 있어 제외
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
      const response: AxiosResponse<T> = await this.client(config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Auth API
  async login(credentials: LoginForm): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>({
      method: 'POST',
      url: '/auth/login',
      data: credentials,
    });
    
    // 쿠키 기반이므로 토큰 저장 불필요
    return response;
  }

  async register(userData: RegisterForm): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>({
      method: 'POST',
      url: '/auth/register',
      data: userData,
    });
    
    // 쿠키 기반이므로 토큰 저장 불필요
    return response;
  }

  async getProfile(): Promise<User> {
    return this.request<User>({
      method: 'GET',
      url: '/users/profile',
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request({
        method: 'POST',
        url: '/auth/logout',
      });
    } finally {
      this.removeStoredToken();
    }
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

  // 여러 포스트의 좋아요 상태를 한 번에 서버로 전송 (배치)
  async batchUpdateLikes(batch: Record<string, boolean>): Promise<void> {
    // TODO: 실제 엔드포인트에 맞게 구현
    // return this.request({ method: 'POST', url: '/posts/likes/batch', data: batch });
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
        // 민감한 정보 제외
      });

      // 1. Presigned URL 요청 - 반드시 인자로 받은 file 객체의 정보 사용
      const uploadData: CreateUploadUrlDto = {
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        fileType,
      };

      apiLogger.debug('Requesting presigned URL', uploadData);
      const presignedResponse = await this.createUploadUrl(uploadData);
      apiLogger.debug('Presigned URL response received');

      // 2. S3에 파일 업로드 (file 객체 그대로)
      await this.uploadFileToS3(file, presignedResponse.uploadUrl);

      // 3. 업로드 완료 알림 - file 객체 정보 그대로 사용
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
  /**
   * @deprecated Use useOAuth hook or SocialLoginButton component instead
   */
  googleAuth(): void {
    if (typeof window !== 'undefined') {
      window.location.href = `${API_BASE_URL}/auth/google`;
    }
  }

  /**
   * @deprecated Use useOAuth hook or SocialLoginButton component instead
   */
  kakaoAuth(): void {
    if (typeof window !== 'undefined') {
      window.location.href = `${API_BASE_URL}/auth/kakao`;
    }
  }

  /**
   * @deprecated Use useOAuth hook or SocialLoginButton component instead
   */
  githubAuth(): void {
    if (typeof window !== 'undefined') {
      window.location.href = `${API_BASE_URL}/auth/github`;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export posts API for convenience
export const postsAPI = {
  getPosts: (params?: { page?: number; limit?: number; search?: string; category?: string; blogSlug?: string; }) => 
    apiClient.getPosts(params),
  getPost: (id: string) => apiClient.getPost(id),
  getPostBySlug: (slug: string) => apiClient.getPostBySlug(slug),
  createPost: (data: PostForm) => apiClient.createPost(data),
  updatePost: (id: string, data: Partial<PostForm>) => apiClient.updatePost(id, data),
  deletePost: (id: string) => apiClient.deletePost(id),
  toggleLike: (id: string) => apiClient.toggleLike(id),
  batchUpdateLikes: (batch: Record<string, boolean>) => apiClient.batchUpdateLikes(batch),
};

// Export individual functions for convenience with proper binding
export const login = (...args: Parameters<typeof apiClient.login>) => apiClient.login(...args);
export const register = (...args: Parameters<typeof apiClient.register>) => apiClient.register(...args);
export const logout = (...args: Parameters<typeof apiClient.logout>) => apiClient.logout(...args);
export const getProfile = (...args: Parameters<typeof apiClient.getProfile>) => apiClient.getProfile(...args);
// refreshToken is private and should not be exported
export const getPosts = (...args: Parameters<typeof apiClient.getPosts>) => apiClient.getPosts(...args);
export const getPost = (...args: Parameters<typeof apiClient.getPost>) => apiClient.getPost(...args);
export const getPostBySlug = (...args: Parameters<typeof apiClient.getPostBySlug>) => apiClient.getPostBySlug(...args);
export const createPost = (...args: Parameters<typeof apiClient.createPost>) => apiClient.createPost(...args);
export const updatePost = (...args: Parameters<typeof apiClient.updatePost>) => apiClient.updatePost(...args);
export const deletePost = (...args: Parameters<typeof apiClient.deletePost>) => apiClient.deletePost(...args);
export const toggleLike = (...args: Parameters<typeof apiClient.toggleLike>) => apiClient.toggleLike(...args);
export const batchUpdateLikes = (...args: Parameters<typeof apiClient.batchUpdateLikes>) => apiClient.batchUpdateLikes(...args);
export const getComments = (...args: Parameters<typeof apiClient.getComments>) => apiClient.getComments(...args);
export const createComment = (...args: Parameters<typeof apiClient.createComment>) => apiClient.createComment(...args);
export const updateComment = (...args: Parameters<typeof apiClient.updateComment>) => apiClient.updateComment(...args);
export const deleteComment = (...args: Parameters<typeof apiClient.deleteComment>) => apiClient.deleteComment(...args);
export const toggleCommentLike = (...args: Parameters<typeof apiClient.toggleCommentLike>) => apiClient.toggleCommentLike(...args);
export const getBlogs = (...args: Parameters<typeof apiClient.getBlogs>) => apiClient.getBlogs(...args);
export const createBlog = (...args: Parameters<typeof apiClient.createBlog>) => apiClient.createBlog(...args);
export const getMyBlogs = (...args: Parameters<typeof apiClient.getMyBlogs>) => apiClient.getMyBlogs(...args);
export const getBlogBySlug = (...args: Parameters<typeof apiClient.getBlogBySlug>) => apiClient.getBlogBySlug(...args);
export const updateBlog = (...args: Parameters<typeof apiClient.updateBlog>) => apiClient.updateBlog(...args);
export const deleteBlog = (...args: Parameters<typeof apiClient.deleteBlog>) => apiClient.deleteBlog(...args);
export const createUploadUrl = (...args: Parameters<typeof apiClient.createUploadUrl>) => apiClient.createUploadUrl(...args);
export const uploadComplete = (...args: Parameters<typeof apiClient.uploadComplete>) => apiClient.uploadComplete(...args);
export const getFileStats = (...args: Parameters<typeof apiClient.getFileStats>) => apiClient.getFileStats(...args);
export const deleteFile = (...args: Parameters<typeof apiClient.deleteFile>) => apiClient.deleteFile(...args);
export const createApiKey = (...args: Parameters<typeof apiClient.createApiKey>) => apiClient.createApiKey(...args);
export const getApiKeys = (...args: Parameters<typeof apiClient.getApiKeys>) => apiClient.getApiKeys(...args);
export const deleteApiKey = (...args: Parameters<typeof apiClient.deleteApiKey>) => apiClient.deleteApiKey(...args);
export const googleAuth = (...args: Parameters<typeof apiClient.googleAuth>) => apiClient.googleAuth(...args);
export const kakaoAuth = (...args: Parameters<typeof apiClient.kakaoAuth>) => apiClient.kakaoAuth(...args);

// Export for backward compatibility
export default apiClient; 