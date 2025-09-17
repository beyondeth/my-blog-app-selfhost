'use client';

import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar } from '@/components/ui/avatar';

export default function DMListPage() {
  const { conversations, loading } = useChat();
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Messages</h1>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-gray-100 h-20 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Messages</h1>
          <div className="text-center py-12">
            <p className="text-gray-500">No conversations yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Start a conversation by clicking the message button on someone's profile
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Messages</h1>

        <div className="space-y-2">
          {conversations.map((conversation) => {
            const otherUser = conversation.user1Id === user?.id
              ? conversation.user2
              : conversation.user1;

            return (
              <div
                key={conversation.id}
                onClick={() => router.push(`/dm/${conversation.id}`)}
                className="flex items-center gap-4 p-4 bg-white rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <Avatar
                  src={otherUser?.profileImage}
                  fallback={otherUser?.username?.[0]?.toUpperCase() || '?'}
                  size="md"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold truncate">
                      {otherUser?.username || 'Unknown User'}
                    </p>
                    {conversation.lastMessageAt && (
                      <span className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}