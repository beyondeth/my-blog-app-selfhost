/**
 * 포스트 라이프사이클 이벤트 상수
 *
 * 기존 CacheInvalidationEvents (post.created/updated/deleted)와 충돌을 피하기 위해
 * post.lifecycle.* 네임스페이스 사용
 */
export const PostLifecycleEvents = {
  /** 포스트 생성 + 커밋 완료 후 */
  CREATED: "post.lifecycle.created",

  /** 포스트 수정 + 커밋 완료 후 */
  UPDATED: "post.lifecycle.updated",

  /** 포스트 삭제 + 커밋 완료 후 */
  DELETED: "post.lifecycle.deleted",

  /** 포스트 복원 + 커밋 완료 후 */
  RESTORED: "post.lifecycle.restored",
} as const;

/**
 * 포스트 라이프사이클 이벤트 페이로드
 * content 본문은 포함하지 않음 (payload 최소화)
 */
export interface PostLifecyclePayload {
  postId: string;
  blogId: string;
  blogSlug?: string;
  authorId: string;

  /** 현재 발행 상태 */
  isPublished?: boolean;

  /** 삭제/복원 시: 이전에 발행된 포스트였는지 */
  wasPublished?: boolean;

  /** 삭제 시: 에디터픽이었는지 */
  wasEditorPick?: boolean;

  /** 수정 시: 발행 상태 변경 방향 */
  publishStateChanged?: "published" | "unpublished" | null;

  /** 수정 시: 큐 처리에 필요한 메타데이터 */
  title?: string;
  tags?: string[];
  category?: string;
}
