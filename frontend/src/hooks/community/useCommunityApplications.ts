'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { communityService } from '@/services/api/community.service';
import type {
  PendingApplication,
  CommunityInvite,
  HandleApplicationDto,
  CreateInviteDto,
  PaginatedCommunityResponse,
} from '@/types/community';
import { communityQueryKeys } from './useCommunities';
import { communityMemberQueryKeys } from './useCommunityMembers';

// =====================================================
// Query Key 팩토리
// =====================================================

/**
 * 가입 신청 관련 Query Key 팩토리
 */
export const communityApplicationQueryKeys = {
  all: ['community-applications'] as const,
  lists: () => [...communityApplicationQueryKeys.all, 'list'] as const,
  list: (slug: string) => [...communityApplicationQueryKeys.lists(), slug] as const,
};

/**
 * 초대 관련 Query Key 팩토리
 */
export const communityInviteQueryKeys = {
  all: ['community-invites'] as const,
  lists: () => [...communityInviteQueryKeys.all, 'list'] as const,
  list: (slug: string) => [...communityInviteQueryKeys.lists(), slug] as const,
  token: (token: string) => [...communityInviteQueryKeys.all, 'token', token] as const,
};

// =====================================================
// 가입 신청 관리 훅 (RESTRICTED 커뮤니티)
// =====================================================

/**
 * 대기 중인 가입 신청 목록 조회 훅 (무한 스크롤)
 *
 * @description 매니저가 승인 대기 중인 신청 목록을 조회
 */
export function usePendingApplications(slug: string, options: { limit?: number } = {}) {
  const { limit = 20 } = options;

  return useInfiniteQuery<PaginatedCommunityResponse<PendingApplication>>({
    queryKey: communityApplicationQueryKeys.list(slug),
    queryFn: ({ pageParam = 1 }) =>
      communityService.getPendingApplications(slug, {
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
    staleTime: 30 * 1000, // 30초
  });
}

/**
 * 가입 신청 승인 훅
 */
export function useApproveApplication(slug: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (userId: string) => communityService.approveApplication(slug, userId),
    onSuccess: () => {
      // 신청 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityApplicationQueryKeys.list(slug),
      });
      // 멤버 목록도 무효화 (새 멤버 추가)
      queryClient.invalidateQueries({
        queryKey: communityMemberQueryKeys.lists(),
      });
      // 커뮤니티 상세도 무효화 (멤버 수 변경)
      queryClient.invalidateQueries({
        queryKey: communityQueryKeys.detail(slug),
      });
    },
  });
}

/**
 * 가입 신청 거부 훅
 */
export function useRejectApplication(slug: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { userId: string; dto?: HandleApplicationDto }>({
    mutationFn: ({ userId, dto }) => communityService.rejectApplication(slug, userId, dto),
    onSuccess: () => {
      // 신청 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityApplicationQueryKeys.list(slug),
      });
    },
  });
}

// =====================================================
// 초대 링크 관리 훅
// =====================================================

/**
 * 초대 링크 목록 조회 훅 (무한 스크롤)
 *
 * @description 매니저가 생성한 초대 링크 목록 조회
 */
export function useCommunityInvites(slug: string, options: { limit?: number } = {}) {
  const { limit = 20 } = options;

  return useInfiniteQuery<PaginatedCommunityResponse<CommunityInvite>>({
    queryKey: communityInviteQueryKeys.list(slug),
    queryFn: ({ pageParam = 1 }) =>
      communityService.getInvites(slug, {
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
    staleTime: 30 * 1000, // 30초
  });
}

/**
 * 초대 링크 생성 훅
 */
export function useCreateInvite(slug: string) {
  const queryClient = useQueryClient();

  return useMutation<CommunityInvite, Error, CreateInviteDto | undefined>({
    mutationFn: (dto) => communityService.createInvite(slug, dto),
    onSuccess: () => {
      // 초대 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityInviteQueryKeys.list(slug),
      });
    },
  });
}

/**
 * 초대 링크 비활성화 훅
 */
export function useRevokeInvite(slug: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (inviteId: string) => communityService.revokeInvite(slug, inviteId),
    onSuccess: () => {
      // 초대 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityInviteQueryKeys.list(slug),
      });
    },
  });
}

// =====================================================
// 초대 수락 훅 (공개 페이지용)
// =====================================================

/**
 * 토큰으로 초대 정보 조회 훅
 *
 * @description 초대 수락 페이지에서 초대 정보를 표시
 */
export function useInviteByToken(token: string | undefined) {
  return useQuery<CommunityInvite | null, Error>({
    queryKey: communityInviteQueryKeys.token(token || ''),
    queryFn: () => communityService.getInviteByToken(token!),
    enabled: !!token,
    staleTime: 60 * 1000, // 1분
    retry: false, // 실패 시 재시도 안함 (만료된 초대 등)
  });
}

/**
 * 초대 수락 훅
 */
export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation<
    { communityId: string; status: string; role: string },
    Error,
    string
  >({
    mutationFn: (token: string) => communityService.acceptInvite(token),
    onSuccess: (_data, token) => {
      // 해당 토큰의 초대 정보 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityInviteQueryKeys.token(token),
      });
      // 내 커뮤니티 목록도 무효화 (새로 가입했으니)
      queryClient.invalidateQueries({
        queryKey: ['my-communities'],
      });
    },
  });
}
