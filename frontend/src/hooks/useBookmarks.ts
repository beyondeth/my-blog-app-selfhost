import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * 북마크 관련 API 호출 함수들
 */

// 북마크 토글 (추가/제거)
const toggleBookmark = async (postId: string) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/bookmarks/${postId}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '북마크 처리 중 오류가 발생했습니다.');
  }

  return response.json();
};

// 북마크 목록 조회
const fetchBookmarks = async (page: number = 1, pageSize: number = 20) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/bookmarks?page=${page}&pageSize=${pageSize}`,
    {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '북마크 목록을 불러오는데 실패했습니다.');
  }

  return response.json();
};

/**
 * 북마크 토글 Hook
 * 북마크 추가/제거를 처리하고 관련 캐시를 업데이트
 */
export const useToggleBookmark = (postId: string, onUnauthorized?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      // postId가 없거나 빈 문자열이면 에러 throw
      if (!postId) {
        throw new Error('Post ID is required for bookmark operation');
      }
      return toggleBookmark(postId);
    },
    onSuccess: (data) => {
      // 포스트 상세 캐시 업데이트
      queryClient.setQueryData(['post', postId], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          bookmarked: data.bookmarked,
        };
      });

      // 포스트 슬러그 캐시도 업데이트 (slug로 조회하는 경우)
      queryClient.invalidateQueries({
        queryKey: ['post'],
        predicate: (query) => {
          const queryKey = query.queryKey as any[];
          return queryKey.length === 2 && queryKey[0] === 'post';
        }
      });

      // 북마크 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });

      // 성공 메시지
      toast.success(data.message || (data.bookmarked ? '북마크에 추가되었습니다.' : '북마크가 제거되었습니다.'));
    },
    onError: (error: any) => {
      // 401 에러 처리 (로그인 필요)
      if (error?.response?.status === 401 && onUnauthorized) {
        onUnauthorized();
        return;
      }

      // 에러 메시지 표시
      toast.error(error.message || '북마크 처리 중 오류가 발생했습니다.');
    },
  });
};

/**
 * 북마크 목록 조회 Hook
 * 페이지네이션을 지원하는 북마크 목록 조회
 */
export const useBookmarks = (page: number = 1, pageSize: number = 20) => {
  return useQuery({
    queryKey: ['bookmarks', page, pageSize],
    queryFn: () => fetchBookmarks(page, pageSize),
    staleTime: 1000 * 60 * 5, // 5분
    retry: 1,
  });
};

/**
 * 북마크 상태 확인 Hook
 * 특정 포스트의 북마크 여부를 확인
 */
export const useIsBookmarked = (postId: string) => {
  return useQuery({
    queryKey: ['bookmark-status', postId],
    queryFn: async () => {
      // postId가 없으면 쿼리 실행하지 않음 (enabled 옵션과 함께 이중 방어)
      if (!postId || postId.trim() === '') {
        return { bookmarked: false };
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/bookmarks/${postId}/status`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          // 로그인하지 않은 경우 false 반환
          return { bookmarked: false };
        }
        throw new Error('북마크 상태를 확인할 수 없습니다.');
      }

      return response.json();
    },
    enabled: Boolean(postId && postId.trim()), // postId가 유효할 때만 쿼리 실행
    staleTime: 1000 * 60 * 10, // 10분 (다른 쿼리와 일관성)
    retry: false, // 401 에러 시 재시도하지 않음
  });
};

/**
 * 북마크 삭제 Hook
 * 북마크를 직접 삭제 (토글과 별개)
 */
export const useDeleteBookmark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/bookmarks/${postId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '북마크 삭제 중 오류가 발생했습니다.');
      }
    },
    onSuccess: (_, postId) => {
      // 북마크 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });

      // 포스트 상세 캐시 업데이트
      queryClient.setQueryData(['post', postId], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          bookmarked: false,
        };
      });

      toast.success('북마크가 삭제되었습니다.');
    },
    onError: (error: any) => {
      toast.error(error.message || '북마크 삭제 중 오류가 발생했습니다.');
    },
  });
};