import { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: '커뮤니티 가이드라인 | Aigory',
  description: 'Aigory의 커뮤니티 운영 기준을 확인하세요.',
};

/**
 * 커뮤니티 가이드라인 페이지
 */
export default function GuidelinesPage() {
  return (
    <LegalPageLayout
      title="커뮤니티 가이드라인"
      documentType="community-guidelines"
    />
  );
}
