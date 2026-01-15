/**
 * 캐시 무효화 이벤트 타입 정의
 *
 * @description
 * 중앙화된 이벤트 관리로 타입 안정성 보장
 * EventEmitter2 기반의 자동 캐시 무효화 시스템
 *
 * @사용방법
 * ```typescript
 * // 이벤트 발행
 * this.eventEmitter.emit(CacheInvalidationEvents.POST_CREATED, {
 *   postId: 'abc123',
 *   blogSlug: 'my-blog',
 *   authorId: 'user123',
 * });
 *
 * // 이벤트 리스닝
 * @OnEvent(CacheInvalidationEvents.POST_CREATED, { async: true })
 * async handlePostCreated(payload: PostCreatedEvent) {
 *   // 캐시 무효화 로직
 * }
 * ```
 */
export enum CacheInvalidationEvents {
  // ===================================================
  // Post 관련 이벤트
  // ===================================================
  /**
   * 포스트 생성 시 발생
   * @payload PostCreatedEvent
   * @무효화_대상 홈 피드 첫 페이지, 블로그 피드 첫 페이지
   */
  POST_CREATED = "post.created",

  /**
   * 포스트 업데이트 시 발생
   * @payload PostUpdatedEvent
   * @무효화_대상 포스트 개별 캐시, 홈 피드, 블로그 피드
   */
  POST_UPDATED = "post.updated",

  /**
   * 포스트 삭제 시 발생
   * @payload PostDeletedEvent
   * @무효화_대상 모든 페이지, 인기 포스트, 에디터스 픽
   */
  POST_DELETED = "post.deleted",

  /**
   * 포스트 발행 시 발생 (초안 → 발행)
   * @payload PostPublishedEvent
   * @무효화_대상 홈 피드, 블로그 피드, 카테고리 피드
   */
  POST_PUBLISHED = "post.published",

  /**
   * 에디터스 픽 토글 시 발생
   * @payload EditorPickToggledEvent
   * @무효화_대상 에디터스 픽 전체
   */
  POST_EDITOR_PICK_TOGGLED = "post.editorPick.toggled",

  /**
   * 인기도 업데이트 시 발생 (조회수, 좋아요, 댓글 수 변경)
   * @payload PopularityUpdatedEvent
   * @무효화_대상 인기 포스트 전체, 포스트 개별 캐시
   */
  POST_POPULARITY_UPDATED = "post.popularity.updated",

  /**
   * 포스트 썸네일 업데이트 시 발생
   * @payload PostThumbnailUpdatedEvent
   * @무효화_대상 홈 피드, 관련 블로그 피드
   */
  POST_THUMBNAIL_UPDATED = "post.thumbnail.updated",

  // ===================================================
  // Comment 관련 이벤트
  // ===================================================
  /**
   * 댓글 생성 시 발생
   * @payload CommentCreatedEvent
   * @무효화_대상 댓글 페이지네이션, 포스트 상세, 인기 포스트
   */
  COMMENT_CREATED = "comment.created",

  /**
   * 댓글 수정 시 발생
   * @payload CommentUpdatedEvent
   * @무효화_대상 댓글 개별 캐시
   */
  COMMENT_UPDATED = "comment.updated",

  /**
   * 댓글 삭제 시 발생
   * @payload CommentDeletedEvent
   * @무효화_대상 댓글 트리 전체, 포스트 상세, 인기 포스트
   */
  COMMENT_DELETED = "comment.deleted",

  // ===================================================
  // Blog 관련 이벤트
  // ===================================================
  /**
   * 블로그 생성 시 발생
   * @payload BlogCreatedEvent
   * @무효화_대상 공개 블로그 목록
   */
  BLOG_CREATED = "blog.created",

  /**
   * 블로그 업데이트 시 발생
   * @payload BlogUpdatedEvent
   * @무효화_대상 블로그 정보, 블로그 피드, 홈 피드 (isPublic 변경 시)
   */
  BLOG_UPDATED = "blog.updated",

  /**
   * 블로그 설정 변경 시 발생 (allowComments, isPublic 등)
   * @payload BlogSettingsChangedEvent
   * @무효화_대상 블로그 정보, 관련 피드
   */
  BLOG_SETTINGS_CHANGED = "blog.settings.changed",

  // ===================================================
  // User 관련 이벤트
  // ===================================================
  /**
   * 사용자 프로필 업데이트 시 발생
   * @payload UserProfileUpdatedEvent
   * @무효화_대상 사용자 프로필, 블로그 정보, 포스트 목록 (author 정보)
   */
  USER_PROFILE_UPDATED = "user.profile.updated",

  /**
   * 사용자 아바타 업데이트 시 발생
   * @payload UserAvatarUpdatedEvent
   * @무효화_대상 사용자 프로필, 모든 관련 포스트/댓글
   */
  USER_AVATAR_UPDATED = "user.avatar.updated",

  // ===================================================
  // Tag 관련 이벤트
  // ===================================================
  /**
   * 태그 인기도 변경 시 발생 (포스트에서 태그 사용 빈도 변경)
   * @payload TagPopularityChangedEvent
   * @무효화_대상 인기 태그 목록
   */
  TAG_POPULARITY_CHANGED = "tag.popularity.changed",
}

// ===================================================
// 이벤트 페이로드 타입 정의
// ===================================================

/**
 * 포스트 생성 이벤트 페이로드
 */
export interface PostCreatedEvent {
  postId: string;
  blogSlug: string;
  authorId: string;
  category?: string;
  tags?: string[];
}

/**
 * 포스트 업데이트 이벤트 페이로드
 */
export interface PostUpdatedEvent {
  postId: string;
  blogSlug?: string;
  authorId?: string;
  changes: {
    title?: boolean;
    content?: boolean;
    thumbnail?: boolean;
    category?: boolean;
    tags?: boolean;
    isPublished?: boolean;
  };
}

/**
 * 포스트 썸네일 업데이트 이벤트 페이로드
 */
export interface PostThumbnailUpdatedEvent {
  postId: string;
  blogSlug: string;
  oldThumbnailImageId?: string;
  newThumbnailImageId?: string;
  oldThumbnailUrl?: string;
  newThumbnailUrl?: string;
  authorId: string;
}

/**
 * 포스트 삭제 이벤트 페이로드
 */
export interface PostDeletedEvent {
  postId: string;
  blogSlug?: string;
  authorId?: string;
}

/**
 * 포스트 발행 이벤트 페이로드
 */
export interface PostPublishedEvent {
  postId: string;
  blogSlug: string;
  category?: string;
}

/**
 * 에디터스 픽 토글 이벤트 페이로드
 */
export interface EditorPickToggledEvent {
  postId: string;
  isPicked: boolean;
}

/**
 * 인기도 업데이트 이벤트 페이로드
 */
export interface PopularityUpdatedEvent {
  postId: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

/**
 * 댓글 생성 이벤트 페이로드
 */
export interface CommentCreatedEvent {
  commentId: string;
  postId: string;
  parentCommentId?: string;
  authorId: string;
}

/**
 * 댓글 업데이트 이벤트 페이로드
 */
export interface CommentUpdatedEvent {
  commentId: string;
  postId: string;
  changes: {
    content?: boolean;
  };
}

/**
 * 댓글 삭제 이벤트 페이로드
 */
export interface CommentDeletedEvent {
  commentId: string;
  postId: string;
  parentCommentId?: string;
  authorId: string;
}

/**
 * 블로그 생성 이벤트 페이로드
 */
export interface BlogCreatedEvent {
  blogId: string;
  blogSlug: string;
  userId: string;
}

/**
 * 블로그 업데이트 이벤트 페이로드
 */
export interface BlogUpdatedEvent {
  blogId: string;
  blogSlug: string;
  changes: {
    isPublic?: boolean;
    allowComments?: boolean;
    name?: boolean;
    description?: boolean;
  };
}

/**
 * 블로그 설정 변경 이벤트 페이로드
 */
export interface BlogSettingsChangedEvent {
  blogId: string;
  blogSlug: string;
  settingKey: string;
  oldValue: any;
  newValue: any;
}

/**
 * 사용자 프로필 업데이트 이벤트 페이로드
 */
export interface UserProfileUpdatedEvent {
  userId: string;
  username: string;
  changes: {
    profileImage?: boolean;
    bio?: boolean;
    displayName?: boolean;
  };
}

/**
 * 사용자 아바타 업데이트 이벤트 페이로드
 */
export interface UserAvatarUpdatedEvent {
  userId: string;
  oldAvatarUrl?: string;
  newAvatarUrl: string;
}

/**
 * 태그 인기도 변경 이벤트 페이로드
 */
export interface TagPopularityChangedEvent {
  tag: string;
  oldCount: number;
  newCount: number;
}
