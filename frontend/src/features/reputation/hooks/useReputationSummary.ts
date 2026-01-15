/**
 * 평판 시스템 - 사용자 평판 요약 조회 Hook
 *
 * React Query를 사용하여 특정 사용자의 평판 정보를 조회합니다.
 *
 * @example
 * const { data, isLoading } = useReputationSummary('user-id');
 *
 * @see fetchUserReputation
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchUserReputation, ReputationSummary } from '../api/reputation';

/**
 * 사용자 평판 요약 Query Key
 */
export const reputationSummaryQueryKey = (userId: string) => [
  'reputation',
  'summary',
  userId,
];

/**
 * 사용자 평판 요약 조회 Hook
 *
 * @param userId 사용자 ID
 * @param enabled 쿼리 활성화 여부 (기본값: true)
 * @returns React Query 결과
 */
export function useReputationSummary(
  userId: string | undefined,
  enabled: boolean = true,
) {
  return useQuery<ReputationSummary, Error>({
    queryKey: reputationSummaryQueryKey(userId || ''),
    queryFn: () => fetchUserReputation(userId!),
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000, // 5분 동안 fresh
    gcTime: 10 * 60 * 1000, // 10분 동안 캐시 유지
  });
}

export default useReputationSummary;
