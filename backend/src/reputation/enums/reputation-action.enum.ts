/**
 * 평판 시스템 - Action 열거형
 *
 * 사용자 평판 점수에 영향을 주는 모든 액션 타입을 정의합니다.
 * 각 액션은 LedgerService에서 점수 매핑에 사용됩니다.
 *
 * @see LedgerService.record()
 */
export enum ReputationAction {
  /**
   * 포스트 발행
   * 사용자가 블로그 포스트를 작성하고 발행했을 때 부여
   * 기본 점수: +10
   */
  POST_PUBLISHED = 'POST_PUBLISHED',

  /**
   * 댓글 작성
   * 사용자가 포스트에 댓글을 달았을 때 부여
   * 기본 점수: +3
   */
  COMMENT_ADDED = 'COMMENT_ADDED',

  /**
   * 좋아요 수신
   * 사용자의 콘텐츠가 다른 사용자로부터 좋아요를 받았을 때 부여
   * 기본 점수: +2
   * 주의: 셀프 좋아요는 차단됨
   */
  LIKE_RECEIVED = 'LIKE_RECEIVED',

  /**
   * 북마크 수신
   * 사용자의 콘텐츠가 다른 사용자로부터 북마크되었을 때 부여
   * 기본 점수: +1
   * 주의: 셀프 북마크는 차단됨
   */
  BOOKMARK_RECEIVED = 'BOOKMARK_RECEIVED',

  /**
   * 유효한 신고
   * 사용자가 제출한 신고가 관리자에 의해 유효함으로 처리되었을 때 부여
   * 기본 점수: +5
   */
  REPORT_VALID = 'REPORT_VALID',

  /**
   * Editor's Pick 선정
   * 관리자가 포스트를 Editor's Pick으로 선정했을 때 부여
   * 기본 점수: +30
   */
  EDITOR_PICKED = 'EDITOR_PICKED',
}

/**
 * 액션별 기본 점수 매핑
 * LedgerService에서 사용됨
 */
export const REPUTATION_ACTION_SCORES: Record<ReputationAction, number> = {
  [ReputationAction.POST_PUBLISHED]: 10,
  [ReputationAction.COMMENT_ADDED]: 3,
  [ReputationAction.LIKE_RECEIVED]: 2,
  [ReputationAction.BOOKMARK_RECEIVED]: 1,
  [ReputationAction.REPORT_VALID]: 5,
  [ReputationAction.EDITOR_PICKED]: 30,
};
