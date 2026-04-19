'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useUserBlogV2 } from '@/hooks/useUserBlogV2';
import { BarChart3, TrendingUp, Eye, ArrowBigUp, MessageSquare, Users, Calendar, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SETTINGS_CARD_CLASS } from '@/app/settings/theme';
import dynamic from 'next/dynamic';

// ApexCharts SSR guard
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface BlogStatsData {
  blogId: string;
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  followerCount: number;
  avgEngagementRate: number;
  weeklyViews: number;
  weeklyLikes: number;
  lastCalculatedAt: string;
}

interface TrendData {
  date: string;
  views: number;
  likes: number;
  comments: number;
}

interface TopPost {
  id: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
}

/**
 * Blog analytics page
 */
export default function BlogAnalyticsPage() {
  const { user } = useAuth();
  const { blog, loading: blogLoading } = useUserBlogV2();
  const [stats, setStats] = useState<BlogStatsData | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'7' | '30' | '90'>('7');

  const fetchAnalytics = useCallback(async () => {
    if (!blog?.id) return;

    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

      // Fetch each section independently so a single failure does not blank the page.
      const [statsRes, trendsRes, topPostsRes] = await Promise.allSettled([
        fetch(`${apiUrl}/blogs/${blog.id}/stats`, { credentials: 'include' }),
        fetch(`${apiUrl}/blogs/${blog.id}/stats/trends?period=daily&range=${period}`, { credentials: 'include' }),
        fetch(`${apiUrl}/blogs/${blog.id}/stats/top-posts?sortBy=views&limit=5`, { credentials: 'include' }),
      ]);

      // Stats
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const data = await statsRes.value.json();
        setStats(data);
      }

      // Trends
      if (trendsRes.status === 'fulfilled' && trendsRes.value.ok) {
        const data = await trendsRes.value.json();
        setTrends(data.trends || []);
      }

      // Top posts
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
  }, [blog?.id, period]);

  useEffect(() => {
    if (blog?.id) {
      fetchAnalytics();
    }
  }, [blog?.id, fetchAnalytics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
  };

  // ApexCharts options
  const lineChartOptions = {
    chart: {
      type: 'line' as const,
      toolbar: { show: false },
      animations: { enabled: true, easing: 'easeinout' as const, speed: 800 },
      background: 'transparent',
      fontFamily: 'inherit',
    },
    stroke: { curve: 'smooth' as const, width: 3 },
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
        style: { colors: '#d1d5db' }
      }
    },
    yaxis: {
      labels: {
        style: { colors: '#d1d5db' }
      }
    },
    colors: ['#6366f1', '#10B981', '#F59E0B'],
    legend: { 
      position: 'top' as const,
      labels: { colors: '#d1d5db' }
    },
    tooltip: { 
      theme: 'dark',
      shared: true, 
      intersect: false,
      style: { fontSize: '12px' } 
    },
    grid: { 
      borderColor: '#374151', // gray-700 equivalent for better dark mode visibility
      strokeDashArray: 5,
      xaxis: { lines: { show: false } }
    },
  };

  const lineChartSeries = [
    { name: 'Views', data: trends.map((t) => t.views) },
    { name: 'Likes', data: trends.map((t) => t.likes) },
    { name: 'Comments', data: trends.map((t) => t.comments) },
  ];

  if (!user) {
    return (
      <div className={`${SETTINGS_CARD_CLASS} p-6 text-center text-gray-600 dark:text-gray-300`}>
        Sign in to view your analytics.
      </div>
    );
  }

  if (blogLoading || loading) {
    return (
      <div className="space-y-6 pt-2">
         {/* Title skeleton */}
        <div className="h-8 w-48 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
        
        {/* Stats grid skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${SETTINGS_CARD_CLASS} p-6 h-32 animate-pulse flex flex-col justify-between`}>
               <div className="h-4 w-20 bg-gray-100 dark:bg-white/5 rounded" />
               <div className="h-8 w-16 bg-gray-100 dark:bg-white/5 rounded" />
            </div>
          ))}
        </div>
        
        {/* Chart skeleton */}
        <div className={`${SETTINGS_CARD_CLASS} p-6 h-[400px] animate-pulse`} />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total views',
      value: stats?.totalViews ?? 0,
      icon: Eye,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    },
    {
      title: 'Total likes',
      value: stats?.totalLikes ?? 0,
      icon: ArrowBigUp,
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-500/10',
    },
    {
      title: 'Total comments',
      value: stats?.totalComments ?? 0,
      icon: MessageSquare,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-500/10',
    },
    {
      title: 'Followers',
      value: stats?.followerCount ?? 0,
      icon: Users,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
  ];

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Blog analytics
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Track your blog performance at a glance.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-white dark:bg-[#121621] border-gray-200 dark:border-[#2e3545] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1c2130]"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <section key={stat.title} className={`${SETTINGS_CARD_CLASS} p-6 flex flex-col justify-between`}>
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-300">
                  {stat.title}
                </p>
                <div className={`p-2 rounded-xl ${stat.bgColor}`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 mt-2">
                {stat.value.toLocaleString()}
              </p>
            </section>
          );
        })}
      </div>

      {/* Weekly highlights */}
      <section className={`${SETTINGS_CARD_CLASS} p-6 space-y-4`}>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-emerald-500" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Weekly highlights
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div className="p-5 bg-gray-50 dark:bg-[#1A1F2B] rounded-2xl border border-gray-100 dark:border-[#232834]">
            <p className="text-xs text-gray-500 dark:text-gray-300 mb-1">Views this week</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              {(stats?.weeklyViews ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="p-5 bg-gray-50 dark:bg-[#1A1F2B] rounded-2xl border border-gray-100 dark:border-[#232834]">
            <p className="text-xs text-gray-500 dark:text-gray-300 mb-1">Likes this week</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              {(stats?.weeklyLikes ?? 0).toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      {/* Trend chart */}
      <section className={`${SETTINGS_CARD_CLASS} p-6 space-y-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">
              Daily trend
            </h3>
          </div>
          <div className="flex gap-1 bg-gray-100 dark:bg-[#121621] p-1 rounded-xl">
            {(['7', '30', '90'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                  period === p
                    ? 'bg-white dark:bg-[#2A2F3A] text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
        </div>
        
        <div className="w-full">
          {trends.length > 0 ? (
            <div className="h-[320px] w-full">
               <Chart
                options={lineChartOptions}
                series={lineChartSeries}
                type="line"
                height="100%"
                width="100%"
              />
            </div>
          ) : (
            <div className="h-[300px] flex flex-col items-center justify-center text-gray-500 dark:text-gray-300 bg-gray-50 dark:bg-[#1A1F2B] rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
              <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-medium">No data yet</p>
              <p className="text-xs mt-1 opacity-70">Publish posts to start seeing analytics.</p>
            </div>
          )}
        </div>
      </section>

      {/* Top posts */}
      <section className={`${SETTINGS_CARD_CLASS} p-6 space-y-5`}>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          Top posts
        </h3>
        
        {topPosts.length > 0 ? (
          <div className="space-y-3">
            {topPosts.map((post, index) => (
              <div
                key={post.id}
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-[#1A1F2B] rounded-2xl border border-transparent hover:border-gray-200 dark:hover:border-[#2F3440] transition-colors"
              >
                <span className="text-lg font-bold text-gray-300 dark:text-gray-600 w-6 text-center">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-50 truncate">
                    {post.title}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-300 mt-1.5">
                    <span className="flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      {post.viewCount.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ArrowBigUp className="w-3.5 h-3.5" />
                      {post.likeCount}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {post.commentCount}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-gray-500 dark:text-gray-300 bg-gray-50 dark:bg-[#1A1F2B] rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
            <p>No top posts yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}
