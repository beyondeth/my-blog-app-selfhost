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

/**
 * 블로그의 카테고리별 포스트 개수 조회 훅
 *
 * @description
 * 특정 블로그의 카테고리별 포스트 개수를 가져옵니다.
 * 내 블로그 페이지에서 카테고리별 현황을 표시하는 데 사용됩니다.
 *
 * @param blogSlug - 블로그 슬러그
 * @returns 카테고리별 포스트 개수 (내림차순)
 */
export function useBlogCategories(blogSlug: string) {
  return useQuery({
    queryKey: ['blog-categories', blogSlug],
    queryFn: async (): Promise<Array<{ category: string; count: number }>> => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/blogs/slug/${blogSlug}/categories`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch blog categories');
      }
      return response.json();
    },
    enabled: !!blogSlug,
    staleTime: 5 * 60 * 1000, // 5분간 캐시
    gcTime: 10 * 60 * 1000, // 10분간 가비지 컬렉션 방지
  });
}