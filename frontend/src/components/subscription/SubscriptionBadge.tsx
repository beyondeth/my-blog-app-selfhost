/**
 * 구독 상태 배지 컴포넌트
 * 헤더에 현재 구독 플랜을 표시 (user.subscriptionTier 사용)
 */

'use client';

import Link from 'next/link';
import { User } from '@/types';
import { SubscriptionTier } from '@/types/subscription';
import { FiStar, FiAward } from 'react-icons/fi';

const tierConfig = {
  [SubscriptionTier.FREE]: {
    label: 'Free',
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    icon: null,
  },
  [SubscriptionTier.STARTER]: {
    label: 'Starter',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    icon: <FiStar className="w-3 h-3" />,
  },
  [SubscriptionTier.PRO]: {
    label: 'Pro',
    color: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    icon: <FiAward className="w-3 h-3" />,
  },
};

interface SubscriptionBadgeProps {
  user: User;
}

export default function SubscriptionBadge({ user }: SubscriptionBadgeProps) {
  // subscriptionTier가 없으면 FREE로 기본 설정
  const currentTier = (user.subscriptionTier as SubscriptionTier) || SubscriptionTier.FREE;
  const config = tierConfig[currentTier];

  // 구독 티어에 따라 다른 링크로 이동
  // FREE 플랜은 pricing으로 (업그레이드 유도)
  // 유료 플랜은 구독 관리 페이지로 이동
  const badgeLink = currentTier === SubscriptionTier.FREE ? '/pricing' : '/settings/billing';

  return (
    <Link
      href={badgeLink}
      title={currentTier === SubscriptionTier.FREE ? '플랜 업그레이드' : '구독 관리'}
      className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all hover:opacity-90 ${config.color}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </Link>
  );
}
