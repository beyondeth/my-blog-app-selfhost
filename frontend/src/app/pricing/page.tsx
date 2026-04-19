'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useSubscriptionPlans } from '@/hooks/useSubscription';
import { canAccessSubscriptionUi } from '@/lib/subscription-access';
import { getMySubscription } from '@/services/api/subscription.service';
import { useLocaleContext } from '@/providers/LocaleProvider';
import {
  BillingCycle,
  SubscriptionTier,
  SubscriptionStatus,
  type SubscriptionPlan,
  type SubscriptionResponse,
} from '@/types/subscription';

const tierOrder: Record<SubscriptionTier, number> = {
  [SubscriptionTier.FREE]: 0,
  [SubscriptionTier.STARTER]: 1,
  [SubscriptionTier.PRO]: 2,
};

const priceFormatter = new Intl.NumberFormat('ko-KR');

function formatAnalyticsLevel(value: SubscriptionPlan['features']['analytics']) {
  if (value === 'advanced') return 'Advanced';
  if (value === 'basic') return 'Basic';
  return 'None';
}

function getCycleLabel(cycle: BillingCycle) {
  return cycle === BillingCycle.MONTHLY ? '/ month' : '/ year';
}

const planFeatureRows = [
  {
    label: 'MCP posts / month',
    render: (plan: SubscriptionPlan) => plan.features.maxMcpPostsPerMonth.toLocaleString(),
  },
  {
    label: 'Blogs',
    render: (plan: SubscriptionPlan) => plan.features.maxBlogCount.toLocaleString(),
  },
  {
    label: 'Analytics',
    render: (plan: SubscriptionPlan) => formatAnalyticsLevel(plan.features.analytics),
  },
  {
    label: 'Scheduled posts',
    render: (plan: SubscriptionPlan) => (plan.features.scheduledPosts ? 'Included' : '-'),
  },
  {
    label: 'Export data',
    render: (plan: SubscriptionPlan) => (plan.features.exportData ? 'Included' : '-'),
  },
];

export default function PricingPage() {
  const { user, isAdmin } = useAuth();
  const { t, href } = useLocaleContext();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(BillingCycle.MONTHLY);
  const { data: plansData, isLoading } = useSubscriptionPlans();
  const billingEnabled = canAccessSubscriptionUi(isAdmin);

  const subscriptionQuery = useQuery<SubscriptionResponse>({
    queryKey: ['subscription', 'public-pricing', user?.id],
    queryFn: getMySubscription,
    enabled: Boolean(user),
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const plans = useMemo<SubscriptionPlan[]>(
    () =>
      (plansData ?? [])
        .slice()
        .sort((a: SubscriptionPlan, b: SubscriptionPlan) => a.sortOrder - b.sortOrder),
    [plansData],
  );

  const currentTier = subscriptionQuery.data?.subscription?.tier ?? SubscriptionTier.FREE;
  const subscriptionStatus = subscriptionQuery.data?.subscription?.status;
  const hasCancelledSubscription =
    subscriptionStatus === SubscriptionStatus.CANCELLED ||
    subscriptionStatus === SubscriptionStatus.EXPIRED;

  const primaryCtaHref = billingEnabled
    ? user
      ? '/settings/billing'
      : href('/register')
    : href('/support');

  const primaryCtaLabel = billingEnabled ? t('publicSite.header.getStarted') : t('publicSite.resources.support.label');

  if (!billingEnabled) {
    return (
      <main className="bg-white text-[#202124] dark:bg-[#202124] dark:text-[#e8eaed]">
        <section className="mx-auto flex min-h-[70vh] max-w-4xl flex-col items-center justify-center px-6 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-[#202124] dark:text-white">
            {t('beta.billingDisabledTitle')}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5f6368] dark:text-[#9aa0a6]">
            {t('beta.billingDisabledDescription')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={href('/docs/get-started')}
              className="inline-flex items-center rounded-full border border-[#D9E0EA] bg-white px-5 py-3 text-sm font-semibold text-[#1B2430] transition-colors hover:bg-[#F7F9FC] dark:border-[#223244] dark:bg-[#0E141B] dark:text-[#E6EDF3] dark:hover:bg-[#162231]"
            >
              {t('publicSite.resources.docs.label')}
            </Link>
            <Link
              href={href('/support')}
              className="inline-flex items-center rounded-full bg-[#101828] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1F2937] dark:bg-white dark:text-[#101828]"
            >
              {t('publicSite.resources.support.label')}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="bg-white text-[#202124] selection:bg-[#e8f0fe] selection:text-[#1a73e8] dark:bg-[#202124] dark:text-[#e8eaed]">
      <section className="mx-auto w-full max-w-[1440px] px-6 pb-20 pt-24 sm:px-12 lg:px-16 lg:pb-32 lg:pt-32">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-5xl font-bold leading-[1.15] tracking-tight text-[#202124] dark:text-white">
            Choose the right plan <br className="hidden md:block"/>
            for your team
          </h1>
          <p className="mt-6 max-w-2xl text-lg md:text-xl leading-relaxed text-[#5f6368] dark:text-[#9aa0a6]">
            운영 규모에 맞는 플랜을 고르고, 문서와 자동 포스팅을 같은 흐름에서 관리하세요. 
            변경 사항은 서비스 설정에 바로 반영됩니다.
          </p>

          <div className="mt-12 inline-flex items-center rounded-full bg-[#f1f3f4] p-1 dark:bg-[#303134]">
            {[BillingCycle.MONTHLY, BillingCycle.YEARLY].map((cycle) => {
              const active = billingCycle === cycle;
              return (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => setBillingCycle(cycle)}
                  className={`rounded-full px-8 py-3 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-white text-[#202124] shadow-sm dark:bg-[#202124] dark:text-white'
                      : 'text-[#5f6368] hover:text-[#202124] dark:text-[#9aa0a6] dark:hover:text-white'
                  }`}
                >
                  {cycle === BillingCycle.MONTHLY ? 'Monthly' : 'Yearly (Save 20%)'}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="mt-20 grid gap-6 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[600px] animate-pulse rounded-[32px] bg-[#f1f3f4] dark:bg-[#303134]" />
            ))}
          </div>
        ) : (
          <div className="mt-20 grid gap-6 lg:grid-cols-3">
            {plans.map((plan: SubscriptionPlan) => {
              const price = billingCycle === BillingCycle.MONTHLY ? plan.monthlyPrice : plan.yearlyPrice;
              const isCurrentPlan = user && currentTier === plan.tier && !hasCancelledSubscription;
              const isUpgrade = user && tierOrder[plan.tier] > tierOrder[currentTier];
              const isDowngrade = user && tierOrder[plan.tier] < tierOrder[currentTier];
              
              const actionLabel = !user
                ? primaryCtaLabel
                : isCurrentPlan
                  ? '현재 사용 중인 플랜'
                  : isUpgrade
                    ? billingEnabled ? '업그레이드' : '문의하기'
                    : isDowngrade
                      ? billingEnabled ? '플랜 조정' : '문의하기'
                      : billingEnabled ? '구독 관리' : '문의하기';

              return (
                <article
                  key={plan.id}
                  className={`relative flex h-full flex-col rounded-[32px] p-10 ${
                    plan.isPopular
                      ? 'bg-[#e8f0fe] dark:bg-[#8ab4f8]/10'
                      : 'bg-[#f1f3f4] dark:bg-[#303134]'
                  }`}
                >
                  {plan.isPopular && (
                    <div className="absolute -top-4 right-10 rounded-full bg-[#1a73e8] px-4 py-1.5 text-xs font-bold text-white shadow-sm dark:bg-[#8ab4f8] dark:text-[#202124]">
                      Recommended
                    </div>
                  )}

                  <h2 className="text-2xl font-bold tracking-tight text-[#202124] dark:text-white">
                    {plan.displayName}
                  </h2>
                  <p className="mt-3 text-base text-[#5f6368] dark:text-[#9aa0a6] min-h-[48px]">
                    {plan.description}
                  </p>

                  <div className="mt-8 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tighter text-[#202124] dark:text-white">
                      {price === 0 ? 'Free' : `₩${priceFormatter.format(price)}`}
                    </span>
                    {price !== 0 && (
                      <span className="text-base text-[#5f6368] dark:text-[#9aa0a6]">
                        {getCycleLabel(billingCycle)}
                      </span>
                    )}
                  </div>

                  <Link
                    href={isCurrentPlan ? '/settings/billing' : primaryCtaHref}
                    className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-8 py-4 text-base font-medium transition-colors ${
                      isCurrentPlan
                        ? 'bg-[#dadce0] text-[#5f6368] dark:bg-[#4dd5156] dark:text-[#9aa0a6] cursor-default pointer-events-none'
                        : plan.isPopular
                          ? 'bg-[#1a73e8] text-white hover:bg-[#1557b0] dark:bg-[#8ab4f8] dark:text-[#202124] dark:hover:bg-[#8ab4f8]/80'
                          : 'bg-[#202124] text-white hover:bg-[#3c4043] dark:bg-[#e8eaed] dark:text-[#202124] dark:hover:bg-white'
                    }`}
                  >
                    {actionLabel}
                  </Link>

                  <div className="mt-10 flex-1 space-y-4">
                    <p className="text-sm font-bold text-[#202124] dark:text-white uppercase tracking-wider">Features</p>
                    {plan.highlights.map((item: string) => (
                      <div key={item} className="flex items-start gap-4">
                        <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#1a73e8] dark:text-[#8ab4f8]" />
                        <span className="text-base text-[#3c4043] dark:text-[#cbd0d8]">{item}</span>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mx-auto w-full max-w-[1440px] px-6 py-20 lg:px-16 lg:py-32 border-t border-[#f1f3f4] dark:border-[#303134]">
        <div className="mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-[#202124] dark:text-white">
            Compare plans
          </h2>
          <p className="mt-4 text-xl text-[#5f6368] dark:text-[#9aa0a6]">
            Compare features directly to find what fits your needs.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b-2 border-[#dadce0] dark:border-[#5f6368]">
                <th className="py-6 px-4 text-sm font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-widest w-1/4">Feature</th>
                {plans.map((plan: SubscriptionPlan) => (
                  <th key={plan.id} className="py-6 px-4 text-xl font-bold text-[#202124] dark:text-white w-1/4">
                    {plan.displayName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f4] dark:divide-[#303134]">
              {planFeatureRows.map((row) => (
                <tr key={row.label} className="transition-colors hover:bg-[#f8f9fa] dark:hover:bg-[#202124]/50">
                  <td className="py-6 px-4 text-base font-medium text-[#202124] dark:text-white">{row.label}</td>
                  {plans.map((plan: SubscriptionPlan) => {
                    const val = row.render(plan);
                    const isIncluded = val === 'Included';
                    
                    return (
                      <td key={`${row.label}-${plan.id}`} className="py-6 px-4 text-base text-[#5f6368] dark:text-[#9aa0a6]">
                        {isIncluded ? (
                          <Check className="h-5 w-5 text-[#1a73e8] dark:text-[#8ab4f8]" />
                        ) : (
                          val
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
