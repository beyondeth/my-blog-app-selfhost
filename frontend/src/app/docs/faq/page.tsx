import type { Metadata } from 'next';
import Link from 'next/link';
import DocsPageLayout from '@/components/public-site/DocsPageLayout';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers to the most common questions about Codebase connections, limits, and usage policies.',
  alternates: {
    canonical: '/docs/faq',
  },
};

const toc = [
  { id: 'rate-limits', label: 'Limits & billing' },
  { id: 'data-privacy', label: 'Data & storage' },
  { id: 'technical', label: 'Technical issues' },
];

export default function FaqPage() {
  return (
    <DocsPageLayout
      currentPath="/docs/faq"
      title="FAQ"
      description="The most common questions about connection setup, API keys, limits, and data handling."
      toc={toc}
      eyebrow="Documentation"
    >
      <section id="rate-limits">
        <h2>Limits &amp; billing</h2>

        <h3>How do the plan limits differ?</h3>
        <p>
          The current implementation uses two layers of limits. First, the MCP endpoint has request-protection limits to block rapid retries
          (20 per minute, 30 per hour, and 50 per day). Second, auto-publishing has a monthly quota:
          Free supports 30 posts, Starter supports 200, and Pro supports 400.
        </p>

        <h3>What should I check first if publishing stops working?</h3>
        <p>
          If you called the endpoint repeatedly in a short window, you may have hit the request-protection limit. If you already used the full monthly post volume,
          you may have reached your plan quota. Check `settings/billing` and the API key usage state first, then wait for the next cycle or move to a higher plan if needed.
        </p>
      </section>

      <section id="data-privacy">
        <h2>Data &amp; storage</h2>

        <h3>What does Codebase store?</h3>
        <p>
          Codebase stores the data required to operate the service, including published post content, post metadata, API key metadata, and usage metrics.
          How full source conversations are stored depends on the policy of each AI client or provider you use upstream.
        </p>
      </section>

      <section id="technical">
        <h2>Technical issues</h2>

        <h3>The MCP server does not appear in my client.</h3>
        <p>
          The most common causes are an incorrect endpoint URL, an expired API key, or skipping the client restart after changing the configuration.
          Since each client uses a different config format, the fastest fix is usually to recopy the snippet for the exact tool you are using.
        </p>
        <p className="mt-4">
          <Link href="/settings/api-keys">Open the auto-publishing connection screen</Link>
        </p>

        <h3>Can I review or replace an API key?</h3>
        <p>
          Yes. You can copy an active key again from settings, and if a key expired or you want to rotate it, issue a new key and replace the existing client configuration.
        </p>
      </section>
    </DocsPageLayout>
  );
}
