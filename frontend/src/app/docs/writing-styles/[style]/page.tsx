import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DocsPageLayout from '@/components/public-site/DocsPageLayout';
import DocsMarkdown from '@/components/public-site/DocsMarkdown';
import { extractMarkdownToc } from '@/lib/docs-utils';
import { WRITING_STYLE_DOCS, WRITING_STYLE_DOCS_BY_ID } from '@/lib/writing-style-docs';

type WritingStylePageProps = {
  params: Promise<{
    style: string;
  }>;
};

async function loadStyleDocument(style: string) {
  const filePath = path.join(process.cwd(), 'public', 'docs', 'writing-styles', `${style}.md`);
  const raw = await fs.readFile(filePath, 'utf8');
  return matter(raw);
}

export async function generateStaticParams() {
  return WRITING_STYLE_DOCS.map((style) => ({
    style: style.id,
  }));
}

export async function generateMetadata({ params }: WritingStylePageProps): Promise<Metadata> {
  const { style } = await params;
  const styleDoc = WRITING_STYLE_DOCS_BY_ID[style];

  if (!styleDoc) {
    return {};
  }

  const titleSuffix =
    styleDoc.kind === 'reference'
      ? 'Reference'
      : styleDoc.kind === 'special'
        ? 'Mode'
        : 'Writing Style';

  return {
    title: `${styleDoc.name} ${titleSuffix}`,
    description: styleDoc.summary,
    alternates: {
      canonical: `/docs/writing-styles/${style}`,
    },
  };
}

export default async function WritingStyleDetailPage({ params }: WritingStylePageProps) {
  const { style } = await params;
  const styleDoc = WRITING_STYLE_DOCS_BY_ID[style];

  if (!styleDoc) {
    notFound();
  }

  let styleFile: Awaited<ReturnType<typeof loadStyleDocument>>;
  try {
    styleFile = await loadStyleDocument(style);
  } catch {
    notFound();
  }

  const toc = extractMarkdownToc(styleFile.content);
  const styleName = typeof styleFile.data.style_name === 'string'
    ? styleFile.data.style_name
    : styleDoc.name;
  const pageTitle =
    styleDoc.kind === 'reference'
      ? styleDoc.name
      : styleDoc.kind === 'special'
        ? `${styleDoc.name}`
        : `${styleDoc.name} style`;

  return (
    <DocsPageLayout
      currentPath={`/docs/writing-styles/${style}`}
      title={pageTitle}
      description={styleDoc.summary}
      eyebrow="Writing Styles"
      toc={toc}
    >
      <div className="not-prose mb-10 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-[#E6ECF3] bg-[#FBFCFF] p-5 dark:border-[#223244] dark:bg-[#111D29]">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6A7C90] dark:text-[#8FA5BA]">
            Flag
          </div>
          <div className="mt-3 text-base font-semibold text-[#101828] dark:text-white">
            {styleDoc.flag}
          </div>
        </div>
        <div className="rounded-3xl border border-[#E6ECF3] bg-[#FBFCFF] p-5 dark:border-[#223244] dark:bg-[#111D29]">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6A7C90] dark:text-[#8FA5BA]">
            Style name
          </div>
          <div className="mt-3 text-base font-semibold text-[#101828] dark:text-white">
            {styleName}
          </div>
        </div>
        <div className="rounded-3xl border border-[#E6ECF3] bg-[#FBFCFF] p-5 dark:border-[#223244] dark:bg-[#111D29]">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6A7C90] dark:text-[#8FA5BA]">
            Best for
          </div>
          <div className="mt-3 text-base font-semibold text-[#101828] dark:text-white">
            {styleDoc.bestFor}
          </div>
        </div>
      </div>

      <DocsMarkdown content={styleFile.content} />
    </DocsPageLayout>
  );
}
