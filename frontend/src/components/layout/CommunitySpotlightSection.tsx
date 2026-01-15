"use client";

import React from 'react';
import Link from 'next/link';
import { Users, Sparkles } from 'lucide-react';
import SidebarSection from './SidebarSection';
import { usePopularCommunities } from '@/hooks/community/useCommunities';

const CommunitySpotlightSection = React.memo(function CommunitySpotlightSection() {
  const { data: communities, isLoading, error, refetch } = usePopularCommunities(4);

  return (
    <SidebarSection
      title={
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span>커뮤니티 스포트라이트</span>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="animate-pulse rounded-lg border border-border/60 p-3 space-y-3">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-muted-foreground">
          커뮤니티 정보를 불러오지 못했습니다.
          <button className="ml-2 text-primary underline" onClick={() => refetch()}>
            다시 시도
          </button>
        </div>
      ) : !communities || communities.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 추천할 커뮤니티가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {communities.map((community) => (
            <div
              key={community.id}
              className="rounded-lg border border-border/60 p-3 hover:border-primary/50 transition-colors"
            >
              <Link href={`/c/${community.slug}`} className="block">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground truncate">
                      {community.name}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate">
                      c/{community.slug}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                    {community.isNsfw ? 'NSFW' : '공개'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {community.memberCount.toLocaleString()}명
                  </span>
                  <span>포스트 {community.postCount.toLocaleString()}개</span>
                </div>
                <button className="w-full text-xs font-medium py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition-colors">
                  커뮤니티 둘러보기
                </button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </SidebarSection>
  );
});

export default CommunitySpotlightSection;
