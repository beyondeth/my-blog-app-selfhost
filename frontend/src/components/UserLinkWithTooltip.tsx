"use client";

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PropsWithChildren } from 'react';
import UserTooltip from './UserTooltip';
import { queryKeys } from '@/lib/queries/keys';
import { useAuth } from '@/providers/AuthProviderV2';

interface UserLinkWithTooltipProps extends PropsWithChildren {
  userId: string;
  username: string;
  blogSlug?: string;
}

export default function UserLinkWithTooltip({
  children,
  userId,
  username,
  blogSlug,
}: UserLinkWithTooltipProps) {
  const { user } = useAuth();
  
  // 사용자 데이터 조회
  const { data: userData } = useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${userId}`,
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
    enabled: !!userId,
  });

  // 팔로우 정보 조회 (로그인된 상태에서만)
  const { data: followInfo } = useQuery({
    queryKey: queryKeys.users.followInfo(userId),
    queryFn: async () => {
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
        if (response.status === 401) {
          // 로그인되지 않았다면 기본값 반환
          return null;
        }
        throw new Error('Failed to fetch follow info');
      }
      
      return response.json();
    },
    staleTime: 60 * 1000, // 1분
    enabled: !!userId && !!user, // 로그인된 상태에서만 실행
  });

  // blogSlug를 props에서 받거나 userData에서 가져옴
  const effectiveBlogSlug = blogSlug || userData?.blog?.slug;

  // 데이터가 아직 없다면 기본 링크만 표시
  if (!userData) {
    return (
      <Link
        href={effectiveBlogSlug ? `/${effectiveBlogSlug}` : '#'}
        className="inline-block cursor-pointer"
      >
        {children}
      </Link>
    );
  }

  return (
    <UserTooltip user={userData} followInfo={followInfo}>
      <Link
        href={effectiveBlogSlug ? `/${effectiveBlogSlug}` : '#'}
        className="inline-block cursor-pointer"
      >
        {children}
      </Link>
    </UserTooltip>
  );
}