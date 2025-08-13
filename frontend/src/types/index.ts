// 사용자 관련 타입 - 타입 안전성 개선
export const UserRole = {
  ADMIN: 'admin',
  USER: 'user',
  MODERATOR: 'moderator'
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

export const AuthProvider = {
  LOCAL: 'local',
  GOOGLE: 'google',
  KAKAO: 'kakao'
} as const;

export type AuthProviderType = typeof AuthProvider[keyof typeof AuthProvider];

export interface User {
  readonly id: number;
  readonly email: string;
  readonly username: string;
  readonly profileImage?: string;
  readonly bio?: string;
  readonly role: UserRoleType;
  readonly authProvider: AuthProviderType;
  readonly isEmailVerified: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuthResponse {
  readonly access_token: string;
  readonly user: User;
}

export enum Role {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator'
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (credentials: LoginForm) => Promise<void>;
  register: (userData: RegisterForm) => Promise<void>;
  logout: (redirectTo?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  error: string | null;
}

// 게시글 관련 타입
export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  thumbnail?: string;
  isPublished: boolean;
  viewCount: number;
  likeCount: number;
  liked: boolean;
  tags?: string[];
  category?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  author: User;
  comments?: Comment[];
  likedBy?: User[];
  attachedFiles?: FileUpload[];
}

// 댓글 관련 타입
export interface Comment {
  id: number;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  author: User;
  post: Post;
  parentComment?: Comment;
  replies?: Comment[];
}

// API 응답 타입
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
  details?: any;
}

export interface PaginatedResponse<T> {
  posts: T[];
  total: number;
}

// 폼 관련 타입
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  username: string;
}

export interface PostForm {
  title: string;
  content: string;
  thumbnail?: string;
  tags?: string[];
  category?: string;
  attachedFileIds?: string[];
}

export interface CommentForm {
  content: string;
  postId: number;
  parentCommentId?: number;
}

// 검색 및 필터링 타입
export interface SearchParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
}

// 테마 관련 타입
export type Theme = 'light' | 'dark';

// 관리자 대시보드 타입
export interface DashboardStats {
  totalPosts: number;
  totalUsers: number;
  totalComments: number;
  totalViews: number;
}

export interface UserActivity {
  id: number;
  userId: number;
  action: string;
  target: string;
  createdAt: string;
}

// 파일 업로드 관련 타입 - 타입 안전성 개선
export const FileType = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  VIDEO: 'video',
  GENERAL: 'general'
} as const;

export type FileTypeType = typeof FileType[keyof typeof FileType];

export interface FileUpload {
  readonly id: number;
  readonly originalName: string;
  readonly fileName: string;
  readonly fileKey: string;
  readonly fileUrl: string;
  readonly fileSize: number;
  readonly mimeType: string;
  readonly fileType: FileTypeType;
  readonly userId: number;
  readonly user?: User;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateUploadUrlDto {
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileType?: FileTypeType;
}

export interface UploadCompleteDto {
  fileKey: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileType?: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileKey: string;
  expiresIn: number;
  tempId?: string;
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  byType: Array<{
    fileType: string;
    count: number;
    totalSize: number;
  }>;
} 