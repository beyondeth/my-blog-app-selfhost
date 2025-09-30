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
  // MCP 자동포스팅 관련 사용량 가져오기 (일반 포스트는 무제한이므로 표시하지 않음)
  let mcpPostLimit = 0;
  let mcpPostUsage = 0;
  let mcpPostPercentage = 0;

  if (subscription.usage) {
    if (Array.isArray(subscription.usage)) {
      // 배열 형태인 경우 (UsageStats[])
      const mcpPostStats = subscription.usage.find((stat: any) => stat.resourceType === ResourceType.MCP_POST);
      mcpPostLimit = mcpPostStats?.limit || 0;
      mcpPostUsage = mcpPostStats?.currentUsage || 0;
      mcpPostPercentage = mcpPostStats?.percentage || 0;
    } else {
      // 객체 형태인 경우 (UsageStatsResponse)
      const usage = subscription.usage as any;
      mcpPostLimit = usage.limits?.mcp_post || usage.limits?.[ResourceType.MCP_POST] || 0;
      mcpPostUsage = usage.usage?.mcp_post || usage.usage?.[ResourceType.MCP_POST] || 0;
      mcpPostPercentage = usage.percentages?.mcp_post || usage.percentages?.[ResourceType.MCP_POST] || 0;
    }
  }

  // MCP 포스트 제한이 있는 경우에만 사용량 표시
  const shouldShowUsage = mcpPostLimit > 0;

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

      {/* MCP 포스트 사용량 표시 (제한이 있을 때만) */}
      {shouldShowUsage && (
        <div className="flex items-center space-x-1.5 text-xs text-gray-500">
          <span className="font-medium">
            {mcpPostUsage}/{mcpPostLimit}
          </span>
          <span>MCP</span>

          {/* 사용량 경고 (80% 이상 사용 시) */}
          {mcpPostPercentage >= 80 && mcpPostLimit > 0 && (
            <Link
              href="/account/subscription"
              className="ml-1 text-orange-500 hover:text-orange-600"
              title="MCP 포스팅 한도에 근접했습니다"
            >
              <FiTrendingUp className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}