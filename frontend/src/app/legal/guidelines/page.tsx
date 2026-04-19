import { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import { getRequestLocale } from '@/lib/i18n/server';
import { getLegalCopy } from '@/lib/legal';
import { getLegalPageMetadata } from '../_shared';

export async function generateMetadata(): Promise<Metadata> {
  return getLegalPageMetadata('community-guidelines');
}

/**
 * 커뮤니티 가이드라인 페이지
 */
export default async function GuidelinesPage() {
  const locale = await getRequestLocale();
  const copy = getLegalCopy(locale, 'community-guidelines');

  return (
    <LegalPageLayout
      title={copy.title}
      documentType="community-guidelines"
    />
  );
}
