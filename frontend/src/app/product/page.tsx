import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import PublicSiteFrame from '@/components/public-site/PublicSiteFrame';
import { getRequestLocale } from '@/lib/i18n/server';
import { localizePath } from '@/lib/i18n/config';
import { getProductContent } from './product-content';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001').replace(/\/+$/, '');

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const isKorean = locale === 'ko';

  return {
    title: isKorean ? 'Codebase 제품 소개' : 'Codebase product',
    description: isKorean
      ? 'AI 대화를 검토 가능한 글로 만들고 블로그와 커뮤니티에 발행하는 지식 워크스페이스입니다.'
      : 'A knowledge workspace for turning AI conversations into reviewed posts for blogs and communities.',
    alternates: {
      canonical: `${siteUrl}/${locale}/product`,
      languages: {
        en: `${siteUrl}/en/product`,
        ko: `${siteUrl}/ko/product`,
      },
    },
    openGraph: {
      type: 'website',
      locale: isKorean ? 'ko_KR' : 'en_US',
      url: `${siteUrl}/${locale}/product`,
      title: isKorean ? 'Codebase 제품 소개' : 'Codebase product',
      description: isKorean
        ? '유용한 AI 대화를 오래 남는 지식으로 바꾸세요.'
        : 'Turn useful AI conversations into durable knowledge.',
    },
  };
}

export default async function ProductPage() {
  const locale = await getRequestLocale();
  const copy = getProductContent(locale);
  const alternateLocale = locale === 'ko' ? 'en' : 'ko';

  return (
    <PublicSiteFrame variant="content">
      <div className="border-b border-[#CBD5D1] bg-[#F4F1E8] text-[#10231D] dark:border-[#32463E] dark:bg-[#101A17] dark:text-[#F5F7F2]">
        <section className="mx-auto grid min-h-[680px] w-full max-w-[1440px] lg:grid-cols-[1.08fr_0.92fr]">
          <div className="flex flex-col justify-between border-b border-[#CBD5D1] px-5 py-10 sm:px-8 sm:py-14 lg:border-b-0 lg:border-r lg:px-14 lg:py-20">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#315D4D] dark:text-[#9ECBB9]">
                {copy.eyebrow}
              </p>
              <Link
                href={`/${alternateLocale}/product`}
                className="shrink-0 border-b border-current pb-1 text-sm font-semibold text-[#173D31] hover:text-[#0B6B4F] dark:text-[#CDE1D8] dark:hover:text-white"
                hrefLang={alternateLocale}
              >
                {copy.languageLabel}
              </Link>
            </div>

            <div className="py-16 lg:py-24">
              <h1 className="max-w-[860px] text-[clamp(3rem,7vw,7.4rem)] font-semibold leading-[0.93] tracking-[-0.065em]">
                {copy.heroTitle}
              </h1>
              <p className="mt-9 max-w-2xl text-lg leading-8 text-[#385047] dark:text-[#B9C9C2] sm:text-xl">
                {copy.heroDescription}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#123D30] px-6 text-base font-semibold text-white transition-colors hover:bg-[#0B6B4F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#123D30] dark:bg-[#D9ECE4] dark:text-[#10231D]"
              >
                {copy.primaryCta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex min-h-12 items-center justify-center border border-[#80938B] px-6 text-base font-semibold transition-colors hover:bg-[#E5E5DA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#123D30] dark:border-[#657A71] dark:hover:bg-[#1D2A25]"
              >
                {copy.secondaryCta}
              </Link>
            </div>
          </div>

          <div className="grid min-h-[560px] grid-rows-[1fr_auto] bg-[#123D30] text-white">
            <div className="relative flex items-center justify-center overflow-hidden p-6 sm:p-12">
              <div className="absolute inset-0 grid grid-cols-6 opacity-20" aria-hidden="true">
                {Array.from({ length: 36 }).map((_, index) => (
                  <span key={index} className="border-b border-r border-white/40" />
                ))}
              </div>
              <div className="relative w-full max-w-xl border border-white/65 bg-[#F7F5EE] p-5 text-[#10231D] shadow-[18px_18px_0_0_#071E17] sm:p-8">
                <div className="flex items-center justify-between border-b border-[#9AA9A3] pb-5">
                  <div className="flex items-center gap-3">
                    <Image src="/assets/logo.svg" alt="" width={40} height={40} className="h-10 w-10" />
                    <span className="font-semibold tracking-[-0.02em]">{copy.boardRecord}</span>
                  </div>
                  <span className="font-mono text-xs">{copy.boardStatus}</span>
                </div>
                <p className="mt-8 font-mono text-xs uppercase tracking-[0.18em] text-[#466158]">
                  {copy.boardLabel}
                </p>
                <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
                  {copy.boardTitle}
                </h2>
                <div className="mt-10 divide-y divide-[#AAB7B2] border-y border-[#AAB7B2]">
                  {copy.boardItems.map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[1fr_1.15fr] gap-4 py-4 text-sm">
                      <span className="font-mono text-[#39554B]">{label}</span>
                      <span className="font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="border-t border-white/35 px-6 py-5 font-mono text-xs uppercase tracking-[0.16em] text-[#D4E7DF] sm:px-12">
              {copy.boardFlow}
            </p>
          </div>
        </section>
      </div>

      <section id="features" className="border-b border-[#D8DED9] bg-white py-20 text-[#14231E] dark:border-[#2E4038] dark:bg-[#0E141B] dark:text-white sm:py-28">
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-14">
          <div className="grid gap-8 border-b border-[#B7C2BD] pb-12 lg:grid-cols-[1fr_1fr] dark:border-[#394C44]">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#27614D] dark:text-[#91C7B3]">
                {copy.principlesEyebrow}
              </p>
              <h2 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.03] tracking-[-0.045em] sm:text-6xl">
                {copy.principlesTitle}
              </h2>
            </div>
            <p className="max-w-2xl self-end text-lg leading-8 text-[#4B6158] dark:text-[#B3C2BC]">
              {copy.principlesDescription}
            </p>
          </div>
          <div className="grid divide-y divide-[#CBD4CF] lg:grid-cols-3 lg:divide-x lg:divide-y-0 dark:divide-[#31453C]">
            {copy.principles.map((item) => (
              <article key={item.number} className="py-10 lg:px-8 lg:py-14 lg:first:pl-0 lg:last:pr-0">
                <span className="font-mono text-sm text-[#36725C] dark:text-[#91C7B3]">{item.number}</span>
                <h3 className="mt-12 text-2xl font-semibold tracking-[-0.025em]">{item.title}</h3>
                <p className="mt-4 text-base leading-7 text-[#53675F] dark:text-[#AFC0B8]">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#D8DED9] bg-[#ECE9DF] text-[#10231D] dark:border-[#2E4038] dark:bg-[#17201D] dark:text-white">
        <div className="mx-auto grid w-full max-w-[1440px] lg:grid-cols-2">
          <div className="border-b border-[#B9C3BE] px-5 py-20 sm:px-8 lg:border-b-0 lg:border-r lg:px-14 lg:py-28 dark:border-[#3A4D45]">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#27614D] dark:text-[#9DCEBA]">
              {copy.workflowEyebrow}
            </p>
            <h2 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.03] tracking-[-0.045em] sm:text-6xl">
              {copy.workflowTitle}
            </h2>
            <ol className="mt-14 border-t border-[#9DACA6] dark:border-[#51635B]">
              {copy.workflowSteps.map(([title, description], index) => (
                <li key={title} className="grid grid-cols-[42px_1fr] gap-4 border-b border-[#9DACA6] py-6 dark:border-[#51635B]">
                  <span className="font-mono text-sm">0{index + 1}</span>
                  <div>
                    <h3 className="text-xl font-semibold">{title}</h3>
                    <p className="mt-2 text-base leading-7 text-[#4A6157] dark:text-[#B6C5BE]">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex items-center bg-[#D9D6CC] px-5 py-20 sm:px-8 lg:px-14 dark:bg-[#101714]">
            <div className="w-full border border-[#778B82] bg-[#FAF9F3] p-5 text-[#12251E] shadow-[14px_14px_0_0_#123D30] sm:p-8">
              <div className="flex items-center justify-between border-b border-[#A6B2AD] pb-4">
                <span className="font-mono text-xs uppercase tracking-[0.18em]">{copy.interfaceLabel}</span>
                <span className="h-3 w-3 bg-[#167A58]" aria-label="Ready" />
              </div>
              <h3 className="mt-8 max-w-lg text-3xl font-semibold leading-tight tracking-[-0.035em]">
                {copy.interfaceTitle}
              </h3>
              <ul className="mt-10 grid gap-px border border-[#99A8A2] bg-[#99A8A2] sm:grid-cols-2">
                {copy.interfaceItems.map((item) => (
                  <li key={item} className="flex min-h-24 items-center gap-3 bg-[#FAF9F3] p-5 text-base font-semibold">
                    <Check className="h-5 w-5 text-[#0B6B4F]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 text-[#14231E] dark:bg-[#0E141B] dark:text-white sm:py-28">
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-14">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#27614D] dark:text-[#91C7B3]">
            {copy.destinationsEyebrow}
          </p>
          <h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.03] tracking-[-0.045em] sm:text-6xl">
            {copy.destinationsTitle}
          </h2>
          <div className="mt-14 grid border-y border-[#B7C2BD] lg:grid-cols-3 lg:divide-x dark:border-[#394C44] dark:divide-[#394C44]">
            {copy.destinations.map((item) => (
              <article key={item.title} className="border-b border-[#CBD4CF] py-9 last:border-b-0 lg:border-b-0 lg:px-8 lg:first:pl-0 lg:last:pr-0 dark:border-[#31453C]">
                <h3 className="text-2xl font-semibold">{item.title}</h3>
                <p className="mt-4 min-h-24 text-base leading-7 text-[#53675F] dark:text-[#AFC0B8]">{item.description}</p>
                <Link href={localizePath(item.href, locale)} className="mt-8 inline-flex items-center gap-2 border-b border-current pb-1 text-sm font-semibold hover:text-[#0B6B4F] dark:hover:text-[#9DCEBA]">
                  {item.link}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#315247] bg-[#0D2B22] py-20 text-white sm:py-28">
        <div className="mx-auto grid w-full max-w-[1440px] gap-12 px-5 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-14">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#9DCEBA]">
              {copy.selfHostEyebrow}
            </p>
            <h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.03] tracking-[-0.045em] sm:text-6xl">
              {copy.selfHostTitle}
            </h2>
            <p className="mt-8 max-w-3xl text-lg leading-8 text-[#C0D3CB]">{copy.selfHostDescription}</p>
          </div>
          <div className="border border-[#66847A] p-6 sm:p-8">
            <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-[#E3EEE9]">
              <span className="h-2.5 w-2.5 bg-[#F2C94C]" aria-hidden="true" />
              {copy.selfHostStatus}
            </p>
            <ul className="mt-8 divide-y divide-[#49685D] border-y border-[#49685D]">
              {copy.selfHostPoints.map((item) => (
                <li key={item} className="flex items-center justify-between py-4 text-base font-medium">
                  {item}
                  <Check className="h-4 w-4 text-[#9DCEBA]" aria-hidden="true" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-[#F4F1E8] py-20 text-[#10231D] dark:bg-[#101A17] dark:text-white sm:py-28">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start justify-between gap-10 px-5 sm:px-8 lg:flex-row lg:items-end lg:px-14">
          <div>
            <h2 className="max-w-4xl text-4xl font-semibold leading-[1.03] tracking-[-0.045em] sm:text-6xl">{copy.finalTitle}</h2>
            <p className="mt-6 text-lg leading-8 text-[#4B6158] dark:text-[#B3C2BC]">{copy.finalDescription}</p>
          </div>
          <Link href="/register" className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 bg-[#123D30] px-7 text-base font-semibold text-white hover:bg-[#0B6B4F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#123D30] dark:bg-[#D9ECE4] dark:text-[#10231D]">
            {copy.finalCta}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </PublicSiteFrame>
  );
}
