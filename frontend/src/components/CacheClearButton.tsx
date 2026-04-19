'use client';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface CacheClearButtonProps {
  className?: string;
}

/**
 * 블로그 공유 문제 해결을 위한 캐시 클리어 버튼
 *
 * @description
 * 개발 중에 발생하는 캐시 문제를 즉시 해결하기 위한 임시 컴포넌트
 * - TanStack Query 캐시 클리어
 * - localStorage 클리어
 * - sessionStorage 클리어
 * - 페이지 새로고침
 */
export function CacheClearButton({ className = '' }: CacheClearButtonProps) {
  const queryClient = useQueryClient();
  const isEnabled = process.env.NEXT_PUBLIC_ENABLE_DEBUG_CACHE_CLEAR === 'true';

  const handleClearCache = () => {
    console.log('🧹 Starting cache clear...');

    // 1. Clear TanStack Query cache
    queryClient.clear();
    console.log('✅ Cleared TanStack Query cache');

    // 2. Clear related localStorage keys
    const localStorageKeys = Object.keys(localStorage);
    let removedKeys = 0;

    localStorageKeys.forEach(key => {
      if (key.includes('blog') ||
          key.includes('query') ||
          key.includes('auth') ||
          key.includes('user')) {
        localStorage.removeItem(key);
        removedKeys++;
      }
    });
    console.log(`✅ Removed ${removedKeys} localStorage keys`);

    // 3. Clear related sessionStorage keys
    const sessionStorageKeys = Object.keys(sessionStorage);
    let sessionRemovedKeys = 0;

    sessionStorageKeys.forEach(key => {
      if (key.includes('blog') ||
          key.includes('query') ||
          key.includes('auth') ||
          key.includes('user')) {
        sessionStorage.removeItem(key);
        sessionRemovedKeys++;
      }
    });
    console.log(`✅ Removed ${sessionRemovedKeys} sessionStorage keys`);

    // 4. Show completion toast
    toast.success(`Cache cleared (${removedKeys + sessionRemovedKeys} keys removed)`);

    // 5. Refresh after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  if (process.env.NODE_ENV === 'production' || !isEnabled) {
    return null;
  }

  return (
    <button
      onClick={handleClearCache}
      className={`fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-red-600 transition-colors text-sm font-medium ${className}`}
      title="Clear caches (development only)"
    >
      🧹 Clear caches
    </button>
  );
}
