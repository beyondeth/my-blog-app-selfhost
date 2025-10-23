"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { DarkModeIcon } from "@/components/icons/DarkModeIcon";
import { LightModeIcon } from "@/components/icons/LightModeIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
 * 심플한 테마 전환 버튼 컴포넌트
 * 다크모드 ↔ 라이트모드 전환
 * - 다크모드일 때: 태양 아이콘 표시 (라이트모드로 전환)
 * - 라이트모드일 때: 달 아이콘 표시 (다크모드로 전환)
 * - View Transition API로 부드러운 전환 효과 (최신 브라우저)
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
      <div className="w-10 h-10 rounded-md bg-muted animate-pulse" />
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
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleThemeToggle}
            className="p-2 rounded-full border border-transparent text-foreground hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
          >
            {isDark ? (
              <LightModeIcon size={20} className="transition-transform hover:rotate-45" />
            ) : (
              <DarkModeIcon size={20} className="transition-transform hover:-rotate-12" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={5}>
          <p className="text-sm">{isDark ? "라이트 모드" : "다크 모드"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}