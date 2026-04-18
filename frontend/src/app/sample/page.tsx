import type { Metadata } from 'next';
import AutoPostingSampleShell from '@/components/sample/AutoPostingSampleShell';

export const metadata: Metadata = {
  title: 'MCP Auto-posting Sample',
  description: '자동포스팅 결과물을 문서형으로 미리보기 위한 샘플 페이지',
  robots: {
    index: false,
    follow: false,
  },
};

export default function SamplePage() {
  return <AutoPostingSampleShell />;
}
