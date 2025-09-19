/**
 * React Query 키 관리 시스템
 * @description 일관된 캐시 키 구조를 위한 중앙화된 키 팩토리
 * 타입 안전성과 자동완성을 제공하며, 캐시 무효화를 쉽게 관리
 */

/**
 * 쿼리 키 팩토리
 * @description 모든 React Query 키를 중앙에서 관리
 * 계층적 구조로 세분화된 캐시 무효화 지원
 */
export const queryKeys = {
  /**
   * 사용자 관련 쿼리 키
   */
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,

    // 팔로우 관련
    followInfo: (id: string) => [...queryKeys.users.detail(id), 'follow-info'] as const,
    followers: (id: string) => [...queryKeys.users.detail(id), 'followers'] as const,
    following: (id: string) => [...queryKeys.users.detail(id), 'following'] as const,
  },

  /**
   * 블로그 관련 쿼리 키
   */
  blogs: {
    all: ['blogs'] as const,
    lists: () => [...queryKeys.blogs.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.blogs.lists(), filters] as const,
    details: () => [...queryKeys.blogs.all, 'detail'] as const,
    detail: (slug: string) => [...queryKeys.blogs.details(), slug] as const,
    byUser: (userId: string) => [...queryKeys.blogs.all, 'by-user', userId] as const,
    myBlogs: () => [...queryKeys.blogs.all, 'my-blogs'] as const,
  },

  /**
   * 포스트 관련 쿼리 키
   */
  posts: {
    all: ['posts'] as const,
    lists: () => [...queryKeys.posts.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.posts.lists(), filters] as const,
    details: () => [...queryKeys.posts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.posts.details(), id] as const,
    bySlug: (slug: string) => [...queryKeys.posts.all, 'slug', slug] as const,
    byBlog: (blogId: string) => [...queryKeys.posts.all, 'by-blog', blogId] as const,
  },

  /**
   * 댓글 관련 쿼리 키
   */
  comments: {
    all: ['comments'] as const,
    byPost: (postId: string) => [...queryKeys.comments.all, 'by-post', postId] as const,
    detail: (id: string) => [...queryKeys.comments.all, 'detail', id] as const,
  },

  /**
   * 알림 관련 쿼리 키
   */
  notifications: {
    all: ['notifications'] as const,
    lists: () => [...queryKeys.notifications.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.notifications.lists(), filters] as const,
    unreadCount: () => [...queryKeys.notifications.all, 'unread-count'] as const,
  },

  /**
   * 추천 관련 쿼리 키
   */
  recommendations: {
    all: ['recommendations'] as const,
    users: () => [...queryKeys.recommendations.all, 'users'] as const,
    blogs: () => [...queryKeys.recommendations.all, 'blogs'] as const,
    posts: () => [...queryKeys.recommendations.all, 'posts'] as const,
  },

  /**
   * 인증 관련 쿼리 키
   */
  auth: {
    all: ['auth'] as const,
    user: () => [...queryKeys.auth.all, 'user'] as const,
    session: () => [...queryKeys.auth.all, 'session'] as const,
  },

  /**
   * 채팅 관련 쿼리 키
   */
  chat: {
    all: ['chat'] as const,
    conversations: () => [...queryKeys.chat.all, 'conversations'] as const,
    conversation: (id: string) => [...queryKeys.chat.all, 'conversation', id] as const,
    messages: (conversationId: string) => [...queryKeys.chat.all, 'messages', conversationId] as const,
    unreadCount: () => [...queryKeys.chat.all, 'unread-count'] as const,
    blockedUsers: () => [...queryKeys.chat.all, 'blocked-users'] as const,
  },

  /**
   * 파일 관련 쿼리 키
   */
  files: {
    all: ['files'] as const,
    lists: () => [...queryKeys.files.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.files.lists(), filters] as const,
    detail: (id: string | number) => [...queryKeys.files.all, 'detail', String(id)] as const,
    stats: () => [...queryKeys.files.all, 'stats'] as const,
  },

  /**
   * API 키 관련 쿼리 키
   */
  apiKeys: {
    all: ['api-keys'] as const,
    list: () => [...queryKeys.apiKeys.all, 'list'] as const,
    byBlog: (blogId: string) => [...queryKeys.apiKeys.all, 'by-blog', blogId] as const,
  },

  /**
   * 사용자 설정 관련 쿼리 키
   */
  settings: {
    all: ['settings'] as const,
    notifications: () => [...queryKeys.settings.all, 'notifications'] as const,
    security: () => [...queryKeys.settings.all, 'security'] as const,
    preferences: () => [...queryKeys.settings.all, 'preferences'] as const,
  },
} as const;

/**
 * 쿼리 키 사용 예시
 *
 * @example
 * ```typescript
 * // 특정 유저의 팔로우 정보 조회
 * useQuery({
 *   queryKey: queryKeys.users.followInfo(userId),
 *   queryFn: () => fetchFollowInfo(userId),
 * });
 *
 * // 팔로우 액션 후 무효화
 * queryClient.invalidateQueries({
 *   queryKey: queryKeys.users.followInfo(userId)
 * });
 *
 * // 모든 유저 관련 캐시 무효화
 * queryClient.invalidateQueries({
 *   queryKey: queryKeys.users.all
 * });
 *
 * // 특정 블로그의 포스트 목록 조회
 * useQuery({
 *   queryKey: queryKeys.posts.byBlog(blogId),
 *   queryFn: () => fetchPostsByBlog(blogId),
 * });
 *
 * // 채팅 대화 목록 조회
 * useQuery({
 *   queryKey: queryKeys.chat.conversations(),
 *   queryFn: () => fetchConversations(),
 * });
 * ```
 */

/**
 * 쿼리 키 헬퍼 함수
 */
export const queryHelpers = {
  /**
   * 특정 패턴의 모든 쿼리 무효화
   * @param queryClient - React Query 클라이언트
   * @param pattern - 무효화할 쿼리 패턴
   */
  invalidatePattern: (queryClient: any, pattern: readonly unknown[]) => {
    queryClient.invalidateQueries({ queryKey: pattern });
  },

  /**
   * 관련된 모든 사용자 쿼리 무효화
   * @param queryClient - React Query 클라이언트
   * @param userId - 사용자 ID
   */
  invalidateUserQueries: (queryClient: any, userId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.users.followInfo(userId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.blogs.byUser(userId) });
  },

  /**
   * 관련된 모든 블로그 쿼리 무효화
   * @param queryClient - React Query 클라이언트
   * @param blogSlug - 블로그 슬러그
   */
  invalidateBlogQueries: (queryClient: any, blogSlug: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.blogs.detail(blogSlug) });
    queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
  },

  /**
   * 채팅 관련 쿼리 무효화
   * @param queryClient - React Query 클라이언트
   * @param conversationId - 대화 ID (옵션)
   */
  invalidateChatQueries: (queryClient: any, conversationId?: string) => {
    if (conversationId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversation(conversationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(conversationId) });
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.chat.unreadCount() });
  },
};