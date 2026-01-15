/**
 * 평판 시스템 - 리더보드 항목 DTO
 *
 * Admin API 및 프론트엔드에서 사용하는 리더보드 응답 DTO입니다.
 *
 * @see LeaderboardService.getTopUsers()
 */
export class LeaderboardEntryDto {
  /**
   * 순위 (1부터 시작)
   */
  rank: number;

  /**
   * 사용자 ID
   */
  userId: string;

  /**
   * 사용자명
   */
  username: string;

  /**
   * 프로필 이미지 URL (있는 경우)
   */
  avatarUrl?: string;

  /**
   * 감쇠 적용 점수
   */
  score: number;

  /**
   * 활성 타이틀 목록
   */
  titles: string[];

  /**
   * 순위 변동 (이전 대비)
   * 양수: 상승, 음수: 하락, 0: 유지
   */
  rankChange?: number;
}

/**
 * 리더보드 응답 DTO
 */
export class LeaderboardResponseDto {
  /**
   * 기간 (l7, l30)
   */
  period: string;

  /**
   * 리더보드 항목 목록
   */
  entries: LeaderboardEntryDto[];

  /**
   * 마지막 갱신 시각
   */
  lastUpdatedAt: Date;

  /**
   * 총 참가자 수
   */
  totalParticipants: number;
}
