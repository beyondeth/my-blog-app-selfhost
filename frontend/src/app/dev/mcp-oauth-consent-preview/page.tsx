'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { McpOAuthConsentCard } from '@/components/auth/McpOAuthConsentCard';
import { parseMcpScopes } from '@/lib/mcpScopes';

function getParam(value: string | null, fallback: string): string {
  return value || fallback;
}

export default function McpOAuthConsentPreviewPage() {
  const searchParams = useSearchParams();
  const clientName = getParam(searchParams.get('client_name'), 'ChatGPT');
  const scopeValue = getParam(searchParams.get('scope'), 'mcp:tools mcp:read mcp:write');
  const requestedMcpScopes = parseMcpScopes(scopeValue);

  return (
    <div>
      <div className="absolute left-0 top-0 z-10 w-full px-4 py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              Preview
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              MCP OAuth Consent
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              배포 없이 승인 화면 디자인을 바로 확인할 수 있습니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/auth/mcp-consent?mcp_oauth=true&state=preview_state&callback_url=${encodeURIComponent('https://mcp.codebase.blog/oauth/callback')}&client_name=${encodeURIComponent(clientName)}&scope=${encodeURIComponent(scopeValue)}`}
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
            >
              실제 승인 페이지 열기
            </Link>
          </div>
        </div>
      </div>

      <McpOAuthConsentCard
        clientName={clientName}
        requestedMcpScopes={requestedMcpScopes}
        onBack={() => {}}
        onCancel={() => {}}
        onApprove={() => {}}
      />
    </div>
  );
}
