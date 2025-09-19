'use client';

import React, { useEffect } from 'react';
import { useDMStore } from '@/stores/dmStore';
import { useWindowSize } from '@/hooks/useWindowSize';
import DMSidebar from '../DMSidebar/DMSidebar';
import DMConversationList from '../DMConversationList/DMConversationList';
import DMChatArea from '../DMChatArea/DMChatArea';
import { DMLayoutProps } from './DMLayout.types';

interface ExtendedDMLayoutProps extends DMLayoutProps {
  isModal?: boolean;
}

const DMLayout: React.FC<ExtendedDMLayoutProps> = ({ isModal = false }) => {
  const {
    activeConversationId,
    isSidebarCollapsed,
    isConversationListVisible,
    setConversationListVisible
  } = useDMStore();

  const { isMobile } = useWindowSize();

  // Handle responsive layout
  useEffect(() => {
    if (isMobile && activeConversationId) {
      setConversationListVisible(false);
    } else if (!isMobile) {
      setConversationListVisible(true);
    }
  }, [isMobile, activeConversationId, setConversationListVisible]);

  // Different layouts for modal vs page mode
  const containerClass = isModal
    ? "flex h-full bg-white" // Modal mode - clean white background
    : "flex h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50"; // Page mode - subtle gradient

  const innerContainerClass = isModal
    ? "flex w-full h-full" // Modal mode - full container
    : "flex w-full max-w-7xl mx-auto bg-white shadow-2xl"; // Page mode - centered with max width

  return (
    <div className={containerClass}>
      {/* Main container */}
      <div className={innerContainerClass}>
        {/* Left Sidebar */}
        <div
          className={`
            ${isSidebarCollapsed ? 'w-14' : 'w-16'}
            flex-shrink-0
            bg-gradient-to-b from-gray-900 to-gray-800
            border-r border-gray-700
            transition-all duration-300 ease-in-out
          `}
        >
          <DMSidebar />
        </div>

        {/* Conversation List */}
        <div
          className={`
            ${isConversationListVisible ? 'w-64 lg:w-72' : 'w-0'}
            ${activeConversationId && isMobile ? 'hidden' : 'flex'}
            flex-shrink-0
            bg-white
            border-r border-gray-200
            transition-all duration-300 ease-in-out
            overflow-hidden
          `}
        >
          {isConversationListVisible && <DMConversationList />}
        </div>

        {/* Chat Area */}
        <div className="flex-1 min-w-0 bg-gradient-to-br from-gray-50/50 to-white">
          {activeConversationId ? (
            <DMChatArea conversationId={activeConversationId} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-12 h-12 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                  메시지를 선택하세요
                </h2>
                <p className="text-gray-500">
                  왼쪽 목록에서 대화를 선택하여 채팅을 시작하세요
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals will be rendered here */}
    </div>
  );
};

export default DMLayout;