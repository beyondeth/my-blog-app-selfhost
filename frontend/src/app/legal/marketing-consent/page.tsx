import { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import { getRequestLocale } from '@/lib/i18n/server';
import { getLegalCopy } from '@/lib/legal';
import { getLegalPageMetadata } from '../_shared';

export async function generateMetadata(): Promise<Metadata> {
  return getLegalPageMetadata('marketing-consent');
}

/**
 * 마케팅 정보 수신 동의 페이지
 * 회원가입 및 설정 페이지에서 참조하는 마케팅 정보 수신 동의 관련 법적 문서
 */
export default async function MarketingConsentPage() {
  const locale = await getRequestLocale();
  const copy = getLegalCopy(locale, 'marketing-consent');

  return (
    <LegalPageLayout
      title={copy.title}
      documentType="marketing-consent"
    />
  );
}
