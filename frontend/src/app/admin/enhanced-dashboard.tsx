'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Users,
  FileText,
  MessageSquare,
  Flag,
  TrendingUp,
  TrendingDown,
  Activity,
  Eye,
  Search,
  RefreshCw,
  Calendar
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { t } from '@/constants/adminTranslations';

// Dynamic import for ApexCharts to avoid SSR issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface DashboardStats {
  users: {
    total: number;
    active: number;
    new: number;
    inactive: number;
    changePercent: number;
  };
  posts: {
    total: number;
    published: number;
    drafts: number;
    todayCount: number;
    changePercent: number;
  };
  comments: {
    total: number;
    todayCount: number;
    pending: number;
    changePercent: number;
  };
  reports: {
    total: number;
    pending: number;
    resolved: number;
    todayCount: number;
  };
  metrics: {
    dau: number;
    mau: number;
    avgPostsPerUser: number;
    avgCommentsPerPost: number;
    avgSessionDuration: number;
    bounceRate: number;
  };
}

interface ActivityItem {
  id?: string;
  type: 'user_signup' | 'post_created' | 'comment_created' | 'report_created';
  message: string;
  timestamp: string;
  metadata?: any;
}

interface TrendData {
  date: string;
  users: number;
  posts: number;
  comments: number;
  reports: number;
}

export default function EnhancedDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [popularPosts, setPopularPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Search states for different sections
  const [userSearch, setUserSearch] = useState('');
  const [postSearch, setPostSearch] = useState('');
  const [commentSearch, setCommentSearch] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any>({
    users: [],
    posts: [],
    comments: [],
    reports: []
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

      // Fetch all dashboard data in parallel
      const [statsRes, activityRes, trendsRes, popularRes] = await Promise.all([
        fetch(`${apiUrl}/admin/dashboard/stats`, { credentials: 'include' }),
        fetch(`${apiUrl}/admin/dashboard/activity`, { credentials: 'include' }),
        fetch(`${apiUrl}/admin/dashboard/trends`, { credentials: 'include' }),
        fetch(`${apiUrl}/admin/dashboard/popular-posts`, { credentials: 'include' })
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setActivity(activityData.activities || activityData || []);
      }

      if (trendsRes.ok) {
        const trendsData = await trendsRes.json();
        setTrends(trendsData.trends || trendsData || []);
      }

      if (popularRes.ok) {
        const popularData = await popularRes.json();
        setPopularPosts(popularData.posts || popularData || []);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('대시보드 데이터를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
  };

  // Search handlers
  const handleUserSearch = async () => {
    if (!userSearch.trim()) {
      toast.warning('검색어를 입력해주세요');
      return;
    }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetch(`${apiUrl}/users?search=${encodeURIComponent(userSearch)}`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setSearchResults((prev: any) => ({ ...prev, users: data.users || [] }));
        toast.success(`${data.users?.length || 0}명의 사용자를 찾았습니다`);
      }
    } catch (error) {
      console.error('User search error:', error);
      toast.error('사용자 검색에 실패했습니다');
    }
  };

  const handlePostSearch = async () => {
    if (!postSearch.trim()) {
      toast.warning('검색어를 입력해주세요');
      return;
    }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetch(`${apiUrl}/posts?search=${encodeURIComponent(postSearch)}`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setSearchResults((prev: any) => ({ ...prev, posts: data.posts || [] }));
        toast.success(`${data.posts?.length || 0}개의 포스트를 찾았습니다`);
      }
    } catch (error) {
      console.error('Post search error:', error);
      toast.error('포스트 검색에 실패했습니다');
    }
  };

  const handleCommentSearch = async () => {
    if (!commentSearch.trim()) {
      toast.warning('검색어를 입력해주세요');
      return;
    }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetch(`${apiUrl}/comments?search=${encodeURIComponent(commentSearch)}`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setSearchResults((prev: any) => ({ ...prev, comments: data.comments || [] }));
        toast.success(`${data.comments?.length || 0}개의 댓글을 찾았습니다`);
      }
    } catch (error) {
      console.error('Comment search error:', error);
      toast.error('댓글 검색에 실패했습니다');
    }
  };

  const handleReportSearch = async () => {
    if (!reportSearch.trim()) {
      toast.warning('검색어를 입력해주세요');
      return;
    }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetch(`${apiUrl}/reports?search=${encodeURIComponent(reportSearch)}`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setSearchResults((prev: any) => ({ ...prev, reports: data.reports || [] }));
        toast.success(`${data.reports?.length || 0}개의 신고를 찾았습니다`);
      }
    } catch (error) {
      console.error('Report search error:', error);
      toast.error('신고 검색에 실패했습니다');
    }
  };

  // ApexCharts configurations
  const lineChartOptions = {
    chart: {
      type: 'line' as const,
      toolbar: {
        show: true,
        offsetX: 0,
        offsetY: 0,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
        }
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      }
    },
    stroke: {
      curve: 'smooth' as const,
      width: 3
    },
    dataLabels: {
      enabled: false
    },
    xaxis: {
      categories: trends.map(t => format(new Date(t.date), 'MMM dd')),
      title: { text: 'Date' }
    },
    yaxis: {
      title: { text: 'Count' }
    },
    colors: ['#4F46E5', '#10B981', '#F59E0B', '#EF4444'],
    legend: {
      position: 'top' as const,
      horizontalAlign: 'left' as const,
      offsetX: 0,
      offsetY: -5,
      itemMargin: {
        horizontal: 10,
        vertical: 5
      }
    },
    tooltip: {
      shared: true,
      intersect: false,
      x: {
        format: 'dd MMM yyyy'
      }
    },
    grid: {
      borderColor: '#e7e7e7',
      strokeDashArray: 5,
      padding: {
        top: 10,
        right: 10,
        bottom: 0,
        left: 10
      }
    }
  };

  const lineChartSeries = [
    { name: 'Users', data: trends.map(t => t.users) },
    { name: 'Posts', data: trends.map(t => t.posts) },
    { name: 'Comments', data: trends.map(t => t.comments) },
    { name: 'Reports', data: trends.map(t => t.reports) }
  ];

  // 사용자 분포 차트 설정 - 3D 효과 추가
  const donutChartOptions = {
    chart: {
      type: 'donut' as const,
      animations: {
        enabled: true,
        animateGradually: {
          enabled: true,
          delay: 150
        },
        dynamicAnimation: {
          enabled: true,
          speed: 350
        }
      },
      dropShadow: {
        enabled: true,
        color: '#000',
        top: 3,
        left: 0,
        blur: 10,
        opacity: 0.15
      }
    },
    labels: [t.dashboard.activeUsers, t.dashboard.inactiveUsers, '신규 사용자'],
    colors: ['#10B981', '#EF4444', '#3B82F6'],
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'vertical',
        shadeIntensity: 0.4,
        gradientToColors: ['#059669', '#DC2626', '#2563EB'],
        inverseColors: false,
        opacityFrom: 1,
        opacityTo: 0.8,
        stops: [0, 100]
      }
    },
    stroke: {
      width: 2,
      colors: ['#ffffff']
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '14px',
              fontWeight: 600,
              color: '#4B5563',
              offsetY: -10
            },
            value: {
              show: true,
              fontSize: '20px',
              fontWeight: 700,
              color: '#1F2937',
              offsetY: 5,
              formatter: function(val: string) {
                return val;
              }
            },
            total: {
              show: true,
              showAlways: true,
              label: '전체 사용자',
              fontSize: '12px',
              fontWeight: 600,
              color: '#6B7280',
              formatter: function(w: any) {
                // 실제 전체 사용자 수를 표시 (stats.users.total)
                return (stats?.users.total || 0) + '명';
              }
            }
          }
        },
        expandOnClick: true,
        offsetX: 0,
        offsetY: 0,
        customScale: 1,
        dataLabels: {
          offset: 0,
          minAngleToShowLabel: 10
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: function(val: number) {
        return Math.round(val) + '%';
      },
      style: {
        fontSize: '12px',
        fontWeight: 'bold',
        colors: ['#ffffff']
      },
      dropShadow: {
        enabled: true,
        top: 1,
        left: 1,
        blur: 1,
        opacity: 0.45
      }
    },
    legend: {
      position: 'bottom' as const,
      horizontalAlign: 'center' as const,
      offsetY: 5,
      fontSize: '12px',
      fontWeight: 500,
      markers: {
        width: 12,
        height: 12,
        radius: 3,
        offsetX: -2,
        offsetY: 0
      },
      itemMargin: {
        horizontal: 8,
        vertical: 3
      }
    },
    responsive: [{
      breakpoint: 480,
      options: {
        chart: {
          width: 200
        },
        legend: {
          position: 'bottom' as const
        }
      }
    }],
    noData: {
      text: '데이터 로딩 중...',
      style: {
        fontSize: '14px'
      }
    },
    tooltip: {
      enabled: true,
      fillSeriesColor: false,
      theme: 'dark',
      style: {
        fontSize: '12px'
      },
      y: {
        formatter: function(val: number) {
          return val + '명';
        }
      }
    }
  };

  // 실제 사용자 데이터로 계산
  const donutChartSeries = stats ? [
    stats.users.active || 0,
    stats.users.inactive || 0,
    stats.users.new || 0
  ] : [0, 0, 0];

  // 성능 메트릭 차트 설정 - 실제 데이터 사용  
  const radialBarOptions = {
    chart: {
      type: 'radialBar' as const,
      sparkline: {
        enabled: true
      }
    },
    plotOptions: {
      radialBar: {
        startAngle: -90,
        endAngle: 90,
        track: {
          background: '#e7e7e7',
          strokeWidth: '97%',
          margin: 5,
        },
        dataLabels: {
          name: {
            fontSize: '16px',
            color: '#888',
            offsetY: 30
          },
          value: {
            offsetY: -10,
            fontSize: '22px',
            color: undefined,
            formatter: function (val: number) {
              return val ? val.toFixed(1) + '%' : '0%';
            }
          }
        }
      }
    },
    grid: {
      padding: {
        top: -10
      }
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'light',
        shadeIntensity: 0.4,
        inverseColors: false,
        opacityFrom: 1,
        opacityTo: 1,
        stops: [0, 50, 53, 91]
      },
    },
    labels: ['사용자 활성도'],
  };

  // 사용자 활성도 계산 (DAU/MAU 비율)
  const userActivityRate = stats && stats.metrics.mau > 0 
    ? (stats.metrics.dau / stats.metrics.mau) * 100 
    : 0;
  
  const radialBarSeries = [Math.min(userActivityRate, 100)];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const statCards: Array<{
    title: string;
    value: number | string;
    subtitle?: string;
    change?: number;
    changeLabel?: string;
    icon: any;
    color: string;
    bgColor: string;
    searchSection?: string | null;
  }> = [
    {
      title: t.dashboard.totalUsers,
      value: stats?.users.total || 0,
      change: stats?.users.changePercent || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      searchSection: 'users'
    },
    {
      title: t.dashboard.totalPosts,
      value: stats?.posts.published || 0,
      change: stats?.posts.changePercent || 0,
      icon: FileText,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      searchSection: 'posts'
    },
    {
      title: t.dashboard.totalComments,
      value: stats?.comments.total || 0,
      change: stats?.comments.changePercent || 0,
      icon: MessageSquare,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      searchSection: 'comments'
    },
    {
      title: t.dashboard.totalReports,
      value: `${stats?.reports.resolved || 0} / ${stats?.reports.total || 0}`,
      subtitle: '처리완료 / 전체',
      change: (stats?.reports?.total || 0) > 0 
        ? Math.round(((stats?.reports?.resolved || 0) / (stats?.reports?.total || 1)) * 100) 
        : 0,
      changeLabel: '처리 완료',
      icon: Flag,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      searchSection: 'reports'
    },
  ];

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.dashboard.title}</h1>
          <p className="text-gray-600 mt-1">실시간 분석 및 고급 검색</p>
        </div>
        <Button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {t.actions.refresh}
        </Button>
      </div>

      {/* Stats Cards with Search */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-semibold text-gray-900 mt-2">
                      {typeof stat.value === 'string' ? stat.value : stat.value.toLocaleString()}
                    </p>
                    {stat.subtitle && (
                      <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
                    )}
                    {stat.change !== undefined && stat.change !== 0 && (
                      <div className="flex items-center mt-2">
                        {stat.changeLabel ? (
                          <>
                            <span className={`text-sm ${stat.changeLabel === '처리 완료' ? 'text-green-600' : 'text-orange-600'}`}>
                              {stat.changeLabel}: {stat.change}%
                            </span>
                          </>
                        ) : (
                          <>
                            {stat.change > 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                            )}
                            <span className={`text-sm ${stat.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {Math.abs(stat.change)}%
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    
                    {/* Search Section - 모든 카드에서 동일한 높이 유지 */}
                    <div className={stat.searchSection ? 'mt-3' : ''}>
                      {stat.searchSection === 'users' && (
                        <div className="flex gap-1">
                          <Input
                            placeholder={t.users.searchPlaceholder}
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleUserSearch()}
                            className="h-8 text-xs"
                          />
                          <Button onClick={handleUserSearch} size="sm" className="h-8 px-2">
                            <Search className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      
                      {stat.searchSection === 'posts' && (
                        <div className="flex gap-1">
                          <Input
                            placeholder={t.posts.searchPlaceholder}
                            value={postSearch}
                            onChange={(e) => setPostSearch(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handlePostSearch()}
                            className="h-8 text-xs"
                          />
                          <Button onClick={handlePostSearch} size="sm" className="h-8 px-2">
                            <Search className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      
                      {stat.searchSection === 'comments' && (
                        <div className="flex gap-1">
                          <Input
                            placeholder="댓글 검색..."
                            value={commentSearch}
                            onChange={(e) => setCommentSearch(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleCommentSearch()}
                            className="h-8 text-xs"
                          />
                          <Button onClick={handleCommentSearch} size="sm" className="h-8 px-2">
                            <Search className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      
                      {stat.searchSection === 'reports' && (
                        <div className="flex gap-1">
                          <Input
                            placeholder={t.reports.searchPlaceholder}
                            value={reportSearch}
                            onChange={(e) => setReportSearch(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleReportSearch()}
                            className="h-8 text-xs"
                          />
                          <Button onClick={handleReportSearch} size="sm" className="h-8 px-2">
                            <Search className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`p-3 rounded-full ${stat.bgColor} ml-4 flex-shrink-0`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search Results Display */}
      {(searchResults.users.length > 0 || searchResults.posts.length > 0 || searchResults.comments.length > 0 || searchResults.reports.length > 0) && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>검색 결과</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {searchResults.users.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">{t.navigation.users} ({searchResults.users.length})</h3>
                  <div className="space-y-2">
                    {searchResults.users.slice(0, 5).map((user: any) => (
                      <div key={user.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span>{user.username || user.email}</span>
                        <span className="text-sm text-gray-500">ID: {user.id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {searchResults.posts.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">{t.navigation.posts} ({searchResults.posts.length})</h3>
                  <div className="space-y-2">
                    {searchResults.posts.slice(0, 5).map((post: any) => (
                      <div key={post.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span>{post.title}</span>
                        <span className="text-sm text-gray-500">조회수: {post.viewCount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {searchResults.comments.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">댓글 ({searchResults.comments.length})</h3>
                  <div className="space-y-2">
                    {searchResults.comments.slice(0, 5).map((comment: any) => (
                      <div key={comment.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="truncate max-w-xs">{comment.content}</span>
                        <span className="text-sm text-gray-500">작성자: {comment.author?.username || 'Unknown'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {searchResults.reports.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">{t.navigation.reports} ({searchResults.reports.length})</h3>
                  <div className="space-y-2">
                    {searchResults.reports.slice(0, 5).map((report: any) => (
                      <div key={report.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span>{report.reason}</span>
                        <span className={`text-sm px-2 py-1 rounded ${
                          report.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {report.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Trends Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              {t.dashboard.weeklyTrends}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            {trends.length > 0 ? (
              <div className="mt-4">
                <Chart
                  options={lineChartOptions}
                  series={lineChartSeries}
                  type="line"
                  height={350}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                {t.messages.noData}
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.userDistribution}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats && (stats.users.active > 0 || stats.users.inactive > 0 || stats.users.new > 0) ? (
              <Chart
                options={donutChartOptions}
                series={donutChartSeries}
                type="donut"
                height={300}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>사용자 데이터를 수집 중입니다</p>
                  <p className="text-sm mt-1">잠시 후 다시 확인해주세요</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              {t.dashboard.recentActivity}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {activity.length > 0 ? (
                activity.slice(0, 10).map((item, index) => (
                  <div key={item.id || index} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className={`p-2 rounded-full ${
                        item.type === 'user_signup' ? 'bg-blue-100' :
                        item.type === 'post_created' ? 'bg-green-100' :
                        item.type === 'comment_created' ? 'bg-yellow-100' :
                        'bg-red-100'
                      }`}>
                        {item.type === 'user_signup' && <Users className="h-4 w-4 text-blue-600" />}
                        {item.type === 'post_created' && <FileText className="h-4 w-4 text-green-600" />}
                        {item.type === 'comment_created' && <MessageSquare className="h-4 w-4 text-yellow-600" />}
                        {item.type === 'report_created' && <Flag className="h-4 w-4 text-red-600" />}
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{item.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(item.timestamp), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">최근 활동이 없습니다</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.performanceMetrics}</CardTitle>
          </CardHeader>
          <CardContent>
            <Chart
              options={radialBarOptions}
              series={radialBarSeries}
              type="radialBar"
              height={250}
            />
            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xl font-semibold">{stats?.metrics.mau || 0}</p>
                <p className="text-xs text-gray-500">월간 활성 사용자</p>
              </div>
              <div>
                <p className="text-xl font-semibold">{stats?.metrics.dau || 0}</p>
                <p className="text-xs text-gray-500">일간 활성 사용자</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t text-center">
              <p className="text-sm text-gray-600">
                평균 게시물/사용자: <span className="font-semibold">{stats?.metrics.avgPostsPerUser?.toFixed(1) || '0.0'}</span>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                평균 댓글/게시물: <span className="font-semibold">{stats?.metrics.avgCommentsPerPost?.toFixed(1) || '0.0'}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Popular Posts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            인기 포스트
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularPosts.length > 0 ? (
              popularPosts.slice(0, 6).map((post) => (
                <div key={post.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col h-32">
                  <h3 className="font-medium text-gray-900 line-clamp-2 mb-2 flex-1">
                    {post.title}
                  </h3>
                  <div className="flex items-center justify-between text-sm text-gray-500 mt-auto">
                    <span className="flex items-center">
                      <Eye className="h-3 w-3 mr-1" />
                      {post.viewCount}
                    </span>
                    <span className="flex items-center">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      {post.commentCount}
                    </span>
                    <span className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {format(new Date(post.createdAt), 'MMM d')}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 col-span-3">아직 인기 포스트가 없습니다</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics with Better Visualization */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>핵심 성과 지표 (KPI)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center w-20 h-20 mx-auto">
                <svg className="w-20 h-20">
                  <circle
                    className="text-gray-200"
                    strokeWidth="5"
                    stroke="currentColor"
                    fill="transparent"
                    r="30"
                    cx="40"
                    cy="40"
                  />
                  <circle
                    className="text-indigo-600"
                    strokeWidth="5"
                    strokeDasharray={`${((stats?.metrics?.dau || 0) / (stats?.metrics?.mau || 1)) * 188.5} 188.5`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="30"
                    cx="40"
                    cy="40"
                    transform="rotate(-90 40 40)"
                  />
                </svg>
                <span className="absolute text-lg font-semibold">
                  {Math.round(((stats?.metrics?.dau || 0) / (stats?.metrics?.mau || 1)) * 100)}%
                </span>
              </div>
              <p className="text-sm font-medium mt-2">DAU/MAU 비율</p>
              <p className="text-xs text-gray-500">{stats?.metrics.dau || 0} / {stats?.metrics.mau || 0}</p>
            </div>
            
            <div className="text-center">
              <p className="text-3xl font-bold text-indigo-600">
                {stats?.metrics.avgPostsPerUser.toFixed(1) || '0.0'}
              </p>
              <p className="text-sm font-medium mt-2">{t.dashboard.avgPostsPerUser}</p>
              <p className="text-xs text-gray-500">평균</p>
            </div>
            
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                {stats?.metrics.avgCommentsPerPost.toFixed(1) || '0.0'}
              </p>
              <p className="text-sm font-medium mt-2">{t.dashboard.avgCommentsPerPost}</p>
              <p className="text-xs text-gray-500">평균</p>
            </div>
            
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-600">
                {stats?.posts.drafts || 0}
              </p>
              <p className="text-sm font-medium mt-2">{t.dashboard.draftPosts}</p>
              <p className="text-xs text-gray-500">미게시</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}