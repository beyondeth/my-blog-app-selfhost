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
              폭주 / 긴급 상황 대응
            </h2>
            <p className={SETTINGS_SECTION_DESCRIPTION_CLASS}>
              잠금 상태에서는 글/댓글 작성이 제한되며, 안전하게 복구할 수 있도록 스냅샷이 자동으로 생성됩니다.
            </p>
          </div>
          <div className="space-y-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            <ul className="list-disc space-y-2 pl-4">
              <li>잠금 상태는 Admin만 해제할 수 있으며, 모든 콘텐츠는 소프트 삭제 상태로 보관됩니다.</li>
              <li>매니저가 잠적하거나 권한을 남용하면 아래 신고 기능을 통해 바로 에스컬레이트하세요.</li>
              <li>스냅샷은 게시물/댓글/설정 전체를 저장하며, 필요 시 전체 롤백이 가능합니다.</li>
            </ul>
            <div className="flex flex-wrap gap-3">
              <Link href={`/c/${slug}/report-moderator`} className={`${SETTINGS_PRIMARY_BUTTON_CLASS} inline-flex items-center gap-2`}>
                매니저 신고 / 복구 요청
              </Link>
              {isSiteAdmin && (
                <Link
                  href={`/admin/communities/${slug}/recovery`}
                  className={`${SETTINGS_SUBTLE_BUTTON_CLASS} inline-flex items-center gap-2`}
                >
                  Admin 복구 콘솔
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
              복구 스냅샷 가이드
            </h2>
            <p className={SETTINGS_SECTION_DESCRIPTION_CLASS}>
              실시간으로 스냅샷을 생성하고 특정 시점으로 복구할 수 있는 방법을 안내합니다.
            </p>
          </div>
          <div className="space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            <p>
              커뮤니티가 잠금되면 새로운 스냅샷이 자동으로 생성되며, 수동으로 추가 스냅샷을 만드는 것도 가능합니다. 스냅샷에는 게시물, 댓글, 잠금 상태, 배너/아이콘 등 주요 설정 값이 모두 포함됩니다.
            </p>
            <p>
              잠금 해제 전 스냅샷을 비교하여 삭제된 콘텐츠를 확인하고, 필요하다면 Admin 복구 콘솔에서 특정 스냅샷을 선택해 전체 롤백을 진행하세요.
            </p>
          </div>
        </section>
      </div>
    </CommunityAdminLayout>
  );
}
