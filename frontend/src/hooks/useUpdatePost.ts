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
      // 목록 invalidate
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      // 상세 페이지로 이동
      router.push(`/posts/${updatedPost.slug || updatedPost.id}`);
    },
  });
} 