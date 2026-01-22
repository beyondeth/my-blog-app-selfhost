'use client';

import { ErrorCard } from '@/components/ui/error-card';

export default function BlogError({
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
      title="블로그를 찾을 수 없습니다"
      description="해당 블로그에 접근하는 도중 오류가 발생했습니다. 주소가 정확한지 확인하시거나 잠시 후 다시 시도해주세요."
    />
  );
}
