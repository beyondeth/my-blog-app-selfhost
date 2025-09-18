'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function DMConversationPage() {
  const router = useRouter();
  const params = useParams();
  const conversationId = params.conversationId as string;

  // Redirect to new DM page with conversation ID as query param
  useEffect(() => {
    router.replace(`/dm?conversation=${conversationId}`);
  }, [conversationId, router]);

  return null;
}