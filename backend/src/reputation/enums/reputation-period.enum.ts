/**
 * 평판 시스템 - 기간 열거형
 *
 * 평판 점수 집계 기간을 정의합니다.
 * ReputationTotal 엔티티에서 사용되며, 리더보드 필터링에도 활용됩니다.
 *
 * @see ReputationTotal
 * @see LeaderboardService
 */
export enum ReputationPeriod {
  /**
   * 최근 7일
   * 주간 리더보드에 사용
   */
  L7 = "L7",

  /**
   * 최근 30일
   * 월간 리더보드에 사용
   */
  L30 = "L30",

  /**
   * 최근 90일
   * 분기별 트렌드 분석에 사용
   */
  L90 = "L90",

  /**
   * 전체 기간
   * 누적 총점, 역대 순위에 사용
   */
  ALL_TIME = "ALL_TIME",
}

/**
 * 기간별 일수 매핑
 * AggregatorService에서 집계 범위 계산에 사용
 */
export const PERIOD_DAYS: Record<ReputationPeriod, number | null> = {
  [ReputationPeriod.L7]: 7,
  [ReputationPeriod.L30]: 30,
  [ReputationPeriod.L90]: 90,
  [ReputationPeriod.ALL_TIME]: null, // 전체 기간은 제한 없음
};
