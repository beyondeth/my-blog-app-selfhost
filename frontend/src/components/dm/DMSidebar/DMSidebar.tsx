'use client';

import React, { memo, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useDMStore, SidebarView } from '@/stores/dmStore';
import { Avatar } from '@/components/ui/avatar';
import {
  MessageSquare,
  LogOut
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DMSidebarButton from './DMSidebarButton';

const DMSidebar: React.FC = memo(() => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const {
    sidebarView,
    setSidebarView,
    openModal,
    setDMModalOpen
  } = useDMStore();

  const handleViewChange = useCallback((view: SidebarView) => {
    setSidebarView(view);

    // Open corresponding modal if needed
    if (view === 'settings') {
      openModal('settings');
    }
  }, [setSidebarView, openModal]);

  const handleExit = useCallback(() => {
    // DM 모달 닫기
    setDMModalOpen(false);
    // 홈으로 이동
    router.push('/');
  }, [router, setDMModalOpen]);

  const navigationItems = [
    {
      id: 'chats' as const,
      icon: MessageSquare,
      label: 'Chats',
      onClick: () => handleViewChange('chats'),
    },
  ];

  return (
    <div className="flex flex-col h-full py-4">
      {/* Profile Section */}
      <div className="px-3 mb-6">
        <Avatar
          src={user?.profileImage}
          fallback={user?.username?.[0]?.toUpperCase() || '?'}
          size="md"
          className="mx-auto cursor-pointer ring-2 ring-gray-700 group-hover:ring-gray-600 transition-all"
          onClick={() => router.push('/settings')}
        />
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-1 px-2">
        {navigationItems.map((item) => (
          <DMSidebarButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={sidebarView === item.id}
            isCollapsed={false}
            onClick={item.onClick}
          />
        ))}
      </nav>

      {/* Exit Button */}
      <div className="px-2 mt-auto">
        <DMSidebarButton
          icon={LogOut}
          label="Close"
          isActive={false}
          isCollapsed={false}
          onClick={handleExit}
          variant="danger"
        />
      </div>
    </div>
  );
});

DMSidebar.displayName = 'DMSidebar';

export default DMSidebar;
