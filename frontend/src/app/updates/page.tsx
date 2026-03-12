import type { Metadata } from 'next';
import { PRODUCT_UPDATES, type ProductUpdateEntry, type ProductUpdateType } from '@/lib/productUpdates';

export const metadata: Metadata = {
  title: '업데이트',
  description: 'Codebase의 사용자 대상 주요 업데이트를 버전별로 정리한 changelog 페이지입니다.',
  alternates: {
    canonical: '/updates',
  },
};

const TYPE_STYLES: Record<ProductUpdateType, string> = {
  New: 'bg-[#E9F7EF] text-[#177245] dark:bg-[#0F2A1E] dark:text-[#8FE0B5]',
  Improved: 'bg-[#EEF4FF] text-[#3157C9] dark:bg-[#15233C] dark:text-[#AFC7FF]',
  Fix: 'bg-[#FFF3E8] text-[#B95718] dark:bg-[#33200F] dark:text-[#F0BA8B]',
  Update: 'bg-[#F4F6F8] text-[#516173] dark:bg-[#1B2632] dark:text-[#B6C2CF]',
};

const updatesByMonth = PRODUCT_UPDATES.reduce<Record<string, ProductUpdateEntry[]>>((acc, update) => {
  acc[update.monthLabel] = acc[update.monthLabel] ?? [];
  acc[update.monthLabel].push(update);
  return acc;
}, {});

const monthSections = Object.entries(updatesByMonth);

export default function UpdatesPage() {
  return (
    <main className="min-h-screen bg-white text-[#101828] dark:bg-[#0E141B] dark:text-[#F3F6FB]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-10 px-4 pb-20 pt-24 sm:px-6 lg:px-8">
        <section className="border-b border-[#E7EDF5] pb-8 dark:border-[#223243]">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm font-medium text-[#61758A] dark:text-[#95A8BC]">
              Product updates
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-[#101828] dark:text-white">
              Changelog
            </h1>
          </div>
        </section>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
          <section className="space-y-12">
            {monthSections.map(([monthLabel, entries]) => (
              <section key={monthLabel} className="space-y-8">
                <h2 className="text-2xl font-semibold text-[#101828] dark:text-white">
                  {monthLabel}
                </h2>

                <div className="space-y-5">
                  {entries.map((entry) => (
                    <article
                      key={entry.id}
                      id={entry.id}
                      className="grid gap-4 border-t border-[#E7EDF5] pt-5 dark:border-[#223243] md:grid-cols-[88px_minmax(0,1fr)]"
                    >
                      <div className="pt-1">
                        <span className="inline-flex rounded-full border border-[#DEE6EE] bg-[#F7F9FC] px-3 py-1 text-xs font-medium text-[#5E7287] dark:border-[#283A4D] dark:bg-[#141E29] dark:text-[#9FB2C6]">
                          {entry.date}
                        </span>
                      </div>

                      <div className="space-y-5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TYPE_STYLES[entry.type]}`}>
                            {entry.type}
                          </span>
                          {entry.areas.map((area) => (
                            <span
                              key={area}
                              className="rounded-full bg-[#F4F6F8] px-2.5 py-1 text-xs font-medium text-[#5B6B7F] dark:bg-[#16202C] dark:text-[#A4B6C8]"
                            >
                              {area}
                            </span>
                          ))}
                          <span className="rounded-full bg-[#101828] px-2.5 py-1 text-xs font-semibold text-white dark:bg-[#6CC3B2] dark:text-[#10202A]">
                            {entry.version}
                          </span>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-xl font-semibold text-[#101828] dark:text-white">
                            {entry.title}
                          </h3>
                          <p className="text-base leading-8 text-[#4E6073] dark:text-[#C0CDDA]">
                            {entry.description}
                          </p>
                        </div>

                        {entry.details && entry.details.length > 0 ? (
                          <ul className="space-y-2.5 text-base leading-7 text-[#44576A] dark:text-[#BFD0DF]">
                            {entry.details.map((detail) => (
                              <li key={detail} className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#5A6FF0] dark:bg-[#6CC3B2]" />
                                <span>{detail}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </section>

          <aside className="h-fit lg:sticky lg:top-24">
            <div className="rounded-3xl border border-[#E7EDF5] bg-[#FBFCFE] p-5 dark:border-[#223243] dark:bg-[#111923]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#65788D] dark:text-[#8FA5BA]">
                Archive
              </p>
              <div className="mt-4 space-y-2">
                {monthSections.map(([monthLabel, entries]) => (
                  <a
                    key={monthLabel}
                    href={`#${entries[0]?.id}`}
                    className="block rounded-2xl border border-[#E7EDF5] px-4 py-3 text-sm text-[#44576A] transition-colors hover:bg-white dark:border-[#253446] dark:text-[#C0CDDA] dark:hover:bg-[#16202C]"
                  >
                    <div className="font-semibold text-[#101828] dark:text-white">
                      {monthLabel}
                    </div>
                    <div className="mt-1 text-xs text-[#6A7C90] dark:text-[#90A5BA]">
                      {entries.length} updates
                    </div>
                  </a>
                ))}
              </div>
              <p className="mt-5 text-xs leading-6 text-[#6A7C90] dark:text-[#8FA5BA]">
                이 페이지는 2026년 3월부터 시작합니다. 앞으로 사용자에게 직접 영향을 주는 변경만 누적합니다.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
