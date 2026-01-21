/**
 * 평판 시스템 - 타이틀 코드 열거형
 *
 * 사용자에게 부여할 수 있는 타이틀(칭호) 종류를 정의합니다.
 * TitleGrant 엔티티 및 TitleService에서 사용됩니다.
 *
 * @see TitleGrant
 * @see TitleService
 */
export enum TitleCode {
  /**
   * 탑 컨트리뷰터
   * 최근 7일간 상위 10% 사용자에게 부여
   * 갱신 주기: 매주
   */
  TOP_CONTRIBUTOR = "TOP_CONTRIBUTOR",

  /**
   * 라이징 스타
   * 가입 30일 이내 사용자 중 급성장한 사용자에게 부여
   * 조건: 최근 7일 점수가 상위 20%인 신규 유저
   */
  RISING_STAR = "RISING_STAR",

  /**
   * 검증된 작성자
   * 일정 기준 이상의 콘텐츠를 발행한 사용자에게 부여
   * 조건: 게시글 10개 이상, 총점 100점 이상
   */
  VERIFIED_WRITER = "VERIFIED_WRITER",
}

/**
 * 타이틀 메타데이터
 * 프론트엔드 TitleBadge 컴포넌트에서 표시용으로 사용
 */
export interface TitleMetadata {
  /** 표시 이름 (한글) */
  displayName: string;
  /** 설명 */
  description: string;
  /** 아이콘 이모지 */
  icon: string;
  /** 배지 색상 (tailwind 클래스 호환) */
  color: string;
}

/**
 * 타이틀별 메타데이터 매핑
 */
export const TITLE_METADATA: Record<TitleCode, TitleMetadata> = {
  [TitleCode.TOP_CONTRIBUTOR]: {
    displayName: "탑 컨트리뷰터",
    description: "주간 상위 10% 기여자",
    icon: "🏆",
    color: "gold",
  },
  [TitleCode.RISING_STAR]: {
    displayName: "라이징 스타",
    description: "급성장 중인 신규 유저",
    icon: "🌟",
    color: "blue",
  },
  [TitleCode.VERIFIED_WRITER]: {
    displayName: "검증된 작성자",
    description: "활발한 콘텐츠 제작자",
    icon: "✍️",
    color: "purple",
  },
};

/**
 * 사용자 레벨 정의 (누적 점수 기반)
 *
 * 레벨은 ALL_TIME 누적 점수를 기준으로 계산됩니다.
 * 10점 미만이면 레벨이 없습니다.
 */
export const USER_LEVELS = [
  { level: 1, minScore: 10, icon: "🌱" },
  { level: 2, minScore: 50, icon: "📝" },
  { level: 3, minScore: 100, icon: "✍️" },
  { level: 4, minScore: 500, icon: "🔥" },
  { level: 5, minScore: 1000, icon: "💎" },
  { level: 6, minScore: 2000, icon: "🏆" },
  { level: 7, minScore: 4000, icon: "⭐" },
  { level: 8, minScore: 8000, icon: "🔮" },
  { level: 9, minScore: 20000, icon: "👑" },
  { level: 10, minScore: 50000, icon: "🌟" },
] as const;

export type UserLevel = (typeof USER_LEVELS)[number];

/**
 * 누적 점수로 사용자 레벨 계산
 *
 * @param score 누적 점수 (ALL_TIME)
 * @returns 레벨 정보 또는 null (10점 미만)
 */
export function getUserLevel(score: number): UserLevel | null {
  for (let i = USER_LEVELS.length - 1; i >= 0; i--) {
    if (score >= USER_LEVELS[i].minScore) {
      return USER_LEVELS[i];
    }
  }
  return null;
}
