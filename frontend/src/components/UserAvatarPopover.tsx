'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import UserProfileCardWithActions from './ui/UserProfileCardWithActions';
import { useReport } from '@/hooks/useReport';
import { useBlock } from '@/hooks/useBlock';
import ReportDialog from '@/components/reports/ReportDialog';
import BlockConfirmDialog from '@/components/blocks/BlockConfirmDialog';

interface UserAvatarPopoverProps {
  children: React.ReactNode;
  user: {
    id: string;
    username: string;
    profileImage?: string | null;
    bio?: string | null;
    postCount?: number;
    viewCount?: number;
    commentCount?: number;
    followerCount?: number;
    followingCount?: number;
    blog?: {
      slug: string;
    };
  };
  followInfo?: {
    followersCount: number;
    followingCount: number;
    isFollowedByUser: boolean;
  };
}

export default function UserAvatarPopover({
  children,
  user,
  followInfo
}: UserAvatarPopoverProps) {
  const [open, setOpen] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();
  const closeTimeoutRef = useRef<NodeJS.Timeout>();

  // 신고 기능
  const { isReportModalOpen, reportTarget, openReportModal, closeReportModal, submitReport, isSubmitting } = useReport();

  // 차단 기능
  const { isBlockModalOpen, blockTarget, openBlockModal, closeBlockModal, blockUser, isBlocking } = useBlock();

  // 신고하기 핸들러
  const handleReport = () => {
    if (!user) return;
    setOpen(false); // Popover 닫기
    openReportModal('user', user.id, user.username);
  };

  // 차단하기 핸들러
  const handleBlock = () => {
    if (!user) return;
    setOpen(false); // Popover 닫기
    openBlockModal(user.id, user.username);
  };

  // 마우스 이벤트 핸들러 - 호버 시 열기
  const handleMouseEnter = () => {
    // 닫기 타이머 취소
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = undefined;
    }

    // 300ms 지연 후 열기
    hoverTimeoutRef.current = setTimeout(() => {
      setOpen(true);
    }, 300);
  };

  // 마우스 이벤트 핸들러 - 벗어날 때 닫기
  const handleMouseLeave = () => {
    // 열기 타이머 취소
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = undefined;
    }

    // 150ms 지연 후 닫기 (카드로 이동할 시간 제공)
    closeTimeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 150);
  };

  // 컴포넌트 unmount 시 타이머 정리
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{ display: 'inline-block', cursor: 'pointer' }}
          >
            {children}
          </div>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            data-portal-modal="true"
            className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 shadow-2xl p-0 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 rounded-2xl backdrop-blur-sm z-[10002]"
            sideOffset={12}
            align="start"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <UserProfileCardWithActions
              user={user}
              followInfo={followInfo}
              onReport={handleReport}
              onBlock={handleBlock}
            />
            <Popover.Arrow className="fill-white dark:fill-card" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Report Dialog - Radix UI Dialog 기반 */}
      <ReportDialog
        open={isReportModalOpen}
        onOpenChange={(open) => {
          if (!open) closeReportModal();
        }}
        onSubmit={submitReport}
        targetTitle={reportTarget?.targetTitle}
        targetType="user"
        isSubmitting={isSubmitting}
      />

      {/* Block Confirmation Dialog - Radix UI Dialog 기반 */}
      <BlockConfirmDialog
        open={isBlockModalOpen}
        onOpenChange={(open) => {
          if (!open) closeBlockModal();
        }}
        onConfirm={blockUser}
        username={blockTarget?.username}
        isBlocking={isBlocking}
      />
    </>
  );
}