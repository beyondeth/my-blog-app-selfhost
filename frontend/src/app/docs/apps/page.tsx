import type { Metadata } from 'next';
import Link from 'next/link';
import DocsPageLayout from '@/components/public-site/DocsPageLayout';
import { APP_CONNECTION_DOCS } from '@/lib/app-connection-docs';

export const metadata: Metadata = {
  title: 'Web & App Connections',
  description:
    'Codebase 연결은 Web & App Connections, API Keys & MCP, SKILLS 세 가지 방식으로 정리되어 있습니다.',
  alternates: {
    canonical: '/docs/apps',
  },
};

const toc = [
  { id: 'overview', label: 'Overview' },
  { id: 'web-and-app-connections', label: 'Web & App Connections' },
  { id: 'api-keys-and-mcp', label: 'API Keys & MCP' },
  { id: 'skills', label: 'SKILLS' },
];

export default function AppConnectionsPage() {
  return (
    <DocsPageLayout
      currentPath="/docs/apps"
      title="Web & App Connections"
      description="Codebase 연결 가이드는 사용 환경에 맞춰 세 가지 방식으로 정리되어 있습니다. 웹/앱 공식 문서, API key 기반 MCP 연결, 그리고 SKILLS 설치 흐름을 같은 문서 허브 안에서 확인할 수 있습니다."
      toc={toc}
      eyebrow="Documentation"
    >
      <section id="overview">
        <h2>Overview</h2>
        <p>
          Codebase 연결은 크게 세 가지 방식으로 나뉩니다. 첫째는 ChatGPT, Claude, Perplexity 같은
          웹/앱 surface에서 직접 연결하는 방식이고, 둘째는 API key를 발급해 MCP 설정 파일이나 CLI
          명령으로 붙이는 방식이며, 셋째는 SKILLS를 설치해 더 빠르게 온보딩하는 방식입니다.
        </p>
      </section>

      <section id="web-and-app-connections">
        <h2>Web &amp; App Connections</h2>
        <p>
          ChatGPT, Claude, Perplexity처럼 사용자가 직접 보는 웹/앱 환경의 연결 가이드입니다.
          각 문서는 공식 문서를 기준으로 유지하고, 실제 화면 캡처는{' '}
          <code>frontend/public/docs/apps/...</code> 아래 파일만 교체하면 반영되도록 설계했습니다.
        </p>
        <div className="not-prose mt-6 grid gap-4 md:grid-cols-3">
          {APP_CONNECTION_DOCS.map((doc) => (
            <Link
              key={doc.slug}
              href={`/docs/apps/${doc.slug}`}
              className="rounded-[28px] border border-[#E6ECF3] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] dark:border-[#223244] dark:bg-[#0F1720] dark:shadow-none"
            >
              <div className="inline-flex rounded-full border border-[#D7E3F5] bg-[#F5F9FF] px-3 py-1 text-xs font-medium text-[#1A73E8] dark:border-[#2C425A] dark:bg-[#111D29] dark:text-[#8AB4F8]">
                {doc.statusLabel}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#101828] dark:text-white">
                {doc.shortTitle}
              </h3>
              <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
                {doc.summary}
              </p>
              <p className="mt-4 text-sm font-medium text-[#1A73E8] dark:text-[#8AB4F8]">
                문서 열기 →
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section id="api-keys-and-mcp">
        <h2>API Keys &amp; MCP</h2>
        <p>
          API key를 발급한 뒤 hosted MCP endpoint를 각 클라이언트에 직접 등록하는 방식입니다.
          현재 <Link href="/settings/api-keys">자동포스팅 연결</Link> 화면에 있는 key 관리, client 선택,
          설정 복사, 재시작 흐름을 docs 형식으로 정리한 문서를 제공합니다.
        </p>
        <div className="not-prose mt-6 rounded-[28px] border border-[#E6ECF3] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-[#223244] dark:bg-[#0F1720] dark:shadow-none">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h3 className="text-lg font-semibold text-[#101828] dark:text-white">API key 관리</h3>
              <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
                최대 3개 key, 90일 만료, 사용량/만료/최근 사용 이력을 기준으로 관리합니다.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#101828] dark:text-white">MCP 직접 설정</h3>
              <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
                Select → Copy → Restart 흐름으로 Codex, Claude Code, Gemini, Cursor 등 각 환경에 맞춰 연결합니다.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#101828] dark:text-white">운영 체크포인트</h3>
              <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
                endpoint, 만료 key, 설정 형식, Codex 특수 규칙까지 문서형으로 정리했습니다.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/docs/mcp"
              className="inline-flex items-center justify-center rounded-xl bg-[#1A73E8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#185ABC]"
            >
              API Keys &amp; MCP 문서 열기
            </Link>
            <Link
              href="/settings/api-keys"
              className="inline-flex items-center justify-center rounded-xl border border-[#D7E3F5] bg-[#F5F9FF] px-4 py-3 text-sm font-semibold text-[#1A56B5] transition hover:bg-[#EAF2FF] dark:border-[#2C425A] dark:bg-[#111D29] dark:text-[#8AB4F8] dark:hover:bg-[#162438]"
            >
              설정 화면 열기
            </Link>
          </div>
        </div>
      </section>

      <section id="skills">
        <h2>SKILLS</h2>
        <p>
          Codebase skill을 설치해 Codex, Claude Code, Gemini CLI, Antigravity 같은 환경에서
          공통 온보딩 흐름을 쓰는 방식입니다. settings 화면의 `SKILLS 설치`와 `LLM Agents 설치`
          내용을 docs 형식으로 다시 정리했습니다.
        </p>
        <div className="not-prose mt-6 rounded-[28px] border border-[#E6ECF3] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-[#223244] dark:bg-[#0F1720] dark:shadow-none">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h3 className="text-lg font-semibold text-[#101828] dark:text-white">Global 설치</h3>
              <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
                여러 에이전트를 한 번에 전역 설치하고, 동일한 skill source를 공통으로 사용합니다.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#101828] dark:text-white">Agent별 설치</h3>
              <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
                Codex, Claude Code, Gemini CLI, Antigravity 중 필요한 환경만 골라 설치할 수 있습니다.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#101828] dark:text-white">LLM Agents 안내</h3>
              <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
                설치 가이드를 fetch해서 문서 기반 자동 설치를 진행하는 방식까지 함께 포함했습니다.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/docs/skills"
              className="inline-flex items-center justify-center rounded-xl bg-[#1A73E8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#185ABC]"
            >
              SKILLS 문서 열기
            </Link>
            <Link
              href="/settings/api-keys"
              className="inline-flex items-center justify-center rounded-xl border border-[#D7E3F5] bg-[#F5F9FF] px-4 py-3 text-sm font-semibold text-[#1A56B5] transition hover:bg-[#EAF2FF] dark:border-[#2C425A] dark:bg-[#111D29] dark:text-[#8AB4F8] dark:hover:bg-[#162438]"
            >
              설정 화면 열기
            </Link>
          </div>
        </div>
      </section>
    </DocsPageLayout>
  );
}
