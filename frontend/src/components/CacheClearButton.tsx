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

  const handleClearCache = () => {
    console.log('🧹 캐시 클리어 시작...');

    // 1. TanStack Query 캐시 클리어
    queryClient.clear();
    console.log('✅ TanStack Query 캐시 클리어 완료');

    // 2. localStorage 클리어 (관련 키만)
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
    console.log(`✅ localStorage에서 ${removedKeys}개 키 제거 완료`);

    // 3. sessionStorage 클리어 (관련 키만)
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
    console.log(`✅ sessionStorage에서 ${sessionRemovedKeys}개 키 제거 완료`);

    // 4. 성공 알림
    toast.success(`캐시 클리어 완료! (${removedKeys + sessionRemovedKeys}개 키 제거)`);

    // 5. 1초 후 페이지 새로고침
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  // 개발 환경에서만 표시
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <button
      onClick={handleClearCache}
      className={`fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-red-600 transition-colors text-sm font-medium ${className}`}
      title="캐시 클리어 (개발 전용)"
    >
      🧹 캐시 클리어
    </button>
  );
}