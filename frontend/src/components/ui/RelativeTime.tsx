'use client';

import { useEffect, useState } from 'react';
import { formatRelativeTime } from '@/utils/timeFormat';

interface RelativeTimeProps {
  date: string | Date;
  className?: string;
}

/**
 * 상대 시간 표시 컴포넌트
 *
 * 서버 사이드 렌더링 시에는 placeholder를 표시하고,
 * 클라이언트에서만 실제 상대 시간을 렌더링하여 Hydration 오류를 방지합니다.
 */
export default function RelativeTime({ date, className }: RelativeTimeProps) {
  const [mounted, setMounted] = useState(false);

  // 클라이언트 마운트 후에만 실제 시간 표시
  useEffect(() => {
    setMounted(true);
  }, []);

  // 서버에서는 placeholder 표시
  if (!mounted) {
    return <span className={className}>...</span>;
  }

  // 클라이언트에서 실제 시간 표시
  return <span className={className}>{formatRelativeTime(date)}</span>;
}