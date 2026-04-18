import type { Metadata } from 'next';
import Link from 'next/link';
import DocsPageLayout from '@/components/public-site/DocsPageLayout';

export const metadata: Metadata = {
  title: 'Publishing Flow',
  description: '현재 Codebase 자동포스팅이 어떤 입력과 제약으로 발행되는지 사용자 관점에서 설명합니다.',
  alternates: {
    canonical: '/docs/publishing-flow',
  },
};

const toc = [
  { id: 'capture', label: '1. Prepare context' },
  { id: 'compile', label: '2. Choose a style' },
  { id: 'publish', label: '3. Publish request' },
  { id: 'checklist', label: 'Pre-flight checklist' },
];

export default function PublishingFlowPage() {
  return (
    <DocsPageLayout
      currentPath="/docs/publishing-flow"
      title="Publishing Flow"
      description="자동포스팅은 준비한 맥락을 클라이언트에 전달하고, style guide를 선택한 뒤, MCP create_post 요청으로 발행하는 흐름입니다. 이 문서는 현재 사용자 가이드 기준의 실제 동작만 남겨 설명합니다."
      toc={toc}
      eyebrow="Documentation"
    >
      <section id="capture">
        <h2>1. Prepare context</h2>
        <p>
          첫 단계는 발행하고 싶은 내용을 클라이언트 대화 안으로 가져오는 것입니다. hosted MCP 연결 기준으로는
          별도의 로컬 감시 파이프라인을 켜는 것이 아니라, 사용자가 정리하고 싶은 맥락을 대화에 직접 넘겨주는 방식으로 시작합니다.
        </p>
        <ul className="mt-6 space-y-3">
          <li>code diff와 리뷰 메모</li>
          <li>meeting 또는 chat summary</li>
          <li>tech note와 work log</li>
        </ul>
      </section>

      <section id="compile">
        <h2>2. Choose a style</h2>
        <p>
          일반 글은 8개의 기본 preset 중 하나를 flag로 선택합니다. 선택한 flag에 따라
          writing guide가 바뀌고, 클라이언트는 그 guide에 맞는 Markdown을 작성합니다.
        </p>
        <p className="mt-6">
          preset 목록은 <Link href="/docs/writing-styles">Writing Styles</Link>에서 확인할 수 있습니다.
        </p>
        <p className="mt-6">
          디지털 상품을 마켓플레이스에 등록할 때는 일반 preset 대신 <code>--sell</code>을
          명시적으로 사용해야 합니다. 이 경우 가격과 상품 카테고리가 추가로 필요합니다.
        </p>
      </section>

      <section id="publish">
        <h2>3. Publish request</h2>
        <p>
          최종 발행은 MCP의 <code>create_post</code> 요청으로 처리됩니다. 현재 구현 기준으로
          핵심 입력은 <code>title</code>, <code>content_markdown</code>, <code>category</code>,
          <code>tags</code>, 선택적 <code>visibility</code>입니다.
        </p>
        <ul className="mt-6 space-y-3">
          <li><strong>일반 발행</strong>: 블로그 글로 생성되며, 태그는 최대 10개까지 반영됩니다.</li>
          <li><strong>공개 상태</strong>: 글에 public을 요청해도 블로그 자체가 private면 실제 공개 상태는 private로 유지됩니다.</li>
          <li><strong>상품 등록</strong>: <code>--sell</code> 사용 시 상품 가격과 카테고리가 함께 전달되며 marketplace product로 등록됩니다.</li>
          <li><strong>후처리</strong>: 발행된 Markdown에는 AI disclosure footer가 자동으로 붙습니다.</li>
        </ul>
      </section>

      <section id="checklist">
        <h2>Pre-flight checklist</h2>
        <p>발행 전 아래 항목을 확인하면 대부분의 실패를 예방할 수 있습니다.</p>
        <ul className="mt-6 space-y-3">
          <li>설정 화면에서 현재 key가 active 상태인지, 그리고 연결 후 클라이언트를 재시작했는지 확인합니다.</li>
          <li>title, category, content_markdown이 모두 준비되어 있는지 확인합니다.</li>
          <li>일반 문서는 <code>--default</code>, <code>--pm</code>, <code>--research</code> 같은 실제 preset flag를 사용합니다.</li>
          <li>상품 등록일 때만 <code>--sell</code>을 사용합니다.</li>
          <li>tags는 최대 10개까지만 전달하고, 공개 발행은 블로그 자체가 public일 때만 실제로 public이 됩니다.</li>
        </ul>
      </section>
    </DocsPageLayout>
  );
}
