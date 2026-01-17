"use client";

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Users, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import SidebarSection from './SidebarSection';
import { useInfiniteCommunities } from '@/hooks/community/useCommunities';
import { getRecentPostsBatch } from '@/services/api/community.service';
import { normalizeImageUrl } from '@/utils/imageUtils';
import { cn } from '@/lib/utils';
import type { Community, CommunityPost } from '@/types/community';

const MAX_COMMUNITIES = 4;

/**
 * 커뮤니티별 최신글 목록 컴포넌트
 */
interface CommunityRecentPostsProps {
  communitySlug: string;
  isExpanded: boolean;
  onToggle: () => void;
  posts?: CommunityPost[];
  isLoading: boolean;
}

const CommunityRecentPosts = ({ communitySlug, isExpanded, onToggle, posts, isLoading }: CommunityRecentPostsProps) => {
  return (
    <div className="mt-1">
      <button
        type="button"
        onMouseDown={(e) => {
           // Click 이벤트 대신 onMouseDown을 사용하여 포커스 이동 방지 및 반응 속도 향상
           // Link 내부에서 클릭 시 이벤트 전파 방지가 중요함
           e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        className="flex w-full items-center justify-end gap-1 text-xs text-[#3F4A59] hover:text-[#264653] dark:text-[#E1E8F0] dark:hover:text-[#6CC3B2] transition-colors"
      >
        {!isExpanded && <span>최신글</span>}
        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>


      {isExpanded && (
        <div className="mt-1.5 space-y-1 pl-1">
          {isLoading ? (
            <div className="flex items-center gap-1.5 py-1">
              <Loader2 className="h-3 w-3 animate-spin text-[#3F4A59] dark:text-[#E1E8F0]" />
              <span className="text-xs text-[#3F4A59] dark:text-[#E1E8F0]">로딩 중...</span>
            </div>
          ) : !posts || posts.length === 0 ? (
            <p className="text-xs text-[#3F4A59] dark:text-[#E1E8F0]">최신글이 없습니다</p>
          ) : (
            posts.map((post) => (
              <Link
                key={post.id}
                href={`/c/${communitySlug}/comments/${post.slug}`}
                className="block truncate text-[14px] text-[#3F4A59] hover:text-[#264653] dark:text-[#E1E8F0] dark:hover:text-[#6CC3B2] transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                • {post.title}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 내 커뮤니티 카드 컴포넌트
 */
interface CommunityCardProps {
  community: Community;
  isExpanded: boolean;
  onToggle: () => void;
  renderImage: (iconUrl?: string | null, fallbackText?: string, fit?: 'cover' | 'contain') => React.ReactNode;
  recentPosts?: CommunityPost[];
  isLoadingPosts: boolean;
}

const CommunityCard = ({ community, isExpanded, onToggle, renderImage, recentPosts, isLoadingPosts }: CommunityCardProps) => {
  return (
    <div className="py-3 px-5 first:pt-0 last:pb-0">
      <Link
        href={`/c/${community.slug}`}
        className="flex items-center gap-3 transition-colors hover:opacity-80"
      >
        {renderImage(community.iconUrl, community.name || community.slug, community.iconImageFit)}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{community.name || community.slug}</p>
          <p className="truncate text-xs text-[#3F4A59] dark:text-[#E1E8F0]">
            {community.memberCount?.toLocaleString() || 0}명 참여 중
          </p>
        </div>
      </Link>
      <CommunityRecentPosts
        communitySlug={community.slug}
        isExpanded={isExpanded}
        onToggle={onToggle}
        posts={recentPosts}
        isLoading={isLoadingPosts}
      />
    </div>
  );
};

const MyCommunitiesSection = () => {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useInfiniteCommunities({
    limit: MAX_COMMUNITIES,
    joinedOnly: true,
    sortBy: 'newest',
  });

  // 기본적으로 모든 커뮤니티가 펼쳐진 상태
  const [expandedCommunities, setExpandedCommunities] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  const communities = useMemo(
    () => data?.pages.flatMap((page) => page.items).slice(0, MAX_COMMUNITIES) ?? [],
    [data?.pages]
  );

  // 커뮤니티 ID 목록 추출
  const communityIds = useMemo(() => communities.map(c => c.id), [communities]);

  // Batch API 호출
  const { data: batchPosts, isLoading: isBatchLoading } = useQuery({
    queryKey: ['communities', 'batch-recent-posts', communityIds],
    queryFn: () => getRecentPostsBatch(communityIds),
    enabled: communityIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5분 캐시
  });

  // 커뮤니티 로드 후 모든 커뮤니티를 펼친 상태로 초기화
  useMemo(() => {
    if (communities.length > 0 && !initialized) {
      setExpandedCommunities(new Set(communities.map((c) => c.id)));
      setInitialized(true);
    }
  }, [communities, initialized]);

  const toggleExpanded = useCallback((communityId: string) => {
    setExpandedCommunities((prev) => {
      const next = new Set(prev);
      if (next.has(communityId)) {
        next.delete(communityId);
      } else {
        next.add(communityId);
      }
      return next;
    });
  }, []);

  const hasMoreCommunities = (data?.pages[0]?.hasNext ?? false) || communities.length >= MAX_COMMUNITIES;

  const renderImage = useCallback((iconUrl?: string | null, fallbackText?: string, fit?: 'cover' | 'contain') => {
    if (iconUrl) {
      const imageClass =
        fit === 'cover'
          ? 'object-cover'
          : 'object-contain';
      const containerClass =
        fit === 'cover'
          ? 'bg-[#F7F9FC] dark:bg-[#131A22]'
          : 'bg-[#F7F9FC] dark:bg-[#131A22] border border-[#D9E0EA] dark:border-[#2A3645]';
      return (
        <div className={cn('relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full', containerClass)}>
          <Image
            src={normalizeImageUrl(iconUrl)}
            alt={fallbackText || 'Community'}
            fill
            className={imageClass}
            sizes="40px"
          />
        </div>
      );
    }

    return (
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#F7F9FC] text-[13px] font-semibold text-[#4B5563] dark:bg-[#131A22] dark:text-[#C7D1DD]">
        {fallbackText?.charAt(0).toUpperCase()}
      </div>
    );
  }, []);

  return (
    <SidebarSection
      title={
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#264653] dark:text-[#6CC3B2]" />
          <span>내 커뮤니티</span>
        </div>
      }
    >
      {isLoading ? (
        <div className="-mx-5 divide-y divide-[#E5E7EB] dark:divide-[#4B5563]">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 py-3 px-5 first:pt-0 last:pb-0"
            >
              <div className="h-8 w-8 animate-pulse rounded-full bg-[#DCE3EC] dark:bg-[#223040]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 animate-pulse rounded bg-[#DCE3EC] dark:bg-[#223040]" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-[#DCE3EC] dark:bg-[#223040]" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-[#4B5563] dark:text-[#C7D1DD]">
          커뮤니티 목록을 불러오는 중 오류가 발생했어요.
          <button
            type="button"
            className="ml-2 text-[#264653] underline dark:text-[#6CC3B2]"
            onClick={() => refetch()}
          >
            다시 시도
          </button>
        </div>
      ) : communities.length === 0 ? (
        <p className="text-sm text-[#4B5563] dark:text-[#C7D1DD]">가입한 커뮤니티가 아직 없습니다.</p>
      ) : (
        <div className="-mx-5 divide-y divide-[#E5E7EB] dark:divide-[#4B5563]">
          {communities.map((community) => (
            <CommunityCard
              key={community.id}
              community={community}
              isExpanded={expandedCommunities.has(community.id)}
              onToggle={() => toggleExpanded(community.id)}
              renderImage={renderImage}
              recentPosts={batchPosts ? batchPosts[community.id] : undefined}
              isLoadingPosts={isBatchLoading}
            />
          ))}

          {hasMoreCommunities && (
            <div className="flex justify-center pt-2">
              <Link
                href="/c?tab=joined"
                className="text-sm text-[#4B5563] hover:text-[#264653] dark:text-[#A9B4C2] dark:hover:text-[#6CC3B2] transition-colors"
              >
                더보기
              </Link>
            </div>
          )}
        </div>
      )}
    </SidebarSection>
  );
};

export default MyCommunitiesSection;
