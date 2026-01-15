'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communityService } from '@/services/api/community.service';
import type {
  CommunityRule,
  CreateCommunityRuleDto,
  UpdateCommunityRuleDto,
} from '@/types/community';

/**
 * 규칙 관리 관련 Query Key 팩토리
 */
export const communityRuleQueryKeys = {
  all: ['community-rules'] as const,
  list: (slug: string) => [...communityRuleQueryKeys.all, slug] as const,
};

/**
 * 커뮤니티 규칙 목록 조회 훅
 */
export function useCommunityRules(slug: string) {
  return useQuery<CommunityRule[]>({
    queryKey: communityRuleQueryKeys.list(slug),
    queryFn: () => communityService.getCommunityRules(slug),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * 규칙 생성 훅
 */
export function useCreateCommunityRule(slug: string) {
  const queryClient = useQueryClient();

  return useMutation<CommunityRule, Error, CreateCommunityRuleDto>({
    mutationFn: (dto: CreateCommunityRuleDto) =>
      communityService.createCommunityRule(slug, dto),
    onSuccess: () => {
      // 규칙 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityRuleQueryKeys.list(slug),
      });
    },
  });
}

/**
 * 규칙 수정 훅
 */
export function useUpdateCommunityRule(slug: string) {
  const queryClient = useQueryClient();

  return useMutation<CommunityRule, Error, { ruleId: string; dto: UpdateCommunityRuleDto }>({
    mutationFn: ({ ruleId, dto }: { ruleId: string; dto: UpdateCommunityRuleDto }) =>
      communityService.updateCommunityRule(slug, ruleId, dto),
    onSuccess: () => {
      // 규칙 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityRuleQueryKeys.list(slug),
      });
    },
  });
}

/**
 * 규칙 삭제 훅
 */
export function useDeleteCommunityRule(slug: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (ruleId: string) =>
      communityService.deleteCommunityRule(slug, ruleId),
    onSuccess: () => {
      // 규칙 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityRuleQueryKeys.list(slug),
      });
    },
  });
}
