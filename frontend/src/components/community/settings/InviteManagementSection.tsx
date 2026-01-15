'use client';

import { useState, useCallback } from 'react';
import {
  Link as LinkIcon,
  Plus,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useCommunityInvites,
  useCreateInvite,
  useRevokeInvite,
} from '@/hooks/community';
import type { CommunityInvite, CreateInviteDto } from '@/types/community';
import { cn } from '@/lib/utils';
import { DESTRUCTIVE_ACTION_CLASS, DESTRUCTIVE_BORDER_CLASS } from '@/constants/accessibility';

interface InviteManagementSectionProps {
  slug: string;
}

const MAX_USE_OPTIONS = [
  { label: '무제한', value: 0 },
  { label: '1회', value: 1 },
  { label: '5회', value: 5 },
  { label: '10회', value: 10 },
  { label: '25회', value: 25 },
  { label: '50회', value: 50 },
  { label: '100회', value: 100 },
];

const EXPIRE_OPTIONS = [
  { label: '1시간', value: 1 },
  { label: '6시간', value: 6 },
  { label: '12시간', value: 12 },
  { label: '1일', value: 24 },
  { label: '3일', value: 72 },
  { label: '7일', value: 168 },
  { label: '30일', value: 720 },
];

/**
 * 초대 링크 관리 섹션
 *
 * @description RESTRICTED/PRIVATE 커뮤니티에서 초대 링크 관리
 * - 초대 링크 생성 (만료 시간, 사용 횟수 설정)
 * - 초대 링크 목록 조회
 * - 초대 링크 삭제
 */
export function InviteManagementSection({ slug }: InviteManagementSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // 초대 목록 조회
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCommunityInvites(slug, { limit: 10 });

  const createMutation = useCreateInvite(slug);
  const revokeMutation = useRevokeInvite(slug);

  // 모든 페이지의 초대 목록을 평탄화
  const invites = data?.pages.flatMap((page) => page.items) ?? [];

  // 초대 링크 생성
  const handleCreate = async (dto: CreateInviteDto) => {
    try {
      await createMutation.mutateAsync(dto);
      setShowCreateForm(false);
    } catch {
      // 에러는 mutation에서 처리
    }
  };

  // 초대 링크 삭제
  const handleRevoke = async (inviteId: string) => {
    try {
      await revokeMutation.mutateAsync(inviteId);
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
          <LinkIcon className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            초대 링크 관리
          </h2>
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
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              초대 링크는 승인형/비공개 커뮤니티에서 멤버를 초대할 때 사용됩니다.
            </p>
            {!showCreateForm && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 w-full sm:w-auto"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="w-4 h-4" />
                새 초대 링크
              </Button>
            )}
          </div>
          {showCreateForm && (
            <div className="mt-3">
              <CreateInviteForm
                onCreate={handleCreate}
                onCancel={() => setShowCreateForm(false)}
                isCreating={createMutation.isPending}
              />
            </div>
          )}

          {/* 초대 목록 */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              활성화된 초대 링크
            </h3>

            {isLoading ? (
              <div className="py-6 text-center">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto" />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">로딩 중...</p>
              </div>
            ) : isError ? (
              <div className="py-6 text-center text-red-500">
                초대 목록을 불러오는데 실패했습니다.
              </div>
            ) : invites.length === 0 ? (
              <div className="py-6 text-center text-gray-500 dark:text-gray-400">
                <LinkIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>생성된 초대 링크가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {invites.map((invite) => (
                  <InviteItem
                    key={invite.id}
                    invite={invite}
                    onRevoke={handleRevoke}
                    isRevoking={revokeMutation.isPending}
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
                      {isFetchingNextPage ? '로딩 중...' : '더 보기'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

interface CreateInviteFormProps {
  onCreate: (dto: CreateInviteDto) => void;
  onCancel: () => void;
  isCreating: boolean;
}

function CreateInviteForm({ onCreate, onCancel, isCreating }: CreateInviteFormProps) {
  const [maxUses, setMaxUses] = useState(0);
  const [expiresInHours, setExpiresInHours] = useState(168);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onCreate({ maxUses, expiresInHours });
  };

  const pillClasses = (isActive: boolean) =>
    cn(
      'px-3 py-1.5 rounded-full border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
      isActive
        ? 'bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100'
        : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-500'
    );

  const summaryText = `${maxUses === 0 ? '무제한 사용' : `${maxUses}회 사용`} · ${
    EXPIRE_OPTIONS.find((option) => option.value === expiresInHours)?.label ?? '만료 없음'
  } 설정으로 생성됩니다.`;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-gray-200 dark:border-gray-800/70 bg-white dark:bg-slate-950/40 p-4 space-y-4"
    >
      {!showAdvancedOptions && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            기본값은 <span className="font-medium">무제한 사용 · 7일 만료</span>입니다. 대부분의 경우 이 설정이면 충분해요.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedOptions(true)}
            disabled={isCreating}
          >
            상세 옵션 조정
          </Button>
        </div>
      )}
      {showAdvancedOptions && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                최대 사용 횟수
              </p>
              <button
                type="button"
                onClick={() => setMaxUses(0)}
                disabled={isCreating}
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                무제한으로 설정
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {MAX_USE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMaxUses(option.value)}
                  disabled={isCreating}
                  aria-pressed={maxUses === option.value}
                  className={pillClasses(maxUses === option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
              만료 시간
            </p>
            <div className="flex flex-wrap gap-2">
              {EXPIRE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setExpiresInHours(option.value)}
                  disabled={isCreating}
                  aria-pressed={expiresInHours === option.value}
                  className={pillClasses(expiresInHours === option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedOptions(false)}
              disabled={isCreating}
            >
              간단하게 보기
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 pt-3 border-t border-gray-100 dark:border-gray-800/70 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">{summaryText}</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isCreating}
          >
            취소
          </Button>
          <Button type="submit" size="sm" disabled={isCreating}>
            {isCreating ? '생성 중...' : '생성'}
          </Button>
        </div>
      </div>
    </form>
  );
}

interface InviteItemProps {
  invite: CommunityInvite;
  onRevoke: (inviteId: string) => void;
  isRevoking: boolean;
}

function InviteItem({ invite, onRevoke, isRevoking }: InviteItemProps) {
  const [copied, setCopied] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);

  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${invite.token}`;

  const getTimeRemaining = useCallback(() => {
    const now = new Date();
    const expires = new Date(invite.expiresAt);
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return '만료됨';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}일 남음`;
    if (hours > 0) return `${hours}시간 남음`;
    return '1시간 미만';
  }, [invite.expiresAt]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleRevoke = async () => {
    setLocalLoading(true);
    await onRevoke(invite.id);
    setLocalLoading(false);
  };

  const isExpired = new Date(invite.expiresAt) < new Date();
  const isMaxUsesReached = invite.maxUses > 0 && invite.useCount >= invite.maxUses;
  const statusLabel = !invite.isActive
    ? '비활성화'
    : isMaxUsesReached
      ? '사용 완료'
      : null;
  const timeLabel = isExpired ? '만료됨' : getTimeRemaining();

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800/70 bg-white dark:bg-slate-950/40 p-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 min-w-0 rounded-xl border border-gray-200 dark:border-gray-800/70 bg-gray-50 dark:bg-slate-950/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-600 dark:text-gray-300 truncate font-mono">
              {inviteUrl}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={isExpired || isMaxUsesReached}
            className="gap-2"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copied ? '복사됨' : '복사'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRevoke}
            disabled={localLoading || isRevoking}
            className={cn('gap-2', DESTRUCTIVE_BORDER_CLASS, DESTRUCTIVE_ACTION_CLASS)}
          >
            {localLoading ? (
              <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            삭제
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 dark:bg-slate-900/60">
          <Users className="w-3.5 h-3.5" />
          <span>
            {invite.useCount}
            {invite.maxUses > 0 ? `/${invite.maxUses}회` : '회 사용'}
          </span>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 dark:bg-slate-900/60">
          <Clock className="w-3.5 h-3.5" />
          <span className={isExpired ? 'text-red-500 dark:text-red-300' : undefined}>{timeLabel}</span>
        </div>
        {statusLabel && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-200/80 px-2 py-0.5 text-gray-600 dark:bg-slate-900/60 dark:text-gray-100">
            {statusLabel}
          </span>
        )}
      </div>
    </div>
  );
}
