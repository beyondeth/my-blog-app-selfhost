'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Shield,
  Clock,
  Activity,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Check,
  X,
  Ban,
  Key,
  Globe,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface NonceStats {
  activeNonces: number;
  nonceTTL: number;
  recentNonces: Array<{
    nonce: string;
    timestamp: number;
    age: string;
  }>;
  validationStats: {
    success: number;
    failure: number;
    successRate: number;
  };
}

interface RateLimitStats {
  perMinute: {
    limit: number;
    current: { [key: string]: number };
  };
  perHour: {
    limit: number;
    current: { [key: string]: number };
  };
  perDay: {
    limit: number;
    current: { [key: string]: number };
  };
  blocked: Array<{
    identifier: string;
    type: 'ip' | 'apiKey';
    blockedAt: number;
    unblockAt: number;
    reason: string;
  }>;
}

interface NonceConfig {
  nonceTTL: number;
  rateLimit: {
    perMinute: number;
    perHour: number;
    perDay: number;
    blockDuration: number;
  };
  cacheType: string;
}

export default function AdminNoncePage() {
  const [nonceStats, setNonceStats] = useState<NonceStats | null>(null);
  const [rateLimitStats, setRateLimitStats] = useState<RateLimitStats | null>(null);
  const [config, setConfig] = useState<NonceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  // 논스 통계 조회
  const fetchNonceStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/admin/nonce/stats`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('로그인이 필요합니다');
          router.push('/login');
          return;
        }
        if (response.status === 403) {
          toast.error('관리자 권한이 필요합니다');
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch nonce stats');
      }

      const data = await response.json();

      // 데이터 구조 분리
      if (data.nonceStats) {
        setNonceStats(data.nonceStats);
      }
      if (data.rateLimitStats) {
        setRateLimitStats(data.rateLimitStats);
      }
      if (data.systemInfo) {
        setConfig(data.systemInfo);
      }
    } catch (error) {
      console.error('Error fetching nonce stats:', error);
      toast.error('논스 통계를 불러오는데 실패했습니다');
    }
  }, [API_URL, router]);

  // 설정 정보 조회
  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/admin/nonce/config`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  }, [API_URL]);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchNonceStats(), fetchConfig()]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchNonceStats, fetchConfig]);

  // 초기 로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 자동 새로고침
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchNonceStats();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchNonceStats]);

  // 논스 정리
  const handleCleanup = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/nonce/cleanup`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup nonces');
      }

      const result = await response.json();
      toast.success(`${result.cleaned || 0}개의 만료된 논스가 정리되었습니다`);
      setCleanupDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error('Error cleaning up nonces:', error);
      toast.error('논스 정리에 실패했습니다');
    }
  };

  // 차단 해제
  const handleUnblock = async (identifier: string) => {
    try {
      const response = await fetch(`${API_URL}/admin/nonce/unblock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ identifier }),
      });

      if (!response.ok) {
        throw new Error('Failed to unblock');
      }

      toast.success(`${identifier} 차단이 해제되었습니다`);
      await loadData();
    } catch (error) {
      console.error('Error unblocking:', error);
      toast.error('차단 해제에 실패했습니다');
    }
  };

  // 수동 새로고침
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  // 사용률에 따른 색상 결정
  const getUsageColor = (current: number, limit: number) => {
    const percent = (current / limit) * 100;
    if (percent < 60) return 'text-green-600';
    if (percent < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  // 시간 포맷팅
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}초 전`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    return `${hours}시간 전`;
  };

  // 로딩 상태
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">논스 관리</h1>
        <p className="text-gray-600 mt-1">MCP 인증 논스 및 Rate Limiting 모니터링</p>
      </div>

      {/* 상단 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">활성 논스</p>
              <p className="text-2xl font-bold">
                {nonceStats?.activeNonces || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                TTL: {config?.nonceTTL ? `${config.nonceTTL / 1000}초` : 'N/A'}
              </p>
            </div>
            <Shield className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">검증 성공률</p>
              <p className={`text-2xl font-bold ${nonceStats?.validationStats.successRate ? getUsageColor(100 - nonceStats.validationStats.successRate, 100) : 'text-gray-900'}`}>
                {nonceStats?.validationStats.successRate.toFixed(1) || 0}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                성공: {nonceStats?.validationStats.success || 0} / 실패: {nonceStats?.validationStats.failure || 0}
              </p>
            </div>
            <Activity className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">차단된 요청</p>
              <p className="text-2xl font-bold text-red-600">
                {rateLimitStats?.blocked.length || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                차단 시간: {config?.rateLimit?.blockDuration ? `${config.rateLimit.blockDuration}초` : 'N/A'}
              </p>
            </div>
            <Ban className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">캐시 타입</p>
              <p className="text-2xl font-bold capitalize">
                {config?.cacheType || 'unknown'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {config?.cacheType === 'redis' ? 'Redis 서버' : '메모리 캐시'}
              </p>
            </div>
            <Clock className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* 제어 패널 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">자동 새로고침 (5초)</span>
            </label>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
              title="새로고침"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <button
            onClick={() => setCleanupDialogOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            만료된 논스 정리
          </button>
        </div>
      </div>

      {/* Rate Limiting 설정 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Rate Limiting 설정</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">분당 제한</span>
              <span className="text-xl font-bold">{config?.rateLimit?.perMinute || 0}회</span>
            </div>
            <div className="space-y-2">
              {rateLimitStats?.perMinute.current && Object.entries(rateLimitStats.perMinute.current).slice(0, 3).map(([key, count]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate max-w-[150px]">{key}</span>
                  <span className={getUsageColor(count, config?.rateLimit?.perMinute || 3)}>{count}/{config?.rateLimit?.perMinute || 3}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">시간당 제한</span>
              <span className="text-xl font-bold">{config?.rateLimit?.perHour || 0}회</span>
            </div>
            <div className="space-y-2">
              {rateLimitStats?.perHour.current && Object.entries(rateLimitStats.perHour.current).slice(0, 3).map(([key, count]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate max-w-[150px]">{key}</span>
                  <span className={getUsageColor(count, config?.rateLimit?.perHour || 10)}>{count}/{config?.rateLimit?.perHour || 10}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">일일 제한</span>
              <span className="text-xl font-bold">{config?.rateLimit?.perDay || 0}회</span>
            </div>
            <div className="space-y-2">
              {rateLimitStats?.perDay.current && Object.entries(rateLimitStats.perDay.current).slice(0, 3).map(([key, count]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate max-w-[150px]">{key}</span>
                  <span className={getUsageColor(count, config?.rateLimit?.perDay || 10)}>{count}/{config?.rateLimit?.perDay || 10}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 최근 사용된 논스 */}
      {nonceStats?.recentNonces && nonceStats.recentNonces.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">최근 사용된 논스</h2>
          <div className="space-y-2">
            {nonceStats.recentNonces.slice(0, 5).map((nonce, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div className="flex items-center gap-3">
                  <Key className="w-4 h-4 text-gray-400" />
                  <span className="font-mono text-sm text-gray-700">{nonce.nonce.substring(0, 20)}...</span>
                </div>
                <span className="text-sm text-gray-500">{formatTimeAgo(nonce.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 차단 목록 */}
      {rateLimitStats?.blocked && rateLimitStats.blocked.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">차단된 IP/API Key</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    식별자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    타입
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    차단 시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    해제 예정
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사유
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rateLimitStats.blocked.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {item.type === 'ip' ? <Globe className="w-4 h-4 mr-2 text-gray-400" /> : <Key className="w-4 h-4 mr-2 text-gray-400" />}
                        <span className="text-sm font-medium text-gray-900">{item.identifier}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        item.type === 'ip' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {item.type === 'ip' ? 'IP' : 'API Key'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTimeAgo(item.blockedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTimeAgo(item.unblockAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.reason}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleUnblock(item.identifier)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        해제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 논스 정리 확인 대화상자 */}
      <AlertDialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>만료된 논스 정리</AlertDialogTitle>
            <AlertDialogDescription>
              만료된 논스를 정리하시겠습니까? 이 작업은 성능 향상에 도움이 됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCleanup}
              className="bg-blue-600 hover:bg-blue-700"
            >
              정리
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}