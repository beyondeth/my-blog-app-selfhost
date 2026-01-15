'use client';

/**
 * LevelBadge - 사용자 레벨 배지 컴포넌트
 *
 * 누적 점수 기반 레벨을 "Lv1 🌱" 형식으로 표시합니다.
 * 10점 미만이면 아무것도 표시하지 않습니다.
 */

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * 사용자 레벨 응답 타입
 */
export interface UserLevelResponse {
  level: number;
  icon: string;
  minScore: number;
  currentScore: number;
}

/**
 * 사용자 레벨 조회 API
 */
async function fetchUserLevel(userId: string): Promise<UserLevelResponse | null> {
  const response = await fetch(`${API_BASE}/reputation/user/${userId}/level`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`레벨 조회 실패: ${response.status}`);
  }

  return response.json();
}

interface LevelBadgeProps {
  /** 사용자 ID (API 조회용) */
  userId?: string;
  /** 직접 레벨 정보 전달 (API 조회 생략) */
  level?: UserLevelResponse | null;
  /** 배지 크기 */
  size?: 'sm' | 'md';
  /** 추가 스타일 */
  className?: string;
}

/**
 * 레벨 배지 컴포넌트
 *
 * @example
 * // userId로 자동 조회
 * <LevelBadge userId="user-uuid" />
 *
 * // 직접 레벨 전달
 * <LevelBadge level={{ level: 3, icon: '✍️', minScore: 100, currentScore: 150 }} />
 */
export function LevelBadge({
  userId,
  level: propLevel,
  size = 'sm',
  className,
}: LevelBadgeProps) {
  // userId가 있고 propLevel이 없으면 API 조회
  const { data: fetchedLevel } = useQuery({
    queryKey: ['user-level', userId],
    queryFn: () => fetchUserLevel(userId!),
    enabled: !!userId && !propLevel,
    staleTime: 60000, // 1분 캐시
    retry: false,
  });

  const finalLevel = propLevel ?? fetchedLevel;

  // 레벨이 없으면 아무것도 표시하지 않음
  if (!finalLevel) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium whitespace-nowrap',
        size === 'sm' ? 'text-xs gap-0.5' : 'text-sm gap-1',
        className
      )}
      title={`Level ${finalLevel.level} (${finalLevel.currentScore}점)`}
    >
      <span className="text-gray-500 dark:text-gray-400">
        Lv{finalLevel.level}
      </span>
      <span>{finalLevel.icon}</span>
    </span>
  );
}

export default LevelBadge;
