'use client';

import { useParams } from 'next/navigation';
import { DMChat } from '@/components/dm/DMChat';

export default function DMConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;

  return <DMChat conversationId={conversationId} />;
}