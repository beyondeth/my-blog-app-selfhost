"use client";

import React from 'react';
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
    staleTime: 5 * 60 * 1000,  // 5분 동안 fresh 상태 유지
    gcTime: 10 * 60 * 1000,  // 10분 동안 캐시 유지
  });
}

/**
 * Editor's Pick 토글 Hook (Admin 전용)
 * @param postId 포스트 ID
 * @param onSuccess 성공 시 콜백
 */
export function useToggleEditorPick(postId: string, onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
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
  });

  // 성공 처리
  React.useEffect(() => {
    if (mutation.isSuccess && mutation.data) {
      const post = mutation.data; // API가 이제 Post 전체 데이터를 반환

      // 1. Optimistic Update: 포스트 상세 캐시 즉시 업데이트
      queryClient.setQueriesData(
        {
          queryKey: ['posts', 'detail'],
          exact: false
        },
        (oldData: any) => {
          if (!oldData) return oldData;

          // 단일 포스트 데이터인 경우
          if (oldData.id) {
            return { ...oldData, isEditorPick: post.isEditorPick };
          }

          // 배열인 경우 (목록)
          if (Array.isArray(oldData)) {
            return oldData.map((p: any) =>
              p.id === post.id ? { ...p, isEditorPick: post.isEditorPick } : p
            );
          }

          return oldData;
        }
      );

      // 2. Editor's Pick 목록 캐시 무효화 (모든 limit 값)
      for (let limit = 1; limit <= 10; limit++) {
        queryClient.invalidateQueries({ queryKey: ['editorPicks', limit] });
      }

      // 3. 포스트 목록 캐시도 업데이트 (댓글 옆 아이콘 업데이트용)
      queryClient.setQueriesData(
        {
          queryKey: ['posts', 'list'],
          exact: false
        },
        (oldData: any) => {
          if (!oldData || !oldData.posts) return oldData;

          return {
            ...oldData,
            posts: oldData.posts.map((p: any) =>
              p.id === post.id ? { ...p, isEditorPick: post.isEditorPick } : p
            )
          };
        }
      );

      // 성공 메시지 표시 (중복 방지를 위해 ID 사용)
      const isAdded = post.isEditorPick;
      const message = isAdded
        ? '게시글을 Editor\'s Pick에 추가했습니다.'
        : '게시글을 Editor\'s Pick에서 제거했습니다.';

      const toastId = `editor-pick-${postId}`;
      toast.success(message, {
        id: toastId,  // 고유 ID로 중복 토스트 방지
        duration: 3000,
        position: 'bottom-right',
      });

      // 성공 콜백 실행
      if (onSuccess) {
        onSuccess();
      }
    }
  }, [mutation.isSuccess, mutation.data, postId, queryClient, onSuccess]);

  // 에러 처리
  React.useEffect(() => {
    if (mutation.isError && mutation.error) {
      const error = mutation.error as Error;

      // 에러 메시지 표시 (중복 방지를 위해 ID 사용)
      const toastId = `editor-pick-error-${postId}`;
      toast.error(error.message || 'Editor\'s Pick 변경에 실패했습니다.', {
        id: toastId,  // 고유 ID로 중복 토스트 방지
        duration: 3000,
        position: 'bottom-right',
      });
    }
  }, [mutation.isError, mutation.error, postId]);

  return mutation;
}
