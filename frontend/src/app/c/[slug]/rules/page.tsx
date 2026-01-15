'use client';

import { use } from 'react';
import CommunityAdminLayout from '@/components/community/CommunityAdminLayout';
import RulesManagerPanel from '@/components/community/settings/RulesManagerPanel';

interface RulesPageProps {
  params: Promise<{ slug: string }>;
}

export default function RulesPage({ params }: RulesPageProps) {
  const { slug } = use(params);
  return (
    <CommunityAdminLayout slug={slug}>
      <RulesManagerPanel slug={slug} />
    </CommunityAdminLayout>
  );
}
