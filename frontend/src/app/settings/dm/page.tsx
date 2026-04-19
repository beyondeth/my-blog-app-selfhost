'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { useChat } from '@/hooks/useChat';
import { formatDistanceToNow } from 'date-fns';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FiUserX,
  FiTrash2,
  FiRefreshCw,
  FiAlertCircle,
  FiMessageCircle,
  FiUnlock,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
  SETTINGS_SUBTLE_BUTTON_CLASS,
} from '@/app/settings/theme';
import { DESTRUCTIVE_ACTION_CLASS } from '@/constants/accessibility';

interface BlockedUser {
  id: string;
  blockerId: string;
  blockedUserId: string;
  createdAt: string;
  blockedUser: {
    id: string;
    username: string;
    profileImage?: string;
    email: string;
  };
}

export default function DMSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { conversations, fetchConversations } = useChat();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  // 로그인 체크
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // 차단 목록 가져오기
  const fetchBlockedUsers = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/chat/blocked-users`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setBlockedUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch blocked users:', error);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  // 차단 해제
  const handleUnblock = async (userId: string) => {
    if (!confirm('Unblock this user?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/chat/unblock/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('User unblocked.');
        setBlockedUsers(prev => prev.filter(b => b.blockedUserId !== userId));
      } else {
        toast.error('Failed to unblock the user.');
      }
    } catch (error) {
      console.error('Failed to unblock user:', error);
      toast.error('Failed to unblock the user.');
    }
  };

  // 대화 삭제
  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm('Delete this conversation from your list? The other user will still keep their messages.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/chat/conversation/${conversationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Conversation deleted.');
        await fetchConversations();
      } else {
        toast.error('Failed to delete the conversation.');
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast.error('Failed to delete the conversation.');
    }
  };

  // 새로고침
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchBlockedUsers(), fetchConversations()]);
    setRefreshing(false);
    toast.success('Refreshed.');
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-[#2A2F3A] rounded w-48" />
          <div className={`${SETTINGS_CARD_CLASS} h-32`} />
          <div className={`${SETTINGS_CARD_CLASS} h-32`} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Chat</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">Manage direct messages and blocked users.</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`${SETTINGS_PRIMARY_BUTTON_CLASS} bg-gray-900 dark:bg-[#1F2229] hover:bg-gray-800 dark:hover:bg-[#272C36]`}
        >
          <FiRefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

        <div className={`${SETTINGS_CARD_CLASS} p-0 overflow-hidden`}>
          <Tabs defaultValue="conversations">
            <TabsList className="flex w-full border-b border-gray-100 dark:border-[#242833] bg-white dark:bg-[#141822] text-sm font-medium text-gray-500 dark:text-gray-300 dark:text-gray-300">
              <TabsTrigger
                value="conversations"
                className="flex-1 min-h-[48px] border-b-2 border-transparent rounded-none data-[state=active]:border-[#5850ec] dark:data-[state=active]:border-[#818cf8] data-[state=active]:text-gray-900 dark:data-[state=active]:text-white"
              >
                Conversations
              </TabsTrigger>
              <TabsTrigger
                value="blocked"
                className="flex-1 min-h-[48px] border-b-2 border-transparent rounded-none data-[state=active]:border-[#5850ec] dark:data-[state=active]:border-[#818cf8] data-[state=active]:text-gray-900 dark:data-[state=active]:text-white"
              >
                Blocked users
              </TabsTrigger>
            </TabsList>

            <div className="p-4 sm:p-6 space-y-6">
              <TabsContent value="conversations" className="space-y-4">
                {conversations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-300 dark:text-gray-300">
                    <FiMessageCircle className="h-12 w-12 text-gray-300 dark:text-gray-600 dark:text-gray-300 mx-auto mb-3" />
                    No conversations yet.
                    <p className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-300 mt-2">Start a conversation from another user's profile.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {conversations.map((conversation) => {
                      const otherUser = conversation.user1Id === user?.id ? conversation.user2 : conversation.user1;
                      return (
                        <div
                          key={conversation.id}
                          className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-3xl border border-gray-100 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)] dark:bg-[#161b27] dark:border-[#242a38] hover:border-gray-200 dark:hover:border-[#333a4d]"
                        >
                          <div
                            className="flex items-center gap-3 flex-1 cursor-pointer"
                            onClick={() => router.push(`/dm/${conversation.id}`)}
                          >
                            <Avatar
                              src={otherUser?.profileImage}
                              fallback={otherUser?.username?.[0]?.toUpperCase() || '?'}
                              alt={otherUser?.username || 'User'}
                              size="md"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 dark:text-gray-100">{otherUser?.username || 'Unknown User'}</p>
                              {conversation.lastMessageAt && (
                                <p className="text-xs text-gray-500 dark:text-gray-300 dark:text-gray-300">
                                  Last message:{' '}
                                  {formatDistanceToNow(new Date(conversation.lastMessageAt), {
                                    addSuffix: true,
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(conversation.id);
                            }}
                            variant="ghost"
                            size="sm"
                            className={`min-w-[44px] min-h-[44px] ${DESTRUCTIVE_ACTION_CLASS}`}
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="blocked" className="space-y-4">
                {blockedUsers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-300 dark:text-gray-300">
                    <FiUserX className="h-12 w-12 text-gray-300 dark:text-gray-600 dark:text-gray-300 mx-auto mb-3" />
                    You have not blocked anyone.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {blockedUsers.map((blocked) => (
                      <div
                        key={blocked.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-3xl border border-gray-100 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)] dark:bg-[#161b27] dark:border-[#242a38]"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={blocked.blockedUser.profileImage}
                            fallback={blocked.blockedUser.username?.[0]?.toUpperCase() || '?'}
                            alt={blocked.blockedUser.username}
                            size="md"
                          />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{blocked.blockedUser.username}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-300 dark:text-gray-300">
                              Blocked:{' '}
                              {formatDistanceToNow(new Date(blocked.createdAt), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                        <Button onClick={() => handleUnblock(blocked.blockedUserId)} className={SETTINGS_SUBTLE_BUTTON_CLASS} size="sm">
                          <FiUnlock className="h-4 w-4 mr-2" />
                          Unblock
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-start gap-3 p-4 rounded-3xl border border-gray-100 bg-gray-50 dark:bg-[#161b27] dark:border-[#242a38]">
                  <FiAlertCircle className="h-5 w-5 text-gray-600 dark:text-gray-300 dark:text-gray-300 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-700 dark:text-gray-200">
                    <p className="font-medium mb-1">How blocking works</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300 dark:text-gray-300">
                      <li>Blocked users cannot send you new messages.</li>
                      <li>If you unblock them, your previous conversation becomes visible again.</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
    </div>
  );
}
