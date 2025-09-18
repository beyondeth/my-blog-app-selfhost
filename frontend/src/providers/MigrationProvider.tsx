'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { userBlogQueryKey } from '@/hooks/useUserBlogV2';

/**
 * 마이그레이션 호환성 Provider
 * - 레거시 window.dispatchEvent 이벤트를 TanStack Query invalidation으로 변환
 * - 점진적 마이그레이션 중 호환성 유지
 */
export function MigrationProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // 레거시 이벤트 리스너 (호환성)
    const handleUserBlogRefresh = () => {
      console.log('[Migration] Legacy userBlogRefresh event detected, using query invalidation');
      // TanStack Query invalidation으로 대체
      queryClient.invalidateQueries({ queryKey: userBlogQueryKey });
      queryClient.invalidateQueries({ queryKey: ['blogs', 'my-blogs'] });
    };

    // 레거시 이벤트 리스너 등록
    window.addEventListener('userBlogRefresh', handleUserBlogRefresh);

    return () => {
      window.removeEventListener('userBlogRefresh', handleUserBlogRefresh);
    };
  }, [queryClient]);

  return <>{children}</>;
}