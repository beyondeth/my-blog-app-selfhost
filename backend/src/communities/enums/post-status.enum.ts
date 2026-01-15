/**
 * 커뮤니티 게시물 상태
 *
 * @description 게시물의 공개 및 처리 상태를 정의합니다.
 *
 * - DRAFT: 임시 저장. 작성자만 볼 수 있음
 * - PUBLISHED: 발행됨. 정상적으로 공개된 상태
 * - REMOVED: 삭제됨. 모더레이터에 의해 삭제됨 (사유 기록)
 * - SPAM: 스팸 처리됨. 자동 또는 수동 스팸 처리
 */
export enum CommunityPostStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  REMOVED = "removed",
  SPAM = "spam",
}

/**
 * 공개 상태 확인
 * @param status 확인할 상태
 * @returns 공개된 게시물이면 true
 */
export function isPublishedPost(status: CommunityPostStatus): boolean {
  return status === CommunityPostStatus.PUBLISHED;
}

/**
 * 숨김 상태 확인 (삭제/스팸)
 * @param status 확인할 상태
 * @returns 숨겨진 게시물이면 true
 */
export function isHiddenPost(status: CommunityPostStatus): boolean {
  return (
    status === CommunityPostStatus.REMOVED ||
    status === CommunityPostStatus.SPAM
  );
}
