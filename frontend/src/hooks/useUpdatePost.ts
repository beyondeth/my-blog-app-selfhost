import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postsAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';

export function useUpdatePost() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => postsAPI.updatePost(id, data),
    onSuccess: (updatedPost) => {
      // 최신 데이터로 캐시 동기화
      queryClient.setQueryData(['posts', 'detail', updatedPost.slug], updatedPost);
      queryClient.setQueryData(['posts', 'detail', updatedPost.id], updatedPost);
      // 상세 페이지 강제 refetch (이중 안전망)
      queryClient.invalidateQueries({ queryKey: ['posts', 'detail', updatedPost.slug] });
      // 목록 즉시 refetch (active 쿼리만 - 현재 보고 있는 화면)
      queryClient.refetchQueries({ queryKey: ['posts'], type: 'active' });
      // 상세 페이지로 이동 (새 URL 구조)
      if (updatedPost.blog?.slug) {
        router.push(`/${updatedPost.blog.slug}/${updatedPost.slug || updatedPost.id}`);
      } else {
        // blog 없으면 홈으로 (발생 안 함)
        router.push('/');
      }
    },
  });
} 