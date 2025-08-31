'use client';

import { Avatar } from '@/components/ui/avatar';

interface UserAvatarProps {
  src?: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
}

export default function UserAvatar({ 
  src, 
  alt = 'User', 
  size = 'sm',
  className = '',
  onClick
}: UserAvatarProps) {
  return (
    <Avatar 
      src={src}
      alt={alt}
      size={size}
      className={className}
      onClick={onClick}
    />
  );
}