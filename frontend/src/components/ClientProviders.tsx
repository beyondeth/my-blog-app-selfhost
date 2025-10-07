'use client';

import { QueryClientProvider } from '@tanstack/react-query';
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
    </QueryClientProvider>
  );
} 