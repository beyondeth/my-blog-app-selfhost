'use client';

import Link from 'next/link';
import { Lock, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Community } from '@/types/community';

interface CommunityLockBannerProps {
  isLocked?: boolean;
  lockedAt?: string | null;
  lockedBy?: Community['lockedBy'];
  communitySlug?: string;
  className?: string;
  showAdminLink?: boolean;
  adminHref?: string;
  dense?: boolean;
}

export default function CommunityLockBanner({
  isLocked,
  lockedAt,
  lockedBy,
  communitySlug,
  className,
  showAdminLink = false,
  adminHref,
  dense = false,
}: CommunityLockBannerProps) {
  if (!isLocked) {
    return null;
  }

  const lockedAtLabel = lockedAt
    ? new Date(lockedAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      className={cn(
        'rounded-xl border border-amber-200 bg-amber-50/90 dark:border-amber-900 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 shadow-sm',
        dense ? 'p-3' : 'p-4',
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/70 text-amber-600 dark:bg-amber-900/40">
          <Lock className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span>Community locked</span>
            <ShieldAlert className="h-4 w-4" />
          </div>
          <p className="text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/90">
            This community has been locked by an administrator, so new posts and comments are temporarily restricted. Please wait while the moderation team reviews the issue and works on recovery.
          </p>
          <div className="text-xs text-amber-800/80 dark:text-amber-100/70">
            {lockedAtLabel && <span className="mr-2">Locked at: {lockedAtLabel}</span>}
            {lockedBy?.username && <span>Handled by: {lockedBy.username}</span>}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {communitySlug && (
              <Button size="sm" variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-100" asChild>
                <Link href={`/c/${communitySlug}/report-moderator`}>
                  Report moderator / request recovery
                </Link>
              </Button>
            )}
            {showAdminLink && adminHref && (
              <Button size="sm" variant="ghost" className="text-amber-900 hover:bg-amber-100/60" asChild>
                <Link href={adminHref}>Admin recovery console</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
