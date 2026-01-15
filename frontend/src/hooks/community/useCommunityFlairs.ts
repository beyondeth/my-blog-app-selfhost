'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communityService } from '@/services/api/community.service';
import type {
  CommunityFlair,
  CreateCommunityFlairDto,
  UpdateCommunityFlairDto,
  FlairTypeType,
} from '@/types/community';

/**
 * 플레어 관리 관련 Query Key 팩토리
 */
export const communityFlairQueryKeys = {
  all: ['community-flairs'] as const,
  list: (slug: string, type?: FlairTypeType) =>
    [...communityFlairQueryKeys.all, slug, type] as const,
};

/**
 * 커뮤니티 플레어 목록 조회 훅
 */
export function useCommunityFlairs(slug: string, type?: FlairTypeType) {
  return useQuery<CommunityFlair[]>({
    queryKey: communityFlairQueryKeys.list(slug, type),
    queryFn: () => communityService.getCommunityFlairs(slug, type),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * 플레어 생성 훅
 */
export function useCreateCommunityFlair(slug: string) {
  const queryClient = useQueryClient();

  return useMutation<CommunityFlair, Error, CreateCommunityFlairDto>({
    mutationFn: (dto: CreateCommunityFlairDto) =>
      communityService.createCommunityFlair(slug, dto),
    onSuccess: () => {
      // 플레어 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityFlairQueryKeys.all,
      });
    },
  });
}

/**
 * 플레어 수정 훅
 */
export function useUpdateCommunityFlair(slug: string) {
  const queryClient = useQueryClient();

  return useMutation<CommunityFlair, Error, { flairId: string; dto: UpdateCommunityFlairDto }>({
    mutationFn: ({ flairId, dto }: { flairId: string; dto: UpdateCommunityFlairDto }) =>
      communityService.updateCommunityFlair(slug, flairId, dto),
    onSuccess: () => {
      // 플레어 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityFlairQueryKeys.all,
      });
    },
  });
}

/**
 * 플레어 삭제 훅
 */
export function useDeleteCommunityFlair(slug: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (flairId: string) =>
      communityService.deleteCommunityFlair(slug, flairId),
    onSuccess: () => {
      // 플레어 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityFlairQueryKeys.all,
      });
    },
  });
}
