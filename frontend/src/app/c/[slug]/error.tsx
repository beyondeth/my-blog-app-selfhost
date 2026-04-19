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
      title="Unable to load the community"
      description="An error occurred while fetching community details. The community may not exist, or the issue may be temporary."
    />
  );
}
