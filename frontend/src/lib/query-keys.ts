/**
 * React Query 키 관리 시스템
 * 일관된 캐시 키 구조를 유지하기 위한 중앙화된 키 팩토리
 */

export const queryKeys = {
  all: ['users'] as const,
  
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    
    // Follow related
    followInfo: (id: string) => [...queryKeys.users.detail(id), 'follow-info'] as const,
    followers: (id: string) => [...queryKeys.users.detail(id), 'followers'] as const,
    following: (id: string) => [...queryKeys.users.detail(id), 'following'] as const,
  },
  
  blogs: {
    all: ['blogs'] as const,
    lists: () => [...queryKeys.blogs.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.blogs.lists(), filters] as const,
    details: () => [...queryKeys.blogs.all, 'detail'] as const,
    detail: (slug: string) => [...queryKeys.blogs.details(), slug] as const,
    byUser: (userId: string) => [...queryKeys.blogs.all, 'by-user', userId] as const,
  },
  
  posts: {
    all: ['posts'] as const,
    lists: () => [...queryKeys.posts.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.posts.lists(), filters] as const,
    details: () => [...queryKeys.posts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.posts.details(), id] as const,
    byBlog: (blogId: string) => [...queryKeys.posts.all, 'by-blog', blogId] as const,
  },
  
  notifications: {
    all: ['notifications'] as const,
    lists: () => [...queryKeys.notifications.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.notifications.lists(), filters] as const,
    unreadCount: () => [...queryKeys.notifications.all, 'unread-count'] as const,
  },
  
  recommendations: {
    all: ['recommendations'] as const,
    users: () => [...queryKeys.recommendations.all, 'users'] as const,
    blogs: () => [...queryKeys.recommendations.all, 'blogs'] as const,
  },
  
  auth: {
    all: ['auth'] as const,
    user: () => [...queryKeys.auth.all, 'user'] as const,
  },
} as const;

/**
 * 사용 예시:
 * 
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
 */