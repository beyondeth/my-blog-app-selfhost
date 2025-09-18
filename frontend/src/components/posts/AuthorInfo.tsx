"use client";

import { useQuery } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/avatar';
import UserProfileCard from '@/components/ui/UserProfileCard';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/AuthProviderV2';
import { Post } from '@/types';

interface AuthorInfoProps {
  author?: Post['author'];
}

export default function AuthorInfo({ author }: AuthorInfoProps) {
  const { user } = useAuth();

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

  // 호버 툴팁에 사용할 사용자 데이터가 있는 경우에만 호버 기능 활성화
  if (userData) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <div className="mt-12 p-6 bg-gray-50 rounded-lg">
            <div className="flex items-start space-x-4">
              <TooltipTrigger asChild>
                <div className="flex items-start space-x-4 cursor-pointer">
                  <Avatar
                    src={author.profileImage}
                    alt={author.username || 'Author'}
                    fallback={author.username || 'Author'}
                    size="lg"
                    className="flex-shrink-0 hover:opacity-80 transition-opacity"
                  />
                  <div>
                    <h3 className="text-xs font-medium text-gray-900 mb-1 hover:text-blue-600 transition-colors">
                      {author.username || 'Author'}
                    </h3>
                  </div>
                </div>
              </TooltipTrigger>
              {/* 바이오는 호버 영역 밖에 배치 */}
              <div className="flex-1">
                <p className="text-xs text-gray-600 mt-5">
                  {author.bio || ''}
                </p>
              </div>
            </div>
          </div>
          <TooltipContent
            side="top"
            align="start"
            className="bg-white border border-gray-200 shadow-2xl p-0 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 rounded-2xl backdrop-blur-sm"
            sideOffset={8}
          >
            <UserProfileCard user={userData} followInfo={followInfo} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // 데이터가 없는 경우 기존 디자인 그대로 표시 (호버 기능 없음)
  return (
    <div className="mt-12 p-6 bg-gray-50 rounded-lg">
      <div className="flex items-start space-x-4">
        <Avatar
          src={author.profileImage}
          alt={author.username || 'Author'}
          fallback={author.username || 'Author'}
          size="lg"
          className="flex-shrink-0"
        />
        <div className="flex-1">
          <h3 className="text-xs font-medium text-gray-900 mb-1">
            {author.username || 'Author'}
          </h3>
          <p className="text-xs text-gray-600">
            {author.bio || ''}
          </p>
        </div>
      </div>
    </div>
  );
} 