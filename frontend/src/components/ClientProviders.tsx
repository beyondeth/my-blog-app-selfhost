'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { AuthProviderV2 } from '@/providers/AuthProviderV2';
import { MigrationProvider } from '@/providers/MigrationProvider';
import { createQueryClient } from '@/utils/queryHelpers';

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  // QueryClient 인스턴스 생성 (컴포넌트 당 하나의 인스턴스)
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <MigrationProvider>
        <AuthProviderV2>
          {children}
        </AuthProviderV2>
      </MigrationProvider>
      {/* 개발 환경에서만 React Query DevTools 표시 */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
} 