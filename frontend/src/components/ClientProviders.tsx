'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { AuthProviderV2 } from '@/providers/AuthProviderV2';
import { MigrationProvider } from '@/providers/MigrationProvider';
import ConsentGuard from '@/components/auth/ConsentGuard';
import { createQueryClient } from '@/utils/queryHelpers';
import { initMixpanel } from '@/lib/mixpanel';

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  // QueryClient 인스턴스 생성 (컴포넌트 당 하나의 인스턴스)
  const [queryClient] = useState(() => createQueryClient());

  useEffect(() => {
    // Mixpanel 초기화 (비동기)
    initMixpanel().catch(error => {
      console.error('[ClientProviders] Failed to initialize Mixpanel:', error);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <MigrationProvider>
        <AuthProviderV2>
          <ConsentGuard>
            {children}
          </ConsentGuard>
        </AuthProviderV2>
      </MigrationProvider>
    </QueryClientProvider>
  );
} 