import { redirect } from 'next/navigation';

import { use } from 'react';

interface PageProps {
  params: Promise<{ slug?: string }>;
}

export default function CommunitySubmitRedirect({ params }: PageProps) {
  const resolved = use(params);
  const slug = resolved?.slug;
  if (!slug) {
    redirect('/new-story');
  }
  redirect(`/new-story?communitySlug=${encodeURIComponent(slug)}`);
}
