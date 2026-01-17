import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { getUnifiedFeed, getEditorPicks } from '@/services/api/feed.service';
import HomePageClient from '@/components/home/HomePageClient';

export const revalidate = 60; // ISR 60 seconds

export default async function MobileHomePage() {

  const queryClient = new QueryClient();

  // Prefetch Unified Feed (Client Component의 useUnifiedFeed 기본값과 일치시켜야 함)
  await queryClient.prefetchInfiniteQuery({
    queryKey: ['unified-feed', 'all', 'recent', 20],
    queryFn: () => getUnifiedFeed({ filter: 'all', sort: 'recent', limit: 20 }),
    initialPageParam: undefined,
  });

  // Prefetch Editor Picks
  await queryClient.prefetchQuery({
    queryKey: ['editorPicks', 5],
    queryFn: () => getEditorPicks(5),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomePageClient isMobile={true} />
    </HydrationBoundary>
  );
}
