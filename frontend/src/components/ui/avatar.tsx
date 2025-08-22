'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { FiUser } from 'react-icons/fi';
import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

const iconSizes = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-7 h-7',
  xl: 'w-9 h-9',
};

export function Avatar({ 
  src, 
  alt = 'Avatar', 
  fallback,
  size = 'sm',
  className,
  onClick
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Convert backend proxy URLs to full URLs if needed
  const imageUrl = src && src.startsWith('/api/') 
    ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}${src.replace('/api/v1', '')}`
    : src;

  const showFallback = !imageUrl || imageError;

  if (showFallback) {
    // If we have a fallback name, show initial letters
    if (fallback) {
      const initials = fallback
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      return (
        <div
          className={cn(
            sizeClasses[size],
            'rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-medium cursor-pointer hover:opacity-90 transition-opacity',
            className
          )}
          onClick={onClick}
        >
          <span className={cn(
            size === 'xs' && 'text-xs',
            size === 'sm' && 'text-sm',
            size === 'md' && 'text-base',
            size === 'lg' && 'text-lg',
            size === 'xl' && 'text-xl'
          )}>
            {initials}
          </span>
        </div>
      );
    }

    // Default icon fallback
    return (
      <div
        className={cn(
          sizeClasses[size],
          'rounded-full bg-gray-200 flex items-center justify-center',
          onClick && 'cursor-pointer hover:bg-gray-300 transition-colors',
          className
        )}
        onClick={onClick}
      >
        <FiUser className={cn(iconSizes[size], 'text-gray-400')} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        sizeClasses[size],
        'rounded-full overflow-hidden bg-gray-200 relative',
        onClick && 'cursor-pointer hover:opacity-90 transition-opacity',
        className
      )}
      onClick={onClick}
    >
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
      <Image
        src={imageUrl}
        alt={alt}
        fill
        sizes={size === 'xs' ? '24px' : size === 'sm' ? '32px' : size === 'md' ? '40px' : size === 'lg' ? '48px' : '64px'}
        className="object-cover"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setImageError(true);
          setIsLoading(false);
        }}
        unoptimized
      />
    </div>
  );
}

// Compound components for more complex avatar groups
export function AvatarGroup({ 
  children, 
  max = 3,
  className 
}: { 
  children: React.ReactNode;
  max?: number;
  className?: string;
}) {
  const childrenArray = React.Children.toArray(children);
  const displayedChildren = childrenArray.slice(0, max);
  const remainingCount = childrenArray.length - max;

  return (
    <div className={cn('flex -space-x-2', className)}>
      {displayedChildren}
      {remainingCount > 0 && (
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-700 ring-2 ring-white">
          +{remainingCount}
        </div>
      )}
    </div>
  );
}