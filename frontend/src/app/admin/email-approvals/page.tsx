'use client';

/**
 * Task 28: 관리자 이메일 발송 승인 UI
 * - 이메일 발송 승인 대기 목록 조회 및 관리
 * - 이메일 미리보기 기능
 * - 승인/거부 처리 기능
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useRouter } from 'next/navigation';
import {
  FiMail,
  FiCheck,
  FiX,
  FiEye,
  FiClock,
  FiUsers,
  FiFilter,
  FiRefreshCw
} from 'react-icons/fi';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

interface EmailApproval {
  id: string;
  type: string;
  subject: string;
  content: string;
  targetCount: number;
  targetUserIds: string[];
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export default function EmailApprovalsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [approvals, setApprovals] = useState<EmailApproval[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [selectedApproval, setSelectedApproval] = useState<EmailApproval | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Admin 권한 체크
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  // 이메일 승인 목록 조회
  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('type', typeFilter);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/admin/users/email-approvals?${params}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch email approvals');
      }

      const result = await response.json();
      setApprovals(result.data || []);
      setTotal(result.pagination?.total || 0);
    } catch (err: any) {
      console.error('Failed to fetch approvals:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, typeFilter]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchApprovals();
    }
  }, [user, fetchApprovals]);

  // 이메일 미리보기
  const handlePreview = async (approval: EmailApproval) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/admin/users/email-approvals/${approval.id}/preview`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch email preview');
      }

      const result = await response.json();
      setSelectedApproval(result.data);
      setShowPreviewModal(true);
    } catch (err: any) {
      alert('이메일 미리보기를 불러오지 못했습니다');
    }
  };

  // 이메일 발송 승인
  const handleApprove = async (approvalId: string) => {
    if (!confirm('이메일 발송을 승인하시겠습니까?')) return;

    setActionLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/admin/users/email-approvals/${approvalId}/approve`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to approve email');
      }

      alert('이메일 발송이 승인되었습니다');
      fetchApprovals();
    } catch (err: any) {
      alert('승인 처리 중 오류가 발생했습니다');
    } finally {
      setActionLoading(false);
    }
  };

  // 이메일 발송 거부
  const handleReject = async () => {
    if (!selectedApproval || !rejectReason.trim()) {
      alert('거부 사유를 입력해주세요');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/admin/users/email-approvals/${selectedApproval.id}/reject`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: rejectReason }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to reject email');
      }

      alert('이메일 발송이 거부되었습니다');
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedApproval(null);
      fetchApprovals();
    } catch (err: any) {
      alert('거부 처리 중 오류가 발생했습니다');
    } finally {
      setActionLoading(false);
    }
  };

  // 타입 라벨 변환
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      DATA_RETENTION_NOTICE: '개인정보 보유기간 만료 안내',
      ACCOUNT_DELETION_NOTICE: '계정 삭제 완료 안내',
      DORMANT_ACCOUNT_NOTICE: '휴면 계정 전환 안내',
    };
    return labels[type] || type;
  };

  // 상태 라벨 변환
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING_APPROVAL: '승인 대기',
      APPROVED: '승인됨',
      REJECTED: '거부됨',
    };
    return labels[status] || status;
  };

  // 상태별 색상
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING_APPROVAL: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30',
      APPROVED: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30',
      REJECTED: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
    };
    return colors[status] || 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30';
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          이메일 발송 승인 관리
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          대량 이메일 발송 전 관리자 승인이 필요한 이메일 목록입니다
        </p>
      </div>

      {/* 필터 섹션 */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex items-center space-x-2">
          <FiFilter className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          >
            <option value="">모든 상태</option>
            <option value="PENDING_APPROVAL">승인 대기</option>
            <option value="APPROVED">승인됨</option>
            <option value="REJECTED">거부됨</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <FiMail className="text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          >
            <option value="">모든 타입</option>
            <option value="DATA_RETENTION_NOTICE">보유기간 만료 안내</option>
            <option value="ACCOUNT_DELETION_NOTICE">계정 삭제 안내</option>
            <option value="DORMANT_ACCOUNT_NOTICE">휴면 계정 안내</option>
          </select>
        </div>

        <button
          onClick={fetchApprovals}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-black dark:bg-gray-700 text-white rounded-md hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          <span>새로고침</span>
        </button>
      </div>

      {/* 이메일 승인 목록 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  타입
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  제목
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  대상자 수
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  생성일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    로딩 중...
                  </td>
                </tr>
              ) : approvals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    이메일 승인 대기 건이 없습니다
                  </td>
                </tr>
              ) : (
                approvals.map((approval) => (
                  <tr key={approval.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {getTypeLabel(approval.type)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 max-w-md truncate">
                      {approval.subject}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex items-center">
                        <FiUsers className="mr-1 text-gray-400" />
                        {approval.targetCount}명
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(approval.status)}`}>
                        {getStatusLabel(approval.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <FiClock className="mr-1" />
                        {format(new Date(approval.createdAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        onClick={() => handlePreview(approval)}
                        className="inline-flex items-center px-3 py-1 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        <FiEye className="mr-1" />
                        미리보기
                      </button>

                      {approval.status === 'PENDING_APPROVAL' && (
                        <>
                          <button
                            onClick={() => handleApprove(approval.id)}
                            disabled={actionLoading}
                            className="inline-flex items-center px-3 py-1 text-sm text-white bg-green-600 dark:bg-green-700 rounded-md hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50"
                          >
                            <FiCheck className="mr-1" />
                            승인
                          </button>
                          <button
                            onClick={() => {
                              setSelectedApproval(approval);
                              setShowRejectModal(true);
                            }}
                            disabled={actionLoading}
                            className="inline-flex items-center px-3 py-1 text-sm text-white bg-red-600 dark:bg-red-700 rounded-md hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50"
                          >
                            <FiX className="mr-1" />
                            거부
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {total > limit && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              총 {total}건 중 {(page - 1) * limit + 1}-{Math.min(page * limit, total)}건 표시
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50"
              >
                이전
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * limit >= total}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 미리보기 모달 */}
      {showPreviewModal && selectedApproval && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                이메일 미리보기
              </h3>
              <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                <span className="inline-flex items-center">
                  <FiMail className="mr-1" />
                  {getTypeLabel(selectedApproval.type)}
                </span>
                <span className="inline-flex items-center">
                  <FiUsers className="mr-1" />
                  대상자: {selectedApproval.targetCount}명
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  제목
                </label>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100">
                  {selectedApproval.subject}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  본문
                </label>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100 whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {selectedApproval.content}
                </div>
              </div>

              {selectedApproval.status !== 'PENDING_APPROVAL' && (
                <div className={`p-3 rounded-md ${getStatusColor(selectedApproval.status)}`}>
                  <div className="font-medium mb-1">처리 상태: {getStatusLabel(selectedApproval.status)}</div>
                  {selectedApproval.approvedAt && (
                    <div className="text-sm">승인일: {format(new Date(selectedApproval.approvedAt), 'yyyy-MM-dd HH:mm', { locale: ko })}</div>
                  )}
                  {selectedApproval.rejectedAt && (
                    <>
                      <div className="text-sm">거부일: {format(new Date(selectedApproval.rejectedAt), 'yyyy-MM-dd HH:mm', { locale: ko })}</div>
                      {selectedApproval.rejectionReason && (
                        <div className="text-sm mt-1">거부 사유: {selectedApproval.rejectionReason}</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setSelectedApproval(null);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 거부 사유 입력 모달 */}
      {showRejectModal && selectedApproval && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              이메일 발송 거부
            </h3>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              이메일 발송을 거부하는 사유를 입력해주세요.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                거부 사유
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400"
                placeholder="거부 사유를 입력하세요..."
                autoFocus
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 dark:bg-red-700 text-white font-medium rounded-md hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? '처리 중...' : '거부'}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setSelectedApproval(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
