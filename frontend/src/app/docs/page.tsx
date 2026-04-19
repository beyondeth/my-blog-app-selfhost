import type { Metadata } from 'next';
import Link from 'next/link';
import DocsPageLayout from '@/components/public-site/DocsPageLayout';
const PAGE_CONTENT = {
  metadataDescription:
    'Learn how Codebase MCP connections and publishing flow work in the current production implementation.',
  title: 'Codebase Docs',
  description:
    'This guide reflects how the product works today. It follows the settings UI and the current server contract so you can understand the full flow from connection to publishing in one place.',
  toc: [
    { id: 'overview', label: 'Overview' },
    { id: 'setup-model', label: 'Current setup model' },
    { id: 'environment-guides', label: 'Environment guides' },
    { id: 'what-you-can-do', label: 'What you can do' },
  ],
  overview: {
    heading: 'Overview',
    body: (
      <>
        This document explains Codebase auto-publishing based on the <strong>current implementation</strong>.
        The primary source of truth is{' '}
        <Link href="/settings/api-keys">Settings &gt; Auto-publishing connection</Link>, and the docs are
        aligned to the configuration and server contract shown there.
      </>
    ),
  },
  setupModel: {
    heading: 'Current setup model',
    body: (
      <>
        The default public connection flow does not rely on a local proxy. Instead, it registers the
        <strong> Codebase hosted MCP endpoint</strong> directly in each client. Users create an API key and
        connect each environment with the matching setup flow.
      </>
    ),
    items: [
      '1. Create an API key in settings. You can keep up to 3 active keys at a time.',
      '2. Register https://mcp.codebase.blog/mcp in the client you use.',
      '3. Use a preset flag for standard publishing requests and --sell only for marketplace products.',
    ],
  },
  guides: {
    heading: 'Environment guides',
    body: (
      <>
        The guides are organized by environment. Web and app surfaces such as ChatGPT, Claude, and Perplexity are
        covered in <Link href="/docs/apps">Web &amp; App Connections</Link>, while MCP snippets and CLI or IDE
        policies stay aligned with the settings page and the reference docs.
      </>
    ),
  },
  capabilities: {
    heading: 'What you can do',
    body:
      'With the current connection model, you can do more than simple posting. You can also work with published posts and your personal knowledge surface.',
    items: [
      'Publish: create posts from a title, category, tags, and Markdown body.',
      'Visibility: if the blog is private, a post requested as public still remains private in practice.',
      'Readback: list published posts, inspect details, and query the knowledge manifest, knowledge nodes, and follow-up suggestions.',
    ],
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const content = PAGE_CONTENT;

  return {
    title: 'Documentation',
    description: content.metadataDescription,
    alternates: {
      canonical: '/docs',
    },
  };
}

export default async function DocsHomePage() {
  const content = PAGE_CONTENT;
  return (
    <DocsPageLayout
      currentPath="/docs"
      title={content.title}
      description={content.description}
      toc={[...content.toc]}
    >
      <section id="overview">
        <h2>{content.overview.heading}</h2>
        <p>{content.overview.body}</p>
      </section>

      <section id="setup-model">
        <h2>{content.setupModel.heading}</h2>
        <p>{content.setupModel.body}</p>
        <ol className="mt-6 space-y-3">
          {content.setupModel.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      <section id="environment-guides">
        <h2>{content.guides.heading}</h2>
        <p>{content.guides.body}</p>
      </section>

      <section id="what-you-can-do">
        <h2>{content.capabilities.heading}</h2>
        <p>{content.capabilities.body}</p>
        <ul className="mt-6 space-y-3">
          {content.capabilities.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </DocsPageLayout>
  );
}
