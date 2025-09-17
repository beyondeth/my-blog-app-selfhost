'use client';

import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChat } from '@/hooks/useChat';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

interface DMButtonProps {
  userId: string;
  username?: string;
  size?: 'sm' | 'default' | 'lg';
}

export function DMButton({ userId, username, size = 'default' }: DMButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { getOrCreateConversation } = useChat();
  const [loading, setLoading] = useState(false);

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
        router.push(`/dm/${conversation.id}`);
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