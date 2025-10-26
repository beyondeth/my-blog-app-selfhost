// API Response Types

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio?: string;
  profileImage?: string;
  blog?: Blog;
  createdAt: string;
  updatedAt: string;
}

export interface Blog {
  id: string;
  name: string;
  slug: string;
  description?: string;
  userId: string;
  user?: User;
  posts?: Post[];
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  published: boolean;
  viewCount: number;
  blogId: string;
  blog?: Blog;
  comments?: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  content: string;
  postId: string;
  userId: string;
  user?: User;
  post?: Post;
  createdAt: string;
  updatedAt: string;
}

export interface FollowInfo {
  followersCount: number;
  followingCount: number;
  isFollowedByUser: boolean;
}

export interface PaginatedResponse<T> {
  posts: T[];  // 백엔드 응답 구조와 일치
  total: number;
  page: number;
  totalPages: number;
}

export interface Notification {
  id: string;
  type: NotificationType;
  read: boolean;
  recipientId: string;
  issuerId: string;
  issuer?: User;
  postId?: string;
  post?: Post;
  commentId?: string;
  comment?: Comment;
  blogId?: string;
  blog?: Blog;
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export enum NotificationType {
  FOLLOW = 'FOLLOW',
  POST_LIKE = 'POST_LIKE',
  COMMENT = 'COMMENT',
  COMMENT_LIKE = 'COMMENT_LIKE',
  MENTION = 'MENTION',
  SYSTEM = 'SYSTEM',
}

export interface ApiError {
  message: string;
  error?: string;
  statusCode?: number;
  code?: string;  // 에러 코드 (예: 'ACCOUNT_DELETED')
  remainingDays?: number;  // 삭제된 계정의 재가입 가능까지 남은 일수
}