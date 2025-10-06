/**
 * 상대 시간 포맷팅 유틸리티
 *
 * 날짜를 사용자 친화적인 상대 시간으로 변환합니다.
 *
 * @param date - ISO 문자열 또는 Date 객체
 * @returns 상대 시간 문자열
 *
 * @example
 * formatRelativeTime('2025-10-06T10:00:00Z') // "5분 전"
 * formatRelativeTime(new Date()) // "방금 전"
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const past = new Date(date);

  // 시간 차이 계산 (밀리초)
  const diffMs = now.getTime() - past.getTime();

  // 음수인 경우 (미래 날짜) - 날짜 표기로 fallback
  if (diffMs < 0) {
    return past.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).replace(/\//g, '. ');
  }

  // 각 단위로 변환
  const diffMins = Math.floor(diffMs / 60000);        // 분
  const diffHours = Math.floor(diffMs / 3600000);     // 시간
  const diffDays = Math.floor(diffMs / 86400000);     // 일

  // 1분 미만
  if (diffMins < 1) {
    return '방금 전';
  }

  // 1분 ~ 59분
  if (diffMins < 60) {
    return `${diffMins}분 전`;
  }

  // 1시간 ~ 23시간
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  // 1일
  if (diffDays === 1) {
    return '하루 전';
  }

  // 2일
  if (diffDays === 2) {
    return '이틀 전';
  }

  // 3일 ~ 7일
  if (diffDays <= 7) {
    return `${diffDays}일 전`;
  }

  // 8일 ~ 27일 (1주 ~ 3주)
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) {
    return `${diffWeeks}주 전`;
  }

  // 28일 ~ 364일 (1개월 ~ 11개월)
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths}개월 전`;
  }

  // 365일 이상 (1년, 2년, 3년...)
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}년 전`;
}
