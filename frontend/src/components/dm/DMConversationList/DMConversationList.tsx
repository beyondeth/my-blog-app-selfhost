'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useDMStore } from '@/stores/dmStore';
import { useConversationList } from '@/hooks/useConversationList';
import ConversationItem from './ConversationItem';
import ConversationSearch from './ConversationSearch';
import { Avatar } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { useWindowSize } from '@/hooks/useWindowSize';

const DMConversationList: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const { isMobile } = useWindowSize();
  const {
    activeConversationId,
    setActiveConversation,
    conversationFilter,
    setShowUnreadOnly,
    conversationListVersion,
    setDMModalOpen,
  } = useDMStore();

  const {
    filteredConversations,
    isLoading,
    error,
    hasMore,
    loadMore,
    refreshConversations,
  } = useConversationList();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 모바일 헤더용 나가기 핸들러
  const handleExit = useCallback(() => {
    setDMModalOpen(false);
    router.push('/');
  }, [router, setDMModalOpen]);

  // Handle conversation selection
  const handleConversationClick = useCallback((conversationId: string) => {
    setActiveConversation(conversationId);
  }, [setActiveConversation]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshConversations();
    setIsRefreshing(false);
  }, [refreshConversations]);

  // Periodically refresh conversations to sync unreadCount with backend
  // This ensures the lastReadAt-based unreadCount is accurate
  useEffect(() => {
    const interval = setInterval(() => {
      refreshConversations();
    }, 10000); // Refresh every 10 seconds (reduced from 30 seconds for better accuracy)

    return () => clearInterval(interval);
  }, [refreshConversations]);

  // Handle scroll for infinite loading
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !hasMore || isLoading) return;

    const container = scrollContainerRef.current;
    const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;

    if (scrollBottom < 100) {
      loadMore();
    }
  }, [hasMore, isLoading, loadMore]);

  // Add scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Refresh conversations when version changes
  useEffect(() => {
    if (conversationListVersion > 0) {
      refreshConversations();
    }
  }, [conversationListVersion, refreshConversations]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Messages</h2>

          {/* 모바일 전용: 프로필 이미지 + 나가기 버튼 */}
          <div className="flex items-center gap-2 md:hidden">
            <Avatar
              src={user?.profileImage}
              fallback={user?.username?.[0]?.toUpperCase() || '?'}
              size="sm"
              className="cursor-pointer ring-2 ring-gray-300 hover:ring-gray-400 transition-all"
              onClick={() => router.push('/settings')}
            />
            <button
              onClick={handleExit}
              className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium"
              aria-label="Exit messages"
            >
              Exit
            </button>
          </div>

          {/* 데스크톱 전용: 새로고침 버튼 */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 hidden md:block"
            aria-label="Refresh conversations"
          >
            <RefreshCw
              className={`w-5 h-5 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        {/* Search */}
        <ConversationSearch />

        {/* Filter Options */}
        <div className="flex items-center gap-2 mt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={conversationFilter.showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Unread only</span>
          </label>
        </div>
      </div>

      {/* Conversation List */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto bg-white"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#CBD5E0 #F7FAFC',
          overscrollBehavior: 'contain', // 스크롤이 뒷배경에 전파되지 않도록 독립성 보장
        }}
      >
        {isLoading && filteredConversations.length === 0 ? (
          // Loading skeleton
          <div className="space-y-2 p-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 animate-pulse"
              >
                <div className="w-12 h-12 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          // Error state
          <div className="text-center p-4 sm:p-8">
            <p className="text-sm sm:text-base text-red-500 mb-2">Something went wrong</p>
            <p className="text-sm text-gray-500">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-3 sm:mt-4 px-4 py-2 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try again
            </button>
          </div>
        ) : filteredConversations.length === 0 ? (
          // Empty state
          <div className="text-center p-4 sm:p-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Search className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
            </div>
            <p className="text-sm sm:text-base text-gray-500">
              {conversationFilter.searchQuery
                ? 'No search results'
                : 'No conversations yet'}
            </p>
            <p className="text-sm text-gray-400 mt-2 break-keep">
              Start a conversation from someone&apos;s profile.
            </p>
          </div>
        ) : (
          // Conversation items
          <div className="bg-white">
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                currentUserId={user?.id || ''}
                isActive={activeConversationId === conversation.id}
                onClick={handleConversationClick}
              />
            ))}

            {/* Load more indicator */}
            {hasMore && (
              <div className="text-center py-4">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {isLoading ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DMConversationList;
