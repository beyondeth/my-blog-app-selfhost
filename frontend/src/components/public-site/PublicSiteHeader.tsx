'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, X } from 'lucide-react';
import { useAuth } from '@/providers/AuthProviderV2';
import { ThemeSwitch } from '@/components/ui/ThemeSwitch';
import { PUBLIC_USE_CASES } from '@/lib/public-site';
import { usePublicDocsSidebarStore } from '@/stores/publicDocsSidebarStore';
import { PUBLIC_SITE_HEADER_HEIGHT_CLASS } from './layoutConstants';
import { useLocaleContext } from '@/providers/LocaleProvider';
import { FEATURES } from '@/lib/features';
import { stripLocalePrefix } from '@/lib/i18n/config';

type DropdownKey = 'useCases' | null;

function isActivePath(pathname: string, href: string) {
  const normalizedPathname = stripLocalePrefix(pathname);
  const [basePath] = href.split('#');
  if (basePath === '/product' || basePath === '/pricing' || basePath === '/docs') {
    return normalizedPathname === basePath;
  }
  return normalizedPathname.startsWith(basePath);
}

export default function PublicSiteHeader() {
  const pathname = usePathname();
  const normalizedPathname = stripLocalePrefix(pathname || '/');
  const { t, href } = useLocaleContext();
  const { user } = useAuth();
  const { toggleSidebar } = usePublicDocsSidebarStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isDocsDetailRoute = normalizedPathname.startsWith('/docs/');

  useEffect(() => {
    setMobileOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const primaryCtaHref = user ? '/' : href('/register');
  const primaryCtaLabel = user ? t('publicSite.header.openApp') : t('publicSite.header.getStarted');

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-white dark:bg-[#0E141B]">
      <div
        ref={wrapperRef}
        className={`max-w-full ml-0 flex w-full items-center justify-between px-2 xs:px-3 sm:px-4 md:px-4 lg:pl-[43px] lg:pr-32 ${PUBLIC_SITE_HEADER_HEIGHT_CLASS}`}
      >
        <div className="flex min-w-0 items-center space-x-4">
          {isDocsDetailRoute ? (
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden lg:flex items-center justify-center w-10 h-10 rounded-full border border-[#D9E0EA] bg-white text-[#1B2430] transition-colors hover:bg-[#F7F9FC] dark:border-[#2A3645] dark:bg-[#0E141B] dark:text-[#E6EDF3] dark:hover:bg-[#1A232E]"
              aria-label={t('publicSite.header.docsSidebar')}
            >
              <Image
                src="/assets/left-sidebar/menu.svg"
                alt="Menu"
                width={24}
                height={24}
                className="opacity-80 transition-transform duration-200 group-hover:scale-105 dark:invert"
              />
            </button>
          ) : (
            <div className="hidden lg:block w-10 h-10" aria-hidden="true" />
          )}

          <Link href={href('/product')} className="flex shrink-0 items-center space-x-2">
            <div className="flex min-h-[36px] min-w-[36px] items-center justify-center md:min-h-[48px] md:min-w-[48px]">
              <Image
                src="/assets/logo.svg"
                alt="Codebase logo"
                width={36}
                height={36}
                className="h-9 w-9 object-contain md:h-12 md:w-12"
                priority
              />
            </div>
            <span
              className="text-lg font-bold leading-tight text-[#101828] dark:text-white md:text-2xl"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              Codebase
            </span>
          </Link>

          <nav className="hidden items-center gap-1.5 md:flex">
            <Link
              href={href('/product#features')}
              className={`rounded-full px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
                isActivePath(pathname || '/', '/product#features')
                  ? 'bg-white/80 text-[#111827] shadow-[inset_0_0_0_1px_rgba(16,24,40,0.07)] dark:bg-white/10 dark:text-white dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                  : 'text-[#526477] hover:bg-white/70 hover:text-[#111827] dark:text-[#A9B8C8] dark:hover:bg-white/8 dark:hover:text-white'
              }`}
            >
              {t('publicSite.header.features')}
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => (prev === 'useCases' ? null : 'useCases'))}
                className="inline-flex items-center gap-1 rounded-full px-3.5 py-2.5 text-[13px] font-medium text-[#526477] transition-colors hover:bg-white/70 hover:text-[#111827] dark:text-[#A9B8C8] dark:hover:bg-white/8 dark:hover:text-white"
              >
                {t('publicSite.header.useCases')}
                <ChevronDown className={`h-4 w-4 transition-transform ${openDropdown === 'useCases' ? 'rotate-180' : ''}`} />
              </button>

              {openDropdown === 'useCases' ? (
                <div className="absolute left-0 top-[calc(100%+10px)] w-[320px] rounded-[24px] border border-[#dce5f2] bg-[rgba(255,255,255,0.96)] p-3 shadow-[0_28px_64px_-32px_rgba(16,24,40,0.28)] backdrop-blur dark:border-[#223244] dark:bg-[rgba(15,23,34,0.97)]">
                  {PUBLIC_USE_CASES.map((item) => (
                    <Link
                      key={item.href}
                      href={href(item.href)}
                      className="block rounded-2xl px-4 py-3 transition-colors hover:bg-[#F5F8FC] dark:hover:bg-[#162231]"
                    >
                      <div className="text-sm font-semibold text-[#101828] dark:text-white">{t(item.labelKey)}</div>
                      <div className="mt-1 text-sm leading-6 text-[#61758A] dark:text-[#9FB2C6]">
                        {item.descriptionKey ? t(item.descriptionKey) : ''}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            {FEATURES.SUBSCRIPTION ? (
              <Link
                href={href('/pricing')}
                className={`rounded-full px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
                  isActivePath(pathname || '/', '/pricing')
                    ? 'bg-white/80 text-[#111827] shadow-[inset_0_0_0_1px_rgba(16,24,40,0.07)] dark:bg-white/10 dark:text-white dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                    : 'text-[#526477] hover:bg-white/70 hover:text-[#111827] dark:text-[#A9B8C8] dark:hover:bg-white/8 dark:hover:text-white'
                }`}
              >
                {t('publicSite.header.pricing')}
              </Link>
            ) : null}
            <Link
              href={href('/c')}
              className={`rounded-full px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
                isActivePath(pathname || '/', '/c')
                  ? 'bg-white/80 text-[#111827] shadow-[inset_0_0_0_1px_rgba(16,24,40,0.07)] dark:bg-white/10 dark:text-white dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                  : 'text-[#526477] hover:bg-white/70 hover:text-[#111827] dark:text-[#A9B8C8] dark:hover:bg-white/8 dark:hover:text-white'
              }`}
            >
              {t('publicSite.header.community')}
            </Link>

            <Link
              href={href('/docs')}
              className={`rounded-full px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
                isActivePath(pathname || '/', '/docs')
                  ? 'bg-white/80 text-[#111827] shadow-[inset_0_0_0_1px_rgba(16,24,40,0.07)] dark:bg-white/10 dark:text-white dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                  : 'text-[#526477] hover:bg-white/70 hover:text-[#111827] dark:text-[#A9B8C8] dark:hover:bg-white/8 dark:hover:text-white'
              }`}
            >
              {t('publicSite.header.docs')}
            </Link>
          </nav>
        </div>

        <div className="hidden items-center space-x-4 md:flex">
          <ThemeSwitch />
          <Link
            href={primaryCtaHref}
            className="inline-flex items-center rounded-full bg-[#101828] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1F2937] dark:bg-white dark:text-[#101828] dark:hover:bg-[#E5E7EB]"
          >
            {primaryCtaLabel}
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeSwitch />
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D9E0EA] bg-white text-[#1B2430] transition-colors hover:bg-[#F7F9FC] dark:border-[#2A3645] dark:bg-[#0E141B] dark:text-[#E6EDF3] dark:hover:bg-[#1A232E]"
            aria-label={t('publicSite.header.mobileMenu')}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-[#E6ECF3] bg-white px-4 py-4 md:hidden dark:border-[#1E2B39] dark:bg-[#0E141B]">
          <div className="space-y-2">
            <Link href={href('/product#features')} className="block rounded-2xl px-4 py-3 text-sm font-semibold text-[#101828] hover:bg-[#F5F8FC] dark:text-white dark:hover:bg-[#162231]">
              {t('publicSite.header.features')}
            </Link>
            <div className="rounded-2xl border border-[#E6ECF3] p-3 dark:border-[#223244]">
              <div className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#6A7C90] dark:text-[#8FA5BA]">
                {t('publicSite.header.useCases')}
              </div>
              {PUBLIC_USE_CASES.map((item) => (
                <Link key={item.href} href={href(item.href)} className="block rounded-2xl px-3 py-2 text-sm text-[#101828] hover:bg-[#F5F8FC] dark:text-white dark:hover:bg-[#162231]">
                  {t(item.labelKey)}
                </Link>
              ))}
            </div>
            {FEATURES.SUBSCRIPTION ? (
              <Link href={href('/pricing')} className="block rounded-2xl px-4 py-3 text-sm font-semibold text-[#101828] hover:bg-[#F5F8FC] dark:text-white dark:hover:bg-[#162231]">
                {t('publicSite.header.pricing')}
              </Link>
            ) : null}
            <Link href={href('/c')} className="block rounded-2xl px-4 py-3 text-sm font-semibold text-[#101828] hover:bg-[#F5F8FC] dark:text-white dark:hover:bg-[#162231]">
              {t('publicSite.header.community')}
            </Link>
            <Link href={href('/docs')} className="block rounded-2xl px-4 py-3 text-sm font-semibold text-[#101828] hover:bg-[#F5F8FC] dark:text-white dark:hover:bg-[#162231]">
              {t('publicSite.header.docs')}
            </Link>
            <Link
              href={primaryCtaHref}
              className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-[#101828] px-5 py-3 text-sm font-semibold text-white dark:bg-white dark:text-[#101828]"
            >
              {primaryCtaLabel}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
