"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
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
 * 테마 드롭다운 컴포넌트
 * 라이트, 다크, 시스템 테마를 선택할 수 있는 드롭다운 메뉴
 * View Transition API로 부드러운 전환 효과 (최신 브라우저)
 */
export function ThemeDropdown() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  // 클라이언트 사이드 마운트 확인
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // 드롭다운 외부 클릭시 닫기
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isOpen && !(event.target as Element).closest('.theme-dropdown')) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!mounted) {
    return (
      <button
        className="p-2 rounded-lg transition-interactive hover:bg-muted"
        aria-label="테마 선택"
      >
        <Sun className="h-5 w-5" />
      </button>
    );
  }

  const themes = [
    { value: 'light', label: '라이트', icon: Sun },
    { value: 'dark', label: '다크', icon: Moon },
    { value: 'system', label: '시스템', icon: Monitor },
  ];

  const CurrentIcon = themes.find(t => t.value === theme)?.icon || Sun;

  /**
   * 테마 변경 핸들러
   * 1. 모든 transition 일시 비활성화 (순차적 변경 방지)
   * 2. View Transition API로 부드러운 전환 (최신 브라우저)
   */
  const handleThemeChange = (value: string) => {
    // 모든 transition을 비활성화하고 테마 변경
    disableTransitionsTemporarily(() => {
      // View Transition API 사용 (지원하는 브라우저에서만)
      startViewTransition(() => {
        setTheme(value);
      });
    });
    setIsOpen(false);
  };

  return (
    <div className="relative theme-dropdown">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg transition-interactive hover:bg-muted"
        aria-label="테마 선택"
        aria-expanded={isOpen}
      >
        <CurrentIcon className="h-5 w-5 text-foreground" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-lg border bg-popover shadow-lg">
          {themes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => handleThemeChange(value)}
              className={`
                flex w-full items-center gap-2 px-3 py-2 text-sm
                transition-colors-interactive hover:bg-muted
                ${theme === value ? 'bg-muted' : ''}
                ${value === 'light' ? 'rounded-t-lg' : ''}
                ${value === 'system' ? 'rounded-b-lg' : ''}
              `}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {theme === value && (
                <span className="ml-auto text-xs">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}