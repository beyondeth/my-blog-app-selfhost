'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import UserProfileCard from '@/components/ui/UserProfileCard';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queries/keys';
import { useAuth } from '@/providers/AuthProviderV2';
import { Post } from '@/types';

interface AuthorInfoProps {
  author?: Post['author'];
}

export default function AuthorInfo({ author }: AuthorInfoProps) {
  const { user } = useAuth();
  const isOwner = user?.id === author?.id;
  const displayProfileImage = isOwner ? user?.profileImage : author?.profileImage;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 사용자 데이터 조회
  const { data: userData } = useQuery({
    queryKey: queryKeys.users.detail(author?.id || ''),
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${author?.id}`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5분
    enabled: !!author?.id,
  });

  // 팔로우 정보 조회 (로그인된 상태에서만)
  const { data: followInfo } = useQuery({
    queryKey: queryKeys.users.followInfo(author?.id || ''),
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${author?.id}/follow-info`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          // 로그인되지 않았다면 기본값 반환
          return null;
        }
        throw new Error('Failed to fetch follow info');
      }

      return response.json();
    },
    staleTime: 60 * 1000, // 1분
    enabled: !!author?.id && !!user, // 로그인된 상태에서만 실행
  });

  if (!author) return null;

  // 삭제된 사용자 처리
  const isDeletedUser = author.username?.startsWith('deleted_');
  const displayUsername = isDeletedUser ? 'Deleted user' : (author.username || 'Author');

  // 호버 툴팁에 사용할 사용자 데이터가 있는 경우에만 호버 기능 활성화
  if (userData && !isDeletedUser && mounted) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <div className="mt-12 rounded-2xl border border-gray-400 bg-white p-6 shadow-sm dark:border-gray-500 dark:bg-[rgb(32,32,32)]">
            <TooltipTrigger asChild>
              <div className="flex items-start space-x-4 cursor-pointer">
                <Avatar
                  src={displayProfileImage}
                  alt={displayUsername}
                  fallback={displayUsername}
                  size="md"
                  className="flex-shrink-0 hover:opacity-80 transition-opacity"
                />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    {displayUsername}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {author.bio || ''}
                  </p>
                </div>
              </div>
            </TooltipTrigger>
          </div>
          <TooltipContent
            side="top"
            align="start"
            className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 shadow-2xl p-0 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 rounded-2xl backdrop-blur-sm z-[10002]"
            sideOffset={8}
          >
            <UserProfileCard user={userData} followInfo={followInfo} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // 데이터가 없는 경우 또는 삭제된 사용자의 경우 기존 디자인 그대로 표시 (호버 기능 없음)
  return (
    <div className="mt-12 rounded-2xl border border-gray-400 bg-white p-6 shadow-sm dark:border-gray-500 dark:bg-[rgb(32,32,32)]">
      <div className="flex items-start space-x-4">
        <Avatar
          src={isDeletedUser ? null : displayProfileImage}
          alt={displayUsername}
          fallback={displayUsername}
          size="md"
          className="flex-shrink-0"
        />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            {displayUsername}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isDeletedUser ? '' : (author.bio || '')}
          </p>
        </div>
      </div>
    </div>
  );
}
 
