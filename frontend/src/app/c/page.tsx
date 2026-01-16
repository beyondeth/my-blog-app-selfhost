'use client';

import React, { Suspense, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, TrendingUp, Clock, Users } from 'lucide-react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useInfiniteCommunities, useMyCommunities } from '@/hooks/community';
import CommunityCard from '@/components/community/CommunityCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Community, CommunitySortByType } from '@/types/community';

/**
 * 스켈레톤 로딩 컴포넌트
 */
function CommunityListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse"
        >
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="mt-4 flex gap-4">
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 커뮤니티 목록 컨텐츠 컴포넌트
 * useSearchParams를 사용하므로 Suspense로 감싸야 함
 */
function CommunityListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  // URL 쿼리 파라미터에서 초기값 가져오기
  const initialSearch = searchParams.get('search') || '';
  const initialSort = (searchParams.get('sort') as CommunitySortByType) || 'popular';
  const initialTab = (searchParams.get('tab') as TabType) || 'all';

  // 탭 타입: 전체 / 가입한 커뮤니티
  type TabType = 'all' | 'joined' | 'owned';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [sortBy, setSortBy] = useState<CommunitySortByType>(initialSort);

  // 검색어 디바운싱
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);

    // 디바운싱: 300ms 후 검색 실행
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, []);

  // 커뮤니티 목록 조회 (무한 스크롤)
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteCommunities({
    search: debouncedSearch || undefined,
    sortBy,
    limit: 20,
    joinedOnly: activeTab === 'joined',
    includeNsfw: true,
  });

  const { data: myCommunities = [] } = useMyCommunities({ enabled: isAuthenticated });

  // 모든 커뮤니티 평탄화
  const allCommunities = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items || []);
  }, [data?.pages]);

  const membershipMap = useMemo(() => {
    if (!isAuthenticated || !myCommunities?.length) return new Map<string, Community>();
    return new Map(myCommunities.map((community) => [community.id, community]));
  }, [isAuthenticated, myCommunities]);

  const augmentedCommunities = useMemo(() => {
    if (!isAuthenticated || membershipMap.size === 0) {
      return allCommunities;
    }

    return allCommunities.map((community) => {
      if (community.userMembership?.isMember) {
        return community;
      }

      const owned = membershipMap.get(community.id);
      if (owned) {
        return {
          ...community,
          userMembership:
            owned.userMembership?.isMember
              ? owned.userMembership
              : { isMember: true, role: owned.userMembership?.role, status: owned.userMembership?.status },
        };
      }

      return community;
    });
  }, [allCommunities, membershipMap, isAuthenticated]);

  const ownedCommunities = useMemo(() => {
    if (!isAuthenticated || !myCommunities?.length) return [];
    return myCommunities.filter((community) => {
      const isOwner = community.creatorId && user?.id && community.creatorId === user.id;
      const isOwnerRole = community.userMembership?.role === 'owner';
      return Boolean(isOwner || isOwnerRole);
    });
  }, [isAuthenticated, myCommunities, user?.id]);

  const displayCommunities = useMemo(() => {
    if (activeTab === 'owned') {
      return ownedCommunities;
    }
    return augmentedCommunities;
  }, [activeTab, augmentedCommunities, ownedCommunities]);

  // 정렬 탭 옵션
  const sortOptions = [
    { value: 'popular' as const, label: '인기순', icon: TrendingUp },
    { value: 'newest' as const, label: '최신순', icon: Clock },
    { value: 'active' as const, label: '활동순', icon: Users },
  ];

  // 정렬 변경 핸들러
  const handleSortChange = useCallback((newSort: CommunitySortByType) => {
    setSortBy(newSort);
    // URL 업데이트
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', newSort);
    if (debouncedSearch) {
      params.set('search', debouncedSearch);
    } else {
      params.delete('search');
    }
    router.replace(`/c?${params.toString()}`, { scroll: false });
  }, [router, searchParams, debouncedSearch]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pt-20">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            커뮤니티 탐색
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            관심 있는 커뮤니티를 찾아 가입하세요
          </p>
        </div>

        {/* 커뮤니티 생성 버튼 */}
        {isAuthenticated && (
          <Button
            onClick={() => router.push('/c/create')}
            className="inline-flex items-center gap-2 bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          >
            <Plus className="w-4 h-4" />
            <span>커뮤니티 만들기</span>
          </Button>
        )}
      </div>

      {/* 전체 / 가입한 커뮤니티 탭 */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('all')}
          className={`
            px-4 py-3 text-sm font-medium border-b-2 transition-colors
            ${activeTab === 'all'
              ? 'border-gray-900 text-gray-900 dark:border-gray-300 dark:text-gray-100'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }
          `}
        >
          전체
        </button>
        {isAuthenticated && (
          <button
            onClick={() => setActiveTab('joined')}
            className={`
              px-4 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeTab === 'joined'
                ? 'border-gray-900 text-gray-900 dark:border-gray-300 dark:text-gray-100'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }
            `}
          >
            참여중
          </button>
        )}
        {isAuthenticated && (
          <button
            onClick={() => setActiveTab('owned')}
            className={`
              px-4 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeTab === 'owned'
                ? 'border-gray-900 text-gray-900 dark:border-gray-300 dark:text-gray-100'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }
            `}
          >
            운영중
          </button>
        )}
      </div>

      {/* 검색 바 */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          type="text"
          placeholder="커뮤니티 검색..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10 h-11"
        />
      </div>

      {/* 정렬 탭 */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
        {sortOptions.map((option) => {
          const Icon = option.icon;
          const isActive = sortBy === option.value;

          return (
            <button
              key={option.value}
              onClick={() => handleSortChange(option.value)}
              className={`
                inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium
                transition-colors duration-200
                ${isActive
                  ? 'bg-gray-900 text-white border border-gray-900 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* 에러 상태 */}
      {isError && (
        <div className="text-center py-12">
          <p className="text-red-500 dark:text-red-400">
            {error instanceof Error ? error.message : '커뮤니티 목록을 불러오는데 실패했습니다.'}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            다시 시도
          </Button>
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading && <CommunityListSkeleton />}

      {/* 커뮤니티 목록 */}
      {!isLoading && !isError && (
        <>
        {displayCommunities.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                {debouncedSearch
                  ? `"${debouncedSearch}"에 대한 검색 결과가 없습니다.`
                  : activeTab === 'joined'
                    ? '아직 가입한 커뮤니티가 없습니다.'
                    : activeTab === 'owned'
                      ? '아직 내가 만든 커뮤니티가 없습니다.'
                      : '아직 커뮤니티가 없습니다.'}
              </p>
              {activeTab === 'joined' ? (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setActiveTab('all')}
                >
                  커뮤니티 탐색하기
                </Button>
              ) : activeTab === 'owned' ? (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push('/c/create')}
                >
                  커뮤니티 만들기
                </Button>
              ) : isAuthenticated && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push('/c/create')}
                >
                  첫 번째 커뮤니티 만들기
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayCommunities.map((community) => (
                  <CommunityCard
                    key={community.id}
                    community={community}
                    showJoinButton={isAuthenticated}
                  />
                ))}
              </div>

              {/* 더보기 버튼 */}
              {hasNextPage && (
                <div className="flex justify-center mt-8">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? '불러오는 중...' : '더 보기'}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 커뮤니티 목록 페이지 (/community)
 * - 커뮤니티 탐색 및 검색
 * - 인기순/최신순 정렬
 * - 무한 스크롤
 */
export default function CommunityListPage() {
  return (
    <div className="min-h-screen bg-background dark:bg-[#0E141B]">
      <Suspense fallback={
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse mb-8">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="h-11 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
          <div className="flex gap-2 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
            ))}
          </div>
          <CommunityListSkeleton />
        </div>
      }>
        <CommunityListContent />
      </Suspense>
    </div>
  );
}
