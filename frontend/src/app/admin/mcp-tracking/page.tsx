'use client';

import { useState } from 'react';
import { 
  Bot, 
  Activity, 
  TrendingUp, 
  Clock, 
  FileText,
  Search,
  PenTool,
  BookOpen,
  RefreshCw,
  Calendar,
  Trash2,
} from 'lucide-react';
import {
  useMcpStats,
  useMcpPopularPosts,
  useMcpHourlyActivity,
  useMcpCleanLogs,
  transformStatsToChartData,
  transformHourlyToTimeSeries,
  calculateTrend,
} from '@/hooks/useMcpTracking';
import McpStatsCard from '@/components/admin/mcp/McpStatsCard';
import McpActivityChart from '@/components/admin/mcp/McpActivityChart';
import McpClientDistribution from '@/components/admin/mcp/McpClientDistribution';
import McpPopularPosts from '@/components/admin/mcp/McpPopularPosts';
import { AI_CLIENT_COLORS, AI_CLIENT_LABELS, ACTION_TYPE_LABELS } from '@/types/mcp';
import { toast } from 'sonner';

export default function McpTrackingPage() {
  const [timeRange, setTimeRange] = useState(7); // days
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch data
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useMcpStats(timeRange);
  const { data: popularPosts, isLoading: postsLoading, refetch: refetchPosts } = useMcpPopularPosts(timeRange, 10);
  const { data: hourlyActivity, isLoading: hourlyLoading, refetch: refetchHourly } = useMcpHourlyActivity(24);
  const cleanLogsMutation = useMcpCleanLogs();

  // Transform data for charts
  const chartData = stats ? transformStatsToChartData(stats) : { clientData: [], actionData: [] };
  const timeSeriesData = hourlyActivity ? transformHourlyToTimeSeries(hourlyActivity) : [];

  // Calculate trends
  const trend = stats ? calculateTrend(stats.todayCount, stats.weekCount / 7) : 'stable';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchStats(),
      refetchPosts(),
      refetchHourly(),
    ]);
    setIsRefreshing(false);
    toast.success('데이터를 새로고침했습니다');
  };

  const handleCleanLogs = async () => {
    if (!confirm('30일 이상 된 로그를 정리하시겠습니까?')) return;
    
    try {
      await cleanLogsMutation.mutateAsync(30);
      toast.success('오래된 로그를 정리했습니다');
    } catch (error) {
      toast.error('로그 정리에 실패했습니다');
    }
  };

  if (statsLoading || postsLoading || hourlyLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Bot className="h-8 w-8" />
              MCP AI 트래킹 대시보드
            </h1>
            <p className="text-gray-600 mt-2">AI 클라이언트 활동을 실시간으로 모니터링합니다</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value={1}>오늘</option>
              <option value={7}>최근 7일</option>
              <option value={30}>최근 30일</option>
              <option value={90}>최근 90일</option>
            </select>
            
            {/* Clean Logs Button */}
            <button
              onClick={handleCleanLogs}
              disabled={cleanLogsMutation.isPending}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              로그 정리
            </button>
            
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              새로고침
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <McpStatsCard
            title="전체 활동"
            value={stats.totalActivities}
            icon={<Activity className="h-6 w-6 text-blue-500" />}
            trend={trend}
            trendValue={stats.todayCount > 0 ? Math.round(((stats.todayCount - (stats.weekCount / 7)) / (stats.weekCount / 7)) * 100) : 0}
            bgColor="bg-blue-50"
            color="text-blue-600"
          />
          
          <McpStatsCard
            title="오늘 활동"
            value={stats.todayCount}
            icon={<Clock className="h-6 w-6 text-green-500" />}
            bgColor="bg-green-50"
            color="text-green-600"
          />
          
          <McpStatsCard
            title="포스트 작성"
            value={stats.byAction?.write || 0}
            icon={<PenTool className="h-6 w-6 text-purple-500" />}
            bgColor="bg-purple-50"
            color="text-purple-600"
          />
          
          <McpStatsCard
            title="포스트 읽기"
            value={stats.byAction?.read || 0}
            icon={<BookOpen className="h-6 w-6 text-orange-500" />}
            bgColor="bg-orange-50"
            color="text-orange-600"
          />
        </div>
      )}

      {/* AI Client Stats */}
      {stats && stats.byClient && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {Object.entries(stats.byClient).map(([client, count]) => (
            <div
              key={client}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
              style={{ borderLeftColor: AI_CLIENT_COLORS[client as keyof typeof AI_CLIENT_COLORS], borderLeftWidth: '4px' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {AI_CLIENT_LABELS[client as keyof typeof AI_CLIENT_LABELS]}
                  </p>
                  <p className="text-2xl font-bold mt-1">{count}</p>
                </div>
                <Bot 
                  className="h-5 w-5" 
                  style={{ color: AI_CLIENT_COLORS[client as keyof typeof AI_CLIENT_COLORS] }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <McpActivityChart data={timeSeriesData} />
        </div>
        <div>
          <McpClientDistribution data={chartData.clientData} />
        </div>
      </div>

      {/* Action Type Distribution */}
      {stats && stats.byAction && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">활동 유형별 통계</h3>
            <div className="space-y-4">
              {Object.entries(stats.byAction).map(([action, count]) => {
                const total = stats.totalActivities || 1;
                const percentage = Math.round((count / total) * 100);
                
                return (
                  <div key={action}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {ACTION_TYPE_LABELS[action as keyof typeof ACTION_TYPE_LABELS]}
                      </span>
                      <span className="text-sm text-gray-600">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Popular Posts */}
          {popularPosts && <McpPopularPosts posts={popularPosts} />}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
        <div className="flex items-start gap-3">
          <Bot className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-blue-900">AI 자동 식별 시스템</h4>
            <p className="text-sm text-blue-700 mt-1">
              각 AI는 포스트 작성 시 자동으로 태그를 추가하여 자신을 식별합니다:
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(AI_CLIENT_LABELS).map(([key, label]) => (
                <span
                  key={key}
                  className="px-2 py-1 text-xs font-medium text-white rounded-full"
                  style={{ backgroundColor: AI_CLIENT_COLORS[key as keyof typeof AI_CLIENT_COLORS] }}
                >
                  ai:{key} → {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}