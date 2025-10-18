import { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: '사용자명 정책 | Codebase.blog',
  description: 'Codebase.blog 사용자명 정책을 확인하세요.',
};

/**
 * 사용자명 정책 페이지
 */
export default function UsernamePolicyPage() {
  return (
    <LegalPageLayout
      title={{
        ko: '사용자명 정책',
        en: 'Username Policy',
      }}
      documentType="username-policy"
    />
  );
}
