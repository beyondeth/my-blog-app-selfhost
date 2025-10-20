import { z } from 'zod';

// 라우트 정의
export const routes = {
  home: () => '/',
  posts: (params?: { slug?: string }) =>
    params?.slug ? `/posts/${params.slug}` : '/posts',
  postsEdit: (slug: string) => `/posts/edit/${slug}`,
  login: () => '/login',
  register: () => '/register',
  categories: () => '/categories',
  about: () => '/about',
  dm: () => '/dm',
} as const;

// 검색 파라미터 스키마
export const homeSearchSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
}).default({});

export type HomeSearchParams = z.infer<typeof homeSearchSchema>;

// 네비게이션 헬퍼
export const navigation = {
  // 홈으로 이동 (캐시 유지)
  toHome: () => routes.home(),

  // 포스트 상세로 이동
  toPost: (slug: string) => routes.posts({ slug }),

  // 포스트 편집으로 이동
  toPostEdit: (slug: string) => routes.postsEdit(slug),
} as const;

// URL 파라미터 파싱 헬퍼 (타입 안전)
export const parseSearchParams = (searchParams: unknown): HomeSearchParams => {
  const urlParams = new URLSearchParams(searchParams as string);
  const params = {
    search: urlParams.get('search') || undefined,
    page: urlParams.get('page') ? parseInt(urlParams.get('page')!) : 1,
  };
  
  return homeSearchSchema.parse(params);
};

// 브라우저 히스토리 관리를 위한 헬퍼
export const createSearchUrl = (params: HomeSearchParams): string => {
  const url = new URL(routes.home(), window.location.origin);
  
  if (params.search) {
    url.searchParams.set('search', params.search);
  }
  
  if (params.page && params.page > 1) {
    url.searchParams.set('page', params.page.toString());
  }
  
  return url.pathname + url.search;
}; 