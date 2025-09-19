'use client';

import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChat } from '@/hooks/useChat';
import { useState } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useDMModal } from '@/hooks/useDMModal';
import { useQueryClient } from '@tanstack/react-query';
import { CHAT_QUERY_KEYS } from '@/hooks/chat/useChatsQuery';
import toast from 'react-hot-toast';

interface DMButtonProps {
  userId: string;
  username?: string;
  size?: 'sm' | 'default' | 'lg';
  mode?: 'modal' | 'page';
}

export function DMButton({ userId, username, size = 'default', mode }: DMButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { getOrCreateConversation } = useChat();
  const { openModal, mode: defaultMode } = useDMModal();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  // Use provided mode or default from store
  const viewMode = mode || defaultMode;

  const handleClick = async () => {
    if (!user) {
      toast.error('Please login to send messages');
      router.push('/login');
      return;
    }

    if (user.id === userId) {
      toast.error('Cannot send message to yourself');
      return;
    }

    try {
      setLoading(true);
      const conversation = await getOrCreateConversation(userId);
      if (conversation) {
        // Update React Query cache with the conversation data
        queryClient.setQueryData(
          CHAT_QUERY_KEYS.conversationById(conversation.id),
          conversation
        );

        // Also invalidate conversations list to ensure it's up to date
        queryClient.invalidateQueries({
          queryKey: CHAT_QUERY_KEYS.conversations()
        });

        if (viewMode === 'modal') {
          // Open as modal
          openModal(conversation.id);
        } else {
          // Navigate to DM page
          router.push(`/dm?conversation=${conversation.id}`);
        }
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Failed to start conversation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      size={size}
      variant="outline"
      className="flex items-center gap-1.5"
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {loading ? '...' : 'DM'}
    </Button>
  );
}