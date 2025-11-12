/**
 * 포스트 상호작용 관련 이벤트 상수
 */
export const PostInteractionEvents = {
  /** 좋아요 토글 (추가/삭제) */
  LIKE_TOGGLED: 'post.like.toggled',

  /** 조회수 증가 */
  VIEW_INCREMENTED: 'post.view.incremented',

  /** 북마크 토글 (추가/삭제) */
  BOOKMARK_TOGGLED: 'post.bookmark.toggled',

  /** 댓글 추가 */
  COMMENT_ADDED: 'post.comment.added',

  /** 댓글 삭제 */
  COMMENT_REMOVED: 'post.comment.removed',

  /** 공유 */
  SHARED: 'post.shared',
};

/**
 * 좋아요 토글 이벤트 페이로드
 */
export interface LikeToggledEventPayload {
  postId: string;
  userId: string;
  liked: boolean;
  likeCount: number;
  timestamp: Date;
}

/**
 * 조회수 증가 이벤트 페이로드
 */
export interface ViewIncrementedEventPayload {
  postId: string;
  userId?: string;
  viewCount: number;
  timestamp: Date;
}

/**
 * 북마크 토글 이벤트 페이로드
 */
export interface BookmarkToggledEventPayload {
  postId: string;
  userId: string;
  bookmarked: boolean;
  timestamp: Date;
}