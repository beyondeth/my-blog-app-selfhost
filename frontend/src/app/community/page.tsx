import type { Metadata } from 'next';
import Link from 'next/link';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.codebase.blog';

export const metadata: Metadata = {
  title: 'Codebase 커뮤니티 소개 – AI 트렌드 · 바이브코딩 허브',
  description: 'AI 최신 트렌드와 바이브코딩을 중심으로, 초보자도 쉽게 시작할 수 있는 개발 토론 커뮤니티를 지향합니다.',
  keywords: ['AI 커뮤니티', 'AI 트렌드', '바이브코딩', 'LLM', '프롬프트', '에이전트', 'AI 도구'],
  openGraph: {
    type: 'website',
    title: 'Codebase 커뮤니티 소개 – AI 트렌드 · 바이브코딩 허브',
    description: 'AI 최신 트렌드와 바이브코딩을 중심으로, 초보자도 쉽게 시작할 수 있는 개발 토론 커뮤니티를 지향합니다.',
    url: `${siteUrl}/community`,
    siteName: 'Codebase',
    images: [
      {
        url: `${siteUrl}/og-image-v2.png`,
        width: 1200,
        height: 630,
        alt: 'Codebase 커뮤니티 소개',
      },
    ],
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Codebase 커뮤니티 소개 – AI 트렌드 · 바이브코딩 허브',
    description: 'AI 최신 트렌드와 바이브코딩을 중심으로, 초보자도 쉽게 시작할 수 있는 개발 토론 커뮤니티를 지향합니다.',
    images: [`${siteUrl}/og-image-v2.png`],
  },
  alternates: {
    canonical: `${siteUrl}/community`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function CommunityIntroPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <section className="space-y-6">
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
          AI Trends · Vibe Coding
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Codebase 커뮤니티 소개
        </h1>
        <p className="text-base leading-7 text-muted-foreground">
          Codebase는 AI 최신 트렌드와 바이브코딩을 중심으로, 초보자도 쉽게 시작할 수 있는 개발 토론
          커뮤니티를 지향합니다. 실험, 기록, 공유가 자연스럽게 이어지는 환경을 만들고 있습니다.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-foreground">우리가 다루는 주제</h2>
        <ul className="grid gap-3 text-base text-muted-foreground sm:grid-cols-2">
          <li className="rounded-xl border border-border bg-card px-4 py-3">AI 최신 트렌드 · 리서치 요약</li>
          <li className="rounded-xl border border-border bg-card px-4 py-3">바이브코딩 입문 & 실전</li>
          <li className="rounded-xl border border-border bg-card px-4 py-3">LLM · 프롬프트 · 에이전트</li>
          <li className="rounded-xl border border-border bg-card px-4 py-3">AI 도구 리뷰 · 활용 사례</li>
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-border bg-muted/40 p-6">
        <h3 className="text-lg font-semibold text-foreground">커뮤니티 둘러보기</h3>
        <p className="mt-2 text-base text-muted-foreground">
          관심 분야별 커뮤니티를 둘러보고, 토론을 시작해 보세요.
        </p>
        <div className="mt-4">
          <Link
            href="/c"
            className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90"
          >
            커뮤니티 디렉토리로 이동
          </Link>
        </div>
      </section>
    </main>
  );
}
