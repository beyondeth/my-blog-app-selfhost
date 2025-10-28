import { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: '마케팅 정보 수신 동의 | DevLog',
  description: 'DevLog 마케팅 정보 수신 동의 및 이용에 관한 내용을 확인하세요.',
};

/**
 * 마케팅 정보 수신 동의 페이지
 * 회원가입 및 설정 페이지에서 참조하는 마케팅 정보 수신 동의 관련 법적 문서
 */
export default function MarketingConsentPage() {
  return (
    <LegalPageLayout
      title="마케팅 정보 수신 동의"
      documentType="marketing-consent"
    />
  );
}
