'use client';

import { use } from 'react';
import Link from 'next/link';
import { ShieldAlert, LifeBuoy, ArrowRight } from 'lucide-react';
import { useCommunity } from '@/hooks/community';
import CommunityAdminLayout from '@/components/community/CommunityAdminLayout';
import CommunityLockBanner from '@/components/community/CommunityLockBanner';
import { useAuth } from '@/providers/AuthProviderV2';
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_SECTION_TITLE_CLASS,
  SETTINGS_SECTION_DESCRIPTION_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
  SETTINGS_SUBTLE_BUTTON_CLASS,
} from '@/app/settings/theme';

interface ModToolsPageProps {
  params: Promise<{ slug: string }>;
}

export default function CommunityModToolsPage({ params }: ModToolsPageProps) {
  const { slug } = use(params);
  const { data: community, isLoading } = useCommunity(slug);
  const { user } = useAuth();
  const isSiteAdmin = user?.role === 'admin';

  if (isLoading || !community) {
    return (
      <CommunityAdminLayout slug={slug}>
        <div className="h-32 w-full rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </CommunityAdminLayout>
    );
  }

  return (
    <CommunityAdminLayout slug={slug}>
      <div className="space-y-6">
        <CommunityLockBanner
          isLocked={community.isLocked}
          lockedAt={community.lockedAt}
          lockedBy={community.lockedBy}
          communitySlug={slug}
          showAdminLink={isSiteAdmin}
          adminHref={`/admin/communities/${slug}/recovery`}
        />

        <section className={`${SETTINGS_CARD_CLASS} p-6 space-y-4`}>
          <div className="space-y-1">
            <h2 className={`${SETTINGS_SECTION_TITLE_CLASS} flex items-center gap-2`}>
              <ShieldAlert className="h-4 w-4" />
              Lockdown & emergency response
            </h2>
            <p className={SETTINGS_SECTION_DESCRIPTION_CLASS}>
              While the community is locked, posting and commenting are restricted and recovery snapshots are created automatically.
            </p>
          </div>
          <div className="space-y-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            <ul className="list-disc space-y-2 pl-4">
              <li>Only admins can lift a full lock, and all content stays preserved in a soft-deleted state.</li>
              <li>If a moderator disappears or abuses permissions, escalate immediately through the reporting flow below.</li>
              <li>Snapshots include posts, comments, and key settings so the entire community can be rolled back when needed.</li>
            </ul>
            <div className="flex flex-wrap gap-3">
              <Link href={`/c/${slug}/report-moderator`} className={`${SETTINGS_PRIMARY_BUTTON_CLASS} inline-flex items-center gap-2`}>
                Report moderator / request recovery
              </Link>
              {isSiteAdmin && (
                <Link
                  href={`/admin/communities/${slug}/recovery`}
                  className={`${SETTINGS_SUBTLE_BUTTON_CLASS} inline-flex items-center gap-2`}
                >
                  Admin recovery console
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className={`${SETTINGS_CARD_CLASS} p-6 space-y-3`}>
          <div className="space-y-1">
            <h2 className={`${SETTINGS_SECTION_TITLE_CLASS} flex items-center gap-2`}>
              <LifeBuoy className="h-4 w-4" />
              Recovery snapshot guide
            </h2>
            <p className={SETTINGS_SECTION_DESCRIPTION_CLASS}>
              How snapshots are created and how to restore the community to a specific point in time.
            </p>
          </div>
          <div className="space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            <p>
              When a community is locked, a new snapshot is created automatically, and admins can create additional snapshots manually. Each snapshot captures posts, comments, lock state, banner, icon, and other key settings.
            </p>
            <p>
              Before unlocking, compare snapshots to review removed content. If needed, choose a specific snapshot in the admin recovery console and run a full rollback.
            </p>
          </div>
        </section>
      </div>
    </CommunityAdminLayout>
  );
}
