'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { useDMStore } from '@/stores/dmStore';
import DMLayout from '@/components/dm/DMLayout/DMLayout';
import DMErrorBoundary from '@/components/dm/DMErrorBoundary';

/**
 * DM 페이지 메인 컴포넌트
 * useSearchParams를 사용하므로 Suspense로 감싸야 함
 */
function DMPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setActiveConversation } = useDMStore();

  // Handle conversation ID from URL params
  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId) {
      setActiveConversation(conversationId);
    }
  }, [searchParams, setActiveConversation]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <DMErrorBoundary
      onError={(error, errorInfo) => {
        // Log to external service in production
        console.error('DM Page Error:', error, errorInfo);
      }}
    >
      <DMLayout />
    </DMErrorBoundary>
  );
}

/**
 * DM 페이지 (Suspense 래퍼)
 */
export default function DMPage() {
  return (
    <Suspense fallback={null}>
      <DMPageContent />
    </Suspense>
  );
}