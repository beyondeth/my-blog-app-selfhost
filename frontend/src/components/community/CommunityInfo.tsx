'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Users, FileText, Calendar, Globe, Lock, Shield } from 'lucide-react';
import JoinButton from './JoinButton';
import type { Community, JoinPolicyType } from '@/types/community';
import { JoinPolicy } from '@/types/community';
import CommunityLockBanner from './CommunityLockBanner';

interface CommunityInfoProps {
  community: Community;
  showJoinButton?: boolean;
  className?: string;
}

/**
 * 커뮤니티 정보 카드 컴포넌트
 * 사이드바에서 커뮤니티 기본 정보를 표시
 */
const CommunityInfo = React.memo(function CommunityInfo({
  community,
  showJoinButton = true,
  className,
}: CommunityInfoProps) {
  // 숫자 포맷팅
  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      const formatted = (count / 1000).toFixed(1);
      return formatted.endsWith('.0') ? `${Math.floor(count / 1000)}K` : `${formatted}K`;
    }
    return count.toString();
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // 가입 정책 라벨
  const getJoinPolicyLabel = (policy: JoinPolicyType) => {
    switch (policy) {
      case JoinPolicy.OPEN:
        return { label: '누구나 가입 가능', icon: Globe };
      case JoinPolicy.RESTRICTED:
        return { label: '승인 필요', icon: Shield };
      case JoinPolicy.PRIVATE:
        return { label: '초대 전용', icon: Lock };
      default:
        return { label: '공개', icon: Globe };
    }
  };

  const joinPolicyInfo = getJoinPolicyLabel(community.joinPolicy);
  const PolicyIcon = joinPolicyInfo.icon;

  return (
    <div
      className={cn(
        'bg-white dark:bg-[rgb(38,38,38)] rounded-3xl border border-gray-200 dark:border-gray-700 p-5',
        className
      )}
    >
      {/* 이름 및 설명 */}
      <div className="pb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-2">
          {community.name}
        </h2>
        {community.description && (
          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
            {community.description}
          </p>
        )}
      </div>

      {/* 통계 */}
      <div className="space-y-3 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Users className="w-4 h-4" />
            <span>멤버</span>
          </div>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {formatCount(community.memberCount)}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <FileText className="w-4 h-4" />
            <span>게시물</span>
          </div>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {formatCount(community.postCount)}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Calendar className="w-4 h-4" />
            <span>생성일</span>
          </div>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {formatDate(community.createdAt)}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <PolicyIcon className="w-4 h-4" />
            <span>가입 정책</span>
          </div>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {joinPolicyInfo.label}
          </span>
        </div>
      </div>

      {/* 가입 버튼 */}
      {showJoinButton && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
          <JoinButton
            communitySlug={community.slug}
            userMembership={community.userMembership}
            variant="default"
            className="w-full"
          />
        </div>
      )}

      <div className="pt-4">
        <CommunityLockBanner
          isLocked={community.isLocked}
          lockedAt={community.lockedAt}
          lockedBy={community.lockedBy}
          communitySlug={community.slug}
          dense
        />
      </div>
    </div>
  );
});

export default CommunityInfo;
