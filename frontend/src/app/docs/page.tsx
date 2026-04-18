import type { Metadata } from 'next';
import Link from 'next/link';
import DocsPageLayout from '@/components/public-site/DocsPageLayout';

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'Codebase 자동포스팅 연결 방식과 실제 발행 흐름을 현재 구현 기준으로 안내합니다.',
  alternates: {
    canonical: '/docs',
  },
};

const toc = [
  { id: 'overview', label: 'Overview' },
  { id: 'setup-model', label: 'Current setup model' },
  { id: 'environment-guides', label: 'Environment guides' },
  { id: 'what-you-can-do', label: 'What you can do' },
];

export default function DocsHomePage() {
  return (
    <DocsPageLayout
      currentPath="/docs"
      title="Codebase Docs"
      description="현재 제품이 실제로 작동하는 방식에 맞춘 사용자 가이드입니다. 설정 화면과 서버 계약을 기준으로, 연결부터 발행까지의 흐름을 한 번에 확인할 수 있습니다."
      toc={toc}
    >
      <section id="overview">
        <h2>Overview</h2>
        <p>
          이 문서는 <strong>현재 구현 기준</strong>으로 Codebase 자동포스팅을 설명합니다.
          가장 중요한 기준선은 <Link href="/settings/api-keys">설정 &gt; 자동포스팅 연결</Link>
          페이지이며, 여기에 노출되는 설정 방식과 서버 계약을 바탕으로 문서를 맞춥니다.
        </p>
      </section>

      <section id="setup-model">
        <h2>Current setup model</h2>
        <p>
          현재 public guide에서 지원하는 기본 연결 방식은 로컬 프록시가 아니라
          <strong> Codebase의 hosted MCP endpoint</strong>를 각 클라이언트에 등록하는
          구조입니다. 사용자별 API key를 발급한 뒤, 사용하는 클라이언트에 맞는 방식으로
          연결합니다.
        </p>
        <ol className="mt-6 space-y-3">
          <li>1. 설정 화면에서 API key를 발급합니다. 현재 active key는 최대 3개까지 유지할 수 있습니다.</li>
          <li>2. 사용하는 클라이언트에 <code>https://mcp.codebase.blog/mcp</code>를 등록합니다.</li>
          <li>3. 발행 요청 시 일반 문서는 preset flag를, 상품 등록은 <code>--sell</code>을 사용합니다.</li>
        </ol>
      </section>

      <section id="environment-guides">
        <h2>Environment guides</h2>
        <p>
          연결 가이드는 사용 환경 기준으로 나눕니다. ChatGPT, Claude, Perplexity 같은 웹/앱
          환경은 <Link href="/docs/apps">Web &amp; App Connections</Link>에서 안내하고,
          CLI/IDE용 MCP 스니펫과 정책은 기존 문서와 설정 화면을 기준으로 유지합니다.
        </p>
      </section>

      <section id="what-you-can-do">
        <h2>What you can do</h2>
        <p>
          현재 연결 방식으로는 단순 포스팅만이 아니라, 발행된 글과 개인 knowledge surface를
          함께 다룰 수 있습니다.
        </p>
        <ul className="mt-6 space-y-3">
          <li>발행: 제목, 카테고리, 태그, Markdown 본문을 기준으로 글을 발행합니다.</li>
          <li>공개 상태: 블로그가 private면 글에 public을 요청해도 실제 공개 상태는 private로 유지됩니다.</li>
          <li>조회: 발행된 글 목록과 상세를 읽고, knowledge manifest, node search, follow-up suggestion도 조회할 수 있습니다.</li>
        </ul>
      </section>
    </DocsPageLayout>
  );
}
