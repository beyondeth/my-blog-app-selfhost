'use client';

import { ErrorCard } from '@/components/ui/error-card';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ErrorCard
        error={error}
        reset={reset}
        title="일시적인 문제가 발생했습니다"
        description="예기치 못한 시스템 오류가 발생했습니다. 잠시 후 다시 시도해주시거나, 문제가 지속되면 고객센터로 문의해주세요."
      />
    </div>
  );
}
