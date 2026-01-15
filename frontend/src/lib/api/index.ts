/**
 * 통합 API 모듈
 * @description 모든 API 클라이언트와 메서드를 중앙화하여 관리
 * 레거시 호환성을 위해 기존 api.ts와 동일한 인터페이스 제공
 */

import { ApiClient, createApiClient, defaultApiClient } from './client';
import { AuthAPI, createAuthAPI } from './endpoints/auth';
import { PostsAPI, createPostsAPI } from './endpoints/posts';
import { CommentsAPI, createCommentsAPI } from './endpoints/comments';
import type { CommentContext } from './endpoints/comments';
import { BlogsAPI, createBlogsAPI } from './endpoints/blogs';
import { FilesAPI, createFilesAPI } from './endpoints/files';
import { UsersAPI, createUsersAPI } from './endpoints/users';
import { ChatAPI, createChatAPI } from './endpoints/chat';
import { AdminAPI, createAdminAPI } from './endpoints/admin';

// Types re-export
export * from './types';
export type {
  Conversation,
  Message,
  MessagesPaginatedResponse,
  BlockedUser
} from './endpoints/chat';
export type { BlogForm } from './endpoints/blogs';

/**
 * 확장된 API 클라이언트 클래스
 * @description 모든 엔드포인트 API를 통합한 완전한 클라이언트
 */
export class ExtendedApiClient extends ApiClient {
  public auth: AuthAPI;
  public posts: PostsAPI;
  public comments: CommentsAPI;
  public blogs: BlogsAPI;
  public files: FilesAPI;
  public users: UsersAPI;
  public chat: ChatAPI;
  public admin: AdminAPI;

  constructor(config: any = {}) {
    super(config);

    // 각 API 엔드포인트 초기화
    this.auth = createAuthAPI(this);
    this.posts = createPostsAPI(this);
    this.comments = createCommentsAPI(this);
    this.blogs = createBlogsAPI(this);
    this.files = createFilesAPI(this);
    this.users = createUsersAPI(this);
    this.chat = createChatAPI(this);
    this.admin = createAdminAPI(this);
  }

  // ==================== 레거시 호환성을 위한 메서드 ====================
  // 기존 api.ts의 메서드들을 그대로 유지하여 하위 호환성 보장

  // Auth API - 레거시 메서드
  async login(credentials: any) { return this.auth.login(credentials); }
  async register(userData: any) { return this.auth.register(userData); }
  async getProfile() { return this.auth.getProfile(); }
  async logout() { return this.auth.logout(); }
  googleAuth() { return this.auth.googleAuth(); }
  kakaoAuth() { return this.auth.kakaoAuth(); }
  githubAuth() { return this.auth.githubAuth(); }

  // Posts API - 레거시 메서드
  async getPosts(params?: any) { return this.posts.getPosts(params); }
  async getPost(id: string) { return this.posts.getPost(id); }
  async getPostBySlug(slug: string) { return this.posts.getPostBySlug(slug); }
  async createPost(data: any) { return this.posts.createPost(data); }
  async updatePost(id: string, data: any) { return this.posts.updatePost(id, data); }
  async deletePost(id: string) { return this.posts.deletePost(id); }
  async toggleLike(id: string) { return this.posts.toggleLike(id); }
  async batchUpdateLikes(batch: Record<string, boolean>) {
    return this.posts.batchUpdateLikes(batch);
  }

  // Comments API - 레거시 메서드
  async getComments(postId: string) { return this.comments.getComments(postId); }
  async createComment(data: any, context?: CommentContext) {
    return this.comments.createComment(data, context);
  }
  async updateComment(id: string, content: string, context?: CommentContext) {
    return this.comments.updateComment(id, content, context);
  }
  async deleteComment(id: string, context?: CommentContext) {
    return this.comments.deleteComment(id, context);
  }
  async toggleCommentLike(id: string, context?: CommentContext) {
    return this.comments.toggleCommentLike(id, context);
  }
  async toggleCommentDislike(id: string, context?: CommentContext) {
    return this.comments.toggleCommentDislike(id, context);
  }
  // Comments API - 페이지네이션 메서드
  async getCommentsPaginated(postId: string, params?: any, context?: CommentContext) {
    return this.comments.getCommentsPaginated(postId, params, context);
  }
  async getRepliesPaginated(commentId: string, params?: any, context?: CommentContext) {
    return this.comments.getRepliesPaginated(commentId, params, context);
  }

  // Blogs API - 레거시 메서드
  async getBlogs(params?: any) { return this.blogs.getBlogs(params); }
  async createBlog(data: any) { return this.blogs.createBlog(data); }
  async getMyBlogs() { return this.blogs.getMyBlogs(); }
  async getBlogBySlug(slug: string) { return this.blogs.getBlogBySlug(slug); }
  async checkAlias(alias: string) { return this.blogs.checkAlias(alias); }
  async updateAlias(alias: string) { return this.blogs.updateAlias(alias); }
  async updateBlog(id: string, data: any) { return this.blogs.updateBlog(id, data); }
  async deleteBlog(id: string) { return this.blogs.deleteBlog(id); }

  // Files API - 레거시 메서드
  async createUploadUrl(data: any) { return this.files.createUploadUrl(data); }
  async uploadComplete(data: any) { return this.files.uploadComplete(data); }
  async uploadFileToS3(file: File, uploadUrl: string) {
    return this.files.uploadFileToS3(file, uploadUrl);
  }
  async uploadFile(file: File, fileType?: any) {
    return this.files.uploadFile(file, fileType);
  }
  async getUserFiles(params?: any) { return this.files.getUserFiles(params); }
  async getFile(id: number) { return this.files.getFile(id); }
  async getFileDownloadUrl(id: number) { return this.files.getFileDownloadUrl(id); }
  async deleteFile(id: string) { return this.files.deleteFile(id); }
  async getFileStats() { return this.files.getFileStats(); }

  // Users API - 레거시 메서드
  async updateProfile(data: any) { return this.users.updateProfile(data); }
  async getNotificationSettings() { return this.users.getNotificationSettings(); }
  async updateNotificationSettings(settings: any) {
    return this.users.updateNotificationSettings(settings);
  }
  async getSecuritySettings() { return this.users.getSecuritySettings(); }
  async changePassword(data: any) { return this.users.changePassword(data); }
  async enableTwoFactor() { return this.users.enableTwoFactor(); }
  async verifyTwoFactor(token: string) { return this.users.verifyTwoFactor(token); }
  async disableTwoFactor(password: string) {
    return this.users.disableTwoFactor(password);
  }
  async getApiKeys() { return this.users.getApiKeys(); }
  async getApiKeysByBlog(blogId: string) { return this.users.getApiKeysByBlog(blogId); }
  async createApiKey(data: any) { return this.users.createApiKey(data); }
  async toggleApiKey(id: string) { return this.users.toggleApiKey(id); }
  async deleteApiKey(id: string) { return this.users.deleteApiKey(id); }

  // Chat API - 레거시 메서드 (기존 api.ts에만 있던 중요한 부분)
  async getConversations(signal?: AbortSignal) {
    return this.chat.getConversations(signal);
  }
  async getConversationById(conversationId: string, signal?: AbortSignal) {
    return this.chat.getConversationById(conversationId, signal);
  }
  async getOrCreateConversation(userId: string, signal?: AbortSignal) {
    return this.chat.getOrCreateConversation(userId, signal);
  }
  async getMessages(conversationId: string, page?: number, signal?: AbortSignal) {
    return this.chat.getMessages(conversationId, page, signal);
  }
  async sendMessage(conversationId: string, content: string, tempId: string) {
    return this.chat.sendMessage(conversationId, content, tempId);
  }
  async markMessageAsRead(messageId: string) {
    return this.chat.markMessageAsRead(messageId);
  }
  async markAllMessagesAsRead(conversationId: string) {
    return this.chat.markAllMessagesAsRead(conversationId);
  }
  async markAsRead(messageId: string) {
    return this.chat.markAsRead(messageId);
  }
  async markAllAsRead(conversationId: string) {
    return this.chat.markAllAsRead(conversationId);
  }
  async blockUser(userId: string) {
    return this.chat.blockUser(userId);
  }
  async unblockUser(userId: string) {
    return this.chat.unblockUser(userId);
  }
  async getBlockedUsers(signal?: AbortSignal) {
    return this.chat.getBlockedUsers(signal);
  }
  async deleteConversation(conversationId: string) {
    return this.chat.deleteConversation(conversationId);
  }
  async getUnreadCount(signal?: AbortSignal) {
    return this.chat.getUnreadCount(signal);
  }
  async deleteMessage(messageId: string) {
    return this.chat.deleteMessage(messageId);
  }
}

/**
 * 확장된 API 클라이언트 생성 함수
 * @param config - API 클라이언트 설정
 * @returns 통합된 API 클라이언트
 */
export function createExtendedApiClient(config: any = {}): ExtendedApiClient {
  return new ExtendedApiClient(config);
}

// ==================== 레거시 호환성 Export ====================
// 기존 api.ts를 사용하던 코드들을 위한 하위 호환성 제공

/**
 * 싱글톤 API 클라이언트 (레거시 호환)
 * @deprecated 가급적 createExtendedApiClient 사용 권장
 */
export const apiClient = createExtendedApiClient();

// 개별 함수 export (레거시 호환)
export const login = (data: any) => apiClient.login(data);
export const register = (data: any) => apiClient.register(data);
export const logout = () => apiClient.logout();
export const getProfile = () => apiClient.getProfile();
export const getPosts = (params?: any) => apiClient.getPosts(params);
export const getPost = (id: string) => apiClient.getPost(id);
export const getPostBySlug = (slug: string) => apiClient.getPostBySlug(slug);
export const createPost = (data: any) => apiClient.createPost(data);
export const updatePost = (id: string, data: any) => apiClient.updatePost(id, data);
export const deletePost = (id: string) => apiClient.deletePost(id);
export const toggleLike = (postId: string) => apiClient.toggleLike(postId);
export const batchUpdateLikes = (batch: Record<string, boolean>) => apiClient.batchUpdateLikes(batch);
export const getComments = (postId: string) => apiClient.getComments(postId);
export const createComment = (data: any) => apiClient.createComment(data);
export const updateComment = (commentId: string, content: string) => apiClient.updateComment(commentId, content);
export const deleteComment = (commentId: string) => apiClient.deleteComment(commentId);
export const toggleCommentLike = (commentId: string) => apiClient.toggleCommentLike(commentId);
export const getBlogs = (params?: any) => apiClient.getBlogs(params);
export const createBlog = (data: any) => apiClient.createBlog(data);
export const getMyBlogs = () => apiClient.getMyBlogs();
export const getBlogBySlug = (slug: string) => apiClient.getBlogBySlug(slug);
export const checkAlias = (alias: string) => apiClient.checkAlias(alias);
export const updateAlias = (alias: string) => apiClient.updateAlias(alias);
export const updateBlog = (slug: string, data: any) => apiClient.updateBlog(slug, data);
export const deleteBlog = (slug: string) => apiClient.deleteBlog(slug);
export const createUploadUrl = (data: any) => apiClient.createUploadUrl(data);
export const uploadComplete = (data: any) => apiClient.uploadComplete(data);
export const getFileStats = () => apiClient.getFileStats();
export const deleteFile = (fileId: string) => apiClient.deleteFile(fileId);
export const createApiKey = (data: any) => apiClient.createApiKey(data);
export const getApiKeys = () => apiClient.getApiKeys();
export const deleteApiKey = (keyId: string) => apiClient.deleteApiKey(keyId);
export const googleAuth = () => apiClient.googleAuth();
export const kakaoAuth = () => apiClient.kakaoAuth();

// postsAPI 객체 (레거시 호환)
export const postsAPI = {
  getPosts: (params?: any) => apiClient.getPosts(params),
  getPostsCursor: (params?: any) => apiClient.posts.getPostsCursor(params),
  getPost: (id: string) => apiClient.getPost(id),
  getPostBySlug: (slug: string) => apiClient.getPostBySlug(slug),
  createPost: (data: any) => apiClient.createPost(data),
  updatePost: (id: string, data: any) => apiClient.updatePost(id, data),
  deletePost: (id: string) => apiClient.deletePost(id),
  /** @deprecated vote 사용 권장 */
  toggleLike: (id: string) => apiClient.toggleLike(id),
  /** 투표 (upvote/downvote) */
  vote: (id: string, voteType: 'upvote' | 'downvote') => apiClient.posts.vote(id, voteType),
  batchUpdateLikes: (batch: Record<string, boolean>) => apiClient.batchUpdateLikes(batch),
};

// 기본 export
export default apiClient;

// ApiClient 클래스 및 팩토리 함수 export
export { ApiClient, createApiClient, defaultApiClient } from './client';
