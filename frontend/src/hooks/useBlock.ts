"use client";

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useDMStore } from '@/stores/dmStore';

export interface BlockedUser {
  id: string;
  username: string;
  profileImage?: string;
  bio?: string;
}

export interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  reason?: string;
  createdAt: string;
  blocked?: BlockedUser;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * 사용자 차단 기능을 제공하는 커스텀 훅
 */
export function useBlock() {
  const queryClient = useQueryClient();
  const { blockUser: addBlockedUser, unblockUser: removeBlockedUser } = useDMStore();
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<{
    userId: string;
    username?: string;
  } | null>(null);

  /**
   * 사용자 차단 mutation
   */
  const blockUserMutation = useMutation({
    mutationFn: async ({ blockedId, reason }: { blockedId: string; reason?: string }) => {
      const response = await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ blockedId, reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          throw new Error('이미 차단한 사용자입니다.');
        }
        throw new Error(error.message || '차단 처리 중 오류가 발생했습니다.');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      toast.success('사용자를 차단했습니다.');
      setIsBlockModalOpen(false);
      setBlockTarget(null);

      // DM Store에 차단된 사용자 추가 (대화목록에서 즉시 숨김)
      addBlockedUser(variables.blockedId);

      // 차단 목록 갱신
      queryClient.invalidateQueries({ queryKey: ['blocks', 'my-blocks'] });
      // DM 목록 갱신 (차단한 사용자와의 대화 숨기기)
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  /**
   * 사용자 차단 해제 mutation
   */
  const unblockUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`${API_URL}/blocks/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '차단 해제 중 오류가 발생했습니다.');
      }
    },
    onSuccess: (data, userId) => {
      toast.success('차단을 해제했습니다.');

      // DM Store에서 차단된 사용자 제거 (대화목록에 다시 표시)
      removeBlockedUser(userId);

      queryClient.invalidateQueries({ queryKey: ['blocks', 'my-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  /**
   * 차단 모달 열기
   */
  const openBlockModal = (userId: string, username?: string) => {
    setBlockTarget({ userId, username });
    setIsBlockModalOpen(true);
  };

  /**
   * 차단 모달 닫기
   */
  const closeBlockModal = () => {
    setIsBlockModalOpen(false);
    setBlockTarget(null);
  };

  /**
   * 사용자 차단 실행
   */
  const blockUser = async (reason?: string) => {
    if (!blockTarget) return;

    await blockUserMutation.mutateAsync({
      blockedId: blockTarget.userId,
      reason,
    });
  };

  /**
   * 사용자 차단 해제 실행
   */
  const unblockUser = async (userId: string) => {
    await unblockUserMutation.mutateAsync(userId);
  };

  return {
    isBlockModalOpen,
    blockTarget,
    openBlockModal,
    closeBlockModal,
    blockUser,
    unblockUser,
    isBlocking: blockUserMutation.isPending,
    isUnblocking: unblockUserMutation.isPending,
  };
}

/**
 * 내가 차단한 사용자 목록 조회
 */
export function useMyBlocks(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ['blocks', 'my-blocks', page, limit],
    queryFn: async () => {
      const response = await fetch(
        `${API_URL}/blocks/my-blocks?page=${page}&limit=${limit}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('차단 목록 조회 실패');
      }

      return response.json();
    },
  });
}

/**
 * 특정 사용자 차단 여부 확인
 */
export function useCheckBlock(userId: string | null) {
  return useQuery({
    queryKey: ['blocks', 'check', userId],
    queryFn: async () => {
      if (!userId) return { isBlocked: false };

      const response = await fetch(
        `${API_URL}/blocks/check/${userId}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('차단 여부 확인 실패');
      }

      return response.json();
    },
    enabled: !!userId,
  });
}
