'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LanguageToggle from './LanguageToggle';
import MarkdownRenderer from './MarkdownRenderer';
import { ArrowLeft } from 'lucide-react';

interface LegalPageLayoutProps {
  title: {
    ko: string;
    en: string;
  };
  documentType: 'terms-of-service' | 'privacy-policy' | 'community-guidelines' | 'pro-terms' | 'partner-program' | 'username-policy' | 'marketing-consent';
}

/**
 * 법적 문서 페이지 공통 레이아웃 컴포넌트
 * Markdown 파일을 동적으로 로드하여 렌더링
 */
export default function LegalPageLayout({ title, documentType }: LegalPageLayoutProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'ko' | 'en'>('ko');
  const [isFromAuth, setIsFromAuth] = useState(false);
  const [authPathname, setAuthPathname] = useState<string>('');

  // 인증 페이지에서 왔는지 확인
  useEffect(() => {
    const fromAuth = sessionStorage.getItem('from-auth') === 'true';
    const pathname = sessionStorage.getItem('auth-pathname') || '/login';
    setIsFromAuth(fromAuth);
    setAuthPathname(pathname);
  }, []);

  // 언어 설정
  useEffect(() => {
    const urlLang = searchParams.get('lang');
    const storedLang = typeof window !== 'undefined' ? localStorage.getItem('preferred-lang') : null;
    const initialLang = (urlLang || storedLang || 'ko') as 'ko' | 'en';
    setLang(initialLang);
  }, [searchParams]);

  // Markdown 파일 로드
  useEffect(() => {
    const loadDocument = async () => {
      setLoading(true);
      try {
        // 백엔드 API 또는 public 폴더에서 Markdown 파일 로드
        const response = await fetch(`/api/legal/${documentType}?lang=${lang}`);

        if (!response.ok) {
          throw new Error('Failed to load document');
        }

        const markdown = await response.text();
        setContent(markdown);
      } catch (error) {
        console.error('Error loading legal document:', error);
        setContent(`# Error\n\nFailed to load the document. Please try again later.`);
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [documentType, lang]);

  return (
    <div className="min-h-screen bg-background">
      {/* 왼쪽 사이드바(80px) 고려한 중앙 정렬 컨테이너 */}
      <div className="mx-auto max-w-4xl px-4 py-12 lg:ml-32">
        {/* 인증 페이지에서 온 경우 뒤로가기 버튼 표시 */}
        {isFromAuth && (
          <button
            onClick={() => router.push(authPathname)}
            className="mb-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            뒤로가기
          </button>
        )}

        {/* 헤더 */}
        <div className="mb-8 border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-bold text-foreground">
              {lang === 'ko' ? title.ko : title.en}
            </h1>
            <LanguageToggle />
          </div>
        </div>

        {/* 본문 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100"></div>
          </div>
        ) : (
          <MarkdownRenderer content={content} />
        )}

        {/* Back to Top 버튼 */}
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
            맨 위로
          </button>
        </div>
      </div>
    </div>
  );
}
