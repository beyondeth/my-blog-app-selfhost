'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { canAccessSubscriptionUi } from '@/lib/subscription-access';
import { useAuth } from '@/providers/AuthProviderV2';

interface SubscriptionUiGuardOptions {
  authenticatedRedirectTo?: string;
  unauthenticatedRedirectTo?: string;
}

export function useSubscriptionUiGuard(options: SubscriptionUiGuardOptions = {}) {
  const router = useRouter();
  const { user, authStatus, isAdmin } = useAuth();
  const canAccess = canAccessSubscriptionUi(isAdmin);

  useEffect(() => {
    if (authStatus === 'loading' || canAccess) {
      return;
    }

    router.replace(
      user
        ? options.authenticatedRedirectTo ?? '/'
        : options.unauthenticatedRedirectTo ?? '/'
    );
  }, [
    authStatus,
    canAccess,
    options.authenticatedRedirectTo,
    options.unauthenticatedRedirectTo,
    router,
    user,
  ]);

  return {
    user,
    authStatus,
    isAdmin,
    canAccess,
    isRedirecting: authStatus === 'loading' || !canAccess,
  };
}
