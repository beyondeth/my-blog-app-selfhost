import type { Metadata } from 'next';
import Link from 'next/link';
import DocsPageLayout from '@/components/public-site/DocsPageLayout';

const PAGE_CONTENT = {
  metadataDescription:
    'Follow the shortest path from API key creation to your first auto-published post based on the current implementation.',
  description:
    'This is the shortest path for a signed-in user to create an API key for a blog, connect Codebase MCP to an AI client, and send the first auto-publishing request.',
  toc: [
    { id: 'auth-setup', label: '1. API key' },
    { id: 'mcp-connect', label: '2. Connect from your environment' },
    { id: 'first-posting', label: '3. First auto-publishing request' },
  ],
  sections: {
    apiKey: {
      heading: '1. API key',
      intro: (
        <>
          Start in <Link href="/settings/api-keys">Settings &gt; Auto-publishing connection</Link> and create an API key.
          The key identifies the user and determines which blog receives the published post.
        </>
      ),
      bullets: [
        'You can keep up to 3 active keys per user.',
        'Each key expires after 90 days.',
        'You can copy an active key again later from the settings page.',
      ],
      outro: (
        <>
          Always treat <Link href="/settings/api-keys">Auto-publishing connection</Link> as the source of truth for key creation and copy flows.
        </>
      ),
    },
    connect: {
      heading: '2. Connect from your environment',
      intro: (
        <>
          The default flow uses the hosted MCP endpoint directly instead of a local proxy. Always copy the exact snippet from{' '}
          <Link href="/settings/api-keys">Auto-publishing connection</Link>.
        </>
      ),
      bullets: [
        <>
          <strong>Web &amp; app connections</strong>: see <Link href="/docs/apps">Web &amp; App Connections</Link> for ChatGPT, Claude, and Perplexity.
        </>,
        <>
          <strong>API Keys &amp; MCP</strong>: see <Link href="/docs/mcp">API Keys &amp; MCP</Link> for Codex, Claude Code, Gemini, Cursor, Windsurf, VS Code, and Qwen.
        </>,
        <>
          <strong>SKILLS</strong>: see <Link href="/docs/skills">SKILLS</Link> for global install, per-agent install, validation, and LLM agent fetch guidance.
        </>,
      ],
      exampleTitle: 'Codex example',
      exampleDescription:
        'For Codex, the supported path is editing config.toml directly rather than relying on codex mcp add.',
      code: `[mcp_servers.codebase-blog-mcp]
url = "https://mcp.codebase.blog/mcp"
http_headers = { Authorization = "Bearer blog_sk_xxxxx" }

codex mcp get codebase-blog-mcp`,
    },
    posting: {
      heading: '3. First auto-publishing request',
      intro:
        'Once the connection is ready, ask the client to publish. Standard posts use one of the 8 preset flags, and marketplace products use --sell explicitly.',
      promptTitle: 'Prompt example',
      prompt: `"Turn this conversation into a post --default"`,
      description:
        'Use real preset flags such as --pm, --research, or --designer to match the shape of product, meeting, or code-review content.',
      outro: (
        <>
          Next, review <Link href="/docs/publishing-flow">Publishing Flow</Link> for the request fields and constraints, and compare preset differences in{' '}
          <Link href="/docs/writing-styles">Writing Styles</Link>.
        </>
      ),
    },
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {

  return {
    title: 'Getting Started',
    description: PAGE_CONTENT.metadataDescription,
    alternates: {
      canonical: '/docs/get-started',
    },
  };
}

export default async function GetStartedPage() {
  const content = PAGE_CONTENT;

  return (
    <DocsPageLayout
      currentPath="/docs/get-started"
      title="Getting Started"
      description={content.description}
      toc={[...content.toc]}
      eyebrow="Documentation"
    >
      <section id="auth-setup">
        <h2>{content.sections.apiKey.heading}</h2>
        <p>{content.sections.apiKey.intro}</p>
        <ul className="mt-6 space-y-3">
          {content.sections.apiKey.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-6">{content.sections.apiKey.outro}</p>
      </section>

      <section id="mcp-connect">
        <h2>{content.sections.connect.heading}</h2>
        <p>{content.sections.connect.intro}</p>
        <ul className="mt-6 space-y-3">
          {content.sections.connect.bullets.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>

        <h3>{content.sections.connect.exampleTitle}</h3>
        <p>{content.sections.connect.exampleDescription}</p>
        <pre>{content.sections.connect.code}</pre>
      </section>

      <section id="first-posting">
        <h2>{content.sections.posting.heading}</h2>
        <p>{content.sections.posting.intro}</p>
        <h3>{content.sections.posting.promptTitle}</h3>
        <pre>{content.sections.posting.prompt}</pre>
        <p>{content.sections.posting.description}</p>
        <p className="mt-6">{content.sections.posting.outro}</p>
      </section>
    </DocsPageLayout>
  );
}
