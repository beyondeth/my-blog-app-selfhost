import { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import { getRequestLocale } from '@/lib/i18n/server';
import { getLegalCopy } from '@/lib/legal';
import { getLegalPageMetadata } from '../_shared';

export async function generateMetadata(): Promise<Metadata> {
  return getLegalPageMetadata('newsletter-consent');
}

/**
 * 뉴스레터 수신 동의 페이지
 * 회원가입 및 설정 페이지에서 참조하는 뉴스레터 수신 동의 관련 법적 문서
 */
export default async function NewsletterConsentPage() {
  const locale = await getRequestLocale();
  const copy = getLegalCopy(locale, 'newsletter-consent');

  return (
    <LegalPageLayout
      title={copy.title}
      documentType="newsletter-consent"
    />
  );
}
