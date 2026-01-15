/**
 * 모더레이션 액션 타입
 *
 * @description 모더레이터가 수행할 수 있는 작업 유형을 정의합니다.
 * 모든 액션은 community_mod_logs에 기록됩니다.
 */
export enum ModAction {
  // 커뮤니티 관련
  CREATE_COMMUNITY = "create_community", // 커뮤니티 생성

  // 사용자 관련
  BAN_USER = "ban_user", // 사용자 밴
  UNBAN_USER = "unban_user", // 밴 해제

  // 게시물 관련
  REMOVE_POST = "remove_post", // 게시물 삭제
  EDIT_POST = "edit_post", // 게시물 수정
  APPROVE_POST = "approve_post", // 게시물 승인 (삭제 취소)
  PIN_POST = "pin_post", // 게시물 고정
  UNPIN_POST = "unpin_post", // 고정 해제
  LOCK_POST = "lock_post", // 댓글 잠금
  UNLOCK_POST = "unlock_post", // 잠금 해제

  // 댓글 관련
  REMOVE_COMMENT = "remove_comment", // 댓글 삭제
  APPROVE_COMMENT = "approve_comment", // 댓글 승인 (스팸/삭제 해제)

  // 스팸 관련
  MARK_AS_SPAM = "mark_as_spam", // 스팸 표시
  UNMARK_SPAM = "unmark_spam", // 스팸 해제

  // 신고 관련
  RESOLVE_REPORT = "resolve_report", // 신고 처리 완료
  DISMISS_REPORT = "dismiss_report", // 신고 기각
  ESCALATE_REPORT = "escalate_report", // 신고 에스컬레이션

  // 모더레이터 관련
  ADD_MODERATOR = "add_moderator", // 모더레이터 추가
  REMOVE_MODERATOR = "remove_moderator", // 모더레이터 제거
  UPDATE_MODERATOR = "update_moderator", // 모더레이터 권한 수정
  TRANSFER_OWNERSHIP = "transfer_ownership", // 소유권 이전

  // 커뮤니티 설정
  UPDATE_SETTINGS = "update_settings", // 설정 수정
  LOCK_COMMUNITY = "lock_community", // 커뮤니티 잠금
  UNLOCK_COMMUNITY = "unlock_community", // 커뮤니티 잠금 해제
  RESTORE_COMMUNITY = "restore_community", // 스냅샷 복원

  // 규칙 관련
  ADD_RULE = "add_rule", // 규칙 추가
  UPDATE_RULE = "update_rule", // 규칙 수정
  REMOVE_RULE = "remove_rule", // 규칙 삭제

  // 플레어 관련
  ADD_FLAIR = "add_flair", // 플레어 추가
  UPDATE_FLAIR = "update_flair", // 플레어 수정
  REMOVE_FLAIR = "remove_flair", // 플레어 삭제

  // 멤버십 관련
  APPROVE_MEMBER = "approve_member", // 가입 승인
  REJECT_MEMBER = "reject_member", // 가입 거부
}

/**
 * 액션별 한글 설명
 * - 로그 표시 및 알림에 사용
 */
export const ModActionDescription: Record<ModAction, string> = {
  [ModAction.CREATE_COMMUNITY]: "커뮤니티 생성",
  [ModAction.BAN_USER]: "사용자 차단",
  [ModAction.UNBAN_USER]: "차단 해제",
  [ModAction.REMOVE_POST]: "게시물 삭제",
  [ModAction.EDIT_POST]: "게시물 수정",
  [ModAction.APPROVE_POST]: "게시물 복원",
  [ModAction.PIN_POST]: "게시물 고정",
  [ModAction.UNPIN_POST]: "고정 해제",
  [ModAction.LOCK_POST]: "댓글 잠금",
  [ModAction.UNLOCK_POST]: "잠금 해제",
  [ModAction.REMOVE_COMMENT]: "댓글 삭제",
  [ModAction.APPROVE_COMMENT]: "댓글 복원",
  [ModAction.MARK_AS_SPAM]: "스팸 표시",
  [ModAction.UNMARK_SPAM]: "스팸 해제",
  [ModAction.RESOLVE_REPORT]: "신고 처리",
  [ModAction.DISMISS_REPORT]: "신고 기각",
  [ModAction.ESCALATE_REPORT]: "신고 에스컬레이션",
  [ModAction.ADD_MODERATOR]: "모더레이터 추가",
  [ModAction.REMOVE_MODERATOR]: "모더레이터 제거",
  [ModAction.UPDATE_MODERATOR]: "모더레이터 권한 수정",
  [ModAction.TRANSFER_OWNERSHIP]: "소유권 이전",
  [ModAction.UPDATE_SETTINGS]: "설정 수정",
  [ModAction.LOCK_COMMUNITY]: "커뮤니티 잠금",
  [ModAction.UNLOCK_COMMUNITY]: "커뮤니티 잠금 해제",
  [ModAction.RESTORE_COMMUNITY]: "커뮤니티 복원",
  [ModAction.ADD_RULE]: "규칙 추가",
  [ModAction.UPDATE_RULE]: "규칙 수정",
  [ModAction.REMOVE_RULE]: "규칙 삭제",
  [ModAction.ADD_FLAIR]: "플레어 추가",
  [ModAction.UPDATE_FLAIR]: "플레어 수정",
  [ModAction.REMOVE_FLAIR]: "플레어 삭제",
  [ModAction.APPROVE_MEMBER]: "가입 승인",
  [ModAction.REJECT_MEMBER]: "가입 거부",
};
