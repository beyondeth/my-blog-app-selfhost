"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

const navPrimary = [
  { label: '홈 피드', href: '/mock-home-shell-harbor', active: true },
  { label: '토론', href: '/c' },
  { label: '오토 블로그', href: '/blog' },
  { label: '오픈소스 레이더', href: '/docs' },
];

const navSecondary = [
  { label: 'AI 트렌드 브리핑', href: '/analytics' },
  { label: '커뮤니티 플레이북', href: '/docs' },
  { label: '이벤트 + 룸', href: '/support' },
];

const spaces = [
  { name: 'AI 거버넌스', members: '312' },
  { name: '오픈 평가 스택', members: '188' },
  { name: '에이전트 워크플로', members: '241' },
  { name: 'OSS 메인테이너', members: '129' },
];

const quickActions = [
  { label: '토론 시작', href: '/new-story' },
  { label: 'OSS 리캡 제출', href: '/drafts' },
];

const momentumStats = [
  { label: '활성 토론', value: '214', detail: '오늘 +18' },
  { label: '월간 기여자', value: '3.4k', detail: '전월 대비 +12%' },
  { label: '오픈소스 포스트', value: '128', detail: '리뷰 대기 42' },
];

const liveSignals = [
  { time: '2분 전', text: '새 스레드: 오픈 모델 거버넌스가 중요한 이유' },
  { time: '8분 전', text: 'MCP 오토블로그가 5개 레포 업데이트 요약' },
  { time: '18분 전', text: '커뮤니티 리뷰: AI 평가 스택 플레이북 v1' },
  { time: '27분 전', text: '기여자 온보딩 OSS 스프린트 공지' },
];

const trendingDebates = [
  {
    title: '2024년에 커뮤니티 소유 AI 인프라는 현실적인가?',
    tag: '토론',
    replies: 86,
    participants: 42,
    summary:
      '재원, 인프라 비용, 오픈 거버넌스 모델을 구조적으로 논의합니다.',
  },
  {
    title: '오픈소스 AI 안전 도구: 무엇이 부족한가?',
    tag: '리서치',
    replies: 54,
    participants: 31,
    summary:
      '평가 툴링, 레드팀, 안전 배포 워크플로의 공백을 추적합니다.',
  },
  {
    title: '대화를 날카롭게, 소리만 크지 않게 만드는 커뮤니티 규칙',
    tag: '문화',
    replies: 39,
    participants: 21,
    summary:
      '호기심과 엄밀함을 지키는 모더레이션 패턴을 논의합니다.',
  },
];

const latestPosts = [
  {
    title: '노트: 팀을 위한 OSS 중심 AI 로드맵 만들기',
    author: 'K. Moon',
    time: '오늘 · 13분 읽기',
    excerpt:
      '지속 가능한 오픈 작업과 출시 압박을 균형 있게 맞추는 가이드.',
  },
  {
    title: '커뮤니티 리캡: 투명 거버넌스 실험 12가지',
    author: 'M. Cho',
    time: '어제 · 9분 읽기',
    excerpt:
      '월간 라운드테이블 하이라이트와 채택할 교훈을 정리했습니다.',
  },
  {
    title: '툴링 스택: MCP + GitHub Actions 자동 포스팅',
    author: '오토 블로그 MCP',
    time: '어제 · 6분 읽기',
    excerpt:
      '빠른 업데이트를 위한 자동화 레이어의 뒷이야기.',
  },
];

const aiTrends = [
  { label: '오픈 평가 벤치마크', growth: '+28%' },
  { label: '온디바이스 모델', growth: '+22%' },
  { label: '에이전트 워크플로', growth: '+19%' },
  { label: 'RAG 신뢰성', growth: '+16%' },
];

const openSourceRadar = [
  {
    repo: 'atlas-verify',
    detail: '새 릴리스: 정책 기반 평가 워크플로',
    stars: '2.1k',
  },
  {
    repo: 'luna-data-stack',
    detail: '문서 리프레시: 거버넌스 템플릿 + 체크리스트',
    stars: '4.4k',
  },
  {
    repo: 'signal-lab',
    detail: '첫 커뮤니티 빌드: 안전 배포를 위한 텔레메트리',
    stars: '1.3k',
  },
];

const mcpPipeline = [
  { label: '레포 다이제스트', status: '12분 전 동기화' },
  { label: '요약 초안', status: '대기 중 · 3건' },
  { label: '에디토리얼 리뷰', status: '대기 · 리뷰어 2' },
];

const events = [
  { title: '라이브 토론: 커뮤니티 소유 AI 인프라', time: '금 · 20:00' },
  { title: 'OSS 기여자 오피스아워', time: '토 · 14:00' },
  { title: 'AI 트렌드 브리핑: 7월 시그널', time: '월 · 19:00' },
];

const contributors = [
  { name: 'J. Park', role: '정책 리서치' },
  { name: 'E. Han', role: '오픈소스 메인테이너' },
  { name: 'S. Lee', role: '프로덕트 전략' },
  { name: 'M. Choi', role: '커뮤니티 운영' },
];

const sparkline = [20, 36, 28, 42, 30, 50, 44, 62, 48];

const darkPalette = [
  { name: 'Background', hex: '#0E141B', role: 'Page background' },
  { name: 'Surface', hex: '#131A22', role: 'Card surface' },
  { name: 'Inset', hex: '#1A232E', role: 'Inner container' },
  { name: 'Border', hex: '#2A3645', role: 'Stroke and dividers' },
  { name: 'Primary text', hex: '#E6EDF3', role: 'Main text' },
  { name: 'Muted text', hex: '#A9B4C2', role: 'Secondary text' },
  { name: 'Brand teal', hex: '#6CC3B2', role: 'Primary action' },
  { name: 'Accent navy', hex: '#1F3B73', role: 'Secondary emphasis' },
];

export default function MockHomeShellHarborPage() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const resolvedTheme = theme === 'system' ? systemTheme : theme;
  const isDark = resolvedTheme === 'dark';
  return (
    <div className="min-h-screen bg-[#EFF2F6] text-[#1B2430] tracking-[0.01em] dark:bg-[#0E141B] dark:text-[#E6EDF3]">
      <div className="relative">
        <header className="sticky top-0 z-10 border-b border-[#D9E0EA]/80 bg-[#F9FBFD]/80 backdrop-blur dark:border-[#2A3645] dark:bg-[#0E141B]/70">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[#264653] text-[#F9FBFD] shadow-sm dark:bg-[#6CC3B2] dark:text-[#0E141B]">
                <span className="text-base font-semibold">A</span>
                <span className="absolute -bottom-1 left-2 h-3 w-3 rotate-45 bg-[#264653] dark:bg-[#6CC3B2]" />
              </div>
              <div>
                <p className="text-base font-semibold">aigory.com</p>
                <p className="text-xs text-[#4B5563] dark:text-[#A9B4C2]">
                  AI + 오픈소스 커뮤니티 뉴스룸
                </p>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-center gap-3 md:justify-end">
              <div className="flex w-full max-w-md items-center gap-2 rounded-full border border-[#D9E0EA] bg-[#F9FBFD] px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-[#264653]/40 dark:border-[#2A3645] dark:bg-[#131A22] dark:focus-within:ring-[#6CC3B2]/40">
                <span className="text-sm text-[#7B8794] dark:text-[#A9B4C2]">검색</span>
                <input
                  className="w-full bg-transparent text-sm text-[#1B2430] placeholder:text-[#9AA4B2] focus-visible:outline-none dark:text-[#E6EDF3] dark:placeholder:text-[#728093]"
                  placeholder="AI 트렌드, OSS, 거버넌스"
                  aria-label="Search the community"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!mounted) return;
                  setTheme(isDark ? 'light' : 'dark');
                }}
                disabled={!mounted}
                aria-pressed={isDark}
                className="inline-flex items-center gap-2 rounded-full border border-[#D9E0EA] bg-[#F9FBFD] px-4 py-2 text-sm font-semibold text-[#1B2430] shadow-sm transition-colors hover:bg-[#E7ECF3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#264653] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFF2F6] disabled:cursor-not-allowed disabled:opacity-70 dark:border-[#2A3645] dark:bg-[#131A22] dark:text-[#E6EDF3] dark:hover:bg-[#1A232E] dark:focus-visible:ring-[#6CC3B2] dark:focus-visible:ring-offset-[#0E141B]"
              >
                <span>다크 모드</span>
                <span className="rounded-full bg-[#D8E6EA] px-2 py-0.5 text-xs font-semibold text-[#264653] dark:bg-[#1D3A36] dark:text-[#B9E6DC]">
                  {mounted ? (isDark ? '켜짐' : '꺼짐') : '...'}
                </span>
              </button>
              <Link
                href="/new-story"
                prefetch={false}
                className="inline-flex items-center justify-center rounded-full bg-[#264653] px-5 py-2.5 text-sm font-semibold text-[#F9FBFD] shadow-sm transition-colors hover:bg-[#2F5B6B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#264653] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFF2F6] dark:bg-[#6CC3B2] dark:text-[#0E141B] dark:hover:bg-[#7DD1C0] dark:focus-visible:ring-[#6CC3B2] dark:focus-visible:ring-offset-[#0E141B]"
              >
                새 토론 시작
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-8 px-6 pb-16 pt-10 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="rounded-3xl border border-[#D9E0EA] bg-[#F9FBFD] p-5 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#264653] dark:text-[#6CC3B2]">
                홈 펄스
              </p>
              <p className="mt-3 text-sm text-[#4B5563] dark:text-[#A9B4C2]">
                시그널, 토론, 최신 OSS 드롭을 한눈에.
              </p>
              <div className="mt-4 space-y-2">
                {quickActions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    prefetch={false}
                    className="flex items-center justify-between rounded-2xl border border-[#D9E0EA] bg-[#E7ECF3] px-3 py-2 text-sm font-semibold text-[#1B2430] transition-colors hover:bg-[#DCE3EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#264653] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFF2F6] dark:border-[#2A3645] dark:bg-[#1A232E] dark:text-[#E6EDF3] dark:hover:bg-[#223040] dark:focus-visible:ring-[#6CC3B2] dark:focus-visible:ring-offset-[#0E141B]"
                  >
                    {action.label}
                    <span className="text-xs text-[#9AA4B2] dark:text-[#728093]">↗</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[#D9E0EA] bg-[#F9FBFD] p-5 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4B5563] dark:text-[#A9B4C2]">
                네비게이션
              </p>
              <nav className="mt-4 space-y-2">
                {navPrimary.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    prefetch={false}
                    className={`flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#264653] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFF2F6] dark:focus-visible:ring-[#6CC3B2] dark:focus-visible:ring-offset-[#0E141B] ${
                      item.active
                        ? 'bg-[#D8E6EA] text-[#264653] dark:bg-[#1D3A36] dark:text-[#B9E6DC]'
                        : 'text-[#1B2430] hover:bg-[#E6ECF4] dark:text-[#E6EDF3] dark:hover:bg-[#1A232E]'
                    }`}
                  >
                    {item.label}
                    <span className="text-xs text-[#9AA4B2] dark:text-[#728093]">→</span>
                  </Link>
                ))}
              </nav>
              <div className="mt-6 border-t border-[#D9E0EA] pt-4 dark:border-[#2A3645]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4B5563] dark:text-[#A9B4C2]">
                  라이브러리
                </p>
                <div className="mt-3 space-y-2">
                  {navSecondary.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      prefetch={false}
                      className="flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold text-[#1B2430] transition-colors hover:bg-[#E6ECF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#264653] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFF2F6] dark:text-[#E6EDF3] dark:hover:bg-[#1A232E] dark:focus-visible:ring-[#6CC3B2] dark:focus-visible:ring-offset-[#0E141B]"
                    >
                      {item.label}
                      <span className="text-xs text-[#9AA4B2] dark:text-[#728093]">↗</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#D9E0EA] bg-[#F9FBFD] p-5 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1F3B73] dark:text-[#8FB3E6]">
                스페이스
              </p>
              <div className="mt-4 space-y-3">
                {spaces.map((space) => (
                  <div
                    key={space.name}
                    className="flex items-center justify-between rounded-2xl border border-[#D9E0EA] bg-[#E7ECF3] px-3 py-2 dark:border-[#2A3645] dark:bg-[#1A232E]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
                        {space.name}
                      </p>
                      <p className="text-xs text-[#7B8794] dark:text-[#A9B4C2]">
                        {space.members} members
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[#264653] dark:text-[#6CC3B2]">
                      참여
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[#264653] bg-[#264653] p-5 text-[#F9FBFD] shadow-sm dark:border-[#1C2D34] dark:bg-[#10252B] dark:text-[#DCE7EA]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C4E1DB]">
                MCP 펄스
              </p>
              <p className="mt-3 text-sm text-[#E5F2EF]">
                에디토리얼 리뷰 대기 중인 초안 3건.
              </p>
              <Link
                href="/docs"
                prefetch={false}
                className="mt-4 inline-flex items-center justify-center rounded-full bg-[#F9FBFD] px-4 py-2 text-sm font-semibold text-[#264653] transition-colors hover:bg-[#E6ECF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4E1DB] focus-visible:ring-offset-2 focus-visible:ring-offset-[#264653] dark:bg-[#E6EDF3] dark:text-[#10252B] dark:hover:bg-white dark:focus-visible:ring-[#6CC3B2] dark:focus-visible:ring-offset-[#10252B]"
              >
                파이프라인 확인
              </Link>
            </div>
          </aside>

          <main className="space-y-6">
            <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-6">
                <div className="rounded-3xl border border-[#D9E0EA] bg-[#F9FBFD] p-8 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#264653] dark:text-[#6CC3B2]">
                    커뮤니티 시그널
                  </p>
                  <h1 className="mt-3 text-3xl font-semibold leading-snug sm:text-4xl">
                    AI와 오픈소스가 함께 진화하는 문화를 만듭니다.
                  </h1>
                  <p className="mt-4 text-base leading-relaxed text-[#4B5563] dark:text-[#A9B4C2]">
                    빠른 업데이트, 깊은 토론, 공유 실험을 위한 홈 피드. 새 소식을
                    강조하고 깊은 기여를 보상하며 대화를 공개적으로 유지합니다.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Link
                      href="/community"
                      prefetch={false}
                      className="rounded-full bg-[#1B2430] px-5 py-2.5 text-sm font-semibold text-[#F9FBFD] shadow-sm transition-colors hover:bg-[#242E3C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#264653] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFF2F6] dark:bg-[#E6EDF3] dark:text-[#0E141B] dark:hover:bg-white dark:focus-visible:ring-[#6CC3B2] dark:focus-visible:ring-offset-[#0E141B]"
                    >
                      피드 둘러보기
                    </Link>
                    <Link
                      href="/docs"
                      prefetch={false}
                      className="rounded-full border border-[#D9E0EA] bg-[#F9FBFD] px-5 py-2.5 text-sm font-semibold text-[#1B2430] shadow-sm transition-colors hover:bg-[#E7ECF3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#264653] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFF2F6] dark:border-[#2A3645] dark:bg-[#131A22] dark:text-[#E6EDF3] dark:hover:bg-[#1A232E] dark:focus-visible:ring-[#6CC3B2] dark:focus-visible:ring-offset-[#0E141B]"
                    >
                      커뮤니티 핸드북
                    </Link>
                    <span className="rounded-full bg-[#D8E6EA] px-4 py-2 text-sm font-semibold text-[#264653] dark:bg-[#1D3A36] dark:text-[#B9E6DC]">
                      진행 중인 라이브 룸 42개
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {momentumStats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-[#D9E0EA] bg-[#F9FBFD] p-5 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]"
                    >
                      <p className="text-sm text-[#4B5563] dark:text-[#A9B4C2]">
                        {stat.label}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
                      <p className="mt-1 text-sm text-[#264653] dark:text-[#6CC3B2]">
                        {stat.detail}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-3xl border border-[#D9E0EA] bg-[#F9FBFD] p-8 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#264653] dark:text-[#6CC3B2]">
                        트렌딩 토론
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold">
                        커뮤니티를 앞으로 이끄는 논의
                      </h2>
                    </div>
                    <Link
                      href="/c"
                      prefetch={false}
                      className="rounded-full border border-[#D9E0EA] px-4 py-2 text-sm font-semibold text-[#1B2430] shadow-sm transition-colors hover:bg-[#E7ECF3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#264653] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFF2F6] dark:border-[#2A3645] dark:text-[#E6EDF3] dark:hover:bg-[#1A232E] dark:focus-visible:ring-[#6CC3B2] dark:focus-visible:ring-offset-[#0E141B]"
                    >
                      전체 보기
                    </Link>
                  </div>
                  <div className="mt-6 space-y-5">
                    {trendingDebates.map((thread) => (
                      <article
                        key={thread.title}
                        className="rounded-2xl border border-[#D9E0EA] bg-[#E7ECF3] p-5 dark:border-[#2A3645] dark:bg-[#1A232E]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#D8E6EA] px-3 py-1 text-sm font-semibold text-[#264653] dark:bg-[#1D3A36] dark:text-[#B9E6DC]">
                            {thread.tag}
                          </span>
                          <span className="text-sm text-[#4B5563] dark:text-[#A9B4C2]">
                            댓글 {thread.replies} · 참여 {thread.participants}
                          </span>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold">{thread.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-[#4B5563] dark:text-[#A9B4C2]">
                          {thread.summary}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-[#D9E0EA] bg-[#F9FBFD] p-8 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#1F3B73] dark:text-[#8FB3E6]">
                        피드 최신글
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold">
                        에디토리얼 + 커뮤니티 포스트
                      </h2>
                    </div>
                    <Link
                      href="/blog"
                      prefetch={false}
                      className="rounded-full border border-[#D9E0EA] px-4 py-2 text-sm font-semibold text-[#1B2430] shadow-sm transition-colors hover:bg-[#E7ECF3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3B73] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFF2F6] dark:border-[#2A3645] dark:text-[#E6EDF3] dark:hover:bg-[#1A232E] dark:focus-visible:ring-[#8FB3E6] dark:focus-visible:ring-offset-[#0E141B]"
                    >
                      포스트 보기
                    </Link>
                  </div>
                  <div className="mt-6 space-y-5">
                    {latestPosts.map((post) => (
                      <article
                        key={post.title}
                        className="rounded-2xl border border-[#D9E0EA] bg-[#E7ECF3] p-5 dark:border-[#2A3645] dark:bg-[#1A232E]"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-sm text-[#4B5563] dark:text-[#A9B4C2]">
                          <span className="font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
                            {post.author}
                          </span>
                          <span>{post.time}</span>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold">{post.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-[#4B5563] dark:text-[#A9B4C2]">
                          {post.excerpt}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="space-y-6">
                <div className="rounded-3xl border border-[#D9E0EA] bg-[#F9FBFD] p-6 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#4B5563] dark:text-[#A9B4C2]">
                      라이브 시그널
                    </p>
                    <span className="rounded-full bg-[#DDE8F8] px-3 py-1 text-sm font-semibold text-[#1F3B73] dark:bg-[#1B2A3E] dark:text-[#8FB3E6]">
                      업데이트 중
                    </span>
                  </div>
                  <div className="mt-6 space-y-4">
                    {liveSignals.map((item) => (
                      <div
                        key={item.text}
                        className="rounded-2xl border border-[#D9E0EA] bg-[#E7ECF3] p-4 shadow-sm dark:border-[#2A3645] dark:bg-[#1A232E]"
                      >
                        <p className="text-sm font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
                          {item.text}
                        </p>
                        <p className="mt-2 text-sm text-[#4B5563] dark:text-[#A9B4C2]">
                          {item.time}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 rounded-2xl border border-[#1B2430] bg-[#1B2430] px-4 py-3 text-[#F9FBFD] dark:border-[#2A3645] dark:bg-[#10161E] dark:text-[#E6EDF3]">
                    <p className="text-sm font-semibold">모멘텀 트래커</p>
                    <div className="mt-4 flex items-end gap-1">
                      {sparkline.map((value, index) => (
                        <span
                          key={`${value}-${index}`}
                          className="block w-3 rounded-full bg-[#6CC3B2] dark:bg-[#8BD6C9]"
                          style={{ height: `${value}px` }}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-[#D9E0EA] bg-[#F9FBFD] p-6 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#264653] dark:text-[#6CC3B2]">
                    AI 트렌드 레이더
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">토론이 필요한 시그널</h3>
                  <div className="mt-4 space-y-3">
                    {aiTrends.map((trend) => (
                      <div
                        key={trend.label}
                        className="flex items-center justify-between rounded-2xl border border-[#D9E0EA] bg-[#E7ECF3] px-4 py-3 dark:border-[#2A3645] dark:bg-[#1A232E]"
                      >
                        <span className="text-sm font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
                          {trend.label}
                        </span>
                        <span className="text-sm font-semibold text-[#264653] dark:text-[#6CC3B2]">
                          {trend.growth}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-[#D9E0EA] bg-[#F9FBFD] p-6 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#4B5563] dark:text-[#A9B4C2]">
                    오픈소스 레이더
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">리뷰해야 할 신규 릴리스</h3>
                  <div className="mt-4 space-y-3">
                    {openSourceRadar.map((repo) => (
                      <div
                        key={repo.repo}
                        className="rounded-2xl border border-[#D9E0EA] bg-[#E7ECF3] p-4 dark:border-[#2A3645] dark:bg-[#1A232E]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
                            {repo.repo}
                          </span>
                          <span className="text-sm text-[#4B5563] dark:text-[#A9B4C2]">
                            {repo.stars} 스타
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-[#4B5563] dark:text-[#A9B4C2]">
                          {repo.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-[#1F3B73] bg-[#1F3B73] p-6 text-[#E6EDF3] shadow-sm dark:border-[#2A3645] dark:bg-[#121B2B] dark:text-[#D6E2F1]">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#C9D6EA]">
                    오토 블로그 MCP
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">에디토리얼 파이프라인 상태</h3>
                  <div className="mt-4 space-y-3">
                    {mcpPipeline.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 dark:border-[#2A3645] dark:bg-[#0E141B]"
                      >
                        <span className="text-sm font-semibold">{item.label}</span>
                        <span className="text-sm text-[#C9D6EA] dark:text-[#8FB3E6]">
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/docs"
                    prefetch={false}
                    className="mt-5 inline-flex items-center justify-center rounded-full bg-[#E6EDF3] px-4 py-2 text-sm font-semibold text-[#1F3B73] transition-colors hover:bg-[#DDE8F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9D6EA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F3B73] dark:bg-[#D6E2F1] dark:text-[#121B2B] dark:hover:bg-white dark:focus-visible:ring-[#8FB3E6] dark:focus-visible:ring-offset-[#121B2B]"
                  >
                    자동화 알아보기
                  </Link>
                </div>

                <div className="rounded-3xl border border-[#D9E0EA] bg-[#F9FBFD] p-6 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#1F3B73] dark:text-[#8FB3E6]">
                    다가오는 모먼트
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">이벤트 + 챌린지</h3>
                  <div className="mt-4 space-y-3">
                    {events.map((event) => (
                      <div
                        key={event.title}
                        className="rounded-2xl border border-[#D9E0EA] bg-[#E7ECF3] p-4 dark:border-[#2A3645] dark:bg-[#1A232E]"
                      >
                        <p className="text-sm font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
                          {event.title}
                        </p>
                        <p className="mt-2 text-sm text-[#4B5563] dark:text-[#A9B4C2]">
                          {event.time}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-[#D9E0EA] bg-[#F9FBFD] p-6 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#4B5563] dark:text-[#A9B4C2]">
                    주요 기여자
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">문화를 만드는 사람들</h3>
                  <div className="mt-4 space-y-3">
                    {contributors.map((person) => (
                      <div
                        key={person.name}
                        className="flex items-center gap-3 rounded-2xl border border-[#D9E0EA] bg-[#E7ECF3] px-4 py-3 dark:border-[#2A3645] dark:bg-[#1A232E]"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D8E6EA] text-sm font-semibold text-[#264653] dark:bg-[#1D3A36] dark:text-[#B9E6DC]">
                          {person.name
                            .split(' ')
                            .map((part) => part[0])
                            .join('')}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
                            {person.name}
                          </p>
                          <p className="text-sm text-[#4B5563] dark:text-[#A9B4C2]">
                            {person.role}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </section>

            <section className="rounded-3xl border border-[#D9E0EA] bg-[#F9FBFD] p-8 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#1F3B73] dark:text-[#8FB3E6]">
                    다크 모드 팔레트
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">Harbor dark tokens</h3>
                  <p className="mt-2 text-sm text-[#4B5563] dark:text-[#A9B4C2]">
                    WCAG 가독성을 고려한 다크 토큰을 한눈에 확인할 수 있습니다.
                  </p>
                </div>
                <span className="rounded-full bg-[#DDE8F8] px-4 py-2 text-xs font-semibold text-[#1F3B73] dark:bg-[#1B2A3E] dark:text-[#8FB3E6]">
                  텍스트 대비 4.5:1 이상 기준
                </span>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {darkPalette.map((color) => (
                  <div
                    key={color.name}
                    className="rounded-2xl border border-[#D9E0EA] bg-[#EFF2F6] p-4 dark:border-[#2A3645] dark:bg-[#0E141B]"
                  >
                    <div
                      className="h-12 w-full rounded-xl border border-[#D9E0EA] dark:border-[#2A3645]"
                      style={{ backgroundColor: color.hex }}
                    />
                    <p className="mt-3 text-sm font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
                      {color.name}
                    </p>
                    <p className="text-xs text-[#4B5563] dark:text-[#A9B4C2]">
                      {color.hex} · {color.role}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-[#D9E0EA] bg-[#F9FBFD] p-8 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#264653] dark:text-[#6CC3B2]">
                    커뮤니티 초대
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    트렌딩 아이디어를 공동 프로젝트로 전환하세요.
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-[#4B5563] dark:text-[#A9B4C2]">
                    가장 강한 제안을 부각하고 토론을 기록하며 결과를 투명하게
                    공개합니다. 문화에 관심 있는 빌더와 리서처를 위한 피드입니다.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/auth"
                    prefetch={false}
                    className="rounded-full bg-[#264653] px-6 py-3 text-sm font-semibold text-[#F9FBFD] shadow-sm transition-colors hover:bg-[#2F5B6B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#264653] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFF2F6] dark:bg-[#6CC3B2] dark:text-[#0E141B] dark:hover:bg-[#7DD1C0] dark:focus-visible:ring-[#6CC3B2] dark:focus-visible:ring-offset-[#0E141B]"
                  >
                    커뮤니티 참여
                  </Link>
                  <Link
                    href="/pricing"
                    prefetch={false}
                    className="rounded-full border border-[#D9E0EA] px-6 py-3 text-sm font-semibold text-[#1B2430] shadow-sm transition-colors hover:bg-[#E7ECF3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#264653] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFF2F6] dark:border-[#2A3645] dark:text-[#E6EDF3] dark:hover:bg-[#1A232E] dark:focus-visible:ring-[#6CC3B2] dark:focus-visible:ring-offset-[#0E141B]"
                  >
                    플랜 보기
                  </Link>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
