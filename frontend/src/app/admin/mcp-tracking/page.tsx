'use client';

import { useState } from 'react';
import {
  Bot,
  Activity,
  TrendingUp,
  Clock,
  FileText,
  PenTool,
  RefreshCw,
  Calendar,
  Trash2,
} from 'lucide-react';
import {
  useMcpStats,
  useMcpHourlyActivity,
  useMcpCleanLogs,
  transformStatsToChartData,
  transformHourlyToTimeSeries,
  calculateTrend,
} from '@/hooks/useMcpTracking';
import McpStatsCard from '@/components/admin/mcp/McpStatsCard';
import McpActivityChart from '@/components/admin/mcp/McpActivityChart';
import McpClientDistribution from '@/components/admin/mcp/McpClientDistribution';
import McpPopularAIPosts from '@/components/admin/mcp/McpPopularAIPosts';
import { AI_CLIENT_COLORS, AI_CLIENT_LABELS } from '@/types/mcp';
import { toast } from 'sonner';

export default function McpTrackingPage() {
  const [timeRange, setTimeRange] = useState(7); // days
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch data
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useMcpStats(timeRange);
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

  if (statsLoading || hourlyLoading) {
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
              AI 포스팅 트래킹
            </h1>
            <p className="text-gray-600 mt-2">AI 클라이언트 활동을 실시간으로 모니터링합니다</p>
            {/* AI 자동 식별 시스템 */}
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
              <Bot className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-medium text-blue-900">AI 자동 식별:</span>
              <div className="flex gap-1">
                {Object.entries(AI_CLIENT_LABELS).map(([key, label]) => (
                  <span
                    key={key}
                    className="px-1.5 py-0.5 text-xs font-medium text-white rounded"
                    style={{ backgroundColor: AI_CLIENT_COLORS[key as keyof typeof AI_CLIENT_COLORS] }}
                    title={`ai:${key}`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
        </div>
      )}

      {/* AI Client Stats */}
      {stats && stats.byClient && (
        <div className={`grid gap-4 mb-8 ${
          Object.entries(stats.byClient).length <= 3
            ? 'grid-cols-1 md:grid-cols-3'
            : Object.entries(stats.byClient).length === 4
            ? 'grid-cols-2 md:grid-cols-4'
            : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5'
        }`}>
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

      {/* Popular AI Posts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Popular AI Posts */}
        <McpPopularAIPosts />

          {/* Recent AI Activities */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">최근 AI 활동 요약</h3>
              <Activity className="h-5 w-5 text-gray-400" />
            </div>

            <div className="space-y-4">
              {/* Today's Activity Summary */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">오늘의 활동</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">오늘 활동:</span>
                    <span className="font-medium">{stats?.todayCount || 0}건</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">전체 포스트 작성:</span>
                    <span className="font-medium">{stats?.byAction?.write || 0}개</span>
                  </div>
                </div>
              </div>

              {/* Weekly Trend */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-medium text-blue-700 mb-2">주간 트렌드</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-600">이번 주 총 활동</span>
                    <span className="text-sm font-bold text-blue-900">{stats?.weekCount || 0}</span>
                  </div>
                  {trend !== 'stable' && (
                    <div className="flex items-center gap-2">
                      <TrendingUp className={`h-4 w-4 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`} />
                      <span className={`text-sm font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                        {trend === 'up' ? '증가 추세' : '감소 추세'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Most Active AI */}
              {stats && stats.byClient && (
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="text-sm font-medium text-purple-700 mb-2">가장 활발한 AI</h4>
                  <div className="space-y-2">
                    {Object.entries(stats.byClient)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 3)
                      .map(([client, count]) => (
                        <div key={client} className="flex items-center justify-between">
                          <span
                            className="text-sm font-medium"
                            style={{ color: AI_CLIENT_COLORS[client as keyof typeof AI_CLIENT_COLORS] }}
                          >
                            {AI_CLIENT_LABELS[client as keyof typeof AI_CLIENT_LABELS]}
                          </span>
                          <span className="text-sm font-bold text-purple-900">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>

    </div>
  );
}