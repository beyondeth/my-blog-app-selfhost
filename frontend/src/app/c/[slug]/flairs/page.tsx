'use client';

import { use } from 'react';
import CommunityAdminLayout from '@/components/community/CommunityAdminLayout';
import FlairsManagerPanel from '@/components/community/settings/FlairsManagerPanel';

interface FlairsPageProps {
  params: Promise<{ slug: string }>;
}

export default function FlairsPage({ params }: FlairsPageProps) {
  const { slug } = use(params);
  return (
    <CommunityAdminLayout slug={slug}>
      <FlairsManagerPanel slug={slug} />
    </CommunityAdminLayout>
  );
}
