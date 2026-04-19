'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProviderV2 } from '@/providers/AuthProviderV2';
import { MigrationProvider } from '@/providers/MigrationProvider';
import ConsentGuard from '@/components/auth/ConsentGuard';
import { createQueryClient } from '@/utils/queryHelpers';
import { CookieConsentProvider } from '@/providers/CookieConsentProvider';
import { AnalyticsBootstrap } from '@/components/analytics/AnalyticsBootstrap';

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  // QueryClient 인스턴스 생성 (컴포넌트 당 하나의 인스턴스)
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <CookieConsentProvider>
        <AnalyticsBootstrap />
        <MigrationProvider>
          <AuthProviderV2>
            <ConsentGuard>
              {children}
            </ConsentGuard>
          </AuthProviderV2>
        </MigrationProvider>
      </CookieConsentProvider>
    </QueryClientProvider>
  );
} 
