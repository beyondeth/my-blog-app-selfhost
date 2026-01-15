'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProviderV2';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Loader2, UserPlus, UserMinus, LogIn, Check } from 'lucide-react';
import { toast } from 'sonner';
import { communityService } from '@/services/api/community.service';
import { communityQueryKeys } from '@/hooks/community/useCommunities';
import type { Community, CommunityRoleType } from '@/types/community';
import { isModeratorOrAbove } from '@/types/community';
import { Shield } from 'lucide-react';

interface JoinButtonProps {
  communitySlug: string;
  /** 현재 사용자의 멤버십 정보 */
  userMembership?: {
    isMember: boolean;
    role?: CommunityRoleType;
  };
  /** 멤버 수 (낙관적 업데이트용) */
  memberCount?: number;
  variant?: 'default' | 'minimal' | 'icon-only';
  className?: string;
  /** 상태 변경 후 콜백 */
  onMembershipChange?: (isMember: boolean) => void;
}

/**
 * 커뮤니티 가입/탈퇴 버튼 컴포넌트
 * - 낙관적 업데이트 지원
 * - 로그인 필요 시 로그인 페이지로 리다이렉트
 * - 호버 시 탈퇴 텍스트 표시 (Following -> Unfollow 패턴)
 */
const JoinButton = React.memo(function JoinButton({
  communitySlug,
  userMembership,
  memberCount,
  variant = 'default',
  className,
  onMembershipChange,
}: JoinButtonProps) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isHovered, setIsHovered] = useState(false);

  const isMember = userMembership?.isMember || false;
  const isStaff = isModeratorOrAbove(userMembership?.role);
  const actionPillBase =
    'inline-flex items-center justify-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border';

  // 캐시 키 통일 - communityQueryKeys 사용
  const detailQueryKey = communityQueryKeys.detail(communitySlug);

  // 가입 mutation
  const joinMutation = useMutation({
    mutationFn: () => communityService.joinCommunity(communitySlug),
    onMutate: async () => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({
        queryKey: detailQueryKey
      });

      // 이전 상태 저장
      const previousCommunity = queryClient.getQueryData<Community>(detailQueryKey);

      // 낙관적 업데이트
      queryClient.setQueryData<Community>(
        detailQueryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            memberCount: (old.memberCount || 0) + 1,
            userMembership: {
              isMember: true,
              role: 'member' as CommunityRoleType,
              status: 'active',
            },
          };
        }
      );

      return { previousCommunity };
    },
    onError: (error, _, context) => {
      // 롤백
      if (context?.previousCommunity) {
        queryClient.setQueryData(detailQueryKey, context.previousCommunity);
      }

      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('UNAUTHORIZED')) {
          toast.error('로그인이 필요합니다.');
          router.push('/login');
        } else if (error.message.includes('banned')) {
          toast.error('이 커뮤니티에서 차단되었습니다.');
        } else {
          toast.error('가입에 실패했습니다.');
        }
      }
    },
    onSuccess: () => {
      onMembershipChange?.(true);

      // 관련 캐시 무효화
      queryClient.invalidateQueries({ queryKey: detailQueryKey });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.myCommunities() });
    },
  });

  // 탈퇴 mutation
  const leaveMutation = useMutation({
    mutationFn: () => communityService.leaveCommunity(communitySlug),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: detailQueryKey
      });

      const previousCommunity = queryClient.getQueryData<Community>(detailQueryKey);

      // 낙관적 업데이트
      queryClient.setQueryData<Community>(
        detailQueryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            memberCount: Math.max(0, (old.memberCount || 0) - 1),
            userMembership: {
              isMember: false,
              role: undefined,
              status: undefined,
            },
          };
        }
      );

      return { previousCommunity };
    },
    onError: (error, _, context) => {
      if (context?.previousCommunity) {
        queryClient.setQueryData(detailQueryKey, context.previousCommunity);
      }

      if (error instanceof Error) {
        if (error.message.includes('owner')) {
          toast.error('커뮤니티 오너는 탈퇴할 수 없습니다.');
        } else {
          toast.error('탈퇴에 실패했습니다.');
        }
      }
    },
    onSuccess: () => {
      onMembershipChange?.(false);

      queryClient.invalidateQueries({ queryKey: detailQueryKey });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.myCommunities() });
    },
  });

  const isPending = joinMutation.isPending || leaveMutation.isPending;

  const handleClick = () => {
    if (!isAuthenticated || !user) {
      toast.error('로그인이 필요합니다.');
      router.push('/login');
      return;
    }

    if (isMember) {
      leaveMutation.mutate();
    } else {
      joinMutation.mutate();
    }
  };

  // 버튼 상태 계산
  const buttonConfig = useMemo(() => {
    if (isPending) {
      return {
        text: '처리 중...',
        icon: Loader2,
        className:
          'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed dark:bg-gray-800 dark:border-gray-700',
        iconClassName: 'animate-spin',
        disabled: true,
      };
    }

    if (isMember) {
      if (isHovered) {
        return {
          text: '탈퇴',
          icon: UserMinus,
          className:
            'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400',
          iconClassName: '',
          disabled: false,
        };
      }

      return {
        text: '참여중',
        icon: Check,
        className:
          'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600',
        iconClassName: '',
        disabled: false,
      };
    }

    return {
      text: '가입',
      icon: UserPlus,
      className:
        'bg-gray-900 text-white border-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-500 dark:hover:bg-gray-600',
      iconClassName: '',
      disabled: false,
    };
  }, [isPending, isMember, isHovered]);

  // 운영진(OWNER, ADMIN, MODERATOR)인 경우 "운영중" 뱃지 스타일 버튼 표시
  if (isStaff) {
    return null;
  }

  // icon-only variant
  if (variant === 'icon-only') {
    return (
      <button
        onClick={handleClick}
        disabled={buttonConfig.disabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center border',
          'focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2',
          'disabled:opacity-50 disabled:pointer-events-none',
          'transition-all duration-200',
          buttonConfig.className,
          className
        )}
        aria-label={isPending ? '처리 중...' : isMember ? '탈퇴' : '가입'}
      >
        {isPending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : buttonConfig.icon ? (
          <buttonConfig.icon className={cn('w-5 h-5', buttonConfig.iconClassName)} />
        ) : (
          <LogIn className="w-5 h-5" />
        )}
      </button>
    );
  }

  // minimal variant
  if (variant === 'minimal') {
    return (
      <button
        onClick={handleClick}
        disabled={buttonConfig.disabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          actionPillBase,
          'focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1',
          'disabled:opacity-50 disabled:pointer-events-none',
          'transition-all duration-200',
          buttonConfig.className,
          className
        )}
      >
        {isPending ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>처리 중...</span>
          </>
        ) : (
          <>
            {buttonConfig.icon && (
              <buttonConfig.icon className={cn('w-3 h-3', buttonConfig.iconClassName)} />
            )}
            <span>{buttonConfig.text}</span>
          </>
        )}
      </button>
    );
  }

  // default variant
  return (
    <button
      onClick={handleClick}
      disabled={buttonConfig.disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-full px-6 py-2.5',
        'min-w-[100px] text-sm border',
        'focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2',
        'disabled:opacity-60 disabled:pointer-events-none',
        'transition-all duration-200',
        buttonConfig.className,
        className
      )}
      aria-label={isPending ? '처리 중...' : isMember ? '탈퇴' : '가입'}
    >
      {isPending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>처리 중...</span>
        </>
      ) : (
        <>
          {buttonConfig.icon && (
            <buttonConfig.icon className={cn('w-4 h-4', buttonConfig.iconClassName)} />
          )}
          <span>{buttonConfig.text}</span>
        </>
      )}
    </button>
  );
});

export default JoinButton;
