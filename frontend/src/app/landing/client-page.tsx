'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  ArrowRight,
  Shield,
  FileText,
  Workflow,
  CheckCircle2,
  Plug,
  Search,
  Users,
  ChevronRight,
  Check,
  ShoppingBag,
  MessageSquare,
  Quote,
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

/** OpenAI / ChatGPT 로고 */
function ChatGPTIcon({ className = '', style }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

/** Anthropic / Claude 로고 */
function ClaudeIcon({ className = '', style }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.257 0h3.604L16.744 20.48h-3.604L6.57 3.52zM0 20.48h3.604L10.174 3.52H6.57L0 20.48z" />
    </svg>
  );
}

/** Google Gemini 로고 */
function GeminiIcon({ className = '', style }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M12 0C12 0 12 8 8 12C4 16 0 12 0 12C0 12 4 12 8 12C12 12 12 16 12 24C12 24 12 16 16 12C20 8 24 12 24 12C24 12 20 12 16 12C12 12 12 8 12 0Z" />
    </svg>
  );
}

/** Perplexity 로고 */
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

/** 핵심 기능 카드 — Bento Grid용으로 large/small 구분 */
const features = [
  {
    icon: Workflow,
    title: 'MCP 크로스플랫폼 수집',
    description:
      'ChatGPT, Claude, Gemini, Perplexity — 어떤 AI를 쓰든 MCP 프로토콜로 대화 내용을 자동 수집합니다. 파편화된 지식이 하나로 모입니다.',
    large: true,
  },
  {
    icon: FileText,
    title: 'Style Guide 자동 정제',
    description:
      '수집된 AI 대화를 기술블로그, 에세이, 바이브코딩 등 8종 프리셋으로 자동 변환합니다.',
    large: false,
  },
  {
    icon: Search,
    title: 'SEO 자동 최적화',
    description:
      'Open Graph, 구조화된 데이터, 시맨틱 HTML이 자동 적용됩니다.',
    large: false,
  },
  {
    icon: Users,
    title: '커뮤니티 공유 & 토론',
    description:
      '자동 발행된 포스트를 커뮤니티에서 공유하고 토론하세요. AI 활용 정보를 깊이 교류할 수 있는 공간입니다.',
    large: false,
  },
  {
    icon: ShoppingBag,
    title: '콘텐츠 마켓플레이스',
    description:
      '가치 있는 노하우는 마켓에서 거래하세요. 프롬프트, 템플릿, 스킬을 상품화하고 수익을 창출할 수 있습니다.',
    large: false,
  },
  {
    icon: Shield,
    title: '엔터프라이즈급 보안',
    description:
      'RBAC, JWT HttpOnly 쿠키, OAuth2 인증. 개인의 AI 지식 자산을 안전하게 보호하는 보안 아키텍처를 제공합니다.',
    large: true,
  },
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
export default function LandingClientPage() {
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
                  <h1 className="mt-8 text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-white">
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
                  <p className="mt-6 text-base md:text-lg leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-[52ch]">
                    ChatGPT, Claude, Gemini, Perplexity — 프롬프트 한 줄이면
                    여러 AI에 파편화된 지식이 자동으로 수집되고,
                    블로그로 발행되며, 마켓에서 거래됩니다.
                  </p>
                </FadeInSection>

                <FadeInSection delay={0.3}>
                  <div className="mt-10 flex flex-col sm:flex-row items-start gap-3">
                    <Link
                      href="/register"
                      className="group inline-flex h-14 items-center justify-center rounded-xl bg-zinc-900 dark:bg-white px-8 text-base font-semibold text-white dark:text-zinc-900 transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-zinc-900/10 dark:shadow-black/20"
                    >
                      무료로 시작하기
                      <ArrowRight className="ml-2.5 h-4.5 w-4.5 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                    <Link
                      href="#pipeline"
                      className="inline-flex h-14 items-center justify-center rounded-xl border border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm px-8 text-base font-medium text-zinc-600 dark:text-zinc-400 transition-all duration-300 hover:bg-zinc-50 dark:hover:bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                    >
                      작동 원리 보기
                      <ChevronRight className="ml-1.5 h-4 w-4" />
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
                      {/* 펄스 글로우 링 */}
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
                        {/* 글래스 내부 광택 */}
                        <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]" />
                      </div>
                    </div>

                    {/* 오비탈 컨테이너 — 시계방향 회전 */}
                    <div
                      className="absolute inset-0"
                      style={{ animation: 'orbit 24s linear infinite' }}
                    >
                      {/* AI 플랫폼 노드 — 네 모서리에 배치, 부모와 함께 공전 */}
                      {aiPlatforms.map((platform, i) => {
                        const Icon = platform.icon;
                        const positions = [
                          'top-4 left-1/2 -translate-x-1/2',     // top
                          'top-1/2 right-4 -translate-y-1/2',     // right
                          'bottom-4 left-1/2 -translate-x-1/2',   // bottom
                          'top-1/2 left-4 -translate-y-1/2',      // left
                        ];
                        /* 자연스러운 사용자 대화 스니펫 */
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
                            {/* 역회전으로 텍스트 정방향 유지 */}
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

                      {/* 연결선 — 각 노드에서 중심으로 향하는 점선 (함께 회전) */}
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
            소셜 프루프 메트릭 스트립 — Hero 직후 신뢰 구축
        ════════════════════════════════════════════════════════════ */}
        <section className="border-y border-zinc-100 dark:border-white/[0.06]">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <FadeInSection>
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-zinc-100 dark:divide-white/[0.06]">
                {stats.map((stat) => (
                  <div key={stat.label} className="text-center py-8 sm:py-10 [word-break:keep-all]">
                    <p className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
                      {stat.value}
                    </p>
                    <p className="mt-1.5 text-sm text-zinc-400 dark:text-zinc-500">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </FadeInSection>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            문제 제기 — 비대칭 레이아웃 (좌 텍스트 / 우 비교 카드)
        ════════════════════════════════════════════════════════════ */}
        <section className="mx-auto max-w-7xl px-6 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* 왼쪽: 문제 제기 텍스트 */}
            <FadeInSection>
              <div className="[word-break:keep-all]">
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">
                  문제 인식
                </p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-white">
                  매일 AI로 지식을 만들고 있지만,
                  <br />
                  그 지식은 어디에 있나요?
                </h2>
                <p className="mt-5 text-base md:text-lg leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-[52ch]">
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
            수집→공유→거래 파이프라인 — 지그재그 레이아웃
        ════════════════════════════════════════════════════════════ */}
        <section
          id="pipeline"
          className="border-y border-zinc-100 dark:border-white/[0.06] bg-zinc-50/60 dark:bg-white/[0.01] py-24 lg:py-32"
        >
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <FadeInSection>
              <div className="max-w-2xl mb-16 [word-break:keep-all]">
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">
                  작동 원리
                </p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-white">
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
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/[0.06] mb-6">
                            <Icon className="h-7 w-7 text-zinc-600 dark:text-zinc-300" strokeWidth={1.5} />
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
                                    <div className="h-2 flex-1 rounded-full bg-zinc-100 dark:bg-white/[0.06]" />
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {i === 1 && (
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-white/10 shrink-0" />
                              <div className="flex-1 space-y-2">
                                <div className="h-2.5 w-3/4 rounded-full bg-zinc-100 dark:bg-white/[0.06]" />
                                <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-white/[0.06]" />
                                <div className="h-2 w-5/6 rounded-full bg-zinc-100 dark:bg-white/[0.06]" />
                                <div className="flex gap-3 pt-2">
                                  <div className="h-7 w-16 rounded-md bg-zinc-100 dark:bg-white/[0.06]" />
                                  <div className="h-7 w-16 rounded-md bg-zinc-100 dark:bg-white/[0.06]" />
                                </div>
                              </div>
                            </div>
                          )}
                          {i === 2 && (
                            <div className="grid grid-cols-2 gap-2.5">
                              {[1, 2, 3, 4].map((n) => (
                                <div
                                  key={n}
                                  className="rounded-lg border border-zinc-100 dark:border-white/[0.06] p-3 space-y-2"
                                >
                                  <div className="h-2 w-2/3 rounded-full bg-zinc-100 dark:bg-white/[0.06]" />
                                  <div className="h-5 w-1/2 rounded bg-zinc-100 dark:bg-white/[0.06]" />
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
                        <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white leading-snug">
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
            MCPorter 시작 가이드 — "어떻게 가능한가"
        ════════════════════════════════════════════════════════════ */}
        <section className="mx-auto max-w-7xl px-6 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            {/* 왼쪽: 3단계 과정 */}
            <div className="space-y-5">
              <FadeInSection>
                <div className="mb-8 [word-break:keep-all]">
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">
                    시작 가이드
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">
                    3분이면 자동 포스팅이
                    <br />
                    시작됩니다
                  </h2>
                </div>
              </FadeInSection>

              {/* Step 1: MCPorter 설치 */}
              <FadeInSection delay={0.1}>
                <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/50 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-100 dark:border-white/[0.06]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 dark:bg-white text-[11px] font-bold text-white dark:text-zinc-900">
                      1
                    </span>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                      MCPorter 설치 (1회)
                    </span>
                  </div>
                  <div className="bg-zinc-950 px-5 py-4 font-mono text-[13px] leading-7">
                    <p>
                      <span className="text-zinc-600">$</span>{' '}
                      <span className="text-zinc-300">npx mcporter connect --platform codebase</span>
                    </p>
                    <p className="text-zinc-600">
                      <span className="text-zinc-500">✓</span> OAuth2 인증 완료
                    </p>
                    <p className="text-zinc-600">
                      <span className="text-zinc-500">✓</span> MCP 프록시 서버 실행 중 (port 3100)
                    </p>
                    <p className="text-emerald-500/80 mt-0.5">● 연결 완료</p>
                  </div>
                </div>
              </FadeInSection>

              {/* Step 2: 프롬프트 한마디 */}
              <FadeInSection delay={0.2}>
                <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/50 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-100 dark:border-white/[0.06]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 dark:bg-white text-[11px] font-bold text-white dark:text-zinc-900">
                      2
                    </span>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                      사용 중인 AI에서 한마디
                    </span>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex -space-x-1">
                        {aiPlatforms.map((p) => {
                          const Icon = p.icon;
                          return (
                            <div
                              key={p.name}
                              className="flex h-5 w-5 items-center justify-center rounded-full border border-white dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-800"
                            >
                              <Icon className="h-2.5 w-2.5" style={{ color: p.color }} />
                            </div>
                          );
                        })}
                      </div>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-600">
                        어떤 AI에서든 동일하게 작동
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <div className="rounded-2xl rounded-br-md bg-zinc-900 dark:bg-zinc-200 px-4 py-2.5 max-w-[280px]">
                        <p className="text-sm text-white dark:text-zinc-900 font-medium">
                          &quot;자동포스팅해줘&quot;
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-bl-md bg-zinc-100 dark:bg-white/[0.06] px-4 py-2.5 max-w-[320px]">
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 [word-break:keep-all]">
                          이번 세션의 내용을 정리하여 Codebase에 포스팅하겠습니다.
                          Style Guide는 &quot;기술블로그&quot;로 설정할까요?
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="rounded-2xl rounded-br-md bg-zinc-900 dark:bg-zinc-200 px-4 py-2.5">
                        <p className="text-sm text-white dark:text-zinc-900 font-medium">&quot;응&quot;</p>
                      </div>
                    </div>
                  </div>
                </div>
              </FadeInSection>

              {/* Step 3: 자동 발행 */}
              <FadeInSection delay={0.3}>
                <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/50 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-100 dark:border-white/[0.06]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 dark:bg-white text-[11px] font-bold text-white dark:text-zinc-900">
                      3
                    </span>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                      자동 발행 완료
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-200/50 dark:border-emerald-500/10 bg-emerald-50/30 dark:bg-emerald-500/[0.04] p-4">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          포스트가 발행되었습니다
                        </p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                          codebase.blog/your-blog/next-js-caching-strategy
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500 text-center [word-break:keep-all]">
                      SEO 최적화, Open Graph, 구문 강조 자동 적용
                    </p>
                  </div>
                </div>
              </FadeInSection>
            </div>

            {/* 오른쪽: 요약 + CTA */}
            <FadeInSection delay={0.15}>
              <div className="lg:sticky lg:top-32 space-y-5">
                <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/50 p-6 [word-break:keep-all]">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-5">
                    왜 MCPorter인가?
                  </h3>
                  <ul className="space-y-4">
                    {[
                      { label: '설치 한 번이면 끝', desc: 'npx 한 줄로 설치. 이후 자동 실행됩니다.' },
                      {
                        label: '모든 AI 플랫폼 지원',
                        desc: 'ChatGPT, Claude, Gemini, Perplexity 등 MCP 호환 AI 모두 연동.',
                      },
                      {
                        label: '프롬프트 한 줄로 발행',
                        desc: '"자동포스팅해줘" 한마디로 수집→정제→발행 자동 완료.',
                      },
                      { label: 'Style Guide 8종', desc: '기술블로그, 에세이, 바이브코딩 등 원하는 형태로 자동 정제.' },
                      { label: '보안 인증', desc: 'OAuth2 기반 안전한 인증. 토큰은 로컬에만 저장됩니다.' },
                    ].map((item) => (
                      <li key={item.label} className="flex items-start gap-3">
                        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {item.label}
                          </p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{item.desc}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href="/register"
                  className="group flex h-14 items-center justify-center rounded-xl bg-zinc-900 dark:bg-white text-base font-semibold text-white dark:text-zinc-900 transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-zinc-900/10 dark:shadow-black/20"
                >
                  지금 무료로 시작하기
                  <ArrowRight className="ml-2.5 h-4.5 w-4.5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </FadeInSection>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            FEATURES — Bento Grid (비대칭, 3-column 등분 금지)
        ════════════════════════════════════════════════════════════ */}
        <section
          id="features"
          className="border-y border-zinc-100 dark:border-white/[0.06] bg-zinc-50/60 dark:bg-white/[0.01] py-24 sm:py-32"
        >
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <FadeInSection>
              <div className="max-w-2xl mb-14 [word-break:keep-all]">
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">
                  핵심 기능
                </p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-white">
                  파편화 문제를 해결하는
                  <br />
                  6가지 기능
                </h2>
              </div>
            </FadeInSection>

            {/* Bento Grid — 비대칭 레이아웃: large 카드는 col-span-2 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <FadeInSection
                    key={feature.title}
                    delay={i * 0.06}
                    className={feature.large ? 'sm:col-span-2 lg:col-span-2' : ''}
                  >
                    <div
                      className={`group h-full rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/50 transition-all duration-300 hover:border-zinc-300 dark:hover:border-white/10 hover:shadow-lg hover:shadow-zinc-900/5 dark:hover:shadow-black/10 ${
                        feature.large ? 'p-8' : 'p-6'
                      }`}
                    >
                      <div
                        className={`mb-4 inline-flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 ${
                          feature.large ? 'h-12 w-12' : 'h-10 w-10'
                        }`}
                      >
                        <Icon className={feature.large ? 'h-6 w-6' : 'h-5 w-5'} strokeWidth={1.5} />
                      </div>
                      <h3
                        className={`font-bold text-zinc-900 dark:text-zinc-100 [word-break:keep-all] ${
                          feature.large ? 'text-lg' : 'text-base'
                        }`}
                      >
                        {feature.title}
                      </h3>
                      <p
                        className={`mt-2 leading-relaxed text-zinc-500 dark:text-zinc-400 [word-break:keep-all] ${
                          feature.large ? 'text-base max-w-[56ch]' : 'text-sm'
                        }`}
                      >
                        {feature.description}
                      </p>
                    </div>
                  </FadeInSection>
                );
              })}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            TESTIMONIALS — 마소니 레이아웃 (새 섹션)
        ════════════════════════════════════════════════════════════ */}
        <section className="mx-auto max-w-7xl px-6 py-24 sm:px-8 lg:px-12 lg:py-32">
          <FadeInSection>
            <div className="max-w-2xl mb-14 [word-break:keep-all]">
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">
                사용자 후기
              </p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-white">
                먼저 경험한 분들의 이야기
              </h2>
            </div>
          </FadeInSection>

          {/* 마소니 스타일: 2열, 엇갈린 높이 */}
          <div className="columns-1 sm:columns-2 gap-4 space-y-4">
            {testimonials.map((t, i) => (
              <FadeInSection key={t.name} delay={i * 0.08}>
                <div className="break-inside-avoid rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/50 p-6 [word-break:keep-all]">
                  <Quote className="h-5 w-5 text-zinc-200 dark:text-white/10 mb-4" />
                  <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {t.quote}
                  </p>
                  <div className="mt-5 flex items-center gap-3 pt-4 border-t border-zinc-100 dark:border-white/[0.06]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://i.pravatar.cc/80?u=${t.name}`}
                      alt={t.name}
                      className="h-9 w-9 rounded-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                        {t.name}
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        {t.role} · {t.company}
                      </p>
                    </div>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            ACCESS
        ════════════════════════════════════════════════════════════ */}
        <section
          id="access"
          className="border-y border-zinc-100 dark:border-white/[0.06] bg-zinc-50/60 dark:bg-white/[0.01] py-24 lg:py-32"
        >
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <FadeInSection>
              <div className="text-center max-w-2xl mx-auto mb-14 [word-break:keep-all]">
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">
                  이용 안내
                </p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">
                  지금은 핵심 기능에
                  <br />
                  바로 집중할 수 있습니다
                </h2>
                <p className="mt-5 text-base leading-relaxed text-zinc-500 dark:text-zinc-400">
                  공개 결제는 아직 열지 않았습니다. 현재는 기본 경험을 먼저 사용할 수 있고,
                  팀 도입이나 별도 운영이 필요하면 문의를 통해 안내합니다.
                </p>
              </div>
            </FadeInSection>

            <div className="grid gap-5 lg:grid-cols-3 max-w-4xl mx-auto">
              {/* 개인 사용자 */}
              <FadeInSection delay={0} className="h-full">
                <div className="h-full flex flex-col rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/50 p-7 [word-break:keep-all]">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">개인 사용자</h3>
                  <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">핵심 기능을 빠르게 체험</p>
                  <p className="mt-6 text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
                    즉시 시작
                  </p>
                  <ul className="mt-6 space-y-3">
                    {['계정 생성 후 기본 기능 사용', 'AI 기록 정리와 발행 경험 확인', '커뮤니티 참여', '서비스 흐름 빠르게 체험'].map(
                      (item) => (
                        <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
                          <Check className="h-4 w-4 text-zinc-400 dark:text-zinc-600 mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ),
                    )}
                  </ul>
                  <Link
                    href="/register"
                    className="mt-auto pt-8 flex h-12 items-center justify-center rounded-xl border border-zinc-200 dark:border-white/10 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition-all duration-300 hover:bg-zinc-50 dark:hover:bg-white/[0.04]"
                  >
                    무료로 시작하기
                  </Link>
                </div>
              </FadeInSection>

              {/* 팀 운영 */}
              <FadeInSection delay={0.06} className="h-full">
                <div className="h-full flex flex-col rounded-2xl border-2 border-emerald-500/30 dark:border-emerald-400/30 bg-white dark:bg-zinc-900/50 p-7 relative shadow-lg shadow-emerald-500/5 dark:shadow-emerald-400/5 [word-break:keep-all]">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 dark:bg-emerald-500 px-3.5 py-1 text-[11px] font-bold text-white tracking-wide">
                    추천
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">팀 운영</h3>
                  <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">반복 발행과 협업이 필요한 워크플로우</p>
                  <p className="mt-6 text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
                    도입 상담
                  </p>
                  <ul className="mt-6 space-y-3">
                    {[
                      '여러 워크플로우에 맞춘 운영 설계',
                      '반복 발행 자동화 범위 검토',
                      '팀 단위 사용 시나리오 상담',
                      '출시 시점 우선 안내',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
                        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/support"
                    className="mt-auto pt-8 flex h-12 items-center justify-center rounded-xl bg-emerald-600 dark:bg-emerald-500 text-sm font-semibold text-white transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    도입 문의하기
                  </Link>
                </div>
              </FadeInSection>

              {/* Enterprise */}
              <FadeInSection delay={0.12} className="h-full">
                <div className="h-full flex flex-col rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/50 p-7 [word-break:keep-all]">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">Enterprise</h3>
                  <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">조직과 기업을 위한 맞춤형</p>
                  <p className="mt-6 text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">별도 협의</p>
                  <ul className="mt-6 space-y-3">
                    {['Pro 전체 기능 포함', 'SSO & RBAC 관리', 'SLA 보장 (99.9%)', '전담 기술 지원', 'On-premise 배포 옵션'].map(
                      (item) => (
                        <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
                          <Check className="h-4 w-4 text-zinc-400 dark:text-zinc-600 mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ),
                    )}
                  </ul>
                  <Link
                    href="/support"
                    className="mt-auto pt-8 flex h-12 items-center justify-center rounded-xl border border-zinc-200 dark:border-white/10 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition-all duration-300 hover:bg-zinc-50 dark:hover:bg-white/[0.04]"
                  >
                    상담 요청하기
                  </Link>
                </div>
              </FadeInSection>
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

          <div className="relative mx-auto max-w-4xl px-6 py-28 sm:px-8 lg:px-12 lg:py-36">
            <FadeInSection>
              <div className="text-center [word-break:keep-all]">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">
                  AI 지식, 더 이상
                  <br />
                  흩어지지 않게
                </h2>
                <p className="mt-5 mx-auto max-w-lg text-base md:text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed">
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

      {/* ═══ Footer — 미니멀 ═══ */}
      <footer className="border-t border-zinc-100 dark:border-white/[0.06] py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-6 sm:flex-row sm:items-center sm:px-8 lg:px-12">
          <div className="flex items-center gap-2">
            <Image
              src="/assets/logo.svg"
              alt="Codebase Logo"
              width={20}
              height={20}
              className="dark:invert opacity-60"
            />
            <span className="text-sm text-zinc-400 dark:text-zinc-600">© 2026 Codebase</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-400 dark:text-zinc-600">
            <Link
              href="/legal/privacy"
              className="transition hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              개인정보처리방침
            </Link>
            <Link
              href="/legal/terms"
              className="transition hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              이용약관
            </Link>
          </div>
        </div>
      </footer>

      {/* ═══ CSS 키프레임 (float 애니메이션) ═══ */}
      {/* ═══ CSS 키프레임 (오비탈 회전 애니메이션) ═══ */}
      <style jsx global>{`
        @keyframes orbit {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes counter-orbit {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(-360deg);
          }
        }
        @keyframes pulse-glow {
          0%,
          100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.08);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0s !important;
          }
        }
      `}</style>
    </div>
  );
}
