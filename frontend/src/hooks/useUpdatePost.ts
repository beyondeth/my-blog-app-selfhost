import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postsAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { postQueryKeys } from './usePosts';

export function useUpdatePost() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => postsAPI.updatePost(id, data),
    onMutate: async (variables) => {
      // 낙관적 업데이트를 위해 현재 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ['posts'] });

      // 썸네일 변경 감지 로그
      if (variables.data && (variables.data.thumbnailImageId || variables.data.thumbnail)) {
        console.log('🎯 [Optimistic Update] Thumbnail change detected', variables.data);
      }

      // Return context for potential rollback
      return { variables };
    },
    onSuccess: (updatedPost, variables) => {
      // 1. 즉시 최신 데이터로 캐시 업데이트
      queryClient.setQueryData(['posts', 'detail', updatedPost.slug], updatedPost);
      queryClient.setQueryData(['posts', 'detail', updatedPost.id], updatedPost);

      // 2. 모든 상세 페이지 쿼리 즉시 무효화 (강제로 fresh 데이터 가져오기)
      queryClient.invalidateQueries({ queryKey: ['posts', 'detail'] });

      // 3. 목록 쿼리 즉시 refetch (active 쿼리만 - 현재 보고 있는 화면)
      queryClient.refetchQueries({ queryKey: ['posts'], type: 'active' });

      // 4. 썸네일 변경 감지 시 홈페이지 캐시 즉시 무효화
      // thumbnailImageId 또는 thumbnail 필드가 있으면 썸네일 변경으로 간주
      const hasThumbnailChange = variables.data && (
        'thumbnailImageId' in variables.data ||
        'thumbnail' in variables.data ||
        variables.data.thumbnailImageId !== undefined ||
        variables.data.thumbnail !== undefined
      );

      if (hasThumbnailChange) {
        console.log('🎯 [Frontend] Thumbnail change detected, invalidating homepage cache');
        console.log('  Mutation variables:', variables.data);
        console.log('  Updated post thumbnail:', updatedPost.thumbnail);
        console.log('  Updated post thumbnailImageId:', (updatedPost as any).thumbnailImageId);

        // 홈페이지 캐시 강제 리프레치 (invalidate + refetch)
        queryClient.invalidateQueries({
          queryKey: postQueryKeys.list({ sort: 'homepage' }),
          refetchType: 'active'
        });

        // 즉시 refetch 추가 (staleTime 무시)
        queryClient.refetchQueries({
          queryKey: postQueryKeys.list({ sort: 'homepage' }),
          type: 'active'
        });

        // 홈페이지의 기본 쿼리 키도 리프레치
        queryClient.invalidateQueries({
          queryKey: postQueryKeys.list({ sort: 'recent' }),
          refetchType: 'active'
        });
        queryClient.refetchQueries({
          queryKey: postQueryKeys.list({ sort: 'recent' }),
          type: 'active'
        });

        // 모든 포스트 목록 쿼리 리프레치
        queryClient.refetchQueries({
          queryKey: postQueryKeys.lists(),
          type: 'active'
        });
      }

      // 5. 블로그 관련 캐시도 무효화
      if (updatedPost.blog?.slug) {
        queryClient.invalidateQueries({ queryKey: ['blog', updatedPost.blog.slug] });
        queryClient.invalidateQueries({ queryKey: ['posts', 'list', { blogSlug: updatedPost.blog.slug }] });
      }

      // 6. Editor's Pick인 경우 즉시 홈 피드 반영
      if (updatedPost.isEditorPick) {
        queryClient.invalidateQueries({ queryKey: ['editorPicks'] });
        queryClient.refetchQueries({ queryKey: ['editorPicks'], type: 'active' });
      }

      // 7. 상태에 따른 리다이렉트
      if (!updatedPost.isPublished) {
        // 초안 상태이면 초안 목록으로 이동
        router.push('/drafts');
      } else if (updatedPost.blog?.slug) {
        // 발행 상태이면 상세 페이지로 이동 (새 URL 구조)
        router.push(`/${updatedPost.blog.slug}/${updatedPost.slug || updatedPost.id}`);
      } else {
        // blog 없으면 홈으로 (발생 안 함)
        router.push('/');
      }
    },
  });
} 
