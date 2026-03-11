import type { McpScopeInfo } from '@/lib/mcpScopes';

interface McpOAuthRequestPanelProps {
  clientName: string;
  requestedMcpScopes: McpScopeInfo[];
  showBadge?: boolean;
  showHeader?: boolean;
}

export function McpOAuthRequestPanel({
  clientName,
  requestedMcpScopes,
  showBadge = true,
  showHeader = true,
}: McpOAuthRequestPanelProps) {
  return (
    <div className="mb-3 sm:mb-6 w-full rounded-2xl border border-zinc-200/80 bg-zinc-50/70 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      {showBadge && (
        <div className="flex items-center justify-center">
          <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            APP CONNECTION
          </span>
        </div>
      )}
      {showHeader && (
        <div className={`${showBadge ? 'mt-3' : ''} text-center`}>
          <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {clientName} 권한 요청
          </h3>
          <p className="mt-1 text-xs sm:text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            요청 권한을 확인해 주세요.
          </p>
        </div>
      )}
      <div className={`${showHeader ? 'mt-4' : ''} divide-y divide-zinc-200/80 rounded-xl border border-zinc-200/80 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/60`}>
        {requestedMcpScopes.map((scope) => (
          <div key={scope.scope} className="px-4 py-3">
            <p className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {scope.label}
            </p>
            <p className="mt-1 text-xs sm:text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {scope.description}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 text-center text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
        연결 후에는 언제든 권한을 취소할 수 있습니다.
      </div>
    </div>
  );
}
