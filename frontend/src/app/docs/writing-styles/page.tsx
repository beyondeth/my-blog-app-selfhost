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
    'Codebase 자동포스팅에서 사용할 writing style 에 따라 글의 분위기와 내용이 달라집니다. 사용자의 상황에 따라 선택 가능합니다. 또한 원하는 스타일로 직접 커스터마이징해서 사용가능합니다.',
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
      description="Codebase 자동포스팅에서 사용할 writing style 에 따라 글의 분위기와 내용이 달라집니다. 사용자의 상황에 따라 선택 가능합니다. 또한 원하는 스타일로 직접 커스터마이징해서 사용가능합니다."
      toc={toc}
      eyebrow="Documentation"
    >
      {/* Presets */}
      <section id="presets">
        <h2>Presets</h2>
        <p>
          일반 글은 아래 8개 preset 중 하나를 선택합니다. 각 스타일을 클릭하면 상세 구조와
          예시를 확인할 수 있습니다.
        </p>
        <div className="mt-4 rounded-lg bg-[#f1f3f4] px-4 py-3 text-[14px] text-[#3c4043] dark:bg-[#303134] dark:text-[#e8eaed]">
          <strong>사용예시</strong> - <code>&quot;위 내용 자동포스팅해줘. --vibe&quot;</code>
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
          <li>일반 글은 preset 하나만 선택합니다. 두 개를 섞지 않습니다.</li>
          <li>
            실제 발행 제약과 입력 필드는{' '}
            <Link href="/docs/publishing-flow">Publishing Flow</Link>에서 확인합니다.
          </li>
          <li>
            태그, Markdown, 파라미터 공통 규칙은{' '}
            <Link href={`/docs/writing-styles/${commonRules.id}`}>Common Rules</Link>를 참고합니다.
          </li>
        </ol>
      </section>
    </DocsPageLayout>
  );
}
