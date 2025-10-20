'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useRouter } from 'next/navigation';
import {
  FiActivity,
  FiUsers,
  FiFileText,
  FiKey,
  FiTrendingUp,
  FiClock,
  FiBarChart2,
  FiRefreshCw,
} from 'react-icons/fi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * MCP 관리자 대시보드
 *
 * 기능:
 * - 총 사용량 통계 (활성 키, 총 요청, 총 포스트, 활성 사용자)
 * - 시간별 사용량 차트 (최근 24시간)
 * - 사용자별 순위 (Top 20)
 * - 월별 통계
 * - 최근 활동 로그
 */
export default function McpAdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalStats, setTotalStats] = useState<any>(null);
  const [hourlyStats, setHourlyStats] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // 관리자 권한 확인
  useEffect(() => {
    if (!loading && user && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, loading, router]);

  // 데이터 로딩 (최초 1회만)
  useEffect(() => {
    if (user?.role === 'admin') {
      loadAllData();
    }
  }, [user]);

  const loadAllData = async () => {
    const isInitialLoad = loading;

    if (!isInitialLoad) {
      setRefreshing(true);
    }

    try {
      // 병렬로 모든 데이터 로딩
      const [totalRes, hourlyRes, usersRes, logsRes] = await Promise.all([
        fetch(`${API_URL}/mcp/admin/stats/total`, { credentials: 'include' }),
        fetch(`${API_URL}/mcp/admin/stats/hourly?hours=24`, { credentials: 'include' }),
        fetch(`${API_URL}/mcp/admin/stats/users?limit=20`, { credentials: 'include' }),
        fetch(`${API_URL}/mcp/admin/logs?limit=50`, { credentials: 'include' }),
      ]);

      if (totalRes.ok) {
        const data = await totalRes.json();
        setTotalStats(data.data);
      }

      if (hourlyRes.ok) {
        const data = await hourlyRes.json();
        setHourlyStats(data.data);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUserStats(data.data);
      }

      if (logsRes.ok) {
        const data = await logsRes.json();
        setRecentLogs(data.data);
      }

      setLastUpdate(new Date());
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Failed to load MCP admin data:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 수동 새로고침
  const handleRefresh = () => {
    loadAllData();
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">관리자 권한이 필요합니다</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              MCP 시스템 모니터링
            </h1>
            <div className="flex items-center space-x-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                MCP API 사용량 및 통계를 모니터링합니다
              </p>
              {lastUpdate && (
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  마지막 업데이트: {lastUpdate.toLocaleString('ko-KR')}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? '새로고침 중...' : '새로고침'}</span>
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          icon={<FiKey className="w-6 h-6" />}
          title="활성 API Keys"
          value={totalStats?.activeKeys || 0}
          iconColor="text-blue-500"
          bgColor="bg-blue-50 dark:bg-blue-900/20"
        />
        <StatsCard
          icon={<FiActivity className="w-6 h-6" />}
          title="총 요청 수"
          value={totalStats?.totalRequests?.toLocaleString() || '0'}
          iconColor="text-green-500"
          bgColor="bg-green-50 dark:bg-green-900/20"
        />
        <StatsCard
          icon={<FiFileText className="w-6 h-6" />}
          title="생성된 포스트"
          value={totalStats?.totalPosts?.toLocaleString() || '0'}
          iconColor="text-purple-500"
          bgColor="bg-purple-50 dark:bg-purple-900/20"
        />
        <StatsCard
          icon={<FiUsers className="w-6 h-6" />}
          title="활성 사용자"
          value={totalStats?.activeUsers || 0}
          subtitle={`평균 ${totalStats?.avgPostsPerUser || 0}개/사용자`}
          iconColor="text-orange-500"
          bgColor="bg-orange-50 dark:bg-orange-900/20"
        />
      </div>

      {/* 시간별 사용량 차트 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <div className="flex items-center mb-4">
          <FiClock className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            시간별 사용량 (최근 24시간)
          </h2>
        </div>
        <div className="h-64 flex items-end space-x-1">
          {hourlyStats.map((stat, index) => {
            const maxCount = Math.max(...hourlyStats.map(s => s.count), 1);
            const height = (stat.count / maxCount) * 100;

            return (
              <div key={index} className="flex-1 flex flex-col items-center group">
                <div
                  className="w-full bg-blue-500 dark:bg-blue-400 rounded-t transition-all hover:bg-blue-600 dark:hover:bg-blue-300"
                  style={{ height: `${height}%` }}
                  title={`${stat.hour}: ${stat.count}회`}
                />
                {index % 4 === 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 rotate-45 origin-top-left">
                    {stat.hour.split(' ')[1]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 사용자별 순위 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center mb-4">
            <FiTrendingUp className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              사용자별 순위 (이번 달)
            </h2>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {userStats.map((user, index) => (
              <div
                key={user.userId}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg font-bold text-gray-400 dark:text-gray-500 w-6">
                    #{index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user.username}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user.tier}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {user.postsCreated}개
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user.percentage}% 사용
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 최근 활동 로그 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center mb-4">
            <FiBarChart2 className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              최근 활동
            </h2>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentLogs.map((log, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded"
              >
                <div>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {log.user?.username || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {log.count}개 포스트 생성
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {log.lastUsedAt
                      ? new Date(log.lastUsedAt).toLocaleString('ko-KR')
                      : 'N/A'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 통계 카드 컴포넌트
 */
function StatsCard({
  icon,
  title,
  value,
  subtitle,
  iconColor,
  bgColor,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  iconColor: string;
  bgColor: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${bgColor}`}>
          <div className={iconColor}>{icon}</div>
        </div>
      </div>
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{title}</h3>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {subtitle && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
