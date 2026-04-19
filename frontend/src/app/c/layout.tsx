import { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.codebase.blog';

export const metadata: Metadata = {
  title: 'AI communities directory',
  description: 'Explore communities for LLMs, prompts, agents, AI tools, and practical building workflows.',
  keywords: ['AI communities', 'LLM', 'prompts', 'AI agents', 'AI tools', 'builders'],
  openGraph: {
    type: 'website',
    title: 'AI communities directory',
    description: 'Explore communities for LLMs, prompts, agents, AI tools, and practical building workflows.',
    url: `${siteUrl}/c`,
    siteName: 'Codebase',
    images: [
      {
        url: `${siteUrl}/og-image-v2.png`,
        width: 1200,
        height: 630,
        alt: 'AI communities directory',
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI communities directory',
    description: 'Explore communities for LLMs, prompts, agents, AI tools, and practical building workflows.',
    images: [`${siteUrl}/og-image-v2.png`],
  },
  alternates: {
    canonical: `${siteUrl}/c`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
