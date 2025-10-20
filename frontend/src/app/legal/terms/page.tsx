import { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: '이용약관 | DevLog',
  description: 'DevLog 서비스 이용약관을 확인하세요.',
};

/**
 * 이용약관 페이지
 */
export default function TermsPage() {
  return (
    <LegalPageLayout
      title={{
        ko: '이용약관',
        en: 'Terms of Service',
      }}
      documentType="terms-of-service"
    />
  );
}
