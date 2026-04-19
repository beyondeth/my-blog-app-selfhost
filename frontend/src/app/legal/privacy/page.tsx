import { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import { getRequestLocale } from '@/lib/i18n/server';
import { getLegalCopy } from '@/lib/legal';
import { getLegalPageMetadata } from '../_shared';

export async function generateMetadata(): Promise<Metadata> {
  return getLegalPageMetadata('privacy-policy');
}

/**
 * 개인정보처리방침 페이지
 */
export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  const copy = getLegalCopy(locale, 'privacy-policy');

  return (
    <LegalPageLayout
      title={copy.title}
      documentType="privacy-policy"
    />
  );
}
