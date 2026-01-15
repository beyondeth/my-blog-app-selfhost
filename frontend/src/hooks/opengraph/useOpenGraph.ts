'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchOpenGraph, OpenGraphData } from '@/services/api/opengraph.service';

/**
 * Open Graph Query Key
 */
export const openGraphQueryKeys = {
  all: ['opengraph'] as const,
  url: (url: string) => [...openGraphQueryKeys.all, url] as const,
};

/**
 * useOpenGraph 옵션
 */
interface UseOpenGraphOptions {
  /** 훅 활성화 여부 */
  enabled?: boolean;
}

/**
 * Open Graph 메타데이터 조회 훅
 *
 * @description
 * URL에서 Open Graph 메타데이터를 조회합니다.
 * React Query를 사용하여 캐싱 및 재시도 로직을 처리합니다.
 *
 * @param url 메타데이터를 조회할 URL
 * @param options 훅 옵션
 * @returns Open Graph 메타데이터 및 로딩/에러 상태
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useOpenGraph(
 *   'https://github.com/user/repo',
 *   { enabled: true }
 * );
 *
 * if (isLoading) return <Skeleton />;
 * if (error || !data?.success) return <FallbackCard />;
 *
 * return <LinkCard data={data} />;
 * ```
 */
export function useOpenGraph(
  url: string | null | undefined,
  options: UseOpenGraphOptions = {},
) {
  const { enabled = true } = options;

  return useQuery<OpenGraphData>({
    queryKey: openGraphQueryKeys.url(url || ''),
    queryFn: () => fetchOpenGraph(url!),
    enabled: enabled && !!url && url.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // 24시간 캐시
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7일 유지
    retry: 1, // 1회 재시도
    refetchOnWindowFocus: false,
  });
}

export { type OpenGraphData } from '@/services/api/opengraph.service';
