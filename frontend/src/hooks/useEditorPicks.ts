"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Editor's Pick 포스트 타입 정의
interface EditorPickPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  thumbnail: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  publishedAt: string;
  author: {
    id: string;
    username: string;
    email: string;
  };
  blog: {
    id: string;
    slug: string;
    name: string;
  };
}

interface EditorPicksResponse {
  posts: EditorPickPost[];
  total: number;
}

/**
 * Editor's Pick 목록 조회 Hook
 * @param limit 조회할 개수 (기본: 5, 최대: 10)
 */
export function useEditorPicks(limit: number = 5) {
  return useQuery<EditorPicksResponse>({
    queryKey: ['editorPicks', limit],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/posts/editor-picks?limit=${limit}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Editor\'s Pick 목록을 불러올 수 없습니다.');
      }

      return response.json();
    },
    staleTime: 30 * 60 * 1000, // 30분 동안 fresh 상태 유지
    gcTime: 60 * 60 * 1000, // 1시간 동안 캐시 유지
  });
}

/**
 * Editor's Pick 토글 Hook (Admin 전용)
 * @param postId 포스트 ID
 * @param onSuccess 성공 시 콜백
 */
export function useToggleEditorPick(postId: string, onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/posts/${postId}/editor-pick`,
        {
          method: 'PATCH',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Editor\'s Pick 변경에 실패했습니다.');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Editor's Pick 목록 캐시 무효화 (모든 limit 값)
      for (let limit = 1; limit <= 10; limit++) {
        queryClient.invalidateQueries({ queryKey: ['editorPicks', limit] });
      }

      // 포스트 상세 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['post', postId] });

      // 성공 메시지 표시
      toast.success(data.message || 'Editor\'s Pick이 변경되었습니다.', {
        duration: 3000,
        position: 'bottom-right',
      });

      // 성공 콜백 실행
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
      // 에러 메시지 표시
      toast.error(error.message || 'Editor\'s Pick 변경에 실패했습니다.', {
        duration: 3000,
        position: 'bottom-right',
      });
    },
  });
}
