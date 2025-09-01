'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  profileImage?: string | null;
  username?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-20 h-20 text-2xl',
};

// 기본 아바타 SVG 컴포넌트
const DefaultAvatar = ({ className }: { className?: string }) => (
  <svg
    className={cn("w-full h-full", className)}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="12" fill="#E5E7EB" />
    <path
      d="M12 12C13.6569 12 15 10.6569 15 9C15 7.34315 13.6569 6 12 6C10.3431 6 9 7.34315 9 9C9 10.6569 10.3431 12 12 12Z"
      fill="#9CA3AF"
    />
    <path
      d="M12 14C8.68629 14 6 16.6863 6 20H18C18 16.6863 15.3137 14 12 14Z"
      fill="#9CA3AF"
    />
  </svg>
);

export default function UserAvatar({
  profileImage,
  username,
  size = 'md',
  className,
}: UserAvatarProps) {
  const sizeClass = sizeClasses[size];

  // 이미지 URL 처리
  let imageUrl = profileImage || '';
  if (profileImage && !profileImage.startsWith('http://') && !profileImage.startsWith('https://')) {
    // /api/로 시작하는 경우
    if (profileImage.startsWith('/api/')) {
      imageUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}${profileImage.replace('/api/v1', '')}`;
    } 
    // /로 시작하는 경우
    else if (profileImage.startsWith('/')) {
      imageUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}${profileImage}`;
    }
    // v2/users/... 같은 상대 경로인 경우 (S3 키)
    else {
      // proxy 엔드포인트 사용
      imageUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/files/proxy/${profileImage}`;
    }
  }

  return (
    <div
      className={cn(
        'relative rounded-full overflow-hidden bg-gray-200 flex-shrink-0',
        sizeClass,
        className
      )}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={username || 'User'}
          fill
          className="object-contain"
          sizes={
            size === 'xs' ? '24px' :
            size === 'sm' ? '32px' :
            size === 'md' ? '40px' :
            size === 'lg' ? '64px' :
            '80px'
          }
        />
      ) : (
        <DefaultAvatar />
      )}
    </div>
  );
}