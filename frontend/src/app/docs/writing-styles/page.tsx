import type { Metadata } from 'next';
import Link from 'next/link';
import DocsPageLayout from '@/components/public-site/DocsPageLayout';
import {
  type WritingStyleDoc,
  WRITING_STYLE_PRESET_DOCS,
  WRITING_STYLE_REFERENCE_DOCS,
  WRITING_STYLE_SPECIAL_MODE_DOCS,
} from '@/lib/writing-style-docs';

export const metadata: Metadata = {
  title: 'Writing Styles',
  description:
    'Choose the writing style that matches the type of post you want to publish in Codebase, or customize one for your own workflow.',
  alternates: {
    canonical: '/docs/writing-styles',
  },
};

const toc = [
  { id: 'presets', label: 'Presets' },
  { id: 'rules', label: 'Usage rules' },
];

function StyleCard({ style }: { style: WritingStyleDoc }) {
  return (
    <div className="border-b border-[#e8eaed] py-5 last:border-0 dark:border-[#303134]">
      <Link
        href={`/docs/writing-styles/${style.id}`}
        className="inline-flex items-center rounded-full bg-[#f1f3f4] px-4 py-1.5 text-[14px] font-semibold text-[#202124] transition-colors hover:bg-[#e8eaed] dark:bg-[#303134] dark:text-[#e8eaed] dark:hover:bg-[#3c4043]"
      >
        --{style.name}
      </Link>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#5f6368] dark:text-[#9aa0a6]">
        {style.summary}
      </p>
    </div>
  );
}

export default function WritingStylesPage() {
  const sellMode = WRITING_STYLE_SPECIAL_MODE_DOCS[0];
  const commonRules = WRITING_STYLE_REFERENCE_DOCS[0];

  return (
    <DocsPageLayout
      currentPath="/docs/writing-styles"
      title="Writing Styles"
      description="Pick the writing style that fits your post. Each preset changes tone, structure, and emphasis, and you can still adapt the final output to your own workflow."
      toc={toc}
      eyebrow="Documentation"
    >
      {/* Presets */}
      <section id="presets">
        <h2>Presets</h2>
        <p>
          Standard posts should use one of the eight presets below. Click a style to review its structure, tone, and example guidance.
        </p>
        <div className="mt-4 rounded-lg bg-[#f1f3f4] px-4 py-3 text-[14px] text-[#3c4043] dark:bg-[#303134] dark:text-[#e8eaed]">
          <strong>Example</strong> - <code>&quot;Turn this into a post --vibe&quot;</code>
        </div>

        <div className="not-prose mt-6 mb-12 border-t border-[#e8eaed] dark:border-[#303134]">
          {WRITING_STYLE_PRESET_DOCS.map((style) => (
            <StyleCard key={style.id} style={style} />
          ))}
          <StyleCard key={sellMode.id} style={sellMode} />
        </div>
      </section>

      {/* Usage rules */}
      <section id="rules">
        <h2>Usage rules</h2>
        <ol>
          <li>Use one preset for a standard post. Do not mix two presets in the same request.</li>
          <li>
            Review the request fields and publishing constraints in{' '}
            <Link href="/docs/publishing-flow">Publishing Flow</Link>.
          </li>
          <li>
            Use{' '}
            <Link href={`/docs/writing-styles/${commonRules.id}`}>Common Rules</Link> for shared guidance on tags, Markdown, and parameters.
          </li>
        </ol>
      </section>
    </DocsPageLayout>
  );
}
