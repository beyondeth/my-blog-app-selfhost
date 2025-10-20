import { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: '개인정보처리방침 | DevLog',
  description: 'DevLog 개인정보 수집 및 이용에 관한 방침을 확인하세요.',
};

/**
 * 개인정보처리방침 페이지
 */
export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title={{
        ko: '개인정보처리방침',
        en: 'Privacy Policy',
      }}
      documentType="privacy-policy"
    />
  );
}
