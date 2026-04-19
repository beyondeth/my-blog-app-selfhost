'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DOCS_NAVIGATION } from '@/lib/public-site';
import { usePublicDocsSidebarStore } from '@/stores/publicDocsSidebarStore';
import { useLocaleContext } from '@/providers/LocaleProvider';
import { stripLocalePrefix } from '@/lib/i18n/config';

type DocsTocItem = {
  id: string;
  label: string;
};

interface DocsPageLayoutProps {
  currentPath: string;
  title: string;
  description: string;
  toc?: DocsTocItem[];
  children: React.ReactNode;
  eyebrow?: string;
}

function matchesPath(currentPath: string, href: string) {
  if (href === '/docs') {
    return currentPath === href;
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export default function DocsPageLayout({
  currentPath,
  title,
  description,
  toc = [],
  children,
  eyebrow = 'Documentation',
}: DocsPageLayoutProps) {
  const { isOpen: isSidebarOpen } = usePublicDocsSidebarStore();
  const pathname = usePathname();
  const { href } = useLocaleContext();
  const normalizedCurrentPath = stripLocalePrefix(pathname || currentPath);

  return (
    <div
      className="bg-white dark:bg-[#202124] text-[#202124] dark:text-[#e8eaed] min-h-screen selection:bg-[#e8f0fe] selection:text-[#1a73e8]"
      style={{ fontFamily: 'var(--font-docs)' }}
    >
      <div className="mx-auto flex w-full max-w-[1500px] flex-col lg:flex-row px-4 sm:px-6 lg:px-8 items-start">
        <aside
          className={`hidden lg:block shrink-0 sticky top-0 max-h-screen overflow-y-auto border-r border-[#f1f3f4] py-12 transition-[width,padding,opacity] duration-200 dark:border-[#303134] ${
            isSidebarOpen ? 'w-[260px] pr-6 opacity-100' : 'w-0 pr-0 opacity-0 border-r-0'
          }`}
          aria-hidden={!isSidebarOpen}
        >
          <div className={`space-y-8 ${isSidebarOpen ? 'block' : 'hidden'}`}>
            {DOCS_NAVIGATION.map((section) => (
              <div key={section.title}>
                <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#5f6368] dark:text-[#9aa0a6]">
                  {section.title}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const active = matchesPath(normalizedCurrentPath, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={href(item.href)}
                        className={`block rounded-full px-4 py-2.5 text-[14px] font-medium transition-colors ${
                          active
                            ? 'bg-[#e8f0fe] text-[#1a73e8] dark:bg-[#8ab4f8]/10 dark:text-[#8ab4f8]'
                            : 'text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124] dark:text-[#9aa0a6] dark:hover:bg-[#303134] dark:hover:text-white'
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0 py-12 lg:px-12 xl:px-20 mx-auto w-full max-w-4xl">
          <div className="mb-12">
            <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#1a73e8] dark:text-[#8ab4f8]">
              {eyebrow}
            </div>
            <h1 className="text-[1.7rem] sm:text-[1.95rem] font-medium tracking-[-0.02em] text-[#202124] dark:text-white leading-[1.18]">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-[15px] sm:text-[16px] leading-7 text-[#5f6368] dark:text-[#9aa0a6]">
              {description}
            </p>
          </div>

          <div className="docs-prose prose prose-zinc max-w-none dark:prose-invert 
            prose-headings:scroll-mt-32 prose-headings:font-medium prose-headings:tracking-[-0.02em]
            prose-h2:mt-12 prose-h2:text-[1.3rem] prose-h2:leading-[1.3]
            prose-h3:mt-8 prose-h3:text-[1.08rem] prose-h3:leading-[1.35]
            prose-h4:mt-6 prose-h4:text-[1rem] prose-h4:leading-[1.4]
            prose-p:leading-[1.8] prose-p:text-[16px] prose-p:text-[#3c4043] dark:prose-p:text-[#cbd0d8]
            prose-li:leading-[1.8] prose-li:text-[16px]
            prose-a:text-[#1a73e8] dark:prose-a:text-[#8ab4f8] prose-a:no-underline hover:prose-a:underline
            prose-code:rounded prose-code:bg-[#f1f3f4] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] dark:prose-code:bg-[#303134] prose-code:text-[#d93025] dark:prose-code:text-[#f28b82]
            prose-pre:bg-[#f8f9fa] dark:prose-pre:bg-[#202124] prose-pre:border prose-pre:border-[#e8eaed] dark:prose-pre:border-[#3c4043]"
          >
            {children}
          </div>
        </main>

        <aside className="hidden xl:block w-[240px] shrink-0 py-12 pl-8 sticky top-0 max-h-screen overflow-y-auto border-l border-[#f1f3f4] dark:border-[#303134]">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#5f6368] dark:text-[#9aa0a6] mb-6">
            On this page
          </div>
          {toc.length > 0 ? (
            <div className="flex flex-col gap-2 border-l-2 border-[#e8eaed] dark:border-[#3c4043] py-1">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block px-4 py-1 text-[13px] font-medium text-[#5f6368] transition-colors hover:text-[#202124] hover:border-l-2 -ml-[2px] border-transparent hover:border-[#1a73e8] dark:text-[#9aa0a6] dark:hover:text-white dark:hover:border-[#8ab4f8]"
                >
                  {item.label}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-[13px] leading-relaxed text-[#5f6368] dark:text-[#9aa0a6]">
              This page does not have a table of contents. Use the left menu to move to another page.
            </p>
          )}

          <div className="mt-12 pt-8 border-t border-[#f1f3f4] dark:border-[#303134]">
             <div className="text-[11px] font-bold uppercase tracking-widest text-[#5f6368] dark:text-[#9aa0a6] mb-4">
                Need help?
             </div>
             <p className="text-[13px] leading-relaxed text-[#5f6368] dark:text-[#9aa0a6] mb-4">
               Use the official support channel if the docs do not solve your issue.
             </p>
             <Link href={href('/support')} className="text-[13px] font-bold text-[#1a73e8] dark:text-[#8ab4f8] hover:underline flex items-center gap-1">
                Open support &rarr;
             </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
