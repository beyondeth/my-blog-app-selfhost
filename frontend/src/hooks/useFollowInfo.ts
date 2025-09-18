import { useQuery } from '@tanstack/react-query';
import { FollowInfo } from '@/types/api';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/AuthProviderV2';

/**
 * 사용자의 팔로우 정보를 조회하는 커스텀 훅
 * @param userId 대상 사용자 ID
 * @param initialState 초기 상태 (선택사항)
 * @returns 팔로우 정보, 로딩 상태, 에러 상태
 */
export function useFollowInfo(userId: string, initialState?: FollowInfo) {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery<FollowInfo>({
    queryKey: queryKeys.users.followInfo(userId),
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${userId}/follow-info`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('UNAUTHORIZED');
        }
        throw new Error(`Failed to fetch follow info: ${response.status}`);
      }

      return response.json();
    },
    initialData: initialState,
    staleTime: 30000, // 30초간 캐시 유지
    enabled: !!userId && !!user, // 로그인된 상태에서만 실행
  });

  return { 
    followInfo: data || initialState || {
      followersCount: 0,
      followingCount: 0,
      isFollowedByUser: false,
    },
    isLoading,
    error,
    refetch,
  };
}

export default useFollowInfo;