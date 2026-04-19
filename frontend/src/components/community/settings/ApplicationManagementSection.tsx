'use client';

import { useState } from 'react';
import { UserCheck, UserX, Clock, ChevronDown, ChevronUp, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  usePendingApplications,
  useApproveApplication,
  useRejectApplication,
} from '@/hooks/community';
import type { PendingApplication } from '@/types/community';
import { cn } from '@/lib/utils';
import { DESTRUCTIVE_ACTION_CLASS, DESTRUCTIVE_BORDER_CLASS } from '@/constants/accessibility';

interface ApplicationManagementSectionProps {
  slug: string;
}

/**
 * 가입 신청 관리 섹션
 *
 * @description RESTRICTED 커뮤니티에서 대기 중인 가입 신청을 관리
 * - 신청 목록 조회
 * - 승인/거부 처리
 */
export function ApplicationManagementSection({ slug }: ApplicationManagementSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // 대기 중인 신청 목록 조회
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePendingApplications(slug, { limit: 10 });

  const approveMutation = useApproveApplication(slug);
  const rejectMutation = useRejectApplication(slug);

  // 모든 페이지의 신청 목록을 평탄화
  const applications = data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = data?.pages[0]?.total ?? 0;

  // 승인 처리
  const handleApprove = async (userId: string) => {
    try {
      await approveMutation.mutateAsync(userId);
    } catch {
      // 에러는 mutation에서 처리
    }
  };

  // 거부 처리
  const handleReject = async (userId: string) => {
    try {
      await rejectMutation.mutateAsync({ userId });
    } catch {
      // 에러는 mutation에서 처리
    }
  };

  return (
    <section className="bg-white dark:bg-slate-950/50 rounded-xl border border-gray-200 shadow-sm dark:border-gray-800/70 overflow-hidden">
      {/* 헤더 (접기/펼치기) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Pending join requests
          </h2>
          {totalCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full">
              {totalCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* 내용 */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-800/70">
          {isLoading ? (
            <div className="py-8 text-center">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto" />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading...</p>
            </div>
          ) : isError ? (
            <div className="py-8 text-center text-red-500">
              Failed to load the request list.
            </div>
          ) : applications.length === 0 ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No pending join requests.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {applications.map((application) => (
                <ApplicationItem
                  key={application.id}
                  application={application}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  isApproving={approveMutation.isPending}
                  isRejecting={rejectMutation.isPending}
                />
              ))}

              {/* 더 보기 버튼 */}
              {hasNextPage && (
                <div className="pt-2 text-center">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? 'Loading...' : 'Load more'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

interface ApplicationItemProps {
  application: PendingApplication;
  onApprove: (userId: string) => void;
  onReject: (userId: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

function ApplicationItem({
  application,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: ApplicationItemProps) {
  const [localLoading, setLocalLoading] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = async () => {
    setLocalLoading('approve');
    await onApprove(application.userId);
    setLocalLoading(null);
  };

  const handleReject = async () => {
    setLocalLoading('reject');
    await onReject(application.userId);
    setLocalLoading(null);
  };

  const isLoading = localLoading !== null;

  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl border border-gray-200 dark:border-gray-800/70 bg-white dark:bg-slate-950/40">
      {/* 프로필 이미지 */}
      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-900/60 overflow-hidden flex-shrink-0">
        {application.user?.profileImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={application.user.profileImage}
              alt={application.user.username}
              className="w-full h-full object-cover"
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <User className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* 정보 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {application.user?.username ?? 'Unknown user'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(application.joinedAt).toLocaleDateString('en-US')}
          </span>
        </div>
        {application.applicationMessage && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
            {application.applicationMessage}
          </p>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={handleReject}
          disabled={isLoading}
          className={cn(
            DESTRUCTIVE_ACTION_CLASS,
            DESTRUCTIVE_BORDER_CLASS,
            localLoading === 'reject' && 'opacity-50'
          )}
        >
          {localLoading === 'reject' ? (
            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <UserX className="w-4 h-4" />
          )}
        </Button>
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={isLoading}
          className={cn(
            'bg-green-600 hover:bg-green-700 text-white',
            localLoading === 'approve' && 'opacity-50'
          )}
        >
          {localLoading === 'approve' ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <UserCheck className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
