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
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly profileImage?: string;
  readonly bio?: string;
  readonly role: UserRoleType;
  readonly authProvider: AuthProviderType;            // 최초 가입 방법 (변경 안됨)
  readonly lastLoginProvider?: AuthProviderType;      // 현재 로그인 방법 (계정 삭제 UX용)
  readonly providerId?: string;
  readonly isEmailVerified: boolean;
  readonly isActive?: boolean;
  readonly lastLoginAt?: string;
  readonly blogSlug?: string | null;  // 블로그 슬러그 (헤더 "내 블로그" 버튼에서 사용)
  readonly subscriptionTier?: string;  // 구독 티어 (헤더 플랜 배지에서 사용)
  readonly subscriptionStatus?: string;  // 구독 상태
  readonly marketingOptIn?: boolean;  // 마케팅 정보 수신 동의
  readonly newsletterOptIn?: boolean;  // 뉴스레터 수신 동의
  readonly termsAcceptedAt?: string | null;  // 이용약관 동의 시각
  readonly privacyAcceptedAt?: string | null;  // 개인정보 처리방침 동의 시각
  readonly createdAt: string;
  readonly updatedAt: string;
}

// Helper function: 약관 동의가 필요한지 확인
export function needsConsent(user: User | null): boolean {
  if (!user) return false;
  return !user.termsAcceptedAt || !user.privacyAcceptedAt;
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
  checkAuth: () => Promise<void>;
  clearError: () => void;
  error: string | null;
}

// 블로그 관련 타입
export interface Blog {
  readonly id: string;
  readonly slug: string; // 이메일 기반 고유 식별자 (변경 불가)
  readonly alias?: string; // 사용자 변경 가능 주소 (Phase 2: Alias 시스템)
  readonly name: string;
  readonly description?: string;
  readonly thumbnailUrl?: string;
  readonly userId: string;
  readonly owner?: User;
  readonly posts?: Post[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly postCount?: number;
  readonly isPublic?: boolean;
  readonly allowComments?: boolean;
  // 팔로우 정보 (백엔드에서 동적으로 추가)
  readonly followInfo?: {
    followersCount: number;
    followingCount: number;
    isFollowedByUser: boolean;
  };
}

// 게시글 관련 타입
export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;  // 포스트 요약 (목록 표시용)
  thumbnail?: string;
  isPublished: boolean;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  bookmarked?: boolean;  // 북마크 여부
  tags?: string[];
  category: string;  // 카테고리 (필수)
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  author: User;
  blog?: Blog;
  blogId?: string;
  comments?: Comment[];
  likedBy?: User[];
  attachedFiles?: FileUpload[];
  qualityScore?: number | null;
  isEditorPick?: boolean;  // Editor's Pick 여부
  editorPickedAt?: string;  // Editor's Pick 선정 시간
}

// 댓글 관련 타입
export interface Comment {
  id: string;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  author: User;
  post: Post;
  postId: string;
  parentComment?: Comment;
  parentCommentId?: string;
  replies?: Comment[];
  likesCount?: number;
  dislikesCount?: number;
  repliesCount?: number;
  userLiked?: boolean;
  userDisliked?: boolean;
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
  code?: string;  // 에러 코드 (예: 'ACCOUNT_DELETED')
  remainingDays?: number;  // 삭제된 계정의 재가입 가능까지 남은 일수
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
  emailVerificationToken?: string;
  // 약관 동의 필드 (필수)
  isOver14?: boolean;
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
  // 선택 동의 필드
  marketingOptIn?: boolean;
  newsletterOptIn?: boolean;
}

export interface PostForm {
  title: string;
  content: string;
  thumbnail?: string;
  tags?: string[];
  category: string;  // 카테고리 (필수)
  attachedFileIds?: string[];
}

export interface CommentForm {
  content: string;
  postId: string;
  parentCommentId?: string;
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