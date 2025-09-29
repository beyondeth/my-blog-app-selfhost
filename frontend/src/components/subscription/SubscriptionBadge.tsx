/**
 * 구독 상태 배지 컴포넌트
 * 헤더에 현재 구독 플랜과 사용량을 표시
 */

'use client';

import Link from 'next/link';
import { useMySubscription } from '@/hooks/useSubscription';
import { SubscriptionTier, ResourceType } from '@/types/subscription';
import { FiTrendingUp, FiStar, FiAward } from 'react-icons/fi';

const tierConfig = {
  [SubscriptionTier.FREE]: {
    label: 'Free',
    color: 'bg-gray-100 text-gray-600',
    icon: null,
  },
  [SubscriptionTier.STARTER]: {
    label: 'Starter',
    color: 'bg-blue-100 text-blue-700',
    icon: <FiStar className="w-3 h-3" />,
  },
  [SubscriptionTier.PRO]: {
    label: 'Pro',
    color: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    icon: <FiAward className="w-3 h-3" />,
  },
};

export default function SubscriptionBadge() {
  const { data: subscription, isLoading } = useMySubscription();

  // 로딩 중이거나 로그인하지 않은 경우 표시하지 않음
  if (isLoading || !subscription?.subscription) {
    return null;
  }

  const currentTier = subscription.subscription.tier || SubscriptionTier.FREE;
  const config = tierConfig[currentTier];

  // usage는 객체 형태 { limits, usage, percentages } 또는 배열
  // 포스트 관련 사용량 가져오기
  let postLimit = 0;
  let postUsage = 0;
  let postPercentage = 0;

  if (subscription.usage) {
    if (Array.isArray(subscription.usage)) {
      // 배열 형태인 경우 (UsageStats[])
      const postStats = subscription.usage.find((stat: any) => stat.resourceType === ResourceType.POST);
      postLimit = postStats?.limit || 0;
      postUsage = postStats?.currentUsage || 0;
      postPercentage = postStats?.percentage || 0;
    } else {
      // 객체 형태인 경우 (UsageStatsResponse)
      const usage = subscription.usage as any;
      postLimit = usage.limits?.post || usage.limits?.[ResourceType.POST] || 0;
      postUsage = usage.usage?.post || usage.usage?.[ResourceType.POST] || 0;
      postPercentage = usage.percentages?.post || usage.percentages?.[ResourceType.POST] || 0;
    }
  }

  // Free 플랜이 아닌 경우 또는 사용량이 있는 경우에만 표시
  const shouldShowUsage = currentTier !== SubscriptionTier.FREE || postUsage > 0;

  // 구독 티어에 따라 다른 링크로 이동
  // FREE 플랜은 pricing으로 (업그레이드 유도)
  // 유료 플랜은 구독 관리 페이지로 이동
  const badgeLink = currentTier === SubscriptionTier.FREE ? '/pricing' : '/account/subscription';

  return (
    <div className="flex items-center space-x-3">
      {/* 구독 플랜 배지 */}
      <Link
        href={badgeLink}
        title={currentTier === SubscriptionTier.FREE ? '플랜 업그레이드' : '구독 관리'}
        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all hover:opacity-90 ${config.color}`}
      >
        {config.icon}
        <span>{config.label}</span>
      </Link>

      {/* 사용량 표시 (Free 플랜이거나 사용량이 있을 때) */}
      {shouldShowUsage && (
        <div className="flex items-center space-x-1.5 text-xs text-gray-500">
          <span className="font-medium">
            {postUsage}
            {postLimit && postLimit > 0 && `/${postLimit}`}
            {postLimit === -1 && ' (무제한)'}
          </span>
          <span>포스트</span>

          {/* 사용량 경고 (80% 이상 사용 시) */}
          {postPercentage >= 80 && postLimit > 0 && (
            <Link
              href="/account/subscription"
              className="ml-1 text-orange-500 hover:text-orange-600"
              title="사용량 한도에 근접했습니다"
            >
              <FiTrendingUp className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}