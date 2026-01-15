/**
 * 평판 시스템 - 리더보드 조회 Hook
 *
 * React Query를 사용하여 리더보드 데이터를 조회하고 캐싱합니다.
 *
 * @example
 * const { data, isLoading, error } = useReputationLeaderboard('l7');
 *
 * @see fetchLeaderboard
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchLeaderboard,
  LeaderboardPeriod,
  LeaderboardResponse,
} from '../api/reputation';

/**
 * 리더보드 조회 Query Key
 */
export const leaderboardQueryKey = (period: LeaderboardPeriod) => [
  'reputation',
  'leaderboard',
  period,
];

/**
 * 리더보드 조회 Hook
 *
 * @param period 기간 ('l7' | 'l30')
 * @param limit 조회할 상위 N명 (기본값: 100)
 * @param enabled 쿼리 활성화 여부 (기본값: true)
 * @returns React Query 결과
 */
export function useReputationLeaderboard(
  period: LeaderboardPeriod = 'l7',
  limit: number = 100,
  enabled: boolean = true,
) {
  return useQuery<LeaderboardResponse, Error>({
    queryKey: leaderboardQueryKey(period),
    queryFn: () => fetchLeaderboard(period, limit),
    enabled,
    staleTime: 5 * 60 * 1000, // 5분 동안 fresh
    gcTime: 10 * 60 * 1000, // 10분 동안 캐시 유지
    refetchOnWindowFocus: false,
  });
}

export default useReputationLeaderboard;
