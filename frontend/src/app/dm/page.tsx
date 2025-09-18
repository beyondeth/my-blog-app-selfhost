'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { useDMStore } from '@/stores/dmStore';
import DMLayout from '@/components/dm/DMLayout/DMLayout';
import DMErrorBoundary from '@/components/dm/DMErrorBoundary';

export default function DMPage() {
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