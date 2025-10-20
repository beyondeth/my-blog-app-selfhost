import { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: '파트너 프로그램 약관 | Codebase.blog',
  description: 'Codebase.blog 파트너 프로그램 약관을 확인하세요.',
};

/**
 * 파트너 프로그램 약관 페이지
 */
export default function PartnerPage() {
  return (
    <LegalPageLayout
      title={{
        ko: '파트너 프로그램 약관',
        en: 'Partner Program Terms',
      }}
      documentType="partner-program"
    />
  );
}
