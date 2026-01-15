'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useCommunity } from '@/hooks/community';
import {
  BarChart3,
  TrendingUp,
  Eye,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Users,
  Calendar,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { SETTINGS_CARD_CLASS } from '@/app/settings/theme';
import { Button } from '@/components/ui/button';
import CommunityAdminLayout from '@/components/community/CommunityAdminLayout';
import dynamic from 'next/dynamic';

// ApexCharts SSR 방지
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface CommunityStatsData {
  communityId: string;
  totalPosts: number;
  totalViews: number;
  totalUpvotes: number;
  totalDownvotes: number;
  netScore: number;
  totalComments: number;
  activeMemberCount: number;
  avgHotScore: number;
  weeklyPosts: number;
  weeklyMembers: number;
  lastCalculatedAt: string;
}

interface TrendData {
  date: string;
  posts: number;
  upvotes: number;
  comments: number;
  members: number;
}

interface TopContributor {
  userId: string;
  username: string;
  profileImage: string | null;
  postCount: number;
  upvoteCount: number;
}

interface TopPost {
  id: string;
  title: string;
  viewCount: number;
  upvoteCount: number;
  downvoteCount: number;
  hotScore: number;
  authorUsername: string;
}

interface CommunityAnalyticsPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * 커뮤니티 분석 페이지
 */
export default function CommunityAnalyticsPage({ params }: CommunityAnalyticsPageProps) {
  const { slug } = use(params);
  const { data: community, isLoading: communityLoading } = useCommunity(slug);

  const [stats, setStats] = useState<CommunityStatsData | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [topContributors, setTopContributors] = useState<TopContributor[]>([]);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'7' | '30' | '90'>('7');

  const fetchAnalytics = useCallback(async () => {
    if (!community?.id) return;

    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

      const [statsRes, trendsRes, topContributorsRes, topPostsRes] = await Promise.allSettled([
        fetch(`${apiUrl}/communities/${slug}/stats`, { credentials: 'include' }),
        fetch(`${apiUrl}/communities/${slug}/stats/trends?period=daily&range=${period}`, { credentials: 'include' }),
        fetch(`${apiUrl}/communities/${slug}/stats/top-contributors?limit=5`, { credentials: 'include' }),
        fetch(`${apiUrl}/communities/${slug}/stats/top-posts?sortBy=hotScore&limit=5`, { credentials: 'include' }),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const data = await statsRes.value.json();
        setStats(data);
      }

      if (trendsRes.status === 'fulfilled' && trendsRes.value.ok) {
        const data = await trendsRes.value.json();
        setTrends(data.trends || []);
      }

      if (topContributorsRes.status === 'fulfilled' && topContributorsRes.value.ok) {
        const data = await topContributorsRes.value.json();
        setTopContributors(data.contributors || []);
      }

      if (topPostsRes.status === 'fulfilled' && topPostsRes.value.ok) {
        const data = await topPostsRes.value.json();
        setTopPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [community?.id, slug, period]);

  useEffect(() => {
    if (community?.id) {
      fetchAnalytics();
    }
  }, [community?.id, fetchAnalytics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
  };

  // ApexCharts 설정
  const lineChartOptions = {
    chart: {
      type: 'area' as const,
      toolbar: { show: false },
      animations: { enabled: true, easing: 'easeinout' as const, speed: 800 },
      background: 'transparent',
      fontFamily: 'inherit',
    },
    stroke: { curve: 'smooth' as const, width: 2 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } },
    dataLabels: { enabled: false },
    theme: { mode: 'dark' as const },
    xaxis: {
      categories: trends.map((t) => {
        const date = new Date(t.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: '#d1d5db' },
      },
    },
    yaxis: {
      labels: {
        style: { colors: '#d1d5db' },
      },
    },
    colors: ['#8B5CF6', '#10B981', '#F59E0B', '#3B82F6'],
    legend: {
      position: 'top' as const,
      labels: { colors: '#d1d5db' },
    },
    tooltip: {
      theme: 'dark',
      shared: true,
      intersect: false,
    },
    grid: {
      borderColor: '#374151',
      strokeDashArray: 5,
      xaxis: { lines: { show: false } },
    },
  };

  const lineChartSeries = [
    { name: '게시물', data: trends.map((t) => t.posts) },
    { name: '업보트', data: trends.map((t) => t.upvotes) },
    { name: '댓글', data: trends.map((t) => t.comments) },
    { name: '신규 멤버', data: trends.map((t) => t.members) },
  ];

  if (communityLoading || loading) {
    return (
      <CommunityAdminLayout slug={slug}>
        <div className="animate-pulse space-y-6">
          <div className="h-24 bg-gray-200 dark:bg-white/10 rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 dark:bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      </CommunityAdminLayout>
    );
  }

  const statCards = [
    {
      title: '전체 조회수',
      value: stats?.totalViews ?? 0,
      icon: Eye,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      title: '순 투표',
      value: stats?.netScore ?? 0,
      icon: ThumbsUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      subtitle: `↑${stats?.totalUpvotes ?? 0} ↓${stats?.totalDownvotes ?? 0}`,
    },
    {
      title: '전체 댓글',
      value: stats?.totalComments ?? 0,
      icon: MessageSquare,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
    {
      title: '활성 멤버',
      value: stats?.activeMemberCount ?? 0,
      icon: Users,
      color: 'text-violet-600',
      bgColor: 'bg-violet-100 dark:bg-violet-900/30',
      subtitle: '최근 30일',
    },
  ];

  return (
    <CommunityAdminLayout slug={slug}>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              커뮤니티 분석
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              커뮤니티 성과를 한눈에 확인하세요
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>

        {/* 개요 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.title} className={`${SETTINGS_CARD_CLASS} p-4`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-300">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 mt-1">
                      {stat.value.toLocaleString()}
                    </p>
                    {stat.subtitle && (
                      <p className="text-xs text-[#3F4A59] dark:text-[#E1E8F0] mt-0.5">
                        {stat.subtitle}
                      </p>
                    )}
                  </div>
                  <div className={`p-2.5 rounded-full ${stat.bgColor}`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </div>
            );
          })}

        </div>

        {/* 주간 하이라이트 */}
        <div className={`${SETTINGS_CARD_CLASS} p-6`}>
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              주간 하이라이트
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-[#1F2229] rounded-xl border border-gray-100 dark:border-[#2F3440]">
              <p className="text-xs text-gray-500 dark:text-gray-300">이번 주 게시물</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-50 mt-1">
                {(stats?.weeklyPosts ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-[#1F2229] rounded-xl border border-gray-100 dark:border-[#2F3440]">
              <p className="text-xs text-gray-500 dark:text-gray-300">이번 주 신규 멤버</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-50 mt-1">
                {(stats?.weeklyMembers ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* 트렌드 차트 */}
        <div className={`${SETTINGS_CARD_CLASS} p-6`}>
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              일별 추이
            </h3>
            <div className="flex gap-1">
              {(['7', '30', '90'] as const).map((p) => (
                <Button
                  key={p}
                  variant={period === p ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPeriod(p)}
                  className="h-7 px-2 text-xs"
                >
                  {p}일
                </Button>
              ))}
            </div>
          </div>
          <div>
            {trends.length > 0 ? (
              <div className="h-[300px]">
                <Chart
                  options={lineChartOptions}
                  series={lineChartSeries}
                  type="area"
                  height="100%"
                />
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-300">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>아직 데이터가 없습니다</p>
                  <p className="text-xs mt-1">커뮤니티 활동이 시작되면 통계가 표시됩니다</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 두 컬럼 레이아웃 */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* 인기 게시물 */}
          <div className={`${SETTINGS_CARD_CLASS} p-6`}>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                인기 게시물
              </h3>
            </div>
            <div>
              {topPosts.length > 0 ? (
                <div className="space-y-3">
                  {topPosts.map((post, index) => (
                    <div
                      key={post.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#1F2229] rounded-xl border border-gray-100 dark:border-[#2F3440]"
                    >
                      <span className="text-lg font-bold text-gray-400 w-6 text-center">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-50 truncate text-sm">
                          {post.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-300 mt-1">
                          <span className="flex items-center gap-0.5">
                            <ThumbsUp className="w-3 h-3" />
                            {post.upvoteCount}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <ThumbsDown className="w-3 h-3" />
                            {post.downvoteCount}
                          </span>
                          <span className="text-gray-400">@{post.authorUsername}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500 dark:text-gray-300">
                  <p>아직 게시물이 없습니다</p>
                </div>
              )}
            </div>
          </div>

          {/* 기여자 랭킹 */}
          <div className={`${SETTINGS_CARD_CLASS} p-6`}>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                기여자 랭킹
              </h3>
            </div>
            <div>
              {topContributors.length > 0 ? (
                <div className="space-y-3">
                  {topContributors.map((contributor, index) => (
                    <div
                      key={contributor.userId}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#1F2229] rounded-xl border border-gray-100 dark:border-[#2F3440]"
                    >
                      <span className="text-lg font-bold text-gray-400 w-6 text-center">
                        {index + 1}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        {contributor.profileImage ? (
                          <img
                            src={contributor.profileImage}
                            alt={contributor.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-300 text-sm font-medium">
                            {contributor.username[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-50 truncate text-sm">
                          @{contributor.username}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-300 mt-0.5">
                          <span>게시물 {contributor.postCount}</span>
                          <span>업보트 {contributor.upvoteCount}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500 dark:text-gray-300">
                  <p>아직 기여자가 없습니다</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </CommunityAdminLayout>
  );
}
