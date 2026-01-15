'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { ArrowLeft } from 'lucide-react';
import { getLegalFilePath, LEGAL_VERSIONS } from '@/constants/legalVersions';

interface LegalPageLayoutProps {
  title: string;
  documentType: 'terms-of-service' | 'privacy-policy' | 'community-guidelines' | 'marketing-consent' | 'newsletter-consent';
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
 * 법적 문서 페이지 공통 레이아웃 컴포넌트
 *
 * 버전 관리된 주요 문서(privacy, terms, guidelines, marketing)는 /public/legal/ko 에서 직접 로드하여
 * CDN 캐싱 최적화 및 API 부하 제거. 파일명에 버전 포함으로 자동 캐시 무효화.
 *
 * 한국어 문서만 지원.
 */
export default function LegalPageLayout({ title, documentType }: LegalPageLayoutProps) {
  const router = useRouter();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isFromAuth, setIsFromAuth] = useState(false);
  const [authPathname, setAuthPathname] = useState<string>('');

  // 인증 페이지에서 왔는지 확인
  useEffect(() => {
    const fromAuth = sessionStorage.getItem('from-auth') === 'true';
    const pathname = sessionStorage.getItem('auth-pathname') || '/login';
    setIsFromAuth(fromAuth);
    setAuthPathname(pathname);
  }, []);

  // Markdown 파일 로드 (버전 관리된 정적 파일, 한국어만 지원)
  useEffect(() => {
    const loadDocument = async () => {
      setLoading(true);
      try {
        // 버전 키 가져오기
        const versionKey = getVersionKey(documentType);

        if (!versionKey) {
          // 지원하지 않는 문서 타입
          throw new Error('Unsupported document type');
        }

        // 버전 관리 시스템: /public/legal/ko 에서 직접 로드
        const filePath = getLegalFilePath(versionKey, 'ko');
        const response = await fetch(filePath);

        if (!response.ok) {
          throw new Error('Failed to load document');
        }

        const markdown = await response.text();
        setContent(markdown);
      } catch (error) {
        console.error('Error loading legal document:', error);
        setContent(`# 오류\n\n문서를 불러오는데 실패했습니다. 나중에 다시 시도해주세요.`);
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [documentType]);

  return (
    <div className="min-h-screen bg-background dark:bg-[#0E141B]">
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
          <h1 className="text-4xl font-bold text-foreground">
            {title}
          </h1>
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
