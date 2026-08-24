import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Bot,
  Check,
  Code2,
  ExternalLink,
  FileText,
  Github,
  Layers3,
  MessageSquare,
  Paintbrush,
  Server,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import { localizePath, type AppLocale } from '@/lib/i18n/config';
import { getLandingContent } from './landing-content';

const GITHUB_URL = 'https://github.com/beyondeth/my-blog-app-selfhost';

const foundationIcons = [BookOpen, Bot, Paintbrush, Users];
const feedVisuals = [
  { icon: Workflow, className: 'from-[#DDEFE7] via-[#B8DDCF] to-[#76B59E]', iconClassName: 'text-[#0B6B4F]' },
  { icon: Paintbrush, className: 'from-[#E6E9F6] via-[#C9D2ED] to-[#98A9D8]', iconClassName: 'text-[#344D91]' },
  { icon: MessageSquare, className: 'from-[#F3E8D7] via-[#E7CFAC] to-[#C99D63]', iconClassName: 'text-[#76501F]' },
];
const avatars = ['/character/Bimmo.jpeg', '/character/Jooli.jpeg', '/character/LumoPop.jpeg'];
const brandingThemes = [
  { surface: 'bg-[#142F27]', accent: 'bg-[#9FD1BE]', text: 'text-white', muted: 'text-[#C4D8D0]', panel: 'bg-[#F1F5F3]' },
  { surface: 'bg-[#25365D]', accent: 'bg-[#B9C8EF]', text: 'text-white', muted: 'text-[#CBD4EB]', panel: 'bg-[#F1F3F9]' },
  { surface: 'bg-[#6C4124]', accent: 'bg-[#E6BC89]', text: 'text-white', muted: 'text-[#F0D7BA]', panel: 'bg-[#F8F1E9]' },
];

function SectionHeading({
  eyebrow,
  title,
  description,
  light = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  light?: boolean;
}) {
  return (
    <div className="max-w-3xl [word-break:keep-all]">
      <p className={`text-sm font-semibold uppercase tracking-[0.12em] ${light ? 'text-[#A9D4C3]' : 'text-[#0B6B4F] dark:text-[#8FD0B6]'}`}>
        {eyebrow}
      </p>
      <h2 className={`mt-4 text-[32px] font-semibold leading-[1.2] tracking-[0.01em] sm:text-[40px] lg:text-[48px] ${light ? 'text-white' : 'text-[#1B2430] dark:text-[#E6EDF3]'}`}>
        {title}
      </h2>
      <p className={`mt-5 text-base leading-[1.7] tracking-[0.01em] sm:text-lg ${light ? 'text-[#C5D9D1]' : 'text-[#4B5563] dark:text-[#A9B4C2]'}`}>
        {description}
      </p>
    </div>
  );
}

export default function LandingClientPage({ locale }: { locale: AppLocale }) {
  const copy = getLandingContent(locale);
  const alternateLocale = locale === 'ko' ? 'en' : 'ko';

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-[#1B2430] dark:bg-[#0E141B] dark:text-[#E6EDF3]">
      <nav
        aria-label={copy.navLabel}
        className="border-y border-[#D9E0EA] bg-white dark:border-[#2A3645] dark:bg-[#0E141B]"
      >
        <div className="mx-auto flex min-h-14 max-w-7xl items-center gap-1 overflow-x-auto px-4 sm:px-6">
          {copy.navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold text-[#4B5563] transition-colors hover:bg-[#EEF3F8] hover:text-[#1B2430] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B6B4F] dark:text-[#A9B4C2] dark:hover:bg-[#1A232E] dark:hover:text-white"
            >
              {item.label}
            </a>
          ))}
          <Link
            href={localizePath('/landing', alternateLocale)}
            hrefLang={alternateLocale}
            className="ml-auto inline-flex min-h-11 shrink-0 items-center border-l border-[#D9E0EA] px-4 text-sm font-semibold text-[#0B6B4F] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B6B4F] dark:border-[#2A3645] dark:text-[#8FD0B6]"
          >
            {copy.languageLabel}
          </Link>
        </div>
      </nav>

      <main>
        <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.5fr)]">
          <div className="relative overflow-hidden rounded-[28px] bg-[#123D30] px-6 py-10 text-white shadow-[0_18px_48px_-32px_rgba(18,61,48,0.8)] sm:px-10 sm:py-14 lg:min-h-[540px] lg:px-14 lg:py-16">
            <div
              className="absolute inset-0 opacity-[0.16]"
              aria-hidden="true"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)',
                backgroundSize: '56px 56px',
              }}
            />
            <div className="relative flex h-full flex-col justify-between gap-12">
              <div className="[word-break:keep-all]">
                <p className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-sm font-semibold tracking-[0.08em] text-[#D9ECE4]">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {copy.hero.eyebrow}
                </p>
                <h1 className="mt-7 max-w-4xl text-[40px] font-semibold leading-[1.16] tracking-[0.01em] sm:text-[52px] lg:text-[64px]">
                  {copy.hero.title}
                  <span className="mt-2 block text-[#A9D9C6]">{copy.hero.accent}</span>
                </h1>
                <p className="mt-7 max-w-3xl text-base leading-[1.75] tracking-[0.01em] text-[#C5D9D1] sm:text-lg">
                  {copy.hero.description}
                </p>
              </div>

              <div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-[#123D30] transition-colors hover:bg-[#E3EEE9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  >
                    <Github className="h-5 w-5" aria-hidden="true" />
                    {copy.hero.githubCta}
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                  <Link
                    href="/"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/45 px-6 text-base font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  >
                    {copy.hero.liveCta}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
                <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm text-[#D9ECE4]">
                  {copy.hero.proof.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#A9D9C6]" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <article className="flex min-h-[260px] flex-col justify-between rounded-[28px] border border-[#B8D7CB] bg-[#DDEFE7] p-7 text-[#10231D] dark:border-[#355C4D] dark:bg-[#18362C] dark:text-white">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0B6B4F] text-white">
                  <Workflow className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="mt-7 text-sm font-semibold tracking-[0.1em] text-[#315D4D] dark:text-[#9ECBB9]">{copy.hero.automationLabel}</p>
                <h2 className="mt-3 text-2xl font-semibold leading-[1.3] tracking-[0.01em]">{copy.hero.automationTitle}</h2>
              </div>
              <p className="mt-7 text-base leading-[1.65] text-[#385047] dark:text-[#C0D3CB]">{copy.hero.automationDescription}</p>
            </article>

            <article className="flex min-h-[260px] flex-col justify-between rounded-[28px] border border-[#263548] bg-[#0E141B] p-7 text-white dark:border-[#344154]">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <Github className="h-10 w-10" aria-hidden="true" />
                  <span className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold tracking-[0.1em] text-[#B9C7D8]">{copy.hero.repositoryLabel}</span>
                </div>
                <h2 className="mt-7 text-2xl font-semibold tracking-[0.01em]">{copy.hero.repositoryTitle}</h2>
                <p className="mt-4 text-base leading-[1.65] text-[#B9C7D8]">{copy.hero.repositoryDescription}</p>
              </div>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                {copy.hero.repositoryCta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </article>
          </div>
        </section>

        <section id="preview" className="scroll-mt-24 border-y border-[#D9E0EA] bg-white py-20 dark:border-[#2A3645] dark:bg-[#0E141B] sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading eyebrow={copy.demo.eyebrow} title={copy.demo.title} description={copy.demo.description} />
            <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-6">
                <article className="relative min-h-[360px] overflow-hidden rounded-3xl border border-[#D9E0EA] bg-[#173D31] p-6 text-white shadow-sm sm:p-9 dark:border-[#3E544A]">
                  <div className="absolute inset-0" aria-hidden="true">
                    <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#7FC4A9]/35 blur-3xl" />
                    <div className="absolute -bottom-28 left-1/4 h-72 w-72 rounded-full bg-[#D3A96B]/25 blur-3xl" />
                    <div className="absolute right-10 top-14 grid h-40 w-48 rotate-3 grid-cols-3 gap-2 opacity-50 sm:h-52 sm:w-64">
                      {Array.from({ length: 9 }).map((_, index) => (
                        <span key={index} className="rounded-xl border border-white/35 bg-white/10" />
                      ))}
                    </div>
                  </div>
                  <div className="relative flex min-h-[300px] max-w-xl flex-col justify-between">
                    <div className="flex items-center justify-between gap-4">
                      <span className="rounded-full bg-[#D9ECE4] px-3 py-1.5 text-xs font-semibold tracking-[0.1em] text-[#123D30]">{copy.demo.editorPick.label}</span>
                      <span className="text-xs font-semibold tracking-[0.1em] text-[#C5D9D1]">{copy.demo.notice}</span>
                    </div>
                    <div className="[word-break:keep-all]">
                      <h3 className="text-[30px] font-semibold leading-[1.3] tracking-[0.01em] sm:text-[38px]">{copy.demo.editorPick.title}</h3>
                      <p className="mt-4 max-w-2xl text-base leading-[1.7] text-[#D9E6E1]">{copy.demo.editorPick.description}</p>
                      <p className="mt-5 text-sm font-medium text-[#B7CEC5]">{copy.demo.editorPick.meta}</p>
                    </div>
                  </div>
                </article>

                <div className="grid gap-4 md:grid-cols-3">
                  {copy.demo.cards.map((card, index) => {
                    const visual = feedVisuals[index]!;
                    const VisualIcon = visual.icon;
                    return (
                      <article key={card.title} className="overflow-hidden rounded-3xl border border-[#D9E0EA] bg-white shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]">
                        <div className={`flex h-36 items-center justify-center bg-gradient-to-br ${visual.className}`} aria-hidden="true">
                          <VisualIcon className={`h-12 w-12 ${visual.iconClassName}`} strokeWidth={1.5} />
                        </div>
                        <div className="p-5">
                          <span className="text-sm font-semibold text-[#0B6B4F] dark:text-[#8FD0B6]">{card.category}</span>
                          <h3 className="mt-2 text-lg font-semibold leading-[1.45] tracking-[0.01em] text-[#1B2430] dark:text-white">{card.title}</h3>
                          <p className="mt-3 text-base leading-[1.6] text-[#4B5563] dark:text-[#A9B4C2]">{card.description}</p>
                          <div className="mt-5 flex items-center gap-3 border-t border-[#E6EBF1] pt-4 dark:border-[#273342]">
                            <Image src={avatars[index]!} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
                            <div className="min-w-0 text-sm">
                              <p className="font-semibold text-[#1B2430] dark:text-white">{card.author}</p>
                              <p className="truncate text-[#657180] dark:text-[#92A0B1]">{card.meta}</p>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
                <div className="rounded-3xl border border-[#D9E0EA] bg-[#F7F9FC] p-6 dark:border-[#2A3645] dark:bg-[#131A22]">
                  <h3 className="text-lg font-semibold tracking-[0.01em] text-[#1B2430] dark:text-white">{copy.demo.sidebarTitle}</h3>
                  <ul className="mt-5 divide-y divide-[#D9E0EA] border-y border-[#D9E0EA] dark:divide-[#2A3645] dark:border-[#2A3645]">
                    {copy.demo.sidebarItems.map((item) => (
                      <li key={item} className="flex min-h-12 items-center gap-3 py-3 text-sm font-medium text-[#374151] dark:text-[#C5D0DD]">
                        <Check className="h-4 w-4 shrink-0 text-[#0B6B4F] dark:text-[#8FD0B6]" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-3xl bg-[#264653] p-6 text-white">
                  <Code2 className="h-8 w-8 text-[#B6DED0]" aria-hidden="true" />
                  <h3 className="mt-5 text-xl font-semibold tracking-[0.01em]">{copy.demo.toolsTitle}</h3>
                  <p className="mt-3 text-base leading-[1.65] text-[#D0E1DB]">{copy.demo.toolsDescription}</p>
                  <Link href="/docs/mcp" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                    MCP Docs
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section id="foundation" className="scroll-mt-24 bg-[#F4F6F8] py-20 dark:bg-[#101820] sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading eyebrow={copy.foundations.eyebrow} title={copy.foundations.title} description={copy.foundations.description} />
            <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-[#CBD5D1] bg-[#CBD5D1] md:grid-cols-2 lg:grid-cols-4 dark:border-[#31453C] dark:bg-[#31453C]">
              {copy.foundations.items.map((item, index) => {
                const Icon = foundationIcons[index]!;
                return (
                  <article key={item.title} className="min-h-64 bg-white p-6 sm:p-7 dark:bg-[#131A22]">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E2F0EA] text-[#0B6B4F] dark:bg-[#1D3C31] dark:text-[#9ED1BD]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="mt-8 text-sm font-semibold text-[#617066] dark:text-[#95A89F]">0{index + 1}</p>
                    <h3 className="mt-3 text-xl font-semibold tracking-[0.01em] text-[#1B2430] dark:text-white">{item.title}</h3>
                    <p className="mt-4 text-base leading-[1.65] text-[#4B5563] dark:text-[#A9B4C2]">{item.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="automation" className="scroll-mt-24 bg-[#0D2B22] py-20 text-white sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading eyebrow={copy.pipeline.eyebrow} title={copy.pipeline.title} description={copy.pipeline.description} light />
            <ol className="mt-12 grid gap-4 lg:grid-cols-5">
              {copy.pipeline.steps.map((step, index) => (
                <li key={step.code} className="relative rounded-3xl border border-[#48695C] bg-[#123D30] p-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold tracking-[0.12em] text-[#A9D4C3]">{step.code}</span>
                    {index < copy.pipeline.steps.length - 1 ? <ArrowRight className="hidden h-4 w-4 text-[#86B8A5] lg:block" aria-hidden="true" /> : null}
                  </div>
                  <h3 className="mt-8 break-words text-lg font-semibold leading-[1.4] tracking-[0.01em]">{step.title}</h3>
                  <p className="mt-3 text-sm leading-[1.7] text-[#C0D3CB]">{step.description}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 grid gap-5 rounded-3xl border border-[#547568] bg-[#E0EFE9] p-6 text-[#10231D] sm:p-8 lg:grid-cols-[auto_1fr] lg:items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0B6B4F] text-white">
                <FileText className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-[0.01em]">{copy.pipeline.destinationTitle}</h3>
                <p className="mt-2 text-base leading-[1.65] text-[#385047]">{copy.pipeline.destinationDescription}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="blog-design" className="scroll-mt-24 border-b border-[#D9E0EA] bg-white py-20 dark:border-[#2A3645] dark:bg-[#0E141B] sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading eyebrow={copy.branding.eyebrow} title={copy.branding.title} description={copy.branding.description} />
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {copy.branding.previews.map((preview, index) => {
                const theme = brandingThemes[index]!;
                return (
                  <article key={preview.title} className="overflow-hidden rounded-3xl border border-[#D9E0EA] bg-white shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]">
                    <div className={`relative min-h-52 p-6 ${theme.surface} ${theme.text}`}>
                      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
                        <div className={`absolute -right-10 -top-14 h-40 w-40 rounded-full opacity-40 ${theme.accent}`} />
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/30" />
                      </div>
                      <div className="relative">
                        <p className={`text-xs font-semibold tracking-[0.12em] ${theme.muted}`}>{preview.label}</p>
                        <div className="mt-14 flex items-center gap-4">
                          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${theme.accent} text-[#10231D] shadow-lg`}>
                            <span className="text-xl font-semibold">{preview.title.charAt(0)}</span>
                          </div>
                          <div>
                            <h3 className="text-2xl font-semibold tracking-[0.01em]">{preview.title}</h3>
                            <p className={`mt-1 text-sm ${theme.muted}`}>{preview.handle}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={`p-6 ${theme.panel} dark:bg-[#131A22]`}>
                      <p className="text-base leading-[1.65] text-[#4B5563] dark:text-[#A9B4C2]">{preview.description}</p>
                      <div className="mt-5 flex gap-2" aria-hidden="true">
                        <span className="h-2 w-20 rounded-full bg-[#C8D3CE] dark:bg-[#34404F]" />
                        <span className="h-2 w-12 rounded-full bg-[#D9E1DD] dark:bg-[#273342]" />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <ul className="mt-8 flex flex-wrap gap-3">
              {copy.branding.features.map((feature) => (
                <li key={feature} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#C9D4CF] bg-[#F7F9FC] px-4 text-sm font-medium text-[#374151] dark:border-[#344154] dark:bg-[#131A22] dark:text-[#C5D0DD]">
                  <Check className="h-4 w-4 text-[#0B6B4F] dark:text-[#8FD0B6]" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="community" className="scroll-mt-24 bg-[#F4F1E8] py-20 text-[#10231D] dark:bg-[#17201D] dark:text-white sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
            <div>
              <SectionHeading eyebrow={copy.community.eyebrow} title={copy.community.title} description={copy.community.description} />
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {copy.community.capabilities.map((item) => (
                  <li key={item} className="flex min-h-12 items-center gap-3 border-b border-[#B8C4BF] py-3 text-sm font-semibold dark:border-[#3A4D45]">
                    <BadgeCheck className="h-5 w-5 shrink-0 text-[#0B6B4F] dark:text-[#8FD0B6]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[28px] border border-[#8EA39A] bg-white p-5 shadow-[14px_14px_0_0_#123D30] sm:p-8 dark:border-[#4A6258] dark:bg-[#101714]">
              <div className="flex items-center justify-between gap-4 border-b border-[#CBD5D1] pb-5 dark:border-[#3A4D45]">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#DDEFE7] text-[#0B6B4F] dark:bg-[#1D3C31] dark:text-[#9ED1BD]">
                    <Users className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-[0.12em] text-[#315D4D] dark:text-[#9ECBB9]">{copy.community.discussionLabel}</p>
                    <p className="mt-1 text-sm text-[#5B6E66] dark:text-[#AFC0B8]">c/selfhost</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#E5EFEA] px-3 py-1.5 text-xs font-semibold text-[#315D4D] dark:bg-[#1D3C31] dark:text-[#9ECBB9]">LIVE</span>
              </div>
              <h3 className="mt-8 text-[28px] font-semibold leading-[1.35] tracking-[0.01em] sm:text-[34px]">{copy.community.discussionTitle}</h3>
              <p className="mt-5 text-base leading-[1.65] text-[#4A6157] dark:text-[#B6C5BE]">{copy.community.discussionMeta}</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3" aria-hidden="true">
                {[MessageSquare, ShieldCheck, Layers3].map((Icon, index) => (
                  <div key={index} className="flex h-20 items-center justify-center rounded-2xl border border-[#D5DED9] bg-[#F7F9F8] dark:border-[#30453C] dark:bg-[#17201D]">
                    <Icon className="h-6 w-6 text-[#315D4D] dark:text-[#9ECBB9]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="open-source" className="scroll-mt-24 bg-white py-20 dark:bg-[#0E141B] sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="rounded-[32px] bg-[#0E141B] p-6 text-white sm:p-10 lg:p-14 dark:border dark:border-[#2A3645]">
              <SectionHeading eyebrow={copy.openSource.eyebrow} title={copy.openSource.title} description={copy.openSource.description} light />
              <ul className="mt-10 flex flex-wrap gap-3">
                {copy.openSource.stack.map((item) => (
                  <li key={item} className="inline-flex min-h-10 items-center rounded-full border border-[#415064] bg-[#16212E] px-4 text-sm font-semibold text-[#D7E0EB]">{item}</li>
                ))}
              </ul>
              <div className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-[#344154] bg-[#344154] lg:grid-cols-3">
                {copy.openSource.points.map((point, index) => {
                  const icons = [Server, Paintbrush, Code2];
                  const Icon = icons[index]!;
                  return (
                    <article key={point.title} className="bg-[#111B27] p-6 sm:p-8">
                      <Icon className="h-7 w-7 text-[#9ED1BD]" aria-hidden="true" />
                      <h3 className="mt-8 text-xl font-semibold tracking-[0.01em]">{point.title}</h3>
                      <p className="mt-3 text-base leading-[1.65] text-[#AFC0D0]">{point.description}</p>
                    </article>
                  );
                })}
              </div>
              <div className="mt-8 rounded-2xl border border-[#5A4E33] bg-[#282319] p-5 text-sm leading-[1.65] text-[#EAD8AE]">{copy.openSource.notice}</div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-[#0E141B] hover:bg-[#E6EDF3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  <Github className="h-5 w-5" aria-hidden="true" />
                  {copy.openSource.githubCta}
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href="https://github.com/beyondeth/my-blog-app-selfhost/blob/main/docs/self-hosting.md"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#536276] px-6 text-base font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  {copy.openSource.docsCta}
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[#D9E0EA] bg-[#DDEFE7] py-20 text-[#10231D] dark:border-[#2A3645] dark:bg-[#18362C] dark:text-white sm:py-24">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-10 px-4 sm:px-6 lg:flex-row lg:items-end">
            <div className="max-w-4xl [word-break:keep-all]">
              <p className="text-sm font-semibold tracking-[0.12em] text-[#315D4D] dark:text-[#9ECBB9]">{copy.final.eyebrow}</p>
              <h2 className="mt-4 text-[34px] font-semibold leading-[1.2] tracking-[0.01em] sm:text-[46px] lg:text-[56px]">{copy.final.title}</h2>
              <p className="mt-5 max-w-3xl text-base leading-[1.7] text-[#385047] dark:text-[#C0D3CB] sm:text-lg">{copy.final.description}</p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row lg:flex-col">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0B6B4F] px-6 text-base font-semibold text-white hover:bg-[#07553F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0B6B4F]"
              >
                <Github className="h-5 w-5" aria-hidden="true" />
                {copy.final.githubCta}
              </a>
              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#80938B] px-6 text-base font-semibold hover:bg-white/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0B6B4F] dark:border-[#66847A] dark:hover:bg-white/10"
              >
                {copy.final.exploreCta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
