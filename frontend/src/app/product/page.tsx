'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ArrowRight,
  Workflow,
  CheckCircle2,
  Plug,
  Users,
  Check,
  ShoppingBag,
  MessageSquare,
  Quote,
  Terminal,
} from 'lucide-react';

/* ─────────────────────── 애니메이션 유틸 ─────────────────────── */

/** 스크롤 기반 페이드인 섹션 (IntersectionObserver via framer-motion) */
function FadeInSection({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────── AI 플랫폼 브랜드 아이콘 (실제 로고 기반 SVG) ─────────────────────── */

interface BrandIconProps {
  className?: string;
  style?: React.CSSProperties;
}

function ChatGPTIcon({ className = '', style }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

function ClaudeIcon({ className = '', style }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.257 0h3.604L16.744 20.48h-3.604L6.57 3.52zM0 20.48h3.604L10.174 3.52H6.57L0 20.48z" />
    </svg>
  );
}

function GeminiIcon({ className = '', style }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M12 0C12 0 12 8 8 12C4 16 0 12 0 12C0 12 4 12 8 12C12 12 12 16 12 24C12 24 12 16 16 12C20 8 24 12 24 12C24 12 20 12 16 12C12 12 12 8 12 0Z" />
    </svg>
  );
}

function PerplexityIcon({ className = '', style }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M12.005.975L18.3 5.391V11.4l-5.34-3.874V.975h-.955V7.53L6.7 11.4V5.39L12.005.975zM6.7 12.6l5.305 3.874v6.551l-.955-.001-5.34-3.873-.01-6.551zm6.26 3.87L18.3 12.6v6.551l-5.34 3.874V16.47zM5.745 5.015L.4 8.887v6.226l5.345-3.873V5.015zm12.51 0v6.225l5.345 3.873V8.887l-5.345-3.872zM.4 16.113l5.345 3.872V13.76L.4 9.887v6.226zm23.2 0V9.887l-5.345 3.873v6.225l5.345-3.872z" />
    </svg>
  );
}

/* ─────────────────────── 데이터 ─────────────────────── */

const aiPlatforms = [
  { name: 'ChatGPT', icon: ChatGPTIcon, color: '#10a37f' },
  { name: 'Claude', icon: ClaudeIcon, color: '#d4a27f' },
  { name: 'Gemini', icon: GeminiIcon, color: '#4285f4' },
  { name: 'Perplexity', icon: PerplexityIcon, color: '#20b8cd' },
];

/** 3단계 파이프라인 */
const pipeline = [
  {
    number: '01',
    title: '수집',
    subtitle: '프롬프트 한 줄로 자동 수집',
    description:
      '여러 AI 플랫폼에 흩어진 대화와 지식을 MCP로 자동 수집합니다. "자동포스팅해줘" 한마디면 끝.',
    icon: Plug,
  },
  {
    number: '02',
    title: '공유',
    subtitle: '커뮤니티에서 지식 교류',
    description:
      'Style Guide로 자동 정제된 포스트를 커뮤니티에서 공유하고, 같은 관심사를 가진 사람들과 토론하세요.',
    icon: MessageSquare,
  },
  {
    number: '03',
    title: '거래',
    subtitle: '가치 있는 지식은 수익으로',
    description:
      '검증된 노하우와 콘텐츠를 마켓플레이스에서 거래하세요. 크리에이터에게 공정한 수익을 제공합니다.',
    icon: ShoppingBag,
  },
];

/** 소셜 프루프 수치 */
const stats = [
  { value: '4개+', label: '연동 가능 AI 플랫폼' },
  { value: '< 1분', label: '포스트 자동 발행 시간' },
  { value: '8종', label: 'Style Guide 프리셋' },
  { value: '24/7', label: '자동 수집·발행' },
];

/** 테스티모니얼 데이터 */
const testimonials = [
  {
    name: '하윤서',
    role: '프리랜서 개발자',
    company: '스텔라랩스',
    quote:
      'Claude랑 ChatGPT를 번갈아 쓰는데, 대화 내용 정리하려면 1시간씩 걸렸어요. 이제 "자동포스팅해줘" 한 마디면 블로그 글이 나옵니다. 포트폴리오 쌓는 속도가 완전히 달라졌어요.',
  },
  {
    name: '박도현',
    role: 'AI 리서처',
    company: '베리파이',
    quote:
      'Perplexity로 리서치하고 Claude로 정리하는 워크플로우였는데, 그 과정이 자동화되니까 하루에 콘텐츠 3개는 거뜬합니다. SEO도 자동이라 검색 유입이 4배 늘었어요.',
  },
  {
    name: '이서진',
    role: 'PM / 바이브코더',
    company: '루미너스',
    quote:
      '코딩은 AI로 하지만, 그 과정에서 쌓이는 지식은 어디에도 정리가 안 됐어요. Codebase 쓰고 나서는 매일 자동으로 기록이 남으니까, 나중에 다시 찾아보기도 편하고 팀원 온보딩 자료로도 씁니다.',
  },
  {
    name: '정유나',
    role: '콘텐츠 크리에이터',
    company: '프리랜서',
    quote:
      '마켓플레이스에서 프롬프트 템플릿 올렸는데 한 달 만에 수익이 생기기 시작했어요. 제가 매일 쓰는 AI 노하우가 다른 분들한테 가치가 되는 거 보면 동기부여가 됩니다.',
  },
];

/* ─────────────────────── 메인 컴포넌트 ─────────────────────── */
export default function ProductPage() {
  return (
    <div className="w-full text-zinc-900 dark:text-zinc-100 font-sans overflow-x-hidden">
      {/* ═══ 그레인 텍스처 오버레이 — 유기적 촉감 ═══ */}
      <div
        className="fixed inset-0 z-[60] pointer-events-none opacity-[0.025] dark:opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <main className="relative z-10">
        {/* ════════════════════════════════════════════════════════════
            HERO — Split Layout (좌 60% 텍스트 / 우 40% 비주얼)
            DESIGN_VARIANCE=8 → 중앙 정렬 금지, 비대칭 레이아웃 적용
            FONT_SCALE: Reduced from text-6xl to text-5xl for better readability
        ════════════════════════════════════════════════════════════ */}
        <section className="relative min-h-[calc(100dvh-88px)] flex items-center overflow-hidden">
          {/* 그래디언트 메시 배경 */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06] blur-[100px]" />
            <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full bg-zinc-400/[0.03] dark:bg-zinc-500/[0.04] blur-[80px]" />
            <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-emerald-600/[0.02] dark:bg-emerald-600/[0.03] blur-[120px]" />
          </div>

          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 pt-12 pb-16 lg:pt-0 lg:pb-0 w-full">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
              {/* ── 왼쪽: 텍스트 블록 ── */}
              <div className="[word-break:keep-all]">
                <FadeInSection>
                  <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                    <Plug className="h-3.5 w-3.5" />
                    <span>MCP 기반 AI 지식 통합 플랫폼</span>
                  </div>
                </FadeInSection>

                <FadeInSection delay={0.1}>
                  <h1 className="mt-8 text-4xl md:text-5xl font-bold leading-[1.15] tracking-tight text-zinc-900 dark:text-white">
                    흩어진 AI 지식을
                    <br />
                    한 곳에 모으고,
                    <br />
                    <span className="bg-gradient-to-r from-emerald-600 to-emerald-400 dark:from-emerald-400 dark:to-emerald-300 bg-clip-text text-transparent">
                      수익으로 연결합니다
                    </span>
                  </h1>
                </FadeInSection>

                <FadeInSection delay={0.2}>
                  <p className="mt-6 text-base md:text-[1.05rem] leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-[50ch]">
                    ChatGPT, Claude, Gemini, Perplexity — 프롬프트 한 줄이면
                    여러 AI에 파편화된 지식이 자동으로 수집되고,
                    블로그로 발행되며, 마켓에서 거래됩니다.
                  </p>
                </FadeInSection>

                <FadeInSection delay={0.3}>
                  <div className="mt-10 flex items-start">
                    <Link
                      href="/register"
                      className="group inline-flex h-14 items-center justify-center rounded-xl bg-zinc-900 dark:bg-white px-8 text-base font-semibold text-white dark:text-zinc-900 transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-zinc-900/10 dark:shadow-black/20"
                    >
                      무료로 시작하기
                      <ArrowRight className="ml-2.5 h-4.5 w-4.5 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  </div>
                </FadeInSection>
              </div>

              {/* ── 오른쪽: AI 플랫폼 수렴 비주얼 ── */}
              <FadeInSection delay={0.35} className="hidden lg:block">
                <div className="relative">
                  {/* 오비탈 비주얼 — AI 플랫폼들이 MCP 중심으로 수렴 */}
                  <div className="relative w-full aspect-square max-w-[480px] mx-auto">
                    {/* 배경 링 */}
                    <div className="absolute inset-8 rounded-full border border-zinc-200/40 dark:border-white/[0.06]" />
                    <div className="absolute inset-20 rounded-full border border-zinc-200/30 dark:border-white/[0.04]" />

                    {/* 중앙 MCP 허브 — 펄스 글로우 + 로고 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="absolute h-28 w-28 rounded-2xl bg-emerald-500/10 dark:bg-emerald-400/10"
                        style={{ animation: 'pulse-glow 3s ease-in-out infinite' }}
                      />
                      <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 shadow-xl shadow-zinc-900/10 dark:shadow-black/30 backdrop-blur-xl">
                        <div className="text-center">
                          <Plug className="h-7 w-7 text-emerald-600 dark:text-emerald-400 mx-auto" />
                          <p className="text-[10px] font-bold text-zinc-900 dark:text-white mt-1.5 tracking-wide">
                            MCP
                          </p>
                        </div>
                        <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]" />
                      </div>
                    </div>

                    {/* 오비탈 컨테이너 — 시계방향 회전 */}
                    <div
                      className="absolute inset-0"
                      style={{ animation: 'orbit 24s linear infinite' }}
                    >
                      {aiPlatforms.map((platform, i) => {
                        const Icon = platform.icon;
                        const positions = [
                          'top-4 left-1/2 -translate-x-1/2',     // top
                          'top-1/2 right-4 -translate-y-1/2',     // right
                          'bottom-4 left-1/2 -translate-x-1/2',   // bottom
                          'top-1/2 left-4 -translate-y-1/2',      // left
                        ];
                        const snippets = [
                          '이 코드 리팩토링 해줘',
                          '이 논문 요약해줘',
                          '회의록 정리 좀 해줘',
                          '최신 트렌드 분석해줘',
                        ];
                        return (
                          <div
                            key={platform.name}
                            className={`absolute ${positions[i]}`}
                          >
                            <div style={{ animation: 'counter-orbit 24s linear infinite' }}>
                              <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl px-4 py-2.5 shadow-lg shadow-zinc-900/5 dark:shadow-black/20">
                                <Icon className="h-5 w-5 shrink-0" style={{ color: platform.color }} />
                                <div>
                                  <p className="text-xs font-semibold text-zinc-900 dark:text-white leading-none">
                                    {platform.name}
                                  </p>
                                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                                    {snippets[i]}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                        <line x1="50" y1="15" x2="50" y2="38" className="stroke-zinc-300/60 dark:stroke-white/10" strokeWidth="0.3" strokeDasharray="2 2" />
                        <line x1="85" y1="50" x2="62" y2="50" className="stroke-zinc-300/60 dark:stroke-white/10" strokeWidth="0.3" strokeDasharray="2 2" />
                        <line x1="50" y1="85" x2="50" y2="62" className="stroke-zinc-300/60 dark:stroke-white/10" strokeWidth="0.3" strokeDasharray="2 2" />
                        <line x1="15" y1="50" x2="38" y2="50" className="stroke-zinc-300/60 dark:stroke-white/10" strokeWidth="0.3" strokeDasharray="2 2" />
                      </svg>
                    </div>
                  </div>
                </div>
              </FadeInSection>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            소셜 프루프 메트릭 스트립
        ════════════════════════════════════════════════════════════ */}
        <section className="border-y border-zinc-100 dark:border-white/[0.06]">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <FadeInSection>
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-zinc-100 dark:divide-white/[0.06]">
                {stats.map((stat) => (
                  <div key={stat.label} className="text-center py-8 sm:py-10 [word-break:keep-all]">
                    <p className="text-[1.4rem] sm:text-[1.6rem] font-bold text-zinc-900 dark:text-white tracking-tight">
                      {stat.value}
                    </p>
                    <p className="mt-1.5 text-[0.8rem] sm:text-xs text-zinc-400 dark:text-zinc-500">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </FadeInSection>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            문제 제기
        ════════════════════════════════════════════════════════════ */}
        <section className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* 왼쪽: 문제 제기 텍스트 */}
            <FadeInSection>
              <div className="[word-break:keep-all]">
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">
                  문제 인식
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-white">
                  매일 AI로 지식을 만들고 있지만,
                  <br />
                  그 지식은 어디에 있나요?
                </h2>
                <p className="mt-5 text-base leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-[50ch]">
                  국내 AI 이용자 2,031만 명이 매일 ChatGPT, Claude, Gemini 등에서
                  지식을 생산하고 있지만, 각 플랫폼에 파편화되어 축적되지 못하고
                  사라집니다. 블로그에 정리하려면 1편에 2시간, 월 20편이면 40시간의 기회비용이 발생합니다.
                </p>
              </div>
            </FadeInSection>

            {/* 오른쪽: Before / After 비교 */}
            <FadeInSection delay={0.15}>
              <div className="space-y-4">
                {/* Before */}
                <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.02] p-6 [word-break:keep-all]">
                  <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4">
                    기존 방식
                  </p>
                  <div className="space-y-3">
                    {[
                      { label: 'AI 기록 자동 발행', status: false },
                      { label: '콘텐츠 정제', value: '수작업 2시간/편' },
                      { label: '지식 수익화', value: '별도 채널 필요' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500 dark:text-zinc-400">{item.label}</span>
                        {item.status === false ? (
                          <span className="text-red-400/80 font-medium">불가</span>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500">{item.value}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* After — Codebase */}
                <div className="rounded-xl border border-emerald-500/20 dark:border-emerald-400/20 bg-emerald-50/30 dark:bg-emerald-500/[0.04] p-6 [word-break:keep-all]">
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">
                    Codebase
                  </p>
                  <div className="space-y-3">
                    {[
                      { label: 'AI 기록 자동 발행', check: true },
                      { label: '콘텐츠 정제', value: 'Style Guide 자동' },
                      { label: '지식 수익화', value: '마켓플레이스 내장' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-700 dark:text-zinc-300">{item.label}</span>
                        {item.check ? (
                          <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            프롬프트 한 줄
                          </span>
                        ) : (
                          <span className="font-medium text-zinc-900 dark:text-white">{item.value}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeInSection>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            새로운 USE CASES 섹션 (shadcn Tabs 활용)
            - MCP 자동포스팅
            - 커뮤니티 지식 공유
            - 콘텐츠 판매와 배포
        ════════════════════════════════════════════════════════════ */}
        <section
          id="use-cases"
          className="border-y border-zinc-100 dark:border-white/[0.06] bg-zinc-50/60 dark:bg-white/[0.01] py-20 sm:py-28"
        >
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <FadeInSection>
              <div className="max-w-2xl mb-12 [word-break:keep-all]">
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">
                  Use Cases
                </p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-white">
                  프롬프트를 넘어서,
                  <br />
                  코드베이스로 연결되는 세 가지 활용례
                </h2>
              </div>
            </FadeInSection>

            <FadeInSection delay={0.1}>
              <Tabs defaultValue="mcp" className="w-full">
                <TabsList className="flex w-full overflow-x-auto justify-start border-b border-zinc-200 dark:border-white/10 rounded-none bg-transparent p-0 mb-8 max-w-none">
                  <TabsTrigger
                    value="mcp"
                    className="flex-1 pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:text-white text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    MCP 자동포스팅
                  </TabsTrigger>
                  <TabsTrigger
                    value="community"
                    className="flex-1 pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:text-white text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    커뮤니티 지식 공유
                  </TabsTrigger>
                  <TabsTrigger
                    value="marketplace"
                    className="flex-1 pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:text-white text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    콘텐츠 판매와 배포
                  </TabsTrigger>
                </TabsList>

                {/* MCP 자동포스팅 */}
                <TabsContent value="mcp" className="focus-visible:outline-none focus-visible:ring-0">
                  <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                    <div>
                      <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
                        프롬프트 하나로 AI 지식을 수집하세요
                      </h3>
                      <p className="text-base text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
                        <code className="text-sm bg-zinc-100 dark:bg-white/10 rounded px-1.5 py-0.5">npx mcporter connect</code> 한 줄로 로컬 MCP 프록시 서버를 실행하고, 사용하는 어떤 대화형 AI(ChatGPT, Claude 등)와든 연결합니다. &quot;자동포스팅해줘&quot;라고 입력하면 8가지 Style Guide 프리셋(기술블로그, 에세이 등)을 적용해 SEO 메타데이터와 함께 콘텐츠로 정제되어 Codebase에 즉시 포스팅됩니다.
                      </p>
                      <ul className="space-y-3">
                        {['원클릭 CLI 인증 연동', '모든 호환 AI 플랫폼 동시 대응', '포스트 초안의 Markdown/HTML 변환 기능 탑재'].map((item) => (
                           <li key={item} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                             <Check className="h-4 w-4 text-emerald-500" />
                             {item}
                           </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-950 p-6 font-mono text-[13px] text-zinc-300 leading-7 shadow-lg">
                      <p><span className="text-emerald-500">➜</span>  <span className="text-blue-400">~</span> npx mcporter connect --platform codebase</p>
                      <p className="text-zinc-500">Starting Codebase MCP Proxy Server...</p>
                      <p className="text-zinc-300">✓ Authentication successful.</p>
                      <p className="text-zinc-300">✓ Listening on port 3100</p>
                      <br/>
                      <p className="text-zinc-500">{'// Meanwhile, in Claude window:'}</p>
                      <p><span className="text-purple-400">User:</span> 이 내용으로 자동포스팅해줘.</p>
                      <p><span className="text-blue-400">Claude:</span> 네, &apos;기술블로그&apos; 스타일이 적용된 블로그 포스트를 생성했습니다. (id: post_12x...)</p>
                    </div>
                  </div>
                </TabsContent>

                {/* 커뮤니티 지식 공유 */}
                <TabsContent value="community" className="focus-visible:outline-none focus-visible:ring-0">
                  <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                    <div className="lg:order-2">
                      <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
                        관심 커뮤니티에서 지식을 발전시키세요
                      </h3>
                      <p className="text-base text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
                        완성된 포스트는 단 한 번의 조작으로 Codebase 내의 다양한 <code className="text-sm bg-zinc-100 dark:bg-white/10 rounded px-1.5 py-0.5">/community</code> 게시판과 연결됩니다. 관심 주제의 바이브코딩 커뮤니티에서 내 글을 공유하고, 나와 비슷한 워크플로우를 가진 전문가들과 함께 인사이트를 교류하며 토론할 수 있습니다.
                      </p>
                      <ul className="space-y-3">
                        {['발행 즉시 커뮤니티 타임라인 동기화', '전문가 리뷰 및 댓글 피드백', '토론형 스니펫 인용 및 리포스팅'].map((item) => (
                           <li key={item} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                             <Check className="h-4 w-4 text-emerald-500" />
                             {item}
                           </li>
                        ))}
                      </ul>
                    </div>
                    <div className="lg:order-1 rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900 overflow-hidden shadow-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                         <div className="h-10 w-10 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg">C</div>
                         <div>
                            <div className="font-bold text-zinc-900 dark:text-white">AI Builders 커뮤니티</div>
                            <div className="text-xs text-zinc-500">2.1k members</div>
                         </div>
                      </div>
                      <div className="border border-zinc-100 dark:border-white/10 rounded-xl p-4 bg-zinc-50 dark:bg-white/5">
                         <div className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">방금 전 포스팅한 내 게시물 공유하기</div>
                         <div className="text-[13px] text-zinc-500 dark:text-zinc-400 mb-4">&quot;오늘 새롭게 발견한 Cursor 에디터 통합 팁입니다! 다들 어떻게 생각하시나요?&quot;</div>
                         <div className="border border-emerald-500/20 rounded-lg p-3 bg-white dark:bg-zinc-800">
                           <div className="font-medium text-sm text-emerald-600 dark:text-emerald-400">Cursor IDE와 MCP 연동 최적화 전략</div>
                           <div className="text-xs text-zinc-400 mt-1">2 mins read • Tech Blog Style</div>
                         </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* 콘텐츠 판매와 배포 */}
                <TabsContent value="marketplace" className="focus-visible:outline-none focus-visible:ring-0">
                  <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                    <div>
                      <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
                        지식을 안전하게 상품화하세요
                      </h3>
                      <p className="text-base text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
                        마켓플레이스의 강력한 4단계(4-Phase) 아키텍처를 기반으로 나만의 프롬프트 팩, 템플릿, 단축어 설정집을 손쉽게 상품화할 수 있습니다. <code className="text-sm bg-zinc-100 dark:bg-white/10 rounded px-1.5 py-0.5">DeliveryItem</code> 체계를 통해 구매자만 접근 가능한 파일 및 시크릿 텍스트를 제공하여, 단순한 코딩 정보 그 이상의 독점적인 지식을 수익화하세요.
                      </p>
                      <ul className="space-y-3">
                        {['구매자 전용 3중 다운로드 계층 지원', '악성코드 스캔 및 안전 검증 패스 (File Safety)', '개별 결제 기반 주문 내역(Order) 및 영수증 제공'].map((item) => (
                           <li key={item} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                             <Check className="h-4 w-4 text-emerald-500" />
                             {item}
                           </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900 shadow-lg p-6">
                       <div className="flex justify-between items-center mb-6">
                         <div className="font-bold text-zinc-900 dark:text-white">마켓플레이스 대시보드</div>
                         <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded text-xs font-bold">Seller Profile</div>
                       </div>
                       <div className="space-y-4">
                         <div className="flex border border-zinc-100 dark:border-white/10 rounded-xl p-3 gap-4 items-center">
                           <div className="h-12 w-12 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                             <Terminal className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                           </div>
                           <div className="flex-1 min-w-0">
                             <div className="font-semibold text-sm text-zinc-900 dark:text-white truncate">웹개발 생산성 10배 AI 프롬프트 팩</div>
                             <div className="text-xs text-zinc-500">배포: 3 files (Delivery Items)</div>
                           </div>
                           <div className="text-right">
                             <div className="font-bold text-[13px] text-zinc-900 dark:text-white">₩15,000</div>
                             <div className="text-[11px] text-zinc-400">12 Sales</div>
                           </div>
                         </div>
                         <div className="flex border border-zinc-100 dark:border-white/10 rounded-xl p-3 gap-4 items-center">
                           <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                             <Workflow className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                           </div>
                           <div className="flex-1 min-w-0">
                             <div className="font-semibold text-sm text-zinc-900 dark:text-white truncate">Next.js 14 보일러플레이트 구조</div>
                             <div className="text-xs text-zinc-500">배포: 1 file (With Download Track)</div>
                           </div>
                           <div className="text-right">
                             <div className="font-bold text-[13px] text-zinc-900 dark:text-white">₩24,000</div>
                             <div className="text-[11px] text-zinc-400">8 Sales</div>
                           </div>
                         </div>
                       </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </FadeInSection>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            수집→공유→거래 파이프라인 — 지그재그 레이아웃
        ════════════════════════════════════════════════════════════ */}
        <section
          id="features"
          className="border-t border-zinc-100 dark:border-white/[0.06] bg-white dark:bg-zinc-[950] py-20 lg:py-28"
        >
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <FadeInSection>
              <div className="max-w-2xl mb-16 [word-break:keep-all]">
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">
                  작동 원리 요약
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-white">
                  수집, 공유, 거래가
                  <br />
                  하나의 플랫폼에서 완결됩니다
                </h2>
              </div>
            </FadeInSection>

            {/* 지그재그 스텝 */}
            <div className="space-y-16 lg:space-y-24">
              {pipeline.map((step, i) => {
                const Icon = step.icon;
                const isReversed = i % 2 !== 0;

                return (
                  <FadeInSection key={step.number} delay={i * 0.1}>
                    <div
                      className={`grid lg:grid-cols-2 gap-10 lg:gap-20 items-center ${
                        isReversed ? 'lg:[direction:rtl]' : ''
                      }`}
                    >
                      {/* 비주얼 카드 */}
                      <div className={isReversed ? 'lg:[direction:ltr]' : ''}>
                        <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/50 p-8 shadow-sm">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-white/[0.06] mb-6">
                            <Icon className="h-6 w-6 text-zinc-600 dark:text-zinc-300" strokeWidth={1.5} />
                          </div>
                          {/* 각 스텝별 미니 데모 UI */}
                          {i === 0 && (
                            <div className="space-y-2.5">
                              {aiPlatforms.slice(0, 3).map((p) => {
                                const PIcon = p.icon;
                                return (
                                  <div
                                    key={p.name}
                                    className="flex items-center gap-3 rounded-lg border border-zinc-100 dark:border-white/[0.06] p-3"
                                  >
                                    <PIcon className="h-4 w-4 shrink-0" style={{ color: p.color }} />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                        {p.name} 세션 연결
                                      </p>
                                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                                        최근 대화 12건 동기화 준비 완료
                                      </p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                      수집됨
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {i === 1 && (
                            <div className="flex items-start gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-700 dark:bg-white/10 dark:text-zinc-200 shrink-0">
                                AI
                              </div>
                              <div className="flex-1 space-y-3">
                                <div className="rounded-2xl rounded-tl-md bg-zinc-100 px-4 py-3 dark:bg-white/[0.06]">
                                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                                    포스트 초안 생성 완료
                                  </p>
                                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                    기술블로그 스타일, SEO 메타데이터, 제목 3안 포함
                                  </p>
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <span className="inline-flex h-7 items-center rounded-md bg-zinc-100 px-3 text-xs font-medium text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-300">
                                    초안 공유
                                  </span>
                                  <span className="inline-flex h-7 items-center rounded-md bg-emerald-50 px-3 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                    커뮤니티 게시
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                          {i === 2 && (
                            <div className="grid grid-cols-2 gap-2.5">
                              {[
                                ['프롬프트 팩', '₩12,000'],
                                ['블로그 템플릿', '₩8,900'],
                                ['MCP 설정집', '₩15,000'],
                                ['자동화 노하우', '₩19,000'],
                              ].map(([title, price]) => (
                                <div
                                  key={title}
                                  className="rounded-lg border border-zinc-100 dark:border-white/[0.06] p-3 space-y-2"
                                >
                                  <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                    {title}
                                  </p>
                                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                    {price}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 텍스트 */}
                      <div className={`${isReversed ? 'lg:[direction:ltr]' : ''} [word-break:keep-all]`}>
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-4">
                          {step.number.replace('0', '')}
                        </span>
                        <span className="block text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2">
                          {step.title}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white leading-tight">
                          {step.subtitle}
                        </h3>
                        <p className="mt-3 text-base leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-[44ch]">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </FadeInSection>
                );
              })}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            FINAL CTA — 풀블리드 + 그래디언트 메시
        ════════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden">
          {/* 그래디언트 메시 배경 */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.05] dark:bg-emerald-500/[0.08] blur-[100px]" />
            <div className="absolute bottom-0 right-1/3 w-[400px] h-[400px] rounded-full bg-emerald-600/[0.03] dark:bg-emerald-600/[0.05] blur-[120px]" />
          </div>

          <div className="relative mx-auto max-w-4xl px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
            <FadeInSection>
              <div className="text-center [word-break:keep-all]">
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">
                  AI 지식, 더 이상
                  <br />
                  흩어지지 않게
                </h2>
                <p className="mt-5 mx-auto max-w-lg text-base text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  ChatGPT, Claude, Gemini, Perplexity — 어디서 작업하든
                  프롬프트 한 줄이면 지식이 자동으로 모이고 공유됩니다.
                </p>
                <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    href="/register"
                    className="group inline-flex h-14 items-center justify-center rounded-xl bg-zinc-900 dark:bg-white px-8 text-base font-semibold text-white dark:text-zinc-900 transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-zinc-900/10 dark:shadow-black/20"
                  >
                    무료로 시작하기
                    <ArrowRight className="ml-2.5 h-4.5 w-4.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex h-14 items-center justify-center rounded-xl border border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm px-8 text-base font-medium text-zinc-600 dark:text-zinc-400 transition-all duration-300 hover:bg-zinc-50 dark:hover:bg-white/10"
                  >
                    로그인
                  </Link>
                </div>
              </div>
            </FadeInSection>
          </div>
        </section>
      </main>
    </div>
  );
}
