import type { Metadata } from 'next';
import { getRequestLocale } from '@/lib/i18n/server';
import { getLegalCopy, type LegalDocumentType } from '@/lib/legal';

export async function getLegalPageMetadata(documentType: LegalDocumentType): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = getLegalCopy(locale, documentType);

  return {
    title: `${copy.title} | Codebase`,
    description: copy.description,
  };
}
