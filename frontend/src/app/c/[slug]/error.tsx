'use client';

import { ErrorCard } from '@/components/ui/error-card';

export default function CommunityError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorCard
      error={error}
      reset={reset}
      title="커뮤니티를 불러올 수 없습니다"
      description="커뮤니티 정보를 가져오는 중 오류가 발생했습니다. 존재하지 않는 커뮤니티이거나 일시적인 문제일 수 있습니다."
    />
  );
}
