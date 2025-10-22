import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '고객센터 | DevLog',
  description: 'DevLog 고객센터 - 자주 묻는 질문, 법적 문서, 문의하기',
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
