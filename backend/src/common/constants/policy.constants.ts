/**
 * 재가입 및 계정 삭제 정책 상수
 *
 * 법적 요구사항 및 사용자 보호를 위한 정책 설정
 */

/**
 * 재가입 정책
 *
 * 계정 삭제 후 재가입 시 적용되는 정책
 */
export const RE_REGISTRATION_POLICY = {
  /**
   * 재가입 대기 기간 (일)
   *
   * 계정 삭제 후 이 기간이 지나야 동일한 이메일로 재가입 가능
   * - 목적: 악용 방지, 사용자 숙고 시간 제공
   * - 기간 내 재가입 시도 시 거부 메시지와 재가입 가능 날짜 안내
   */
  WAITING_PERIOD_DAYS: 30,

  /**
   * 영구 삭제 기간 (일)
   *
   * 계정 삭제 요청 후 완전히 DB에서 제거되기까지의 기간
   * - 법적 요구사항: 180일간 법적 조회 가능하도록 데이터 보관
   * - 이 기간 동안 isDeleted=true 상태로 보관
   * - 180일 경과 후 자동으로 완전 삭제 (스케줄러)
   */
  PERMANENT_DELETION_DAYS: 180,
} as const;

/**
 * 계정 삭제 정책 설명
 *
 * 사용자에게 안내할 계정 삭제 정책 메시지
 */
export const ACCOUNT_DELETION_POLICY_MESSAGE = {
  /**
   * 재가입 대기 안내 메시지
   */
  WAITING_PERIOD: (remainingDays: number, availableDate: string) =>
    `계정 삭제 후 ${RE_REGISTRATION_POLICY.WAITING_PERIOD_DAYS}일이 지나야 재가입이 가능합니다. ` +
    `${remainingDays}일 후 (${availableDate}) 재가입 가능합니다.`,

  /**
   * OAuth 재가입 차단 메시지
   */
  OAUTH_DELETED_ACCOUNT: `삭제된 계정입니다. 재가입을 원하시면 회원가입 페이지에서 진행해주세요.`,

  /**
   * 계정 삭제 완료 메시지
   */
  DELETION_COMPLETE: (scheduledDeletionDate: string) =>
    `계정이 삭제되었습니다. ${scheduledDeletionDate}에 완전히 삭제됩니다. ` +
    `재가입은 ${RE_REGISTRATION_POLICY.WAITING_PERIOD_DAYS}일 후부터 가능합니다.`,
} as const;

/**
 * 날짜 계산 유틸리티
 */
export const calculateDaysSince = (pastDate: Date): number => {
  const now = new Date();
  const diffMs = now.getTime() - pastDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

export const addDaysToDate = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
