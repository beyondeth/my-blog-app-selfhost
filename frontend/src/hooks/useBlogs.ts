import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBlogBySlug, getMyBlogs, createBlog, updateBlog, deleteBlog } from '@/lib/api';
import { toast } from 'sonner';

// Get blog by slug
export function useBlogBySlug(slug: string) {
  return useQuery({
    queryKey: ['blog', slug],
    queryFn: () => getBlogBySlug(slug),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,       // 5분간 캐싱 (블로그 정보는 자주 변경되지 않음)
    gcTime: 10 * 60 * 1000,          // 10분간 메모리 보관
    refetchOnMount: false,           // 마운트 시 재요청 안함 (성능 최적화)
    refetchOnWindowFocus: false,     // 포커스 시 재요청 안함
  });
}

// Get user's blogs
export function useMyBlogs() {
  return useQuery({
    queryKey: ['my-blogs'],
    queryFn: getMyBlogs,
    staleTime: 5 * 60 * 1000,       // 5분간 캐싱 (블로그 정보는 자주 변경되지 않음)
    gcTime: 10 * 60 * 1000,          // 10분간 메모리 보관
    refetchOnMount: false,           // 마운트 시 재요청 안함 (성능 최적화)
    refetchOnWindowFocus: false,     // 포커스 시 재요청 안함
  });
}

// Create blog
export function useCreateBlog() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createBlog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-blogs'] });
      toast.success('블로그가 생성되었습니다.');
    },
    onError: (error: any) => {
      toast.error(error.message || '블로그 생성에 실패했습니다.');
    },
  });
}

// Update blog
export function useUpdateBlog() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateBlog(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['blog'] });
      queryClient.invalidateQueries({ queryKey: ['my-blogs'] });
      toast.success('블로그가 수정되었습니다.');
    },
    onError: (error: any) => {
      toast.error(error.message || '블로그 수정에 실패했습니다.');
    },
  });
}

// Delete blog
export function useDeleteBlog() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteBlog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-blogs'] });
      toast.success('블로그가 삭제되었습니다.');
    },
    onError: (error: any) => {
      toast.error(error.message || '블로그 삭제에 실패했습니다.');
    },
  });
}