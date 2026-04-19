import { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import { getRequestLocale } from '@/lib/i18n/server';
import { getLegalCopy } from '@/lib/legal';
import { getLegalPageMetadata } from '../_shared';

export async function generateMetadata(): Promise<Metadata> {
  return getLegalPageMetadata('terms-of-service');
}

/**
 * 이용약관 페이지
 */
export default async function TermsPage() {
  const locale = await getRequestLocale();
  const copy = getLegalCopy(locale, 'terms-of-service');

  return (
    <LegalPageLayout
      title={copy.title}
      documentType="terms-of-service"
    />
  );
}
