import { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: '커뮤니티 가이드라인 | DevLog',
  description: 'DevLog 커뮤니티 규칙과 가이드라인을 확인하세요.',
};

/**
 * 커뮤니티 가이드라인 페이지
 */
export default function GuidelinesPage() {
  return (
    <LegalPageLayout
      title={{
        ko: '커뮤니티 가이드라인',
        en: 'Community Guidelines',
      }}
      documentType="community-guidelines"
    />
  );
}
