'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, AlertTriangle, Clock, CheckCircle, XCircle, RefreshCw, Filter, X } from 'lucide-react';

interface SuspiciousRequest {
  id: string;
  requestType: string;
  ipAddress: string;
  endpoint: string;
  userId?: string;
  userEmail?: string;
  requestDetails: any;
  userAgent?: string;
  reason: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isResolved: boolean;
  resolvedNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

interface MonitoringStats {
  totalRequests: number;
  unresolvedCount: number;
  todayCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  topIPs: Array<{ ip: string; count: number }>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
}

export default function MonitoringPage() {
  const [requests, setRequests] = useState<SuspiciousRequest[]>([]);
  const [stats, setStats] = useState<MonitoringStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [showUnresolvedOnly, setShowUnresolvedOnly] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [reviewingRequest, setReviewingRequest] = useState<SuspiciousRequest | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewAction, setReviewAction] = useState<'resolved' | 'unresolved'>('resolved');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  const fetchMonitoringData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch suspicious requests
      const params = new URLSearchParams();
      if (selectedSeverity !== 'all') params.append('severity', selectedSeverity);
      if (showUnresolvedOnly) params.append('isResolved', 'false');
      
      const [requestsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/monitoring/suspicious-requests?${params}`, {
          credentials: 'include',
        }),
        fetch(`${API_URL}/monitoring/dashboard`, {
          credentials: 'include',
        })
      ]);

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        // 백엔드가 페이지네이션 객체를 반환하면 items 속성 사용, 아니면 data 자체 사용
        const requestsData = data.items || data || [];
        setRequests(Array.isArray(requestsData) ? requestsData : []);
      } else {
        setRequests([]);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        // 기본값 설정으로 undefined 방지
        setStats({
          totalRequests: data.totalRequests || 0,
          unresolvedCount: data.unresolvedCount || 0,
          todayCount: data.todayCount || 0,
          criticalCount: data.criticalCount || 0,
          highCount: data.highCount || 0,
          mediumCount: data.mediumCount || 0,
          lowCount: data.lowCount || 0,
          topIPs: data.topIPs || [],
          topEndpoints: data.topEndpoints || [],
        });
      } else {
        // 기본 stats 객체 설정
        setStats({
          totalRequests: 0,
          unresolvedCount: 0,
          todayCount: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          topIPs: [],
          topEndpoints: [],
        });
      }
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedSeverity, showUnresolvedOnly, API_URL]);

  useEffect(() => {
    fetchMonitoringData();
  }, [fetchMonitoringData]);

  const handleReview = (request: SuspiciousRequest) => {
    setReviewingRequest(request);
    setReviewNote(request.resolvedNote || '');
    setReviewAction(request.isResolved ? 'resolved' : 'unresolved');
  };

  const handleResolve = async () => {
    if (!reviewingRequest) return;
    
    try {
      setResolving(reviewingRequest.id);
      const response = await fetch(`${API_URL}/monitoring/suspicious-requests/${reviewingRequest.id}/resolve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          note: reviewNote,
          action: reviewAction 
        }),
      });

      if (response.ok) {
        await fetchMonitoringData();
        setReviewingRequest(null);
        setReviewNote('');
        setReviewAction('resolved');
      }
    } catch (error) {
      console.error('Failed to resolve request:', error);
    } finally {
      setResolving(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-600 bg-red-50';
      case 'HIGH': return 'text-orange-600 bg-orange-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'LOW': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes}분 전`;
    } else if (diffHours < 24) {
      return `${diffHours}시간 전`;
    } else {
      return date.toLocaleDateString('ko-KR') + ' ' + date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Shield className="h-8 w-8" />
          보안 모니터링 대시보드
        </h1>
        <p className="text-gray-600 mt-2">비정상적인 요청 및 보안 위협을 모니터링합니다</p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">전체 요청</p>
                <p className="text-2xl font-bold">{stats.totalRequests}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">방어 성공</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalRequests}</p>
              </div>
              <Shield className="h-8 w-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600">오늘 발생</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.todayCount}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">검토 완료</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.totalRequests - stats.unresolvedCount}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </div>
        </div>
      )}

      {/* Attack Type Distribution */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">공격 유형별 통계</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Limit Abuse (페이지네이션 공격)</span>
                <span className="text-sm font-bold">{stats.totalRequests || 0}건</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">SQL Injection 시도</span>
                <span className="text-sm font-bold">0건</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">XSS 공격 시도</span>
                <span className="text-sm font-bold">0건</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Rate Limit 초과</span>
                <span className="text-sm font-bold">0건</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">상위 IP 주소</h3>
            <div className="space-y-2">
              {stats.topIPs && stats.topIPs.length > 0 ? (
                stats.topIPs.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm font-mono">{item.ip}</span>
                    <span className="text-sm font-bold">{item.count}건</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">데이터 없음</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium">필터:</span>
          </div>
          
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">모든 심각도</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showUnresolvedOnly}
              onChange={(e) => setShowUnresolvedOnly(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">검토 대기만 보기</span>
          </label>

          <button
            onClick={fetchMonitoringData}
            className="ml-auto px-4 py-1 bg-black text-white rounded-md text-sm hover:bg-gray-800 flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            새로고침
          </button>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                시간
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                공격 유형
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                심각도
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                IP 주소
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                엔드포인트
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                사용자
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                공격 상세
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                방어 결과
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {requests && Array.isArray(requests) && requests.map((request) => (
              <tr key={request.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(request.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {request.requestType === 'EXCESSIVE_LIMIT' ? 'Limit Abuse' : request.requestType}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(request.severity)}`}>
                    {request.severity}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                  {request.ipAddress}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={request.endpoint}>
                  {request.endpoint}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {request.userEmail || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs" title={request.reason}>
                  <div className="text-xs">
                    {request.requestDetails?.attemptedLimit && (
                      <span>요청: limit={request.requestDetails.attemptedLimit} → 차단: limit={request.requestDetails.actualLimit || 20}</span>
                    )}
                    {!request.requestDetails?.attemptedLimit && request.reason}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {request.isResolved ? (
                    <span className="px-2 py-1 text-xs font-medium text-green-600 bg-green-50 rounded-full flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      검토완료
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-full flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      방어됨
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleReview(request)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    검토
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {requests.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            조건에 맞는 요청이 없습니다
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewingRequest && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">보안 요청 검토</h3>
              <button
                onClick={() => setReviewingRequest(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Request Details */}
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600">공격 유형</p>
                <p className="font-medium">
                  {reviewingRequest.requestType === 'EXCESSIVE_LIMIT' ? 'Limit Abuse' : reviewingRequest.requestType}
                </p>
              </div>

              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600">IP 주소</p>
                <p className="font-mono">{reviewingRequest.ipAddress}</p>
              </div>

              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600">공격 상세</p>
                <p className="text-sm">
                  {reviewingRequest.requestDetails?.attemptedLimit && (
                    <>요청: limit={reviewingRequest.requestDetails.attemptedLimit} → 차단: limit={reviewingRequest.requestDetails.actualLimit || 20}</>
                  )}
                  {!reviewingRequest.requestDetails?.attemptedLimit && reviewingRequest.reason}
                </p>
              </div>

              {/* Resolution Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  처리 상태
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="resolved"
                      checked={reviewAction === 'resolved'}
                      onChange={(e) => setReviewAction(e.target.value as 'resolved' | 'unresolved')}
                      className="mr-2"
                    />
                    <span className="text-sm">침투 실패 (정상 방어)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="unresolved"
                      checked={reviewAction === 'unresolved'}
                      onChange={(e) => setReviewAction(e.target.value as 'resolved' | 'unresolved')}
                      className="mr-2"
                    />
                    <span className="text-sm text-red-600">침투 성공 (추가 조치 필요)</span>
                  </label>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  처리 메모
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  rows={3}
                  placeholder="처리 내용을 입력하세요..."
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setReviewingRequest(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleResolve}
                  disabled={!!resolving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {resolving ? '처리중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}