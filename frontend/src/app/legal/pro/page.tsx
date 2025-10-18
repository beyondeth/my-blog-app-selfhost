import { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: 'PRO 구독 약관 | Codebase.blog',
  description: 'Codebase.blog PRO 구독 서비스 약관을 확인하세요.',
};

/**
 * PRO 구독 약관 페이지
 */
export default function ProTermsPage() {
  return (
    <LegalPageLayout
      title={{
        ko: 'PRO 구독 약관',
        en: 'PRO Subscription Terms',
      }}
      documentType="pro-terms"
    />
  );
}
