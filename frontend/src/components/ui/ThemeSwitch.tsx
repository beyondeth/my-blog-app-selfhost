"use client";

import * as React from "react";
import { useTheme } from "next-themes";

/**
 * View Transition API를 사용한 부드러운 테마 전환
 * Chrome 111+, Edge 111+ 지원
 * 하위 호환성: 미지원 브라우저에서는 즉시 전환
 */
const startViewTransition = (callback: () => void) => {
  // View Transition API 지원 확인
  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    // @ts-ignore - View Transition API는 아직 TypeScript 타입이 완전하지 않음
    document.startViewTransition(callback);
  } else {
    // 미지원 브라우저: 즉시 실행
    callback();
  }
};

/**
 * 테마 전환 시 모든 transition을 일시적으로 비활성화
 * 모든 UI 요소가 동시에 변경되도록 보장
 */
const disableTransitionsTemporarily = (callback: () => void) => {
  if (typeof document === 'undefined') {
    callback();
    return;
  }

  // 1. body에 no-transition 클래스 추가 (모든 transition 비활성화)
  document.body.classList.add('no-transition');

  // 2. 테마 변경 실행
  callback();

  // 3. 다음 프레임에서 no-transition 제거 (transition 재활성화)
  // 두 번의 requestAnimationFrame으로 브라우저 렌더링 완료 보장
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.remove('no-transition');
    });
  });
};

/**
 * 심플하고 세련된 테마 전환 버튼
 * - 커스텀 SVG 아이콘 (날씬한 초승달)
 * - 원형 버튼 디자인
 */
export function ThemeSwitch() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // 마운트 전에는 placeholder 표시
  if (!mounted) {
    return (
      <div className="h-8 w-8 rounded-full border border-[#D9E0EA] bg-white/70 animate-pulse dark:border-[#2A3645] dark:bg-[#131A22]" />
    );
  }

  const isDark = resolvedTheme === "dark";

  /**
   * 테마 전환 핸들러
   * 1. 모든 transition 일시 비활성화 (순차적 변경 방지)
   * 2. View Transition API로 부드러운 전환 (최신 브라우저)
   */
  const handleThemeToggle = () => {
    const newTheme = isDark ? "light" : "dark";

    // 모든 transition을 비활성화하고 테마 변경
    disableTransitionsTemporarily(() => {
      // View Transition API 사용 (지원하는 브라우저에서만)
      startViewTransition(() => {
        setTheme(newTheme);
      });
    });
  };

  return (
    <button
      onClick={handleThemeToggle}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D9E0EA] bg-white text-[#1B2430] transition-colors hover:bg-[#F7F9FC] dark:border-[#2A3645] dark:bg-[#0E141B] dark:text-[#E6EDF3] dark:hover:bg-[#1A232E]"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? (
        // 해 아이콘 (stroke 스타일)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-[#A9B4C2]"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        // 날씬한 초승달 아이콘
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4 text-[#526477]"
        >
          <path d="M21.53 15.93c-.16-.27-.61-.69-1.73-.49a8.46 8.46 0 01-1.88.13 8.409 8.409 0 01-5.91-2.82 8.068 8.068 0 01-1.44-8.66c.44-1.01.13-1.54-.09-1.76s-.77-.55-1.83-.11a10.318 10.318 0 00-6.32 10.21 10.475 10.475 0 007.04 8.99 10 10 0 002.89.55c.16.01.32.02.48.02a10.5 10.5 0 008.47-4.27c.67-.93.49-1.519.32-1.79z" />
        </svg>
      )}
    </button>
  );
}
