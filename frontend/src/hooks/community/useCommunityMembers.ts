'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { communityService } from '@/services/api/community.service';
import type {
  CommunityMember,
  CommunityBan,
  CommunityRoleType,
  PaginatedCommunityResponse,
  UpdateMemberRoleDto,
  BanMemberDto,
} from '@/types/community';
import { communityQueryKeys } from './useCommunities';

/**
 * 멤버 관리 관련 Query Key 팩토리
 */
export const communityMemberQueryKeys = {
  all: ['community-members'] as const,
  lists: () => [...communityMemberQueryKeys.all, 'list'] as const,
  list: (slug: string, filters: { role?: CommunityRoleType }) =>
    [...communityMemberQueryKeys.lists(), slug, filters] as const,
  bans: () => [...communityMemberQueryKeys.all, 'bans'] as const,
  banList: (slug: string) => [...communityMemberQueryKeys.bans(), slug] as const,
};

/**
 * 커뮤니티 멤버 목록 조회 훅 (무한 스크롤)
 */
export function useCommunityMembers(
  slug: string,
  options: { role?: CommunityRoleType; limit?: number } = {}
) {
  const { role, limit = 20 } = options;

  return useInfiniteQuery<PaginatedCommunityResponse<CommunityMember>>({
    queryKey: communityMemberQueryKeys.list(slug, { role }),
    queryFn: ({ pageParam = 1 }) =>
      communityService.getCommunityMembers(slug, {
        page: pageParam as number,
        limit,
        role,
      }),
    getNextPageParam: (lastPage) => {
      if (lastPage.hasNext) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: !!slug,
    staleTime: 30 * 1000,
  });
}

/**
 * 멤버 역할 변경 훅
 */
export function useUpdateMemberRole(slug: string) {
  const queryClient = useQueryClient();

  return useMutation<CommunityMember, Error, { userId: string; role: CommunityRoleType }>({
    mutationFn: ({ userId, role }: { userId: string; role: CommunityRoleType }) =>
      communityService.updateMemberRole(slug, userId, { role }),
    onSuccess: () => {
      // 멤버 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityMemberQueryKeys.lists(),
      });
      // 커뮤니티 상세도 무효화 (멤버 수 등)
      queryClient.invalidateQueries({
        queryKey: communityQueryKeys.detail(slug),
      });
    },
  });
}

/**
 * 소유권 이전 훅
 */
export function useTransferOwnership(slug: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (newOwnerId: string) =>
      communityService.transferOwnership(slug, newOwnerId),
    onSuccess: () => {
      // 모든 관련 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityMemberQueryKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: communityQueryKeys.detail(slug),
      });
    },
  });
}

/**
 * 멤버 차단 훅
 */
export function useBanMember(slug: string) {
  const queryClient = useQueryClient();

  return useMutation<CommunityBan, Error, { userId: string; dto: BanMemberDto }>({
    mutationFn: ({ userId, dto }: { userId: string; dto: BanMemberDto }) =>
      communityService.banMember(slug, userId, dto),
    onSuccess: () => {
      // 멤버 목록 및 차단 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityMemberQueryKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: communityMemberQueryKeys.bans(),
      });
    },
  });
}

/**
 * 차단 해제 훅
 */
export function useUnbanMember(slug: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (userId: string) =>
      communityService.unbanMember(slug, userId),
    onSuccess: () => {
      // 차단 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityMemberQueryKeys.bans(),
      });
    },
  });
}

/**
 * 차단 목록 조회 훅 (무한 스크롤)
 */
export function useCommunityBans(slug: string, options: { limit?: number } = {}) {
  const { limit = 20 } = options;

  return useInfiniteQuery<PaginatedCommunityResponse<CommunityBan>>({
    queryKey: communityMemberQueryKeys.banList(slug),
    queryFn: ({ pageParam = 1 }) =>
      communityService.getCommunityBans(slug, {
        page: pageParam as number,
        limit,
      }),
    getNextPageParam: (lastPage) => {
      if (lastPage.hasNext) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: !!slug,
    staleTime: 30 * 1000,
  });
}
