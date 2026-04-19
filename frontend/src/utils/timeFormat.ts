/**
 * 상대 시간 포맷팅 유틸리티
 *
 * 날짜를 사용자 친화적인 상대 시간으로 변환합니다.
 *
 * @param date - ISO 문자열 또는 Date 객체
 * @returns 상대 시간 문자열
 *
 * @example
 * formatRelativeTime('2025-10-06T10:00:00Z') // "5m ago"
 * formatRelativeTime(new Date()) // "just now"
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const past = parseDateInput(date);
  if (!past) {
    return 'just now';
  }

  // 시간 차이 계산 (밀리초)
  const diffMs = now.getTime() - past.getTime();

  // 음수인 경우 (미래 날짜) - 날짜 표기로 fallback
  if (diffMs < 0) {
    return formatAbsoluteDate(past);
  }

  // 각 단위로 변환
  const diffMins = Math.floor(diffMs / 60000);        // 분
  const diffHours = Math.floor(diffMs / 3600000);     // 시간
  const diffDays = Math.floor(diffMs / 86400000);     // 일

  // 1분 미만
  if (diffMins < 1) {
    return 'just now';
  }

  // 1분 ~ 59분
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  // 1시간 ~ 23시간
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  // 3일 ~ 7일
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  // 8일 ~ 27일 (1주 ~ 3주)
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) {
    return `${diffWeeks}w ago`;
  }

  // 28일 ~ 364일 (1개월 ~ 11개월)
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths}mo ago`;
  }

  // 365일 이상 (1년, 2년, 3년...)
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
}

function parseDateInput(input: string | Date): Date | null {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const raw = Number(trimmed);
    if (!Number.isNaN(raw) && Number.isFinite(raw)) {
      const millis = raw > 9_999_999_999 ? raw : raw * 1000;
      const epochDate = new Date(millis);
      if (!Number.isNaN(epochDate.getTime())) {
        return epochDate;
      }
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

function formatAbsoluteDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
