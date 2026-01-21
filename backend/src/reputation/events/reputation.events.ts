/**
 * 평판 시스템 - 이벤트 정의
 *
 * 평판 시스템에서 발행하는 이벤트를 정의합니다.
 * 타이틀 부여/회수 등의 이벤트를 다른 모듈에서 구독할 수 있습니다.
 */

/**
 * 평판 이벤트 타입 상수
 */
export const ReputationEvents = {
  /**
   * 평판 점수 기록됨
   * 새로운 Ledger 엔트리가 생성되었을 때 발행
   */
  SCORE_RECORDED: "reputation.score.recorded",

  /**
   * 타이틀 부여됨
   * 사용자에게 새 타이틀이 부여되었을 때 발행
   */
  TITLE_GRANTED: "reputation.title.granted",

  /**
   * 타이틀 만료됨
   * 사용자의 타이틀이 만료되었을 때 발행
   */
  TITLE_EXPIRED: "reputation.title.expired",

  /**
   * 리더보드 갱신됨
   * 리더보드가 새로 갱신되었을 때 발행
   */
  LEADERBOARD_REFRESHED: "reputation.leaderboard.refreshed",
};

/**
 * 점수 기록 이벤트 페이로드
 */
export interface ScoreRecordedEventPayload {
  /** 사용자 ID */
  userId: string;
  /** 액션 타입 */
  actionType: string;
  /** 점수 변화량 */
  delta: number;
  /** 타겟 타입 */
  targetType?: string;
  /** 타겟 ID */
  targetId?: string;
  /** 기록 시각 */
  timestamp: Date;
}

/**
 * 타이틀 부여 이벤트 페이로드
 */
export interface TitleGrantedEventPayload {
  /** 사용자 ID */
  userId: string;
  /** 타이틀 코드 */
  titleCode: string;
  /** 부여 시각 */
  grantedAt: Date;
  /** 만료 시각 (null이면 영구) */
  expiresAt: Date | null;
}

/**
 * 타이틀 만료 이벤트 페이로드
 */
export interface TitleExpiredEventPayload {
  /** 사용자 ID */
  userId: string;
  /** 타이틀 코드 */
  titleCode: string;
  /** 만료 시각 */
  expiredAt: Date;
}
