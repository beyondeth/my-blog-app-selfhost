import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AppGuideStep from '@/components/public-site/AppGuideStep';
import DocsPageLayout from '@/components/public-site/DocsPageLayout';
import {
  APP_CONNECTION_DOCS,
  APP_CONNECTION_DOCS_BY_SLUG,
  type AppConnectionDocSlug,
} from '@/lib/app-connection-docs';

type AppConnectionPageProps = {
  params: Promise<{
    app: string;
  }>;
};

function buildToc() {
  return [
    { id: 'before-you-start', label: 'Before you start' },
    { id: 'connection-steps', label: 'Connection steps' },
    { id: 'test-checklist', label: 'Test checklist' },
    { id: 'troubleshooting', label: 'Troubleshooting' },
    { id: 'official-sources', label: 'Official sources' },
  ];
}

export async function generateStaticParams() {
  return APP_CONNECTION_DOCS.map((doc) => ({
    app: doc.slug,
  }));
}

export async function generateMetadata({
  params,
}: AppConnectionPageProps): Promise<Metadata> {
  const { app } = await params;
  const doc = APP_CONNECTION_DOCS_BY_SLUG[app as AppConnectionDocSlug];

  if (!doc) {
    return {};
  }

  return {
    title: doc.title,
    description: doc.summary,
    alternates: {
      canonical: `/docs/apps/${doc.slug}`,
    },
  };
}

export default async function AppConnectionPage({
  params,
}: AppConnectionPageProps) {
  const { app } = await params;
  const doc = APP_CONNECTION_DOCS_BY_SLUG[app as AppConnectionDocSlug];

  if (!doc) {
    notFound();
  }

  const statusClassName =
    doc.status === 'manual-verify'
      ? 'border-[#F5D08A] bg-[#FFF8E8] text-[#8A5B00] dark:border-[#5E4720] dark:bg-[#261D0C] dark:text-[#F6D58A]'
      : 'border-[#CFE2FF] bg-[#EEF5FF] text-[#1A56B5] dark:border-[#24406A] dark:bg-[#101A2A] dark:text-[#93C5FD]';

  return (
    <DocsPageLayout
      currentPath={`/docs/apps/${doc.slug}`}
      title={doc.title}
      description={doc.summary}
      toc={buildToc()}
      eyebrow="Web & App Guide"
    >
      <div className="not-prose mb-10 rounded-[28px] border border-[#E6ECF3] bg-white p-5 dark:border-[#223244] dark:bg-[#0F1720]">
        <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClassName}`}>
          {doc.statusLabel}
        </div>
        <p className="mt-4 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
          {doc.statusDescription}
        </p>
        <p className="mt-4 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
          마지막 확인일: <strong className="text-[#101828] dark:text-white">{doc.lastVerified}</strong>
        </p>
        <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
          스크린샷은 대응하는 <code>frontend/public/docs/apps/{doc.slug}</code> 경로에 파일을
          넣으면 자동으로 교체됩니다.
        </p>
      </div>

      <section id="before-you-start">
        <h2>Before you start</h2>
        <ul className="mt-6 space-y-3">
          {doc.prerequisites.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section id="connection-steps">
        <h2>Connection steps</h2>
        <div className="not-prose mt-6 space-y-5">
          {doc.steps.map((step, index) => (
            <AppGuideStep
              key={step.imageSrc}
              step={index + 1}
              title={step.title}
              description={step.description}
              imageSrc={step.imageSrc}
              imageAlt={step.imageAlt}
              caption={step.caption}
              note={step.note}
            />
          ))}
        </div>
      </section>

      <section id="test-checklist">
        <h2>Test checklist</h2>
        <ul className="mt-6 space-y-3">
          {doc.testChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section id="troubleshooting">
        <h2>Troubleshooting</h2>
        <ul className="mt-6 space-y-3">
          {doc.troubleshooting.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-6">
          연결 상태나 권한을 다시 확인해야 하면 <Link href="/settings/connected-apps">연결된 앱</Link>{' '}
          페이지를 함께 확인하세요.
        </p>
      </section>

      <section id="official-sources">
        <h2>Official sources</h2>
        <div className="not-prose mt-6 space-y-3">
          {doc.sources.map((source) => (
            <a
              key={source.href}
              href={source.href}
              target="_blank"
              rel="noreferrer"
              className="block rounded-[24px] border border-[#E6ECF3] bg-[#FBFCFF] p-5 transition hover:border-[#C8D8F2] dark:border-[#223244] dark:bg-[#111D29] dark:hover:border-[#35537A]"
            >
              <p className="text-sm font-semibold text-[#101828] dark:text-white">{source.label}</p>
              <p className="mt-1 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
                {source.description}
              </p>
              <p className="mt-3 text-sm font-medium text-[#1A73E8] dark:text-[#8AB4F8]">
                {source.href}
              </p>
            </a>
          ))}
        </div>
      </section>
    </DocsPageLayout>
  );
}
