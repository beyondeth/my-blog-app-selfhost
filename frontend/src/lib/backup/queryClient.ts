import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// 글로벌 QueryClient 인스턴스
let queryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // 서버 사이드에서는 항상 새로운 인스턴스 생성
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // 5분
          gcTime: 10 * 60 * 1000, // 10분
          refetchOnWindowFocus: false,
          retry: 1,
        },
        mutations: {
          retry: 1,
          retryDelay: 1000,
        },
      },
    });
  }

  // 클라이언트 사이드에서는 싱글톤 패턴 사용
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // 5분
          gcTime: 10 * 60 * 1000, // 10분
          refetchOnWindowFocus: false,
          retry: 1,
        },
        mutations: {
          retry: 1,
          retryDelay: 1000,
        },
      },
    });

    // persistQueryClient 적용 (클라이언트에서만)
    if (typeof window !== 'undefined') {
      const persister = createSyncStoragePersister({ storage: window.localStorage });
      persistQueryClient({
        queryClient,
        persister,
        maxAge: 1000 * 60 * 10, // 10분
      });
    }
  }

  return queryClient;
} 