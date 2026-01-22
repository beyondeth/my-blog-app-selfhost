import { useQuery, useMutation, useQueryClient, useInfiniteQuery, InfiniteData } from '@tanstack/react-query';
import { getBlogBySlug, getMyBlogs, createBlog, updateBlog, deleteBlog, checkAlias, updateAlias } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProviderV2';

// Get blog by slug
export function useBlogBySlug(slug: string, options?: { initialData?: any }) {
  const queryClient = useQueryClient();
  const { user } = useAuth(); // AuthProvider에서 사용자 정보 가져오기

  // 캐시 키 정규화 - @ 제거
  const normalizedSlug = slug.replace('@', '');

  return useQuery({
    queryKey: ['blog', normalizedSlug, user?.id || 'anonymous'], // 사용자 ID로 캐시 구분
    queryFn: async () => {
      const blog = await getBlogBySlug(slug);
      return blog;
    },
    enabled: !!slug,
    initialData: options?.initialData,
    // 캐싱 최적화: 페이지 이동 시 불필요한 API 호출 방지
    // 블로그 정보 변경 시에는 invalidateQueries로 명시적 갱신
    staleTime: 10 * 60 * 1000,       // 10분간 fresh 유지 (탭 전환 시 캐시 사용)
    gcTime: 10 * 60 * 1000,          // 10분간 메모리 보관
    refetchOnMount: true,            // stale일 때만 마운트 시 재페칭
    refetchOnWindowFocus: false,     // 포커스 시 재요청 안함 (수동 갱신)
  });
}

// Get user's blog (단일 블로그 반환)
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
export interface BlogCategoriesPage {
  items: Array<{ category: string; count: number }>;
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
}

const BLOG_CATEGORIES_PAGE_SIZE = 20;

async function fetchBlogCategoriesPage(blogSlug: string, cursor?: string): Promise<BlogCategoriesPage> {
  const params = new URLSearchParams();
  params.set('limit', BLOG_CATEGORIES_PAGE_SIZE.toString());
  if (cursor) {
    params.set('cursor', cursor);
  }

  const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/blogs/slug/${blogSlug}/categories?${params.toString()}`;
  console.log('📡 [CATEGORIES API] Fetching from:', url);

  const response = await fetch(url, {
    credentials: 'include',
  });

  console.log('📡 [CATEGORIES API] Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('📡 [CATEGORIES API] Error response:', errorText);
    throw new Error(`Failed to fetch blog categories: ${response.status}`);
  }

  const data = await response.json();
  console.log('📡 [CATEGORIES API] Response data:', data);

  return data;
}

export function useBlogCategories(blogSlug: string, options?: { enabled?: boolean }) {
  // 캐시 키 정규화 - @ 제거
  const normalizedSlug = blogSlug.replace('@', '');

  return useInfiniteQuery<
    BlogCategoriesPage,
    Error,
    InfiniteData<BlogCategoriesPage, string | undefined>,
    string[],
    string | undefined
  >({
    queryKey: ['blog-categories', normalizedSlug],
    queryFn: ({ pageParam }) => fetchBlogCategoriesPage(blogSlug, pageParam),
    getNextPageParam: (lastPage) => {
      if (lastPage?.hasMore && lastPage.nextCursor) {
        return lastPage.nextCursor;
      }
      return undefined;
    },
    initialPageParam: undefined,
    enabled: options?.enabled !== false && !!blogSlug, // enabled 옵션 추가
    staleTime: 5 * 60 * 1000, // 5분간 캐시
    gcTime: 10 * 60 * 1000, // 10분간 가비지 컬렉션 방지
  });
}

/**
 * Alias 사용 가능 여부 확인 훅 (체크포인트 2)
 *
 * @description
 * Settings에서 사용자가 alias를 변경하기 전에 중복 여부를 확인합니다.
 * - 형식 검증: 3~30자, 영문/숫자/하이픈/언더스코어
 * - 예약어 체크 (admin, api, auth 등 23개)
 * - 현재 사용 중인 alias 중복 확인
 * - old_aliases 재사용 방지
 *
 * @param alias - 확인할 alias (@ 없이)
 * @param enabled - 쿼리 활성화 여부 (debounce 처리용)
 * @returns { available: boolean } 또는 에러
 *
 * @example
 * const { data, isLoading, error } = useCheckAlias('park', enabled);
 * // data = { available: true }
 */
export function useCheckAlias(alias: string, enabled: boolean = true) {
  return useQuery<{ available: boolean }>({
    queryKey: ['check-alias', alias],
    queryFn: () => checkAlias(alias),
    enabled: enabled && !!alias && alias.length >= 3, // 3자 이상일 때만 확인
    staleTime: 10 * 1000, // 10초 캐싱
    gcTime: 60 * 1000, // 1분간 메모리 보관
    retry: false, // 중복 확인은 재시도 불필요
    placeholderData: (previousData) => previousData, // v5에서 keepPreviousData 대체
  });
}

/**
 * Alias 변경 훅 (체크포인트 2)
 *
 * @description
 * Settings에서 사용자의 블로그 alias를 변경합니다.
 * - 본인 블로그만 변경 가능 (JWT 인증)
 * - 기존 alias는 old_aliases 테이블로 이동 (SEO 보호)
 * - Redis 캐시 무효화
 * - 성공 시 블로그 쿼리 캐시 갱신
 *
 * @returns useMutation 객체 (mutate, isLoading, error)
 *
 * @example
 * const { mutate: changeAlias, isLoading } = useUpdateAlias();
 * changeAlias('newname');
 * // 성공 시: 블로그 캐시 갱신, 토스트 표시
 * // 실패 시: 에러 토스트 (중복, 예약어 등)
 */
export function useUpdateAlias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alias: string) => updateAlias(alias),
    onMutate: async (newAlias) => {
      // 낙관적 업데이트를 위해 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ['blog'] });
      await queryClient.cancelQueries({ queryKey: ['my-blogs'] });

      // 이전 데이터 저장
      const previousBlogs = queryClient.getQueriesData({ queryKey: ['blog'] });
      const previousMyBlogs = queryClient.getQueriesData({ queryKey: ['my-blogs'] });

      return { previousBlogs, previousMyBlogs };
    },
    onSuccess: (updatedBlog) => {
      // 모든 관련 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['blog'] });
      queryClient.invalidateQueries({ queryKey: ['my-blogs'] });

      // 추가: 특정 쿼리들도 무효화
      queryClient.invalidateQueries({ queryKey: ['check-alias'] });
      queryClient.removeQueries({ queryKey: ['blog'] });
      queryClient.removeQueries({ queryKey: ['my-blogs'] });

      // 브라우저 URL 업데이트를 위한 리프레시
      if (typeof window !== 'undefined') {
        window.location.reload(); // 강제 새로고침으로 서버 상태와 동기화
      }

      // 성공 메시지
      toast.success(`블로그 주소가 @${updatedBlog.alias}로 변경되었습니다.`);
    },
    onError: (error: any, variables, context) => {
      // 에러 발생 시 이전 데이터 복원
      if (context?.previousBlogs) {
        context.previousBlogs.forEach(([queryKey, queryData]) => {
          queryClient.setQueryData(queryKey, queryData);
        });
      }
      if (context?.previousMyBlogs) {
        context.previousMyBlogs.forEach(([queryKey, queryData]) => {
          queryClient.setQueryData(queryKey, queryData);
        });
      }

      // 에러 메시지 (백엔드에서 ConflictException 등)
      const errorMessage = error.message || 'Alias 변경에 실패했습니다.';
      toast.error(errorMessage);
    },
  });
}
