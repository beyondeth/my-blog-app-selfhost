/**
 * React Query 클라이언트 설정
 * @description QueryClient 인스턴스 생성 및 설정 관리
 * SSR/SSG 지원 및 캐시 영속성 설정 포함
 */

import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

/**
 * 글로벌 QueryClient 인스턴스
 * @description 클라이언트 사이드에서만 싱글톤으로 관리
 */
let queryClient: QueryClient | undefined;

/**
 * QueryClient 기본 설정
 * @description 모든 쿼리와 뮤테이션에 적용되는 기본 옵션
 */
const defaultOptions = {
  queries: {
    /**
     * 데이터가 "신선한" 것으로 간주되는 시간 (5분)
     * 이 시간 동안은 동일한 쿼리 키로 재요청하지 않음
     */
    staleTime: 5 * 60 * 1000,

    /**
     * 가비지 컬렉션까지의 캐시 보관 시간 (10분)
     * 언마운트된 컴포넌트의 데이터도 이 시간 동안 보관
     */
    gcTime: 10 * 60 * 1000,

    /**
     * 윈도우 포커스 시 자동 재요청 비활성화
     * 불필요한 네트워크 요청 방지
     */
    refetchOnWindowFocus: false,

    /**
     * 네트워크 재연결 시 자동 재요청
     * 오프라인 후 온라인 전환 시 데이터 동기화
     */
    refetchOnReconnect: true,

    /**
     * 에러 시 재시도 횟수
     * 네트워크 불안정 상황 대응
     */
    retry: 1,

    /**
     * 재시도 지연 시간 계산
     * 지수 백오프 적용
     */
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  },

  mutations: {
    /**
     * 뮤테이션 재시도 횟수
     * POST/PUT/DELETE 요청은 신중하게 재시도
     */
    retry: 1,

    /**
     * 뮤테이션 재시도 지연 시간
     */
    retryDelay: 1000,
  },
};

/**
 * QueryClient 인스턴스 생성 또는 반환
 * @returns QueryClient 인스턴스
 *
 * @description
 * - 서버 사이드: 항상 새로운 인스턴스 생성 (메모리 누수 방지)
 * - 클라이언트 사이드: 싱글톤 패턴으로 하나의 인스턴스만 유지
 * - localStorage를 사용한 캐시 영속성 지원
 */
export function getQueryClient(): QueryClient {
  // 서버 사이드 렌더링 환경
  if (typeof window === 'undefined') {
    // SSR/SSG에서는 항상 새로운 인스턴스 생성
    // 각 요청마다 독립적인 캐시 유지
    return new QueryClient({ defaultOptions });
  }

  // 클라이언트 사이드 환경
  if (!queryClient) {
    // 싱글톤 인스턴스 생성
    queryClient = new QueryClient({ defaultOptions });

    // localStorage를 사용한 캐시 영속성 설정
    // 브라우저 새로고침 후에도 캐시 데이터 유지
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      try {
        const persister = createSyncStoragePersister({
          storage: window.localStorage,
          key: 'react-query-cache', // localStorage 키
        });

        persistQueryClient({
          queryClient,
          persister,
          maxAge: 1000 * 60 * 10, // 10분간 영속성 유지
          hydrateOptions: undefined,
          dehydrateOptions: {
            // 영속화할 쿼리 필터
            shouldDehydrateQuery: (query) => {
              // 기본적으로 성공한 쿼리만 영속화
              return query.state.status === 'success';
            },
          },
        });
      } catch (error) {
        // localStorage 접근 실패 시 (시크릿 모드 등)
        console.warn('QueryClient 캐시 영속성 설정 실패:', error);
      }
    }
  }

  return queryClient;
}

/**
 * QueryClient 초기화 (테스트 환경용)
 * @description 테스트 간 격리를 위해 QueryClient 리셋
 */
export function resetQueryClient(): void {
  if (queryClient) {
    queryClient.clear();
    queryClient = undefined;
  }
}

/**
 * 캐시 프리페칭 헬퍼
 * @param queryClient - QueryClient 인스턴스
 * @param queries - 프리페치할 쿼리 배열
 *
 * @example
 * ```typescript
 * // SSR/SSG에서 사용
 * const queryClient = getQueryClient();
 * await prefetchQueries(queryClient, [
 *   {
 *     queryKey: ['posts'],
 *     queryFn: fetchPosts,
 *   },
 *   {
 *     queryKey: ['user'],
 *     queryFn: fetchUser,
 *   },
 * ]);
 * ```
 */
export async function prefetchQueries(
  queryClient: QueryClient,
  queries: Array<{
    queryKey: readonly unknown[];
    queryFn: () => Promise<any>;
    staleTime?: number;
  }>
): Promise<void> {
  await Promise.allSettled(
    queries.map((query) =>
      queryClient.prefetchQuery({
        ...query,
        staleTime: query.staleTime || defaultOptions.queries.staleTime,
      })
    )
  );
}

/**
 * 캐시 무효화 헬퍼
 * @param patterns - 무효화할 쿼리 키 패턴 배열
 *
 * @example
 * ```typescript
 * // 여러 패턴을 한번에 무효화
 * invalidateQueries([
 *   ['posts'],
 *   ['user', userId],
 *   ['comments'],
 * ]);
 * ```
 */
export function invalidateQueries(patterns: readonly unknown[][]): void {
  const client = getQueryClient();

  patterns.forEach((pattern) => {
    client.invalidateQueries({ queryKey: pattern });
  });
}

/**
 * 캐시 제거 헬퍼
 * @param patterns - 제거할 쿼리 키 패턴 배열
 *
 * @example
 * ```typescript
 * // 로그아웃 시 사용자 관련 캐시 제거
 * removeQueries([
 *   ['auth'],
 *   ['user'],
 *   ['my-blogs'],
 * ]);
 * ```
 */
export function removeQueries(patterns: readonly unknown[][]): void {
  const client = getQueryClient();

  patterns.forEach((pattern) => {
    client.removeQueries({ queryKey: pattern });
  });
}