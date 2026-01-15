/**
 * 신고 사유
 *
 * @description 게시물/댓글 신고 시 선택할 수 있는 사유입니다.
 * 커뮤니티 규칙 위반은 별도로 세부 규칙을 지정할 수 있습니다.
 */
export enum ReportReason {
  /** 스팸 또는 광고 */
  SPAM = "spam",

  /** 괴롭힘 또는 따돌림 */
  HARASSMENT = "harassment",

  /** 혐오 발언 또는 차별 */
  HATE_SPEECH = "hate_speech",

  /** 폭력 또는 위협 */
  VIOLENCE = "violence",

  /** 허위 정보 */
  MISINFORMATION = "misinformation",

  /** 커뮤니티 규칙 위반 */
  RULE_VIOLATION = "rule_violation",

  /** 저작권 침해 */
  COPYRIGHT = "copyright",

  /** 개인정보 노출 */
  PRIVACY = "privacy",

  /** 기타 */
  OTHER = "other",
}

/**
 * 신고 사유별 한글 설명
 */
export const ReportReasonDescription: Record<ReportReason, string> = {
  [ReportReason.SPAM]: "스팸 또는 광고",
  [ReportReason.HARASSMENT]: "괴롭힘 또는 따돌림",
  [ReportReason.HATE_SPEECH]: "혐오 발언 또는 차별",
  [ReportReason.VIOLENCE]: "폭력 또는 위협",
  [ReportReason.MISINFORMATION]: "허위 정보",
  [ReportReason.RULE_VIOLATION]: "커뮤니티 규칙 위반",
  [ReportReason.COPYRIGHT]: "저작권 침해",
  [ReportReason.PRIVACY]: "개인정보 노출",
  [ReportReason.OTHER]: "기타",
};

/**
 * 신고 대상 타입
 */
export enum ReportTargetType {
  /** 게시물 신고 */
  POST = "post",

  /** 댓글 신고 */
  COMMENT = "comment",
}
