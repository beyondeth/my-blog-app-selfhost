import type { Metadata } from 'next';
import Link from 'next/link';
import DocsPageLayout from '@/components/public-site/DocsPageLayout';
import { APP_CONNECTION_DOCS } from '@/lib/app-connection-docs';

export const metadata: Metadata = {
  title: 'Web & App Connections',
  description:
    'Codebase connection guidance is organized into Web & App Connections, API Keys & MCP, and SKILLS.',
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
      description="Codebase connection guidance is organized into three paths: official web and app instructions, API key based MCP setup, and the SKILLS installation flow."
      toc={toc}
      eyebrow="Documentation"
    >
      <section id="overview">
        <h2>Overview</h2>
        <p>
          Codebase connections are grouped into three practical paths. First, you can connect directly inside web and app surfaces such as ChatGPT, Claude, or Perplexity.
          Second, you can issue an API key and register MCP through a config file or CLI command. Third, you can install SKILLS for a faster shared onboarding flow.
        </p>
      </section>

      <section id="web-and-app-connections">
        <h2>Web &amp; App Connections</h2>
        <p>
          This section covers the web and app environments users interact with directly, such as ChatGPT, Claude, and Perplexity.
          Each guide is aligned to official documentation, and the screenshots are wired so replacing files under{' '}
          <code>frontend/public/docs/apps/...</code> updates the page automatically.
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
                Open guide →
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section id="api-keys-and-mcp">
        <h2>API Keys &amp; MCP</h2>
        <p>
          This path issues an API key and registers the hosted MCP endpoint directly in each client.
          The docs mirror the key management, client selection, copy, and restart flow shown in{' '}
          <Link href="/settings/api-keys">Auto-publishing connection</Link>.
        </p>
        <div className="not-prose mt-6 rounded-[28px] border border-[#E6ECF3] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-[#223244] dark:bg-[#0F1720] dark:shadow-none">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h3 className="text-lg font-semibold text-[#101828] dark:text-white">API key management</h3>
              <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
                Manage up to 3 keys with 90-day expiration plus usage, expiry, and last-used history.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#101828] dark:text-white">Direct MCP setup</h3>
              <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
                Follow the Select → Copy → Restart flow for Codex, Claude Code, Gemini, Cursor, and related environments.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#101828] dark:text-white">Operational checks</h3>
              <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
                The guide also covers endpoint validation, expired keys, config formats, and Codex-specific rules.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/docs/mcp"
              className="inline-flex items-center justify-center rounded-xl bg-[#1A73E8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#185ABC]"
            >
              Open the API Keys &amp; MCP guide
            </Link>
            <Link
              href="/settings/api-keys"
              className="inline-flex items-center justify-center rounded-xl border border-[#D7E3F5] bg-[#F5F9FF] px-4 py-3 text-sm font-semibold text-[#1A56B5] transition hover:bg-[#EAF2FF] dark:border-[#2C425A] dark:bg-[#111D29] dark:text-[#8AB4F8] dark:hover:bg-[#162438]"
            >
              Open settings
            </Link>
          </div>
        </div>
      </section>

      <section id="skills">
        <h2>SKILLS</h2>
        <p>
          This path installs the Codebase skill so Codex, Claude Code, Gemini CLI, and Antigravity can share the same onboarding flow.
          It repackages the `SKILLS install` and `LLM Agents install` sections from settings as documentation.
        </p>
        <div className="not-prose mt-6 rounded-[28px] border border-[#E6ECF3] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-[#223244] dark:bg-[#0F1720] dark:shadow-none">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h3 className="text-lg font-semibold text-[#101828] dark:text-white">Global install</h3>
              <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
                Install multiple agents globally in one pass and reuse the same skill source across them.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#101828] dark:text-white">Per-agent install</h3>
              <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
                Install only the environments you need, such as Codex, Claude Code, Gemini CLI, or Antigravity.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#101828] dark:text-white">LLM agent guidance</h3>
              <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">
                Includes the fetch-based path for letting an agent read the installation guide and follow the process.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/docs/skills"
              className="inline-flex items-center justify-center rounded-xl bg-[#1A73E8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#185ABC]"
            >
              Open the SKILLS guide
            </Link>
            <Link
              href="/settings/api-keys"
              className="inline-flex items-center justify-center rounded-xl border border-[#D7E3F5] bg-[#F5F9FF] px-4 py-3 text-sm font-semibold text-[#1A56B5] transition hover:bg-[#EAF2FF] dark:border-[#2C425A] dark:bg-[#111D29] dark:text-[#8AB4F8] dark:hover:bg-[#162438]"
            >
              Open settings
            </Link>
          </div>
        </div>
      </section>
    </DocsPageLayout>
  );
}
