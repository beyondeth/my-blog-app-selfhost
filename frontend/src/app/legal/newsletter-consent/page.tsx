import { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: '뉴스레터 수신 동의 | Codebase.blog',
  description: 'Codebase.blog 뉴스레터 수신 동의 및 이용에 관한 내용을 확인하세요.',
};

/**
 * 뉴스레터 수신 동의 페이지
 * 회원가입 및 설정 페이지에서 참조하는 뉴스레터 수신 동의 관련 법적 문서
 */
export default function NewsletterConsentPage() {
  return (
    <LegalPageLayout
      title="뉴스레터 수신 동의"
      documentType="newsletter-consent"
    />
  );
}
