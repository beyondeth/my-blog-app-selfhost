import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support',
  description: 'Codebase support page for docs-linked troubleshooting, feedback, and policy references.',
  alternates: {
    canonical: '/support',
  },
};

/**
 * 고객센터 레이아웃
 */
export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
