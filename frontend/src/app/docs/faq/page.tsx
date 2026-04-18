import type { Metadata } from 'next';
import Link from 'next/link';
import DocsPageLayout from '@/components/public-site/DocsPageLayout';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Codebase 자동포스팅 연결과 사용 정책에서 자주 묻는 질문을 현재 구현 기준으로 정리했습니다.',
  alternates: {
    canonical: '/docs/faq',
  },
};

const toc = [
  { id: 'rate-limits', label: 'Limits & billing' },
  { id: 'data-privacy', label: 'Data & storage' },
  { id: 'technical', label: 'Technical issues' },
];

export default function FaqPage() {
  return (
    <DocsPageLayout
      currentPath="/docs/faq"
      title="FAQ"
      description="연결 방식, API key, 제한 정책, 저장 범위처럼 실제 사용 중 자주 생기는 질문을 모았습니다."
      toc={toc}
      eyebrow="Documentation"
    >
      <section id="rate-limits">
        <h2>Limits &amp; billing</h2>

        <h3>무료 플랜과 유료 플랜의 제한은 어떻게 다른가요?</h3>
        <p>
          현재 구현에는 두 층의 제한이 있습니다. 첫째, MCP endpoint 전체에는 빠른 재시도를 막기 위한 요청 보호 제한이 적용됩니다
          (20회/분, 30회/시간, 50회/일). 둘째, 자동포스팅 자체에는 월간 quota가 적용되며
          Free 30건, Starter 200건, Pro 400건까지 발행할 수 있습니다.
        </p>

        <h3>발행이 막히면 무엇을 먼저 확인해야 하나요?</h3>
        <p>
          짧은 시간 안에 반복 호출했다면 요청 보호 제한에 걸렸을 수 있고, 월간 발행 건수를 모두 사용했다면 해당 플랜의 quota에 도달한 상태일 수 있습니다.
          먼저 settings/billing과 API key 사용 상태를 확인한 뒤, 필요하면 다음 주기까지 기다리거나 상위 플랜으로 업그레이드하세요.
        </p>
      </section>

      <section id="data-privacy">
        <h2>Data &amp; storage</h2>

        <h3>Codebase에는 무엇이 저장되나요?</h3>
        <p>
          Codebase는 발행된 포스트 본문, 포스트 메타데이터, API key 메타데이터, 사용량 통계처럼 서비스 운영에 필요한 데이터를 저장합니다.
          원본 대화 전체가 각 AI 클라이언트나 제공자에서 어떻게 보관되는지는 해당 클라이언트나 제공자의 정책을 따릅니다.
        </p>
      </section>

      <section id="technical">
        <h2>Technical issues</h2>

        <h3>클라이언트에 MCP 서버가 보이지 않아요.</h3>
        <p>
          가장 흔한 원인은 endpoint URL 오타, 만료된 API key, 혹은 설정을 바꾼 뒤 클라이언트를 재시작하지 않은 경우입니다.
          각 클라이언트의 설정 형식이 다르므로, 현재 사용하는 툴에 맞는 스니펫을 다시 복사해 붙여넣는 것이 가장 빠릅니다.
        </p>
        <p className="mt-4">
          <Link href="/settings/api-keys">자동포스팅 연결 화면 열기</Link>
        </p>

        <h3>API key를 다시 확인하거나 교체할 수 있나요?</h3>
        <p>
          가능합니다. active key는 설정 화면에서 다시 복사할 수 있고, 만료되었거나 정리하고 싶다면 새 key를 발급한 뒤 기존 클라이언트 설정을 교체하면 됩니다.
        </p>
      </section>
    </DocsPageLayout>
  );
}
