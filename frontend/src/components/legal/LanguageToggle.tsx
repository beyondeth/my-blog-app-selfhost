'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * 언어 전환 토글 컴포넌트
 * 한국어(KO) ↔ 영어(EN) 전환
 */
export default function LanguageToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lang, setLang] = useState<'ko' | 'en'>('ko');

  // 초기 언어 설정 (URL 파라미터 > localStorage > 기본값)
  useEffect(() => {
    const urlLang = searchParams.get('lang');
    const storedLang = typeof window !== 'undefined' ? localStorage.getItem('preferred-lang') : null;

    const initialLang = (urlLang || storedLang || 'ko') as 'ko' | 'en';
    setLang(initialLang);
  }, [searchParams]);

  // 언어 전환 핸들러
  const handleToggle = () => {
    const newLang = lang === 'ko' ? 'en' : 'ko';
    setLang(newLang);

    // localStorage에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred-lang', newLang);
    }

    // URL 업데이트
    const currentPath = window.location.pathname;
    router.push(`${currentPath}?lang=${newLang}`);
  };

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      aria-label="언어 전환"
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
          d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802"
        />
      </svg>
      <span className="font-semibold">{lang === 'ko' ? 'KO' : 'EN'}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {lang === 'ko' ? '한국어' : 'English'}
      </span>
    </button>
  );
}
