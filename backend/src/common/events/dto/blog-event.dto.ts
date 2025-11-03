/**
 * 블로그 이벤트 데이터 전송 객체(DTO)
 */

/**
 * 블로그 생성 이벤트 데이터
 */
export interface BlogCreatedEvent {
  blogId: string;
  userId: string;
  alias?: string;
  slug: string;
  title?: string;
  createdAt: Date;
}

/**
 * 블로그 정보 업데이트 이벤트 데이터
 */
export interface BlogUpdatedEvent {
  blogId: string;
  changes: Partial<{
    title: string;
    description: string;
    allowComments: boolean;
    settings: Record<string, any>;
  }>;
  updatedAt: Date;
}

/**
 * 블로그 별칭 변경 이벤트 데이터
 */
export interface BlogAliasChangedEvent {
  blogId: string;
  userId: string;
  oldAlias?: string;
  newAlias?: string;
  changedAt: Date;
}

/**
 * 블로그 포스트 생성/수정/삭제 이벤트 데이터
 */
export interface BlogPostEvent {
  blogId: string;
  postId: string;
  userId: string;
  title?: string;
  category?: string;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * 블로그 포스트 상호작용 이벤트 데이터
 */
export interface BlogPostInteractionEvent {
  blogId: string;
  postId: string;
  userId: string;
  type: 'view' | 'like' | 'unlike';
  timestamp: Date;
}

/**
 * 블로그 통계 업데이트 요청 이벤트 데이터
 */
export interface BlogStatsUpdateEvent {
  blogId: string;
  userId: string;
  updateType: 'post_count' | 'category_stats' | 'activity' | 'all';
  metadata?: Record<string, any>;
}