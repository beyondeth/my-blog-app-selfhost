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
  description: 'Connection guide for the current Codebase MCP endpoint, API key authentication model, and request limits.',
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
  { title: 'Claude Code', description: 'CLI command', configPath: 'Terminal' },
  { title: 'Gemini CLI', description: 'JSON config', configPath: '~/.gemini/settings.json' },
  { title: 'Antigravity', description: 'JSON config', configPath: 'mcp_config.json' },
  { title: 'Cursor', description: 'JSON config', configPath: '~/.cursor/mcp.json' },
  { title: 'Windsurf', description: 'JSON config', configPath: '~/.windsurf/mcp.json' },
  { title: 'VS Code', description: 'Workspace config', configPath: '.mcp.json' },
  { title: 'Qwen Coder', description: 'JSON config', configPath: '~/.qwen/mcp.json' },
];

export default function McpPage() {
  return (
    <DocsPageLayout
      currentPath="/docs/mcp"
      title="API Keys & MCP"
      description="The current public guide uses a hosted MCP endpoint registered directly in each client. This page explains authentication, limits, and troubleshooting based on the live implementation."
      toc={toc}
      eyebrow="Documentation"
    >
      <section id="overview">
        <h2>Overview</h2>
        <p>
          The default connection model uses the <strong>Codebase hosted MCP server</strong>, not a local proxy.
          Users issue an API key, then register the endpoint and Bearer header in the MCP config for the client they use.
        </p>
        <ul className="mt-6 space-y-3">
          <li><strong>Client / Agent</strong>: Codex, Claude Code, Gemini, Cursor, VS Code, Windsurf, Qwen, Antigravity</li>
          <li><strong>Endpoint</strong>: <code>https://mcp.codebase.blog/mcp</code></li>
          <li><strong>Backend scope</strong>: publishing, readback, knowledge queries</li>
        </ul>
        <p className="mt-6">
          Always use the copyable JSON or CLI snippet from the <Link href="/settings/api-keys">Auto-publishing connection</Link> screen.
          The docs explain the flow and policy, but the settings screen remains the source of truth for exact config values.
        </p>
      </section>

      <section id="api-key-management">
        <h2>API key management</h2>
        <p>
          Every MCP request is authenticated with a <strong>Bearer API key</strong>. Each key is linked to a user and a blog,
          and that link determines where publishing requests are routed.
        </p>
        <div className="not-prose mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            title="Active key limit"
            body="Each user can keep up to 3 active keys."
          />
          <InfoCard
            title="Expiration policy"
            body="Each key expires after 90 days."
          />
          <InfoCard
            title="Re-copy available"
            body="You can copy an active key again later from settings, not only at creation time."
          />
          <InfoCard
            title="Blog binding"
            body="Publish requests run only inside the user and blog context linked to that key."
          />
        </div>

        <div className="not-prose mt-6 overflow-x-auto rounded-[28px] border border-[#E6ECF3] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-[#223244] dark:bg-[#0F1720] dark:shadow-none">
          <h3 className="text-lg font-semibold text-[#101828] dark:text-white">What each field means</h3>
          <table className="mt-4 w-full min-w-[560px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#E6ECF3] dark:border-[#303134]">
                <th className="py-3 pr-4 font-semibold text-[#475467] dark:text-[#9FB0C2]">Column</th>
                <th className="py-3 font-semibold text-[#475467] dark:text-[#9FB0C2]">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6] dark:divide-[#2A3442]">
              <tr>
                <td className="py-3 pr-4 text-[#101828] dark:text-white">Name</td>
                <td className="py-3 text-[#475467] dark:text-[#9FB0C2]">Internal label for managing the key.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-[#101828] dark:text-white">Secret key</td>
                <td className="py-3 text-[#475467] dark:text-[#9FB0C2]">The actual Bearer key. You can copy it again when needed.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-[#101828] dark:text-white">Usage</td>
                <td className="py-3 text-[#475467] dark:text-[#9FB0C2]">Shows request counts and published post volume together.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-[#101828] dark:text-white">Expires</td>
                <td className="py-3 text-[#475467] dark:text-[#9FB0C2]">Expiration date for the key.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-[#101828] dark:text-white">Last used</td>
                <td className="py-3 text-[#475467] dark:text-[#9FB0C2]">Relative timestamp of the most recent use.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="setup-flow">
        <h2>Setup flow</h2>
        <p>
          The `Direct MCP setup` section in settings is organized into three steps. This page mirrors the same flow in a clearer card layout.
        </p>
        <div className="not-prose mt-6 grid gap-4 lg:grid-cols-3">
          <InfoCard
            title="1. Select"
            body="Pick the client card that matches your environment."
          />
          <InfoCard
            title="2. Copy"
            body="Copy and paste the JSON or CLI config for that client."
          />
          <InfoCard
            title="3. Restart"
            body="Restart the client and verify that MCP calls work."
          />
        </div>
      </section>

      <section id="client-configs">
        <h2>Client configs</h2>
        <p>
          The settings screen provides multiple client cards, each with a config path and a copyable snippet.
          This page keeps a few representative examples, but the settings screen remains the source of truth for the latest values.
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
            description="For Codex, the supported path is editing `http_headers` directly in `~/.codex/config.toml` instead of relying on `codex mcp add`."
            code={getCodexConfig(placeholderApiKey, false)}
          />
          <DocsCodePanel
            title="Claude Code"
            description="Claude Code can register the connection directly with an HTTP transport command."
            code={getClaudeCodeConfig(placeholderApiKey, false)}
          />
          <DocsCodePanel
            title="Gemini CLI"
            description="Gemini CLI stores the HTTP URL and header together in `~/.gemini/settings.json`."
            code={getGeminiConfig(placeholderApiKey, false)}
          />
          <DocsCodePanel
            title="Cursor / Antigravity"
            description="Cursor and Antigravity both use JSON config, but the URL key name can differ."
            code={`${getCursorConfig(placeholderApiKey, false)}\n\n${getAntigravityConfig(placeholderApiKey, false)}`}
          />
        </div>
      </section>

      <section id="rate-limit">
        <h2>Limits</h2>
        <p>
          The current implementation combines two types of limits: request protection to block rapid retries, and a monthly auto-publishing quota by plan.
        </p>

        <h3>Request protection</h3>
        <p>The MCP endpoint applies a protection limit to block rapid retry loops.</p>
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
        <p>If the connection is missing or publishing fails, check the items below first.</p>
        <ul className="mt-6 space-y-3">
          <li>Confirm the endpoint is exactly <code>https://mcp.codebase.blog/mcp</code> in the config file.</li>
          <li>Make sure the Bearer API key has not expired or been deleted.</li>
          <li>Restart the client after editing the configuration.</li>
          <li>Verify that the copied snippet matches the client you are actually using.</li>
          <li>For Codex, confirm you updated <code>http_headers.Authorization</code> in <code>~/.codex/config.toml</code> instead of relying on <code>codex mcp add</code>.</li>
          <li>If an old <code>bearer_token_env_var</code> block remains in Codex config, replace it with the new header block.</li>
        </ul>
        <p className="mt-6">
          If the issue continues, recopy the snippet from <Link href="/settings/api-keys">Auto-publishing connection</Link> or contact
          <Link href="/support"> Support</Link> with logs.
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
