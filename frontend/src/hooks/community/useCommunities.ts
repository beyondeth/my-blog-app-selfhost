'use client';

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communityService } from '@/services/api/community.service';
import type {
  Community,
  GetCommunitiesQuery,
  CursorPaginationResponse,
  CreateCommunityDto,
  UpdateCommunityDto,
} from '@/types/community';

/**
 * 커서 페이지네이션 파라미터 타입
 */
interface CursorPageParam {
  cursor?: string;
  cursorId?: string;
}

/**
 * 커뮤니티 관련 Query Key 팩토리
 */
export const communityQueryKeys = {
  all: ['communities'] as const,
  lists: () => [...communityQueryKeys.all, 'list'] as const,
  list: (filters: Omit<GetCommunitiesQuery, 'cursor' | 'cursorId'>) =>
    [...communityQueryKeys.lists(), filters] as const,
  popular: () => [...communityQueryKeys.all, 'popular'] as const,
  details: () => [...communityQueryKeys.all, 'detail'] as const,
  detail: (slug: string) => [...communityQueryKeys.details(), slug] as const,
  membership: (slug: string) => [...communityQueryKeys.detail(slug), 'membership'] as const,
  rules: (slug: string) => [...communityQueryKeys.detail(slug), 'rules'] as const,
  flairs: (slug: string) => [...communityQueryKeys.detail(slug), 'flairs'] as const,
  members: (slug: string) => [...communityQueryKeys.detail(slug), 'members'] as const,
  myCommunities: () => [...communityQueryKeys.all, 'my'] as const,
};

/**
 * 커뮤니티 목록 조회 훅 (첫 페이지만)
 *
 * @description 단순 목록 표시용 (무한 스크롤 X)
 */
export function useCommunities(options: Omit<GetCommunitiesQuery, 'cursor' | 'cursorId'> = {}) {
  const { limit = 20, search, sortBy = 'popular', includeNsfw = false, joinedOnly = false } = options;

  return useQuery<CursorPaginationResponse<Community>>({
    queryKey: communityQueryKeys.list({ limit, search, sortBy, includeNsfw, joinedOnly }),
    queryFn: () => communityService.getCommunities({ limit, search, sortBy, includeNsfw, joinedOnly }),
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * 커뮤니티 목록 조회 훅 (무한 스크롤 - 커서 페이지네이션)
 *
 * @description 커서 기반 무한 스크롤 구현
 * - 첫 요청: 커서 없이 요청
 * - 다음 요청: 이전 응답의 nextCursor, nextCursorId 사용
 *
 * **성능 이점:**
 * - OFFSET 스캔 없이 인덱스 범위 스캔 사용
 * - 대량 데이터에서도 일정한 쿼리 시간
 */
export function useInfiniteCommunities(options: Omit<GetCommunitiesQuery, 'cursor' | 'cursorId'> = {}) {
  const { limit = 20, search, sortBy = 'popular', includeNsfw = false, joinedOnly = false } = options;

  return useInfiniteQuery<CursorPaginationResponse<Community>, Error, {
    pages: CursorPaginationResponse<Community>[];
    pageParams: CursorPageParam[];
  }, ReturnType<typeof communityQueryKeys.list>, CursorPageParam>({
    queryKey: communityQueryKeys.list({ limit, search, sortBy, includeNsfw, joinedOnly }),
    queryFn: ({ pageParam }) =>
      communityService.getCommunities({
        cursor: pageParam?.cursor,
        cursorId: pageParam?.cursorId,
        limit,
        search,
        sortBy,
        includeNsfw,
        joinedOnly,
      }),
    getNextPageParam: (lastPage) => {
      // 다음 페이지가 있으면 커서 정보 반환
      if (lastPage.hasNext && lastPage.nextCursor && lastPage.nextCursorId) {
        return {
          cursor: lastPage.nextCursor,
          cursorId: lastPage.nextCursorId,
        };
      }
      return undefined;
    },
    initialPageParam: {}, // 첫 요청은 커서 없이
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 인기 커뮤니티 조회 훅
 *
 * @description 사이드바, 홈 등에서 인기 커뮤니티 표시용
 */
export function usePopularCommunities(limit = 10) {
  return useQuery<Community[]>({
    queryKey: communityQueryKeys.popular(),
    queryFn: async () => {
      const response = await communityService.getCommunities({
        limit,
        sortBy: 'popular',
      });
      return response.items;
    },
    staleTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * 내가 가입한 커뮤니티 목록 조회 훅
 *
 * @description 발행 위치 선택 등에서 사용. limit=20 (백엔드 제한)
 */
export function useMyCommunities(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;

  return useQuery<Community[]>({
    queryKey: communityQueryKeys.myCommunities(),
    queryFn: async () => {
      const response = await communityService.getCommunities({
        limit: 20,
        joinedOnly: true,
      });
      return response.items;
    },
    staleTime: 60 * 1000, // 1분
    enabled,
  });
}

/**
 * 단일 커뮤니티 조회 훅
 */
export function useCommunity(
  slug: string,
  options?: { enabled?: boolean; initialData?: Community }
) {
  return useQuery<Community>({
    queryKey: communityQueryKeys.detail(slug),
    queryFn: () => communityService.getCommunity(slug),
    enabled: options?.enabled !== false && !!slug,
    initialData: options?.initialData,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 커뮤니티 생성 훅
 */
export function useCreateCommunity() {
  const queryClient = useQueryClient();

  return useMutation<Community, Error, CreateCommunityDto>({
    mutationFn: (data: CreateCommunityDto) => communityService.createCommunity(data),
    onSuccess: (newCommunity: Community) => {
      // 커뮤니티 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.myCommunities() });

      // 생성자는 자동으로 OWNER이므로 userMembership 정보 포함하여 캐시 저장
      // 이미지 업로드 후에 invalidate 필요 (create/page.tsx에서 처리)
      const communityWithMembership: Community = {
        ...newCommunity,
        userMembership: {
          isMember: true,
          role: 'owner',
          status: 'active',
        },
      };
      queryClient.setQueryData(
        communityQueryKeys.detail(newCommunity.slug),
        communityWithMembership
      );
    },
  });
}

/**
 * 커뮤니티 수정 훅
 *
 * @description 커뮤니티 정보 수정 시 기존 userMembership 정보를 유지합니다.
 * 백엔드 응답에는 userMembership이 포함되지 않으므로, 캐시된 기존 데이터와 병합합니다.
 */
export function useUpdateCommunity(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<UpdateCommunityDto>) =>
      communityService.updateCommunity(slug, data),
    onSuccess: (updatedCommunity) => {
      // 기존 캐시 데이터 조회하여 userMembership 유지
      const existingData = queryClient.getQueryData<Community>(
        communityQueryKeys.detail(slug)
      );

      // 업데이트된 데이터와 기존 userMembership 병합
      queryClient.setQueryData(
        communityQueryKeys.detail(slug),
        {
          ...updatedCommunity,
          userMembership: existingData?.userMembership,
        }
      );
      // 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.lists() });
    },
  });
}

/**
 * 커뮤니티 삭제 훅 (Site Admin 전용)
 *
 * @description Reddit 정책에 따라 커뮤니티 삭제는 플랫폼 관리자(Site Admin)만 가능합니다.
 * 일반 사용자(커뮤니티 Owner/Moderator 포함)는 이 훅을 사용해도 403 에러가 발생합니다.
 * 이 훅은 관리자 페이지에서만 사용해야 합니다.
 */
export function useDeleteCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slug: string) => communityService.deleteCommunity(slug),
    onSuccess: (_, slug) => {
      // 캐시에서 제거
      queryClient.removeQueries({ queryKey: communityQueryKeys.detail(slug) });
      // 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.myCommunities() });
    },
  });
}
