'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInviteByToken, useAcceptInvite } from '@/hooks/community';
import { useAuthV2 } from '@/hooks/useAuthV2';
import { cn } from '@/lib/utils';

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

/**
 * 커뮤니티 초대 수락 페이지 (/invite/[token])
 *
 * @description 초대 링크를 통해 커뮤니티에 가입
 * - 비로그인: 로그인 유도
 * - 로그인: 초대 정보 확인 및 수락
 */
export default function InvitePage({ params }: InvitePageProps) {
  const { token } = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthV2();

  // 초대 정보 조회
  const { data: invite, isLoading, isError, error } = useInviteByToken(token);
  const acceptMutation = useAcceptInvite();

  // 수락 상태
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // 초대 수락 처리
  const handleAccept = async () => {
    if (!token) return;

    setAcceptError(null);

    try {
      await acceptMutation.mutateAsync(token);
      setAccepted(true);

      // 3초 후 커뮤니티 페이지로 이동
      setTimeout(() => {
        if (invite?.community?.slug) {
          router.push(`/c/${invite.community.slug}`);
        } else {
          router.push('/c');
        }
      }, 3000);
    } catch (err: any) {
      setAcceptError(err.message || '초대 수락에 실패했습니다.');
    }
  };

  // 로딩 중
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 비로그인 상태
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-[rgb(38,38,38)] rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <LogIn className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            로그인이 필요합니다
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            커뮤니티 초대를 수락하려면 먼저 로그인해주세요.
          </p>

          <div className="space-y-3">
            <Button
              asChild
              className="w-full"
            >
              <Link href={`/login?redirect=/invite/${token}`}>
                로그인
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full"
            >
              <Link href={`/register?redirect=/invite/${token}`}>
                회원가입
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 초대 정보 없음 또는 에러
  if (isError || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-[rgb(38,38,38)] rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            유효하지 않은 초대
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            이 초대 링크는 만료되었거나 더 이상 유효하지 않습니다.
          </p>

          <Button
            asChild
            variant="outline"
            className="w-full"
          >
            <Link href="/c">
              커뮤니티 둘러보기
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // 초대가 유효하지 않음
  if (!invite.isValid) {
    const isExpired = new Date(invite.expiresAt) < new Date();
    const isMaxUsesReached = invite.maxUses > 0 && invite.useCount >= invite.maxUses;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-[rgb(38,38,38)] rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {isExpired
              ? '초대가 만료되었습니다'
              : isMaxUsesReached
                ? '초대 사용 횟수 초과'
                : '초대가 비활성화되었습니다'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {isExpired
              ? '이 초대 링크의 유효 기간이 지났습니다.'
              : isMaxUsesReached
                ? '이 초대 링크는 최대 사용 횟수에 도달했습니다.'
                : '이 초대 링크는 더 이상 사용할 수 없습니다.'}
          </p>

          <Button
            asChild
            variant="outline"
            className="w-full"
          >
            <Link href="/c">
              커뮤니티 둘러보기
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // 수락 완료
  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-[rgb(38,38,38)] rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            가입 완료!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {invite.community?.name}
            </span>
            에 성공적으로 가입되었습니다.
          </p>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            잠시 후 커뮤니티로 이동합니다...
          </p>

          <Button
            asChild
            className="w-full"
          >
            <Link href={`/c/${invite.community?.slug}`}>
              지금 이동하기
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // 초대 정보 표시 및 수락 버튼
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-[rgb(38,38,38)] rounded-2xl shadow-lg overflow-hidden">
        {/* 커뮤니티 배너/아이콘 */}
        <div className="relative h-24 bg-gradient-to-r from-blue-500 to-purple-600">
          {invite.community?.iconUrl && (
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
              <div
                className={cn(
                  'w-20 h-20 rounded-full border-4 border-white dark:border-gray-800 overflow-hidden',
                  invite.community.iconImageFit === 'cover'
                    ? 'bg-white dark:bg-gray-800'
                    : 'bg-white dark:bg-gray-900 p-1'
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={invite.community.iconUrl}
                  alt={invite.community.name}
                  className={cn(
                    'w-full h-full',
                    invite.community.iconImageFit === 'cover' ? 'object-cover' : 'object-contain'
                  )}
                />
              </div>
            </div>
          )}
        </div>

        {/* 내용 */}
        <div className={cn('p-8 text-center', invite.community?.iconUrl && 'pt-14')}>
          {!invite.community?.iconUrl && (
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          )}

          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            커뮤니티 초대
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-1">
            다음 커뮤니티에 초대되었습니다
          </p>
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {invite.community?.name}
          </p>
          {invite.community?.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
              {invite.community.description}
            </p>
          )}

          {/* 커뮤니티 정보 */}
          <div className="flex items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{invite.community?.memberCount ?? 0}명</span>
            </div>
          </div>

          {/* 에러 메시지 */}
          {acceptError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {acceptError}
            </div>
          )}

          {/* 수락 버튼 */}
          <Button
            onClick={handleAccept}
            disabled={acceptMutation.isPending}
            className="w-full"
          >
            {acceptMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                처리 중...
              </>
            ) : (
              <>
                초대 수락하기
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>

          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
            초대를 수락하면 이 커뮤니티의 멤버가 됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
