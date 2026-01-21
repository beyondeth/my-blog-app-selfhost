/**
 * 평판 시스템 - 사용자 평판 요약 DTO
 *
 * 특정 사용자의 평판 정보를 요약하여 반환하는 DTO입니다.
 *
 * @see ReputationAdminController.getUserReputation()
 */
import { TitleCode } from "../enums/title-code.enum";

/**
 * 기간별 점수 정보
 */
export class PeriodScoreDto {
  /**
   * 기간 코드
   */
  period: string;

  /**
   * 원본 점수
   */
  score: number;

  /**
   * 감쇠 적용 점수
   */
  decayedScore: number;

  /**
   * 해당 기간 내 순위
   */
  rank?: number;

  /**
   * 상위 백분율 (예: 5 = 상위 5%)
   */
  percentile?: number;
}

/**
 * 타이틀 정보
 */
export class TitleInfoDto {
  /**
   * 타이틀 코드
   */
  code: TitleCode;

  /**
   * 표시용 이름
   */
  displayName: string;

  /**
   * 설명
   */
  description: string;

  /**
   * 아이콘
   */
  icon: string;

  /**
   * 부여 일시
   */
  grantedAt: Date;

  /**
   * 만료 일시 (null이면 영구)
   */
  expiresAt: Date | null;

  /**
   * 현재 활성 여부
   */
  isActive: boolean;
}

/**
 * 사용자 평판 요약 응답 DTO
 */
export class ReputationSummaryDto {
  /**
   * 사용자 ID
   */
  userId: string;

  /**
   * 사용자명
   */
  username: string;

  /**
   * 기간별 점수 목록
   */
  scores: PeriodScoreDto[];

  /**
   * 활성 타이틀 목록
   */
  activeTitles: TitleInfoDto[];

  /**
   * 총 획득 점수 (역대 누적)
   */
  totalEarnedScore: number;

  /**
   * 최근 활동 일시
   */
  lastActivityAt?: Date;

  /**
   * 가입일로부터 경과 일수
   */
  memberDays: number;
}
