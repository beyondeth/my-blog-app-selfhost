import type { Metadata } from 'next';
import Link from 'next/link';
import DocsPageLayout from '@/components/public-site/DocsPageLayout';

export const metadata: Metadata = {
  title: 'Getting Started',
  description: '현재 구현 기준으로 API key 발급부터 첫 자동포스팅까지의 연결 절차를 안내합니다.',
  alternates: {
    canonical: '/docs/get-started',
  },
};

const toc = [
  { id: 'auth-setup', label: '1. API key' },
  { id: 'mcp-connect', label: '2. Connect from your environment' },
  { id: 'first-posting', label: '3. First auto-posting' },
];

export default function GetStartedPage() {
  return (
    <DocsPageLayout
      currentPath="/docs/get-started"
      title="Getting Started"
      description="로그인한 사용자가 자신의 블로그에 연결된 API key를 만들고, 원하는 AI 클라이언트에 Codebase MCP를 등록한 뒤 첫 자동포스팅을 보내는 가장 짧은 경로입니다."
      toc={toc}
      eyebrow="Documentation"
    >
      <section id="auth-setup">
        <h2>1. API key</h2>
        <p>
          첫 단계는 <Link href="/settings/api-keys">설정 &gt; 자동포스팅 연결</Link>에서
          API key를 만드는 것입니다. 이 키는 어떤 블로그에 발행할지와 연결된 사용자 식별자 역할을 합니다.
        </p>
        <ul className="mt-6 space-y-3">
          <li>사용자당 active key는 최대 3개까지 유지할 수 있습니다.</li>
          <li>각 key는 90일 뒤 만료됩니다.</li>
          <li>생성 직후뿐 아니라 설정 화면에서 다시 복사할 수 있습니다.</li>
        </ul>
        <p className="mt-6">
          실제 key 생성과 복사는 항상 <Link href="/settings/api-keys">자동포스팅 연결</Link> 화면을 기준으로 진행하세요.
        </p>
      </section>

      <section id="mcp-connect">
        <h2>2. Connect from your environment</h2>
        <p>
          현재 기본 연결 방식은 로컬 프록시가 아니라 hosted MCP endpoint를 각 클라이언트에
          등록하는 흐름입니다. 정확한 스니펫은 항상 <Link href="/settings/api-keys">자동포스팅 연결</Link>
          화면에서 복사하세요.
        </p>
        <ul className="mt-6 space-y-3">
          <li><strong>웹/앱 연결</strong>: ChatGPT, Claude, Perplexity 같은 surface는 <Link href="/docs/apps">Web &amp; App Connections</Link> 문서에서 단계별로 확인합니다.</li>
          <li><strong>API Keys &amp; MCP</strong>: Codex, Claude Code, Gemini, Cursor, Windsurf, VS Code, Qwen 같은 환경은 <Link href="/docs/mcp">API Keys &amp; MCP</Link> 문서에서 key 관리와 설정 스니펫을 확인합니다.</li>
          <li><strong>SKILLS</strong>: 공통 설치 흐름, agent별 설치, 설치 확인, LLM Agents용 fetch 가이드는 <Link href="/docs/skills">SKILLS</Link> 문서에서 확인합니다.</li>
        </ul>

        <h3>Codex example</h3>
        <p>
          Codex는 이 경우 <code>codex mcp add</code>보다 <code>config.toml</code>에 직접 추가하는 경로를 따릅니다.
        </p>
        <pre>{`[mcp_servers.codebase-blog-mcp]
url = "https://mcp.codebase.blog/mcp"
http_headers = { Authorization = "Bearer blog_sk_xxxxx" }

codex mcp get codebase-blog-mcp`}</pre>
      </section>

      <section id="first-posting">
        <h2>3. First auto-posting</h2>
        <p>
          연결이 끝났다면 이제 클라이언트에게 발행 요청을 보내면 됩니다. 일반 문서는 8개 preset
          중 하나를 flag로 붙이고, 디지털 상품 등록일 때만 <code>--sell</code>을 명시합니다.
        </p>
        <h3>Prompt example</h3>
        <pre>{`"이 대화 내용을 정리해서 포스팅해줘 --default"`}</pre>
        <p>
          제품, 회의, 코드 리뷰 성격에 맞춰 <code>--pm</code>, <code>--research</code>, <code>--designer</code> 같은 실제 preset flag를 사용할 수 있습니다.
        </p>
        <p className="mt-6">
          다음으로는 <Link href="/docs/publishing-flow">Publishing Flow</Link>에서 실제 발행 요청에 어떤 필드와 제약이 적용되는지 확인하고,
          <Link href="/docs/writing-styles"> Writing Styles</Link>에서 preset별 차이를 비교해 보세요.
        </p>
      </section>
    </DocsPageLayout>
  );
}
