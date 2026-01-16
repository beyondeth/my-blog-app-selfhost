"use client";

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PropsWithChildren, useEffect, useState } from 'react';
import UserTooltip from './UserTooltip';
import { queryKeys } from '@/lib/queries/keys';
import { useAuth } from '@/providers/AuthProviderV2';
import { getBlogUrl } from '@/lib/utils/blogUrl';

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
  
  // 모바일 감지 (터치 시 툴팁 표시, 클릭 이동 방지)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640); // sm breakpoint
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 사용자 데이터 조회 (로그인된 상태에서만)
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
    enabled: !!userId && !!user,  // 로그인된 상태에서만 실행
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

  // 블로그 경로 결정 (userData의 blog 정보 우선, 없으면 props의 blogSlug)
  const getBlogLink = () => {
    if (userData?.blog) {
      return getBlogUrl(userData.blog);
    }
    if (blogSlug) {
      // props로 넘어온 blogSlug는 @없이 순수 slug만 있음
      return `/${blogSlug}`;
    }
    return '#';
  };

  const blogLink = getBlogLink();

  // 데이터가 아직 없다면 
  if (!userData) {
    if (isMobile) {
      return <span className="inline-block">{children}</span>;
    }
    return (
      <Link
        href={blogLink}
        className="inline-block cursor-pointer"
      >
        {children}
      </Link>
    );
  }

  return (
    <UserTooltip user={userData} followInfo={followInfo}>
      {isMobile ? (
        // 모바일: 탭하면 툴팁(카드)이 열림. 링크 이동 안 함.
        <span className="inline-block cursor-pointer" role="button" tabIndex={0}>
          {children}
        </span>
      ) : (
        // 데스크톱: 호버하면 툴팁 열림. 클릭하면 블로그로 이동.
        <Link
          href={blogLink}
          className="inline-block cursor-pointer"
        >
          {children}
        </Link>
      )}
    </UserTooltip>
  );
}