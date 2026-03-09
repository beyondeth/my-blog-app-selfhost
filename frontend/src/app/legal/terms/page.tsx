import { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: '이용약관 | Codebase.blog',
  description: 'Codebase.blog 서비스 이용약관을 확인하세요.',
};

/**
 * 이용약관 페이지
 */
export default function TermsPage() {
  return (
    <LegalPageLayout
      title="이용약관"
      documentType="terms-of-service"
    />
  );
}
