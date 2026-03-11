import Link from 'next/link';
import { McpOAuthRequestPanel } from '@/components/auth/McpOAuthRequestPanel';
import { parseMcpScopes } from '@/lib/mcpScopes';

type PreviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(value: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(value)) {
    return value[0] || fallback;
  }
  return value || fallback;
}

export default async function McpOAuthPreviewPage({ searchParams }: PreviewPageProps) {
  const resolved = searchParams ? await searchParams : {};
  const clientName = getParam(resolved.client_name, 'ChatGPT');
  const scopeValue = getParam(resolved.scope, 'mcp:tools mcp:read mcp:write');
  const requestedMcpScopes = parseMcpScopes(scopeValue);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 px-4 py-10 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              Preview
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              MCP OAuth Panel
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              배포 없이 바로 확인할 수 있습니다.
            </p>
          </div>
          <Link
            href={`/login?mcp_oauth=true&state=preview_state&callback_url=${encodeURIComponent('https://mcp.codebase.blog/oauth/callback')}&client_name=${encodeURIComponent(clientName)}&scope=${encodeURIComponent(scopeValue)}`}
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
          >
            실제 로그인 페이지 열기
          </Link>
        </div>

        <div className="auth-card rounded-2xl px-4 py-8 sm:px-8">
          <div className="mx-auto w-full max-w-xl">
            <div className="mb-8 text-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                앱 연결
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                로그인 후 연결을 완료합니다.
              </p>
            </div>

            <McpOAuthRequestPanel
              clientName={clientName}
              requestedMcpScopes={requestedMcpScopes}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
