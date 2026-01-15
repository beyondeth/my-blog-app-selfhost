/**
 * 평판 시스템 - API 클라이언트
 *
 * 백엔드 평판 관련 API를 호출하는 함수들을 정의합니다.
 *
 * @see ReputationAdminController
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * 리더보드 기간 타입
 */
export type LeaderboardPeriod = 'l7' | 'l30' | 'l90' | 'all';

/**
 * 리더보드 항목
 */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl?: string;
  score: number;
  titles: string[];
  rankChange?: number;
}

/**
 * 리더보드 응답
 */
export interface LeaderboardResponse {
  period: string;
  entries: LeaderboardEntry[];
  lastUpdatedAt: string;
  totalParticipants: number;
}

/**
 * 기간별 점수 정보
 */
export interface PeriodScore {
  period: string;
  score: number;
  decayedScore: number;
  rank?: number;
  percentile?: number;
}

/**
 * 타이틀 정보
 */
export interface TitleInfo {
  code: string;
  displayName: string;
  description: string;
  icon: string;
  grantedAt: string;
  expiresAt: string | null;
  isActive: boolean;
}

/**
 * 검색된 사용자 정보
 */
export interface SearchedUser {
  id: string;
  username: string;
  email: string;
  profileImage?: string;
}

/**
 * 사용자 검색 (사용자명 또는 이메일)
 *
 * @param query 검색어 (사용자명 또는 이메일)
 * @returns 검색된 사용자 목록
 */
export async function searchUsers(query: string): Promise<{ users: SearchedUser[] }> {
  if (!query || query.length < 2) {
    return { users: [] };
  }

  const response = await fetch(
    `${API_BASE}/admin/reputation/search?q=${encodeURIComponent(query)}`,
    {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`사용자 검색 실패: ${response.status}`);
  }

  return response.json();
}

/**
 * 사용자 평판 요약
 */
export interface ReputationSummary {
  userId: string;
  username: string;
  scores: PeriodScore[];
  activeTitles: TitleInfo[];
  totalEarnedScore: number;
  lastActivityAt?: string;
  memberDays: number;
}

/**
 * 평판 히스토리 항목
 */
export interface ReputationLedgerEntry {
  id: string;
  actionType: string;
  delta: number;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  recordedAt: string;
}

/**
 * 리더보드 조회
 *
 * @param period 기간 ('l7' | 'l30')
 * @param limit 조회할 상위 N명
 * @returns 리더보드 응답
 */
export async function fetchLeaderboard(
  period: LeaderboardPeriod = 'l7',
  limit: number = 100,
): Promise<LeaderboardResponse> {
  const response = await fetch(
    `${API_BASE}/admin/reputation/leaderboard?period=${period}&limit=${limit}`,
    {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`리더보드 조회 실패: ${response.status}`);
  }

  return response.json();
}

/**
 * 특정 사용자 평판 조회
 *
 * @param userId 사용자 ID
 * @returns 사용자 평판 요약
 */
export async function fetchUserReputation(
  userId: string,
): Promise<ReputationSummary> {
  const response = await fetch(
    `${API_BASE}/admin/reputation/user/${userId}`,
    {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`사용자 평판 조회 실패: ${response.status}`);
  }

  return response.json();
}

/**
 * 특정 사용자 평판 히스토리 조회
 *
 * @param userId 사용자 ID
 * @param limit 조회 개수 (기본 50)
 */
export async function fetchUserReputationLedger(
  userId: string,
  limit: number = 50,
): Promise<{ entries: ReputationLedgerEntry[] }> {
  const response = await fetch(
    `${API_BASE}/admin/reputation/user/${userId}/ledger?limit=${limit}`,
    {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`사용자 평판 히스토리 조회 실패: ${response.status}`);
  }

  return response.json();
}

/**
 * 수동 집계 실행
 *
 * @returns 실행 결과
 */
export async function runAggregate(): Promise<{
  success: boolean;
  elapsed: number;
}> {
  const response = await fetch(
    `${API_BASE}/admin/reputation/aggregate`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`집계 실행 실패: ${response.status}`);
  }

  return response.json();
}

/**
 * 수동 리더보드 갱신
 *
 * @returns 실행 결과
 */
export async function refreshLeaderboard(): Promise<{
  success: boolean;
  elapsed: number;
}> {
  const response = await fetch(
    `${API_BASE}/admin/reputation/leaderboard/refresh`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`리더보드 갱신 실패: ${response.status}`);
  }

  return response.json();
}
