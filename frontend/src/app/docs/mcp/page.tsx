import type { Metadata } from 'next';
import Link from 'next/link';
import DocsPageLayout from '@/components/public-site/DocsPageLayout';
import {
  getAntigravityConfig,
  getClaudeCodeConfig,
  getCodexConfig,
  getCursorConfig,
  getGeminiConfig,
} from '@/app/settings/api-keys/configSnippets';

export const metadata: Metadata = {
  title: 'API Keys & MCP Architecture',
  description: '현재 Codebase MCP endpoint, API key 인증 방식, 요청 보호 제한을 정리한 연결 가이드입니다.',
  alternates: {
    canonical: '/docs/mcp',
  },
};

const toc = [
  { id: 'overview', label: 'Overview' },
  { id: 'api-key-management', label: 'API key management' },
  { id: 'setup-flow', label: 'Setup flow' },
  { id: 'client-configs', label: 'Client configs' },
  { id: 'rate-limit', label: 'Limits' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
];

const placeholderApiKey = 'blog_sk_xxxxx';
const clientCards = [
  { title: 'OpenAI Codex', description: 'Codex CLI', configPath: '~/.codex/config.toml' },
  { title: 'Claude Code', description: 'CLI 명령', configPath: '터미널' },
  { title: 'Gemini CLI', description: 'JSON 설정', configPath: '~/.gemini/settings.json' },
  { title: 'Antigravity', description: 'JSON 설정', configPath: 'mcp_config.json' },
  { title: 'Cursor', description: 'JSON 설정', configPath: '~/.cursor/mcp.json' },
  { title: 'Windsurf', description: 'JSON 설정', configPath: '~/.windsurf/mcp.json' },
  { title: 'VS Code', description: '워크스페이스 설정', configPath: '.mcp.json' },
  { title: 'Qwen Coder', description: 'JSON 설정', configPath: '~/.qwen/mcp.json' },
];

export default function McpPage() {
  return (
    <DocsPageLayout
      currentPath="/docs/mcp"
      title="API Keys & MCP"
      description="현재 public guide 기준의 연결 모델은 hosted MCP endpoint를 각 클라이언트에 등록하는 방식입니다. 이 문서는 인증, 제한, 문제 해결 포인트를 실제 구현 기준으로 설명합니다."
      toc={toc}
      eyebrow="Documentation"
    >
      <section id="overview">
        <h2>Overview</h2>
        <p>
          현재 기본 연결 방식은 로컬 프록시가 아니라 <strong>Codebase hosted MCP server</strong>를
          사용하는 모델입니다. 사용자는 자신의 API key를 발급한 뒤, 사용하는 클라이언트의 MCP 설정에
          endpoint와 Bearer 인증 정보를 등록합니다.
        </p>
        <ul className="mt-6 space-y-3">
          <li><strong>Client / Agent</strong>: Codex, Claude Code, Gemini, Cursor, VS Code, Windsurf, Qwen, Antigravity</li>
          <li><strong>Endpoint</strong>: <code>https://mcp.codebase.blog/mcp</code></li>
          <li><strong>Backend scope</strong>: publishing, readback, knowledge queries</li>
        </ul>
        <p className="mt-6">
          클라이언트별 복사 가능한 JSON/CLI 스니펫은 항상 <Link href="/settings/api-keys">자동포스팅 연결</Link> 화면을
          기준으로 확인하세요. 문서는 흐름과 정책을 설명하고, 설정값 자체는 settings 화면이 source of truth 역할을 합니다.
        </p>
      </section>

      <section id="api-key-management">
        <h2>API key management</h2>
        <p>
          모든 MCP 요청은 <strong>Bearer API key</strong>로 인증됩니다. key는 사용자와 블로그에 연결되어 있으며,
          이 연결 정보를 바탕으로 어떤 블로그에 포스팅할지 결정됩니다.
        </p>
        <div className="not-prose mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            title="생성 제한"
            body="사용자당 active key는 최대 3개까지 유지할 수 있습니다."
          />
          <InfoCard
            title="만료 정책"
            body="각 key는 90일 만료 정책을 따릅니다."
          />
          <InfoCard
            title="재복사 가능"
            body="생성 직후뿐 아니라 설정 화면에서 active key를 다시 복사할 수 있습니다."
          />
          <InfoCard
            title="블로그 연결"
            body="publish 요청은 key에 연결된 블로그와 사용자 컨텍스트 안에서만 처리됩니다."
          />
        </div>

        <div className="not-prose mt-6 overflow-x-auto rounded-[28px] border border-[#E6ECF3] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-[#223244] dark:bg-[#0F1720] dark:shadow-none">
          <h3 className="text-lg font-semibold text-[#101828] dark:text-white">표시 항목 의미</h3>
          <table className="mt-4 w-full min-w-[560px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#E6ECF3] dark:border-[#303134]">
                <th className="py-3 pr-4 font-semibold text-[#475467] dark:text-[#9FB0C2]">컬럼</th>
                <th className="py-3 font-semibold text-[#475467] dark:text-[#9FB0C2]">설명</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6] dark:divide-[#2A3442]">
              <tr>
                <td className="py-3 pr-4 text-[#101828] dark:text-white">이름</td>
                <td className="py-3 text-[#475467] dark:text-[#9FB0C2]">관리용 이름입니다.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-[#101828] dark:text-white">비밀 키</td>
                <td className="py-3 text-[#475467] dark:text-[#9FB0C2]">실제 Bearer key이며 필요 시 다시 복사할 수 있습니다.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-[#101828] dark:text-white">사용량</td>
                <td className="py-3 text-[#475467] dark:text-[#9FB0C2]">요청 수와 포스트 생성 수를 함께 보여줍니다.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-[#101828] dark:text-white">만료</td>
                <td className="py-3 text-[#475467] dark:text-[#9FB0C2]">해당 key의 만료일입니다.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-[#101828] dark:text-white">최근에 사용됨</td>
                <td className="py-3 text-[#475467] dark:text-[#9FB0C2]">마지막 사용 시간을 상대 시각으로 보여줍니다.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="setup-flow">
        <h2>Setup flow</h2>
        <p>
          settings 화면의 `MCP 직접 설정`은 세 단계로 정리되어 있습니다. 문서에서는 같은 흐름을
          읽기 쉬운 카드 구조로 다시 설명합니다.
        </p>
        <div className="not-prose mt-6 grid gap-4 lg:grid-cols-3">
          <InfoCard
            title="1. Select"
            body="사용하는 환경에 맞는 클라이언트 카드를 선택합니다."
          />
          <InfoCard
            title="2. Copy"
            body="선택한 환경의 JSON 또는 CLI 설정을 복사해 붙여넣습니다."
          />
          <InfoCard
            title="3. Restart"
            body="클라이언트를 재시작한 뒤 MCP 호출이 정상 동작하는지 확인합니다."
          />
        </div>
      </section>

      <section id="client-configs">
        <h2>Client configs</h2>
        <p>
          현재 settings 화면은 여러 클라이언트 카드를 제공하고, 각 카드마다 config path와 복사 가능한
          설정 스니펫을 보여줍니다. 문서에서는 자주 쓰는 환경 중심으로 예시를 남기고, 정확한 최신 값은
          항상 settings 화면을 source of truth로 봅니다.
        </p>
        <div className="not-prose mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {clientCards.map((card) => (
            <div
              key={card.title}
              className="rounded-[24px] border border-[#E6ECF3] bg-white p-5 dark:border-[#223244] dark:bg-[#0F1720]"
            >
              <h3 className="text-base font-semibold text-[#101828] dark:text-white">{card.title}</h3>
              <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">{card.description}</p>
              <p className="mt-3 text-xs text-[#667085] dark:text-[#8FA5BA]">{card.configPath}</p>
            </div>
          ))}
        </div>

        <div className="not-prose mt-6 grid gap-4 xl:grid-cols-2">
          <DocsCodePanel
            title="OpenAI Codex"
            description="Codex는 `codex mcp add` 대신 `~/.codex/config.toml`의 `http_headers`를 직접 수정하는 방식이 현재 정식 경로입니다."
            code={getCodexConfig(placeholderApiKey, false)}
          />
          <DocsCodePanel
            title="Claude Code"
            description="Claude Code는 HTTP transport 명령으로 바로 등록할 수 있습니다."
            code={getClaudeCodeConfig(placeholderApiKey, false)}
          />
          <DocsCodePanel
            title="Gemini CLI"
            description="Gemini CLI는 `~/.gemini/settings.json`에 HTTP URL과 header를 함께 넣습니다."
            code={getGeminiConfig(placeholderApiKey, false)}
          />
          <DocsCodePanel
            title="Cursor / Antigravity"
            description="Cursor와 Antigravity는 둘 다 JSON 설정을 사용하지만 URL 키 이름이 다를 수 있습니다."
            code={`${getCursorConfig(placeholderApiKey, false)}\n\n${getAntigravityConfig(placeholderApiKey, false)}`}
          />
        </div>
      </section>

      <section id="rate-limit">
        <h2>Limits</h2>
        <p>
          현재 구현에는 두 가지 제한이 함께 존재합니다. 빠른 재시도를 막는 요청 보호 제한과,
          플랜별 월간 자동포스팅 quota입니다.
        </p>

        <h3>Request protection</h3>
        <p>MCP endpoint 전체에는 rapid retry를 막기 위한 보호 제한이 걸려 있습니다.</p>
        <ul>
          <li>20 requests / minute</li>
          <li>30 requests / hour</li>
          <li>50 requests / day</li>
        </ul>

        <h3>Monthly MCP post quota</h3>
        <div className="not-prose mt-4 overflow-x-auto">
          <table className="w-full min-w-[280px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#e8eaed] dark:border-[#3c4043]">
                <th className="py-2 pr-4 font-semibold text-[#5f6368] dark:text-[#9aa0a6]">Plan</th>
                <th className="py-2 font-semibold text-[#5f6368] dark:text-[#9aa0a6]">Posts / month</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f4] dark:divide-[#303134]">
              <tr>
                <td className="py-2 pr-4 text-[#202124] dark:text-white">Free</td>
                <td className="py-2 text-[#5f6368] dark:text-[#9aa0a6]">30</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-[#202124] dark:text-white">Starter</td>
                <td className="py-2 text-[#5f6368] dark:text-[#9aa0a6]">200</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-[#202124] dark:text-white">Pro</td>
                <td className="py-2 text-[#5f6368] dark:text-[#9aa0a6]">400</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="troubleshooting">
        <h2>Troubleshooting</h2>
        <p>연결이 보이지 않거나 발행이 실패한다면 먼저 아래 항목부터 확인하세요.</p>
        <ul className="mt-6 space-y-3">
          <li>설정 파일의 endpoint가 <code>https://mcp.codebase.blog/mcp</code>로 정확한지</li>
          <li>Bearer API key가 만료되거나 삭제되지 않았는지</li>
          <li>설정을 수정한 뒤 클라이언트를 재시작했는지</li>
          <li>복사한 스니펫이 현재 사용하는 클라이언트에 맞는 형식인지</li>
          <li>Codex는 <code>codex mcp add</code> 대신 <code>~/.codex/config.toml</code>의 <code>http_headers.Authorization</code>를 수정하는 방식인지</li>
          <li>Codex 설정에 예전 <code>bearer_token_env_var</code> 블록이 남아 있다면 새 header 블록으로 교체했는지</li>
        </ul>
        <p className="mt-6">
          문제가 계속되면 <Link href="/settings/api-keys">자동포스팅 연결</Link>에서 스니펫을 다시 복사하거나,
          <Link href="/support"> Support</Link>를 통해 로그와 함께 문의하세요.
        </p>
      </section>
    </DocsPageLayout>
  );
}

type InfoCardProps = {
  title: string;
  body: string;
};

function InfoCard({ title, body }: InfoCardProps) {
  return (
    <div className="rounded-[24px] border border-[#E6ECF3] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-[#223244] dark:bg-[#0F1720] dark:shadow-none">
      <h3 className="text-lg font-semibold text-[#101828] dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">{body}</p>
    </div>
  );
}

type DocsCodePanelProps = {
  title: string;
  description: string;
  code: string;
};

function DocsCodePanel({ title, description, code }: DocsCodePanelProps) {
  return (
    <div className="rounded-[28px] border border-[#E6ECF3] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-[#223244] dark:bg-[#0F1720] dark:shadow-none">
      <h3 className="text-lg font-semibold text-[#101828] dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">{description}</p>
      <pre className="mt-5 overflow-x-auto rounded-2xl border border-[#E6ECF3] bg-[#F8F9FA] px-4 py-4 text-[13px] leading-6 text-[#202124] dark:border-[#303134] dark:bg-[#202124] dark:text-[#E8EAED]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
