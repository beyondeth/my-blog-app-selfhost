/**
 * 평판 시스템 - 사용자 평판 히스토리 조회 Hook
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchUserReputationLedger,
  type ReputationLedgerEntry,
} from '../api/reputation';

export const reputationLedgerQueryKey = (userId: string, limit: number) => [
  'reputation',
  'ledger',
  userId,
  limit,
];

export function useReputationLedger(
  userId: string | undefined,
  limit: number = 50,
  enabled: boolean = true,
) {
  return useQuery<{ entries: ReputationLedgerEntry[] }, Error>({
    queryKey: reputationLedgerQueryKey(userId || '', limit),
    queryFn: () => fetchUserReputationLedger(userId!, limit),
    enabled: enabled && !!userId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export default useReputationLedger;
