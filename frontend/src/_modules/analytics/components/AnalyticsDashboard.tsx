// 관리자용 분석 대시보드 컴포넌트
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FiActivity, FiClock, FiEye, FiTrendingUp, FiSearch, FiBookOpen, FiDownload, FiTrash2, FiX, FiUsers, FiFileText, FiCalendar } from 'react-icons/fi';
import { useAuth } from '@/providers/AuthProviderV2';
import { formatDuration, formatReadingSpeed, formatRelativeTime, getEngagementLevel } from '../utils/formatters';

interface DashboardProps {
  isOpen?: boolean;
  onClose?: () => void;
  showFloatingButton?: boolean;
}

interface VisitorStats {
  period: string;
  summary: {
    totalViews: number;
    uniqueVisitors: number;
    loggedInUsers: number;
    anonymousUsers: number;
    avgViewsPerDay: number;
  };
  dailyData: Array<{
    date: string;
    totalViews: number;
    uniqueVisitors: number;
    loggedInUsers: number;
    anonymousUsers: number;
  }>;
}

interface RecentActivity {
  id: string;
  timestamp: string;
  eventType: string;
  user: {
    id: string;
    username: string;
    email: string;
  } | null;
  isLoggedIn: boolean;
  target: string;
  metadata: any;
  sessionId: string;
  userAgent: string;
  ipAddress: string;
}

interface PostAnalytics {
  post: {
    id: string;
    title: string;
    slug: string;
    category: string;
    publishedAt: string;
  };
  stats: {
    views: number;
    uniqueVisitors: number;
    loggedInViews: number;
    anonymousViews: number;
    readStarts: number;
    readCompletes: number;
    completionRate: number;
    avgReadTime: number;
    avgScrollDepth: number;
  };
}

export default function AdminAnalyticsDashboard({ 
  isOpen: controlledIsOpen, 
  onClose,
  showFloatingButton = true 
}: DashboardProps) {
  const { isAdmin, user } = useAuth();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [postAnalytics, setPostAnalytics] = useState<PostAnalytics[]>([]);
  const [personalStats, setPersonalStats] = useState<any>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [loading, setLoading] = useState(false);
  const fetchInitiated = useRef(false); // 이중 호출 방지용 ref

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  
  // 페이지 모드: showFloatingButton이 false이고 isOpen도 제어되지 않는 경우
  const isPageMode = !showFloatingButton && controlledIsOpen === undefined;
  
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
  };
  
  const handleOpen = () => setInternalIsOpen(true);

  // 로그인하지 않은 사용자는 접근 불가
  if (!user) {
    return null;
  }

  const fetchAnalyticsData = async (period: string = '30d') => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/analytics/admin/dashboard?period=${period}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();

      setVisitorStats(data.visitorStats);
      setRecentActivities(data.recentActivities.activities || []);
      setPostAnalytics(data.postAnalytics);

    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if ((isOpen || isPageMode) && !fetchInitiated.current) {
      fetchInitiated.current = true;
      fetchAnalyticsData(selectedPeriod);
    }
  }, [isOpen, isPageMode, selectedPeriod]);

  const handlePeriodChange = (period: string) => {
    fetchInitiated.current = true; // 기간 변경 시 다시 fetch 하도록 설정
    setSelectedPeriod(period);
    fetchAnalyticsData(period);
  };

  const handleExportData = async () => {
    try {
      const response = await fetch('/api/v1/analytics/admin/export', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('데이터 내보내기에 실패했습니다.');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // 플로팅 버튼 렌더링
  if (!isOpen && showFloatingButton) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50"
        title="분석 대시보드 열기"
      >
        <FiActivity className="w-5 h-5" />
      </button>
    );
  }

  if (!isOpen && !isPageMode) return null;

  const dashboardContent = (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">데이터 로딩 중...</span>
        </div>
      ) : (
        <>
          {/* 기간 선택 */}
          <div className="mb-6">
            <div className="flex items-center space-x-2">
              <FiCalendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">분석 기간:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1d">1일</option>
                <option value="7d">7일</option>
                <option value="30d">30일</option>
                <option value="90d">90일</option>
              </select>
            </div>
          </div>

          {/* 방문자 통계 카드들 */}
          {visitorStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <AnalyticsCard
                title="총 방문수"
                value={visitorStats.summary.totalViews.toLocaleString()}
                icon={<FiEye className="w-5 h-5" />}
                description={`일평균 ${visitorStats.summary.avgViewsPerDay}회`}
              />
              <AnalyticsCard
                title="순 방문자"
                value={visitorStats.summary.uniqueVisitors.toLocaleString()}
                icon={<FiUsers className="w-5 h-5" />}
                description="중복 제거된 방문자 수"
              />
              <AnalyticsCard
                title="로그인 사용자"
                value={visitorStats.summary.loggedInUsers.toLocaleString()}
                icon={<FiUsers className="w-5 h-5" />}
                description="회원 방문자"
                trend="up"
              />
              <AnalyticsCard
                title="비로그인 사용자"
                value={visitorStats.summary.anonymousUsers.toLocaleString()}
                icon={<FiUsers className="w-5 h-5" />}
                description="비회원 방문자"
              />
            </div>
          )}

          {/* 포스트별 분석 */}
          {postAnalytics.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">포스트별 분석</h3>
                <p className="text-sm text-gray-600">조회수와 읽기 완료율 기준</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        포스트
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        조회수
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        로그인/비로그인
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        완료율
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        평균 읽기시간
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {postAnalytics.slice(0, 10).map((item) => (
                      <tr key={item.post.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                              {item.post.title}
                            </div>
                            <div className="text-xs text-gray-500">
                              {item.post.category} • {new Date(item.post.publishedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.stats.views.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="flex space-x-2">
                            <span className="text-blue-600">{item.stats.loggedInViews}</span>
                            <span className="text-gray-400">/</span>
                            <span className="text-orange-600">{item.stats.anonymousViews}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full" 
                                style={{ width: `${item.stats.completionRate}%` }}
                              ></div>
                            </div>
                            <span>{item.stats.completionRate}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatDuration(item.stats.avgReadTime)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 최근 활동 */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">최근 활동</h3>
              <p className="text-sm text-gray-600">실시간 사용자 활동 기록</p>
            </div>
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">아직 활동 기록이 없습니다.</p>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );

  // 페이지 모드: 모달 없이 직접 렌더링
  if (isPageMode) {
    return (
      <div className="p-6">
        {/* 페이지 모드 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900">📊 사이트 분석</h2>
            <p className="text-sm text-gray-600">전체 사용자 활동 및 통계</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportData}
              className="flex items-center space-x-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
              title="데이터 내보내기"
            >
              <FiDownload className="w-4 h-4" />
              <span>내보내기</span>
            </button>
          </div>
        </div>
        {dashboardContent}
      </div>
    );
  }

  // 모달 모드
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* 모달 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">📊 사이트 분석 대시보드</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportData}
              className="flex items-center space-x-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
              title="데이터 내보내기"
            >
              <FiDownload className="w-4 h-4" />
              <span>내보내기</span>
            </button>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded transition-colors"
              title="닫기"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {dashboardContent}
        </div>
      </div>
    </div>
  );
}

// 분석 카드 컴포넌트
interface AnalyticsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
}

function AnalyticsCard({ title, value, icon, description, trend }: AnalyticsCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <div className="p-3 bg-blue-100 rounded-full text-blue-600">
            {icon}
          </div>
          {trend && (
            <FiTrendingUp 
              className={`w-4 h-4 ${
                trend === 'up' ? 'text-green-500' : 
                trend === 'down' ? 'text-red-500' : 
                'text-gray-400'
              }`} 
            />
          )}
        </div>
      </div>
    </div>
  );
}

// 활동 아이템 컴포넌트
interface ActivityItemProps {
  activity: RecentActivity;
}

function ActivityItem({ activity }: ActivityItemProps) {
  const getEventTypeText = (eventType: string) => {
    const typeMap: Record<string, string> = {
      'page_view': '페이지 방문',
      'post_read_start': '포스트 읽기 시작',
      'post_read_complete': '포스트 읽기 완료',
      'search': '검색',
      'like_toggle': '좋아요',
      'share_attempt': '공유 시도',
      'tag_click': '태그 클릭',
    };
    return typeMap[eventType] || eventType;
  };

  const getUserInfo = (activity: RecentActivity) => {
    if (activity.user) {
      return `${activity.user.username} (${activity.user.email})`;
    }
    return '비로그인 사용자';
  };

  return (
    <div className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0">
      <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
        activity.isLoggedIn ? 'bg-blue-400' : 'bg-orange-400'
      }`}></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <span className="text-sm font-medium text-gray-900">
            {getEventTypeText(activity.eventType)}
          </span>
          <span className={`text-xs px-2 py-1 rounded ${
            activity.isLoggedIn 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-orange-100 text-orange-700'
          }`}>
            {activity.isLoggedIn ? '로그인' : '비로그인'}
          </span>
        </div>
        <p className="text-sm text-gray-700">{activity.target}</p>
        <div className="flex items-center space-x-4 mt-1">
          <p className="text-xs text-gray-500">{getUserInfo(activity)}</p>
          <p className="text-xs text-gray-500">{formatRelativeTime(new Date(activity.timestamp).getTime())}</p>
        </div>
        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
          <div className="mt-1 text-xs text-gray-500">
            {activity.metadata.readTime && (
              <span className="mr-2">읽기시간: {formatDuration(activity.metadata.readTime)}</span>
            )}
            {activity.metadata.scrollDepth && (
              <span className="mr-2">스크롤: {activity.metadata.scrollDepth}%</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 