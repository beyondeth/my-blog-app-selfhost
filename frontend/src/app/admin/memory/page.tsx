'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Database,
  HardDrive,
  Activity,
  Server,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Check,
  X,
  TrendingUp,
  TrendingDown,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MemoryUsage {
  itemCount: number;
  estimatedSize: string;
  maxItems: number;
  maxSize: string;
  usagePercent: number;
  cacheType: string;
  hits?: number;
  misses?: number;
  sets?: number;
  deletes?: number;
  hitRate?: number;
  namespaces?: Record<string, number>; // Redis 네임스페이스별 통계
  patternAnalysis?: {
    mostUsed: { pattern: string; count: number };
    recommendations: string[];
    inefficientPatterns: string[];
  };
  uptimeHuman?: string;
  hitsPerHour?: number;
  missesPerHour?: number;
  redisInfo?: {
    version?: string;
    connectedClients?: number;
    uptime?: number;
    memoryRss?: string;
  };
}

interface CacheStats {
  totalKeys: number;
  patterns: {
    [key: string]: number;
  };
  hits?: number;
  misses?: number;
  sets?: number;
  deletes?: number;
  hitRate?: string;
}

export default function AdminMemoryPage() {
  const [memoryUsage, setMemoryUsage] = useState<MemoryUsage | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [patternToDelete, setPatternToDelete] = useState<string | null>(null);
  const [namespaceToDelete, setNamespaceToDelete] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [redisInfo, setRedisInfo] = useState<any>(null);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  // 메모리 사용량 조회
  const fetchMemoryUsage = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/cache/memory-usage`, {
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
        throw new Error('Failed to fetch memory usage');
      }

      const data = await response.json();
      setMemoryUsage(data);
    } catch (error) {
      console.error('Error fetching memory usage:', error);
      toast.error('메모리 사용량을 불러오는데 실패했습니다');
    }
  }, [API_URL, router]);

  // 캐시 통계 조회
  const fetchCacheStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/cache/stats`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setCacheStats(data);
      }
    } catch (error) {
      console.error('Error fetching cache stats:', error);
    }
  }, [API_URL]);

  // Redis 정보 조회
  const fetchRedisInfo = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/cache/redis-info`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setRedisInfo(data);
      }
    } catch (error) {
      console.error('Error fetching Redis info:', error);
    }
  }, [API_URL]);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchMemoryUsage(), fetchCacheStats(), fetchRedisInfo()]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchMemoryUsage, fetchCacheStats, fetchRedisInfo]);

  // 초기 로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 자동 새로고침
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchMemoryUsage();
      fetchCacheStats();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchMemoryUsage, fetchCacheStats]);

  // 캐시 초기화
  const handleResetCache = async () => {
    try {
      const response = await fetch(`${API_URL}/cache/reset`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to reset cache');
      }

      toast.success('캐시가 초기화되었습니다');
      setResetDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error('Error resetting cache:', error);
      toast.error('캐시 초기화에 실패했습니다');
    }
  };

  // 패턴별 캐시 삭제
  const handleDeletePattern = async (pattern: string) => {
    try {
      const response = await fetch(`${API_URL}/cache/pattern/${encodeURIComponent(pattern)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete pattern');
      }

      toast.success(`패턴 '${pattern}' 캐시가 삭제되었습니다`);
      setPatternToDelete(null);
      await loadData();
    } catch (error) {
      console.error('Error deleting pattern:', error);
      toast.error('패턴 삭제에 실패했습니다');
    }
  };

  // 네임스페이스별 캐시 삭제
  const handleDeleteNamespace = async (namespace: string) => {
    try {
      const response = await fetch(`${API_URL}/cache/namespace/${encodeURIComponent(namespace)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete namespace');
      }

      toast.success(`네임스페이스 '${namespace}' 캐시가 삭제되었습니다`);
      setNamespaceToDelete(null);
      await loadData();
    } catch (error) {
      console.error('Error deleting namespace:', error);
      toast.error('네임스페이스 삭제에 실패했습니다');
    }
  };

  // 수동 새로고침
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  // 사용률에 따른 색상 결정
  const getUsageColor = (percent: number) => {
    if (percent < 60) return 'bg-green-500';
    if (percent < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getUsageTextColor = (percent: number) => {
    if (percent < 60) return 'text-green-600';
    if (percent < 80) return 'text-yellow-600';
    return 'text-red-600';
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
        <h1 className="text-2xl font-bold text-gray-900">Redis 캐시 관리</h1>
        <p className="text-gray-600 mt-1">Redis 캐시 메모리 사용량 모니터링 및 관리</p>
      </div>

      {/* 상단 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">캐시 아이템</p>
              <p className="text-2xl font-bold">
                {memoryUsage?.itemCount || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                최대 {memoryUsage?.maxItems || 0}개
              </p>
            </div>
            <Database className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">메모리 사용량</p>
              <p className="text-2xl font-bold">
                {memoryUsage?.estimatedSize || '0 B'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                최대 {memoryUsage?.maxSize || '0 B'}
              </p>
            </div>
            <HardDrive className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">사용률</p>
              <p className={`text-2xl font-bold ${memoryUsage ? getUsageTextColor(memoryUsage.usagePercent) : ''}`}>
                {memoryUsage?.usagePercent.toFixed(1) || 0}%
              </p>
              {memoryUsage && memoryUsage.usagePercent > 80 && (
                <p className="text-xs text-red-600 mt-1 flex items-center">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  높은 사용률
                </p>
              )}
            </div>
            <Activity className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">캐시 타입</p>
              <p className="text-2xl font-bold capitalize">
                {memoryUsage?.cacheType || 'unknown'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {memoryUsage?.cacheType === 'redis' ? 'Redis 서버' : memoryUsage?.cacheType === 'error' ? '연결 오류' : '메모리 캐시'}
              </p>
            </div>
            <Server className="w-8 h-8 text-gray-400" />
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
            onClick={() => setResetDialogOpen(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            전체 캐시 초기화
          </button>
        </div>
      </div>

      {/* 캐시 성능 통계 */}
      {memoryUsage && (memoryUsage.hits !== undefined || memoryUsage.misses !== undefined) && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">캐시 성능 통계</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Hits</p>
              <p className="text-2xl font-bold text-green-600">{memoryUsage.hits || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Misses</p>
              <p className="text-2xl font-bold text-red-600">{memoryUsage.misses || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Sets</p>
              <p className="text-2xl font-bold text-blue-600">{memoryUsage.sets || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Deletes</p>
              <p className="text-2xl font-bold text-gray-600">{memoryUsage.deletes || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Hit Rate</p>
              <p className={`text-2xl font-bold ${(memoryUsage.hitRate || 0) >= 80 ? 'text-green-600' : (memoryUsage.hitRate || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                {memoryUsage.hitRate?.toFixed(1) || 0}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 메모리 사용량 상세 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">메모리 사용량 상세</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">사용률</span>
              <span className={`text-sm font-bold ${memoryUsage ? getUsageTextColor(memoryUsage.usagePercent) : ''}`}>
                {memoryUsage?.usagePercent.toFixed(2) || 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${memoryUsage ? getUsageColor(memoryUsage.usagePercent) : 'bg-gray-300'}`}
                style={{ width: `${memoryUsage?.usagePercent || 0}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>{memoryUsage?.estimatedSize || '0 B'}</span>
              <span>{memoryUsage?.maxSize || '0 B'}</span>
            </div>
          </div>

          {memoryUsage && memoryUsage.usagePercent > 80 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">높은 메모리 사용률 경고</p>
                <p className="text-sm text-red-700 mt-1">
                  메모리 사용률이 80%를 초과했습니다. 캐시 정리를 고려하세요.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 패턴 분석 및 권장사항 */}
      {memoryUsage?.patternAnalysis && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">캐시 패턴 분석</h2>

          {/* 가장 많이 사용되는 패턴 */}
          {memoryUsage.patternAnalysis.mostUsed.pattern && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">가장 많이 사용되는 패턴</p>
              <p className="text-lg font-semibold">
                {memoryUsage.patternAnalysis.mostUsed.pattern}
                <span className="text-sm text-gray-500 ml-2">
                  ({memoryUsage.patternAnalysis.mostUsed.count}개)
                </span>
              </p>
            </div>
          )}

          {/* 권장사항 */}
          {memoryUsage.patternAnalysis.recommendations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-blue-900 mb-2">개선 권장사항</p>
              <ul className="text-sm text-blue-700 space-y-1">
                {memoryUsage.patternAnalysis.recommendations.map((rec, idx) => (
                  <li key={idx}>• {rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 비효율적 패턴 */}
          {memoryUsage.patternAnalysis.inefficientPatterns.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm font-medium text-yellow-900 mb-2">비효율적 패턴 감지</p>
              <div className="text-sm text-yellow-700">
                {memoryUsage.patternAnalysis.inefficientPatterns.join(', ')}
              </div>
            </div>
          )}

          {/* 성능 지표 */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            {memoryUsage.uptimeHuman && (
              <div className="text-center">
                <p className="text-sm text-gray-600">가동 시간</p>
                <p className="text-lg font-semibold">{memoryUsage.uptimeHuman}</p>
              </div>
            )}
            {memoryUsage.hitsPerHour && (
              <div className="text-center">
                <p className="text-sm text-gray-600">시간당 히트</p>
                <p className="text-lg font-semibold">{memoryUsage.hitsPerHour.toLocaleString()}</p>
              </div>
            )}
            {memoryUsage.missesPerHour && (
              <div className="text-center">
                <p className="text-sm text-gray-600">시간당 미스</p>
                <p className="text-lg font-semibold">{memoryUsage.missesPerHour.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Redis 네임스페이스별 통계 */}
      {memoryUsage?.namespaces && Object.keys(memoryUsage.namespaces).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Redis 네임스페이스별 통계</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(memoryUsage.namespaces).map(([namespace, count]) => (
              <div key={namespace} className="border rounded-lg p-3 relative group">
                <p className="text-sm text-gray-600 capitalize">{namespace}</p>
                <p className="text-xl font-bold">{count}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {memoryUsage.itemCount > 0
                    ? `${((count / memoryUsage.itemCount) * 100).toFixed(1)}%`
                    : '0%'
                  }
                </p>
                <button
                  onClick={() => setNamespaceToDelete(namespace)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-800"
                  title={`${namespace} 네임스페이스 삭제`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Redis 서버 정보 */}
      {redisInfo && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Redis 서버 정보</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {redisInfo.redis_version && (
              <div>
                <p className="text-sm text-gray-600">Redis 버전</p>
                <p className="text-lg font-semibold">{redisInfo.redis_version}</p>
              </div>
            )}
            {redisInfo.connected_clients && (
              <div>
                <p className="text-sm text-gray-600">연결된 클라이언트</p>
                <p className="text-lg font-semibold">{redisInfo.connected_clients}</p>
              </div>
            )}
            {redisInfo.uptime_in_days && (
              <div>
                <p className="text-sm text-gray-600">가동 시간</p>
                <p className="text-lg font-semibold">{redisInfo.uptime_in_days} 일</p>
              </div>
            )}
            {redisInfo.used_memory_human && (
              <div>
                <p className="text-sm text-gray-600">메모리 사용량</p>
                <p className="text-lg font-semibold">{redisInfo.used_memory_human}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 캐시 통계 테이블 */}
      {cacheStats && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">캐시 패턴별 통계</h2>
            <p className="text-sm text-gray-600 mt-1">총 {cacheStats.totalKeys || memoryUsage?.itemCount || 0}개 키</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    패턴
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    키 개수
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    비율
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cacheStats.patterns && Object.entries(cacheStats.patterns).map(([pattern, count]) => {
                  const percentage = cacheStats.totalKeys > 0 
                    ? ((count / cacheStats.totalKeys) * 100).toFixed(1)
                    : '0';
                  
                  return (
                    <tr key={pattern} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{pattern}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{count}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-sm text-gray-900 mr-2">{percentage}%</span>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setPatternToDelete(pattern)}
                          className="text-red-600 hover:text-red-900"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {(!cacheStats.patterns || Object.keys(cacheStats.patterns).length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      캐시 데이터가 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 전체 캐시 초기화 확인 대화상자 */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>전체 캐시 초기화</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 모든 캐시를 초기화하시겠습니까? 이 작업은 되돌릴 수 없으며,
              일시적으로 성능이 저하될 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetCache}
              className="bg-red-600 hover:bg-red-700"
            >
              초기화
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 패턴 삭제 확인 대화상자 */}
      <AlertDialog open={!!patternToDelete} onOpenChange={(open) => !open && setPatternToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>패턴 캐시 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              '{patternToDelete}' 패턴의 모든 캐시를 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => patternToDelete && handleDeletePattern(patternToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 네임스페이스 삭제 확인 대화상자 */}
      <AlertDialog open={!!namespaceToDelete} onOpenChange={(open) => !open && setNamespaceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>네임스페이스 캐시 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              '{namespaceToDelete}' 네임스페이스의 모든 캐시를 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => namespaceToDelete && handleDeleteNamespace(namespaceToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}