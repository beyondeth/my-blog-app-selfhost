'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { FollowInfo } from '@/types/api';
import { Loader2, UserPlus, UserMinus, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';

interface FollowButtonProps {
  userId: string;
  initialState?: FollowInfo;
  className?: string;
  showFollowerCount?: boolean;
  variant?: 'default' | 'minimal' | 'icon-only';
}

// API 함수들
async function fetchFollowInfo(userId: string): Promise<FollowInfo> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${userId}/follow-info`,
    {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch follow info: ${response.status}`);
  }
  
  return response.json();
}

async function followUser(userId: string): Promise<void> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${userId}/follow`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    if (response.status === 400) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Bad request');
    }
    throw new Error(`Failed to follow user: ${response.status}`);
  }
}

async function unfollowUser(userId: string): Promise<void> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${userId}/follow`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    if (response.status === 400) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Bad request');
    }
    throw new Error(`Failed to unfollow user: ${response.status}`);
  }
}

export default function FollowButton({
  userId,
  initialState,
  className,
  showFollowerCount = false,
  variant = 'default',
}: FollowButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isHovered, setIsHovered] = useState(false);

  // 팔로우 정보 조회
  const { data: followInfo, isLoading: isLoadingFollowInfo } = useQuery({
    queryKey: queryKeys.users.followInfo(userId),
    queryFn: () => fetchFollowInfo(userId),
    initialData: initialState,
    staleTime: 30000, // 30초간 캐시 유지
    enabled: !!userId && !!user, // 로그인된 상태에서만 실행
  });

  // 현재 팔로우 상태
  const isFollowing = followInfo?.isFollowedByUser || false;

  // 팔로우 토글 뮤테이션
  const { mutate: toggleFollow, isPending } = useMutation({
    mutationFn: async () => {
      if (isFollowing) {
        await unfollowUser(userId);
        return 'UNFOLLOWED';
      } else {
        await followUser(userId);
        return 'FOLLOWED';
      }
    },
    onMutate: async () => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.users.followInfo(userId)
      });

      // 이전 상태 저장
      const previousFollowInfo = queryClient.getQueryData<FollowInfo>(
        queryKeys.users.followInfo(userId)
      );

      // 낙관적 업데이트
      const newIsFollowing = !isFollowing;
      queryClient.setQueryData<FollowInfo>(
        queryKeys.users.followInfo(userId),
        (old) => {
          if (!old) {
            return {
              followersCount: newIsFollowing ? 1 : 0,
              followingCount: 0,
              isFollowedByUser: newIsFollowing,
            };
          }
          return {
            ...old,
            isFollowedByUser: newIsFollowing,
            followersCount: old.followersCount + (newIsFollowing ? 1 : -1),
          };
        }
      );

      return { previousFollowInfo };
    },
    onError: (error, _, context) => {
      // 롤백
      if (context?.previousFollowInfo) {
        queryClient.setQueryData(
          queryKeys.users.followInfo(userId),
          context.previousFollowInfo
        );
      }

      // 에러 처리
      if (error.message === 'UNAUTHORIZED') {
        toast.error('로그인이 필요합니다.');
        router.push('/login');
      } else if (error.message.includes('자신을 팔로우할 수 없습니다')) {
        toast.error('자신을 팔로우할 수 없습니다.');
      } else {
        toast.error('팔로우 상태 변경에 실패했습니다.');
        console.error('Follow toggle failed:', error);
      }
    },
    onSuccess: (result) => {
      // 성공 토스트
      if (result === 'FOLLOWED') {
        toast.success('팔로우했습니다.');
      } else if (result === 'UNFOLLOWED') {
        toast.success('언팔로우했습니다.');
      }
      
      // 관련 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.users.followers(userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.users.following(userId),
      });
    },
  });

  const handleClick = () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      router.push('/login');
      return;
    }
    
    if (user.id === userId) {
      return; // 자신을 팔로우할 수 없음
    }

    toggleFollow();
  };

  // 버튼 설정 계산 - Hook은 조건문 전에 호출되어야 함
  const buttonConfig = useMemo(() => {
    if (isPending) {
      return {
        text: 'Loading...',
        icon: Loader2,
        className: 'bg-white text-gray-400 border border-gray-300 cursor-not-allowed',
        iconClassName: 'animate-spin',
        disabled: true,
      };
    }

    if (isFollowing) {
      return {
        text: 'Following',
        icon: null,
        className: 'bg-white text-gray-900 border border-gray-900 transition-all duration-200',
        iconClassName: '',
        disabled: false,
      };
    } else {
      return {
        text: 'Follow',
        icon: null,
        className: 'bg-white text-gray-900 border border-gray-900 transition-all duration-200',
        iconClassName: '',
        disabled: false,
      };
    }
  }, [isPending, isFollowing]);

  // 자신의 프로필에서는 버튼을 표시하지 않음
  if (user?.id === userId) {
    return null;
  }

  // 로딩 중이면 스켈레톤 표시
  if (isLoadingFollowInfo && !initialState) {
    return (
      <div className={cn('animate-pulse', className)}>
        <div className="h-11 w-28 bg-gray-200 rounded-full" />
      </div>
    );
  }

  // Variant별 렌더링
  if (variant === 'icon-only') {
    const IconComponent = buttonConfig.icon;
    
    return (
      <button
        onClick={handleClick}
        disabled={buttonConfig.disabled}
        className={cn(
          'group relative w-10 h-10 rounded-full flex items-center justify-center',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          'disabled:opacity-50 disabled:pointer-events-none',
          isPending
            ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
            : isFollowing
            ? 'bg-gray-50 text-green-500 border border-gray-300 hover:bg-gray-100 hover:border-gray-400 hover:scale-105'
            : 'bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 hover:border-blue-700 hover:scale-105',
          'transition-all duration-200',
          className
        )}
        title={isPending ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
      >
        {isPending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <IconComponent 
            className={cn(
              'w-5 h-5 transition-all duration-200',
              buttonConfig.iconClassName
            )} 
          />
        )}
      </button>
    );
  }

  if (variant === 'minimal') {
    return (
      <button
        onClick={handleClick}
        disabled={buttonConfig.disabled}
        className={cn(
          'inline-flex items-center justify-center text-sm font-normal px-3 py-0.5 rounded-full',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
          'disabled:opacity-50 disabled:pointer-events-none',
          'bg-white text-gray-900 border border-gray-900',
          'transition-all duration-200',
          className
        )}
      >
        {isPending ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            <span>Loading...</span>
          </>
        ) : (
          <span>{buttonConfig.text}</span>
        )}
      </button>
    );
  }

  // Default variant
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        onClick={handleClick}
        disabled={buttonConfig.disabled}
        className={cn(
          'relative font-normal rounded-full px-6 text-sm',
          'min-w-[110px] h-10 inline-flex items-center justify-center',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          'disabled:opacity-60 disabled:pointer-events-none',
          buttonConfig.className
        )}
        aria-label={isPending ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span>Loading...</span>
          </>
        ) : (
          <span>{buttonConfig.text}</span>
        )}
      </button>
      
      {/* 팔로워 수 표시 */}
      {showFollowerCount && followInfo && (
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-gray-700">
            {followInfo.followersCount.toLocaleString()}
          </span>
          <span className="text-xs text-gray-500">
            Followers
          </span>
        </div>
      )}
    </div>
  );
}