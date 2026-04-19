import type { Metadata } from 'next';
import Link from 'next/link';
import DocsPageLayout from '@/components/public-site/DocsPageLayout';

export const metadata: Metadata = {
  title: 'Publishing Flow',
  description: 'User-facing guide to the current inputs, constraints, and publishing sequence in Codebase auto-publishing.',
  alternates: {
    canonical: '/docs/publishing-flow',
  },
};

const toc = [
  { id: 'capture', label: '1. Prepare context' },
  { id: 'compile', label: '2. Choose a style' },
  { id: 'publish', label: '3. Publish request' },
  { id: 'checklist', label: 'Pre-flight checklist' },
];

export default function PublishingFlowPage() {
  return (
    <DocsPageLayout
      currentPath="/docs/publishing-flow"
      title="Publishing Flow"
      description="Auto-publishing works by preparing context, selecting a writing style, and sending an MCP `create_post` request. This page covers only the behavior that exists in the current user guide."
      toc={toc}
      eyebrow="Documentation"
    >
      <section id="capture">
        <h2>1. Prepare context</h2>
        <p>
          The first step is bringing the material you want to publish into the client conversation. In the hosted MCP flow,
          this starts by passing the context directly into the chat, not by turning on a separate local watcher pipeline.
        </p>
        <ul className="mt-6 space-y-3">
          <li>Code diffs and review notes</li>
          <li>Meeting or chat summaries</li>
          <li>Technical notes and work logs</li>
        </ul>
      </section>

      <section id="compile">
        <h2>2. Choose a style</h2>
        <p>
          Standard posts use one of the eight preset flags. The selected flag changes the writing guide,
          and the client uses that guide to generate Markdown in the right shape.
        </p>
        <p className="mt-6">
          You can review the preset list in <Link href="/docs/writing-styles">Writing Styles</Link>.
        </p>
        <p className="mt-6">
          To register a digital product in the marketplace, use <code>--sell</code> explicitly instead of a standard preset.
          That mode requires a price and a product category.
        </p>
      </section>

      <section id="publish">
        <h2>3. Publish request</h2>
        <p>
          The final publish step runs through the MCP <code>create_post</code> request. In the current implementation,
          the core fields are <code>title</code>, <code>content_markdown</code>, <code>category</code>,
          <code>tags</code>, and optional <code>visibility</code>.
        </p>
        <ul className="mt-6 space-y-3">
          <li><strong>Standard publish</strong>: creates a blog post and applies up to 10 tags.</li>
          <li><strong>Visibility</strong>: even if a post requests public visibility, it stays private when the blog itself is private.</li>
          <li><strong>Marketplace product</strong>: using <code>--sell</code> sends a price and product category and registers the content as a marketplace product.</li>
          <li><strong>Post-processing</strong>: published Markdown automatically receives an AI disclosure footer.</li>
        </ul>
      </section>

      <section id="checklist">
        <h2>Pre-flight checklist</h2>
        <p>Checking the items below before publishing prevents most failures.</p>
        <ul className="mt-6 space-y-3">
          <li>Confirm the current key is active in settings, and restart the client after connecting.</li>
          <li>Make sure `title`, `category`, and `content_markdown` are all ready.</li>
          <li>For standard posts, use a real preset flag such as <code>--default</code>, <code>--pm</code>, or <code>--research</code>.</li>
          <li>Use <code>--sell</code> only for marketplace products.</li>
          <li>Send no more than 10 tags, and remember that public publishing only becomes public when the blog itself is public.</li>
        </ul>
      </section>
    </DocsPageLayout>
  );
}
