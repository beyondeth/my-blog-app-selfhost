import { translate } from '@/lib/i18n/messages';
import type { AppLocale } from '@/lib/i18n/config';

export type LegalDocumentType =
  | 'privacy-policy'
  | 'terms-of-service'
  | 'community-guidelines'
  | 'marketing-consent'
  | 'newsletter-consent';

const titleKeyMap: Record<LegalDocumentType, string> = {
  'privacy-policy': 'legal.privacyTitle',
  'terms-of-service': 'legal.termsTitle',
  'community-guidelines': 'legal.guidelinesTitle',
  'marketing-consent': 'legal.marketingTitle',
  'newsletter-consent': 'legal.newsletterTitle',
};

const descriptionKeyMap: Record<LegalDocumentType, string> = {
  'privacy-policy': 'legal.privacyDescription',
  'terms-of-service': 'legal.termsDescription',
  'community-guidelines': 'legal.guidelinesDescription',
  'marketing-consent': 'legal.marketingDescription',
  'newsletter-consent': 'legal.newsletterDescription',
};

export function getLegalCopy(locale: AppLocale, documentType: LegalDocumentType) {
  return {
    title: translate(locale, titleKeyMap[documentType]),
    description: translate(locale, descriptionKeyMap[documentType]),
  };
}
