'use client';

import { useRouter } from 'next/navigation';

export function useBlogRefresh() {
  const router = useRouter();
  return () => router.refresh();
}

