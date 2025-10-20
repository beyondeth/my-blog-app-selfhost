"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
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
 * 테마 토글 컴포넌트
 * 라이트/다크 모드 전환을 위한 토글 버튼
 * View Transition API로 부드러운 전환 효과 (최신 브라우저)
 */
export function ThemeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // 클라이언트 사이드 마운트 확인 (hydration 오류 방지)
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // 서버 사이드에서는 기본 아이콘만 렌더링 (hydration 오류 방지)
    return (
      <button
        className="p-2 rounded-lg transition-interactive hover:bg-muted"
        aria-label="테마 토글"
      >
        <Sun className="h-5 w-5" />
      </button>
    );
  }

  /**
   * 테마 전환 핸들러
   * 1. 모든 transition 일시 비활성화 (순차적 변경 방지)
   * 2. View Transition API로 부드러운 전환 (최신 브라우저)
   */
  const handleThemeToggle = () => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";

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
      className="p-2 rounded-lg transition-interactive hover:bg-muted"
      aria-label={`${resolvedTheme === "dark" ? "라이트" : "다크"} 모드로 전환`}
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-5 w-5 text-foreground" />
      ) : (
        <Moon className="h-5 w-5 text-foreground" />
      )}
    </button>
  );
}