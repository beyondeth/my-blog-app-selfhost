/**
 * 신고 처리 상태
 *
 * @description 신고의 처리 진행 상태를 나타냅니다.
 *
 * - PENDING: 대기 중. 아직 처리되지 않음
 * - RESOLVED: 처리 완료. 콘텐츠가 삭제됨
 * - DISMISSED: 기각됨. 신고 내용이 타당하지 않음
 * - ESCALATED: 에스컬레이션. 사이트 관리자에게 전달됨
 */
export enum ReportStatus {
  /** 대기 중 - 아직 처리되지 않음 */
  PENDING = "pending",

  /** 처리 완료 - 콘텐츠가 삭제됨 */
  RESOLVED = "resolved",

  /** 기각됨 - 신고 내용이 타당하지 않음 */
  DISMISSED = "dismissed",

  /** 에스컬레이션 - 사이트 관리자에게 전달됨 */
  ESCALATED = "escalated",
}

/**
 * 신고 상태별 한글 설명
 */
export const ReportStatusDescription: Record<ReportStatus, string> = {
  [ReportStatus.PENDING]: "대기 중",
  [ReportStatus.RESOLVED]: "처리 완료",
  [ReportStatus.DISMISSED]: "기각됨",
  [ReportStatus.ESCALATED]: "에스컬레이션",
};

/**
 * 처리 대기 상태인지 확인
 * @param status 확인할 상태
 * @returns 대기 중이면 true
 */
export function isPendingReport(status: ReportStatus): boolean {
  return status === ReportStatus.PENDING;
}

/**
 * 처리 완료 상태인지 확인 (기각 포함)
 * @param status 확인할 상태
 * @returns 처리 완료면 true
 */
export function isHandledReport(status: ReportStatus): boolean {
  return (
    status === ReportStatus.RESOLVED ||
    status === ReportStatus.DISMISSED ||
    status === ReportStatus.ESCALATED
  );
}
