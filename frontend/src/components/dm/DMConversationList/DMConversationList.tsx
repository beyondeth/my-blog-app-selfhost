'use client';

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useDMStore } from '@/stores/dmStore';
import { useConversationList } from '@/hooks/useConversationList';
import ConversationItem from './ConversationItem';
import ConversationSearch from './ConversationSearch';

const DMConversationList: React.FC = () => {
  const { user } = useAuth();
  const {
    activeConversationId,
    setActiveConversation,
    conversationFilter,
    setShowUnreadOnly,
    leaveConversation,
    conversationListVersion,
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

  // Handle leave conversation
  const handleLeaveConversation = useCallback(async (conversationId: string) => {
    await leaveConversation(conversationId);
    // The store will handle clearing active conversation if needed
    // and incrementing conversationListVersion to trigger refresh
  }, [leaveConversation]);

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
          <h2 className="text-xl font-semibold text-gray-800">메시지</h2>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
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
            <span className="text-sm text-gray-600">읽지 않은 메시지만</span>
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
          <div className="text-center p-8">
            <p className="text-red-500 mb-2">오류가 발생했습니다</p>
            <p className="text-sm text-gray-500">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              다시 시도
            </button>
          </div>
        ) : filteredConversations.length === 0 ? (
          // Empty state
          <div className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">
              {conversationFilter.searchQuery
                ? '검색 결과가 없습니다'
                : '대화가 없습니다'}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              프로필에서 메시지 버튼을 눌러 대화를 시작하세요
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
                onLeaveConversation={handleLeaveConversation}
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
                  {isLoading ? '로딩 중...' : '더 보기'}
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