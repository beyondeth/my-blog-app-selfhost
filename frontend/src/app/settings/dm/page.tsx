'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { useChat } from '@/hooks/useChat';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FiMessageSquare,
  FiUserX,
  FiTrash2,
  FiRefreshCw,
  FiAlertCircle,
  FiMessageCircle,
  FiUnlock,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

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
  const fetchBlockedUsers = async () => {
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
  };

  // 차단 해제
  const handleUnblock = async (userId: string) => {
    if (!confirm('정말로 이 사용자의 차단을 해제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/chat/unblock/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('차단이 해제되었습니다.');
        setBlockedUsers(prev => prev.filter(b => b.blockedUserId !== userId));
      } else {
        toast.error('차단 해제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to unblock user:', error);
      toast.error('차단 해제에 실패했습니다.');
    }
  };

  // 대화 삭제
  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm('이 대화를 삭제하시겠습니까? 메시지는 상대방에게는 계속 보입니다.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/chat/conversation/${conversationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('대화가 삭제되었습니다.');
        await fetchConversations();
      } else {
        toast.error('대화 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast.error('대화 삭제에 실패했습니다.');
    }
  };

  // 새로고침
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchBlockedUsers(), fetchConversations()]);
    setRefreshing(false);
    toast.success('새로고침되었습니다.');
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FiMessageSquare className="h-6 w-6" />
          DM 관리
        </h1>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          size="sm"
        >
          <FiRefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      <Tabs defaultValue="conversations" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="conversations">대화 목록</TabsTrigger>
          <TabsTrigger value="blocked">차단 목록</TabsTrigger>
        </TabsList>

        {/* 대화 목록 탭 */}
        <TabsContent value="conversations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">진행 중인 대화</CardTitle>
            </CardHeader>
            <CardContent>
              {conversations.length === 0 ? (
                <div className="text-center py-8">
                  <FiMessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">진행 중인 대화가 없습니다.</p>
                  <p className="text-sm text-gray-400 mt-2">
                    다른 사용자의 프로필에서 메시지 버튼을 눌러 대화를 시작하세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conversations.map((conversation) => {
                    const otherUser = conversation.user1Id === user?.id
                      ? conversation.user2
                      : conversation.user1;

                    return (
                      <div
                        key={conversation.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
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
                            <p className="font-medium">{otherUser?.username || 'Unknown User'}</p>
                            {conversation.lastMessageAt && (
                              <p className="text-sm text-gray-500">
                                마지막 메시지: {formatDistanceToNow(new Date(conversation.lastMessageAt), {
                                  addSuffix: true,
                                  locale: ko
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
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 차단 목록 탭 */}
        <TabsContent value="blocked" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">차단한 사용자</CardTitle>
            </CardHeader>
            <CardContent>
              {blockedUsers.length === 0 ? (
                <div className="text-center py-8">
                  <FiUserX className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">차단한 사용자가 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {blockedUsers.map((blocked) => (
                    <div
                      key={blocked.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={blocked.blockedUser.profileImage}
                          fallback={blocked.blockedUser.username?.[0]?.toUpperCase() || '?'}
                          alt={blocked.blockedUser.username}
                          size="md"
                        />
                        <div>
                          <p className="font-medium">{blocked.blockedUser.username}</p>
                          <p className="text-sm text-gray-500">
                            차단일: {formatDistanceToNow(new Date(blocked.createdAt), {
                              addSuffix: true,
                              locale: ko
                            })}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleUnblock(blocked.blockedUserId)}
                        variant="outline"
                        size="sm"
                      >
                        <FiUnlock className="h-4 w-4 mr-2" />
                        차단 해제
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <FiAlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">차단 기능 안내</p>
                  <ul className="list-disc list-inside space-y-1 text-yellow-700">
                    <li>차단된 사용자는 당신에게 메시지를 보낼 수 없습니다.</li>
                    <li>차단된 사용자와의 기존 대화는 자동으로 숨겨집니다.</li>
                    <li>차단을 해제하면 이전 대화를 다시 볼 수 있습니다.</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}