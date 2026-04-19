'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { ArrowLeft } from 'lucide-react';
import { getLegalFilePath, LEGAL_VERSIONS } from '@/constants/legalVersions';
import { useLocaleContext } from '@/providers/LocaleProvider';
import type { LegalDocumentType } from '@/lib/legal';

interface LegalPageLayoutProps {
  title: string;
  documentType: LegalDocumentType;
}

/**
 * documentType을 LEGAL_VERSIONS 키로 변환
 */
function getVersionKey(documentType: string): keyof typeof LEGAL_VERSIONS | null {
  switch (documentType) {
    case 'privacy-policy':
      return 'PRIVACY';
    case 'terms-of-service':
      return 'TERMS';
    case 'community-guidelines':
      return 'GUIDELINES';
    case 'marketing-consent':
      return 'MARKETING';
    case 'newsletter-consent':
      return 'NEWSLETTER';
    default:
      return null;
  }
}

/**
 * Shared layout for versioned legal documents.
 */
export default function LegalPageLayout({ title, documentType }: LegalPageLayoutProps) {
  const router = useRouter();
  const { t } = useLocaleContext();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isFromAuth, setIsFromAuth] = useState(false);
  const [authPathname, setAuthPathname] = useState<string>('');

  useEffect(() => {
    const fromAuth = sessionStorage.getItem('from-auth') === 'true';
    const pathname = sessionStorage.getItem('auth-pathname') || '/login';
    setIsFromAuth(fromAuth);
    setAuthPathname(pathname);
  }, []);

  useEffect(() => {
    const loadDocument = async () => {
      setLoading(true);
      try {
        const versionKey = getVersionKey(documentType);

        if (!versionKey) {
          throw new Error('Unsupported document type');
        }

        const filePath = getLegalFilePath(versionKey, 'en');
        const response = await fetch(filePath);

        if (!response.ok) {
          throw new Error('Failed to load document');
        }

        const markdown = await response.text();
        setContent(markdown);
      } catch (error) {
        console.error('Error loading legal document:', error);
        setContent(`# Error\n\n${t('legal.loadError')}`);
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [documentType, t]);

  return (
    <div className="min-h-screen bg-background dark:bg-[#0E141B]">
      <div className="mx-auto max-w-4xl px-4 py-12 lg:ml-32">
        {isFromAuth && (
          <button
            onClick={() => router.push(authPathname)}
            className="mb-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </button>
        )}

        <div className="mb-8 border-b border-border pb-6">
          <h1 className="text-4xl font-bold text-foreground">
            {title}
          </h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100"></div>
          </div>
        ) : (
          <MarkdownRenderer content={content} />
        )}

        <div className="mt-12 text-center">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 15.75l7.5-7.5 7.5 7.5"
              />
            </svg>
            {t('legal.backToTop')}
          </button>
        </div>
      </div>
    </div>
  );
}
