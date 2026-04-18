'use client';

import Link from 'next/link';
import { PRODUCT_UPDATES, type ProductUpdateEntry, type ProductUpdateType } from '@/lib/productUpdates';
import { ArrowRight, Sparkles } from 'lucide-react';

const TYPE_STYLES: Record<ProductUpdateType, string> = {
  New: 'border-[#188038] text-[#188038] bg-[#e6f4ea] dark:border-[#81c995] dark:text-[#81c995] dark:bg-[#1e8e3e]/20',
  Improved: 'border-[#1a73e8] text-[#1a73e8] bg-[#e8f0fe] dark:border-[#8ab4f8] dark:text-[#8ab4f8] dark:bg-[#1a73e8]/20',
  Fix: 'border-[#d93025] text-[#d93025] bg-[#fce8e6] dark:border-[#f28b82] dark:text-[#f28b82] dark:bg-[#d93025]/20',
  Update: 'border-[#5f6368] text-[#5f6368] bg-[#f1f3f4] dark:border-[#9aa0a6] dark:text-[#9aa0a6] dark:bg-[#5f6368]/20',
};

const updatesByMonth = PRODUCT_UPDATES.reduce<Record<string, ProductUpdateEntry[]>>((acc, update) => {
  acc[update.monthLabel] = acc[update.monthLabel] ?? [];
  acc[update.monthLabel].push(update);
  return acc;
}, {});

const monthSections = Object.entries(updatesByMonth);

export default function UpdatesPage() {
  return (
    <main
      className="bg-white text-[#202124] selection:bg-[#e8f0fe] selection:text-[#1a73e8] dark:bg-[#202124] dark:text-[#e8eaed]"
      style={{ fontFamily: 'var(--font-docs)' }}
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col px-6 sm:px-12 lg:px-16">
        
        <section className="py-24 lg:py-32 border-b border-[#f1f3f4] dark:border-[#303134]">
          <div className="max-w-[900px]">
             <div className="inline-flex items-center gap-2 rounded-full bg-[#f1f3f4] px-4 py-2 text-sm font-medium text-[#5f6368] dark:bg-[#303134] dark:text-[#9aa0a6]">
               <Sparkles className="h-4 w-4" />
               Changelog
             </div>
             
             <h1 className="mt-8 text-[1.7rem] font-medium leading-[1.2] tracking-[-0.02em] text-[#202124] dark:text-white sm:text-[1.95rem]">
               What&apos;s new
             </h1>
             
             <p className="mt-6 max-w-3xl text-[16px] leading-[1.8] text-[#5f6368] dark:text-[#9aa0a6]">
               제품의 새로운 기능과 개선, 버그 수정 내역을 한곳에서 모아봅니다. 모든 업데이트는 사용자가 체감하는 가치를 기준으로 작성됩니다.
             </p>
          </div>
        </section>

        <section className="grid gap-16 py-20 lg:py-32 xl:grid-cols-[250px_minmax(0,1fr)_300px]">
          {/* Left Archive Menu */}
          <aside className="hidden xl:block">
            <div className="sticky top-32 space-y-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#5f6368] dark:text-[#9aa0a6]">
                Archive
              </p>
              <div className="flex flex-col gap-2">
                {monthSections.map(([monthLabel]) => (
                  <a
                    key={monthLabel}
                    href={`#month-${monthLabel}`}
                    className="group flex items-center justify-between rounded-full px-4 py-2 hover:bg-[#f1f3f4] dark:hover:bg-[#303134]"
                  >
                    <span className="text-base font-medium text-[#202124] dark:text-white">
                      {monthLabel}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </aside>

          {/* Center Feed */}
          <div className="space-y-32">
            {monthSections.map(([monthLabel, entries]) => (
              <section key={monthLabel} id={`month-${monthLabel}`} className="scroll-mt-32">
                <h2 className="mb-12 text-[1.3rem] font-medium leading-[1.3] tracking-[-0.02em] text-[#202124] dark:text-white">
                  {monthLabel}
                </h2>

                <div className="space-y-12 lg:space-y-16">
                  {entries.map((entry) => (
                    <article
                      key={entry.id}
                      id={entry.id}
                      className="relative space-y-10 overflow-hidden rounded-[28px] border border-[#e8eaed] bg-white p-8 shadow-[0_1px_2px_rgba(32,33,36,0.06)] lg:p-10 dark:border-[#3c4043] dark:bg-[#202124] dark:shadow-none"
                    >
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#1a73e8]/35 to-transparent dark:via-[#8ab4f8]/30" />

                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[12px] font-medium text-[#5f6368] dark:text-[#9aa0a6]">
                          {entry.date}
                        </span>
                        <span className="text-[#dadce0] dark:text-[#5f6368]">|</span>
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${TYPE_STYLES[entry.type]}`}>
                          {entry.type}
                        </span>
                        {entry.areas.map((area) => (
                          <span
                            key={area}
                            className="rounded-full border border-[#e8eaed] bg-[#f8f9fa] px-3 py-1 text-[11px] font-medium text-[#5f6368] dark:border-[#3c4043] dark:bg-[#303134] dark:text-[#9aa0a6]"
                          >
                            {area}
                          </span>
                        ))}
                      </div>

                      <div className="space-y-5">
                        <h3 className="text-[1.3rem] font-medium leading-[1.3] tracking-[-0.02em] text-[#202124] dark:text-white">
                          {entry.title}
                        </h3>
                        <p className="text-[16px] leading-[1.8] text-[#5f6368] dark:text-[#9aa0a6]">
                          {entry.description}
                        </p>
                      </div>

                      {entry.details && entry.details.length > 0 && (
                        <div className="rounded-[22px] border border-[#eef0f1] bg-[#fbfcfd] p-7 dark:border-[#303134] dark:bg-[#262a2d]">
                          <ul className="space-y-4">
                            {entry.details.map((detail) => (
                              <li key={detail} className="flex items-start gap-4 text-[16px] leading-[1.8] text-[#202124] dark:text-[#e8eaed]">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1a73e8] dark:bg-[#8ab4f8]" />
                                {detail}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Right Reference Box */}
          <aside className="hidden xl:block">
            <div className="sticky top-32 space-y-6">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#1a73e8] dark:text-[#8ab4f8]">
                  Related
                </p>
                <div className="mt-4 border-t border-[#e8eaed] dark:border-[#303134]">
                  <Link
                    href="/docs/get-started"
                    className="group flex items-center justify-between border-b border-[#e8eaed] py-4 text-left transition-colors hover:text-[#1a73e8] dark:border-[#303134] dark:hover:text-[#8ab4f8]"
                  >
                    <div>
                      <span className="block text-[16px] font-medium text-[#202124] dark:text-white">Docs</span>
                      <span className="mt-1 block text-[13px] leading-6 text-[#5f6368] dark:text-[#9aa0a6]">
                        연결 방식과 설정 흐름을 먼저 확인합니다.
                      </span>
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 text-[#5f6368] transition-transform group-hover:translate-x-1 dark:text-[#9aa0a6]" />
                  </Link>
                  <Link
                    href="/support"
                    className="group flex items-center justify-between border-b border-[#e8eaed] py-4 text-left transition-colors hover:text-[#1a73e8] last:border-b-0 dark:border-[#303134] dark:hover:text-[#8ab4f8]"
                  >
                    <div>
                      <span className="block text-[16px] font-medium text-[#202124] dark:text-white">Support</span>
                      <span className="mt-1 block text-[13px] leading-6 text-[#5f6368] dark:text-[#9aa0a6]">
                        설정 이후 막히는 문제를 바로 해결합니다.
                      </span>
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 text-[#5f6368] transition-transform group-hover:translate-x-1 dark:text-[#9aa0a6]" />
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
