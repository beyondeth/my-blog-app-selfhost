"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * 테마 드롭다운 컴포넌트
 * 라이트, 다크, 시스템 테마를 선택할 수 있는 드롭다운 메뉴
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
        className="p-2 rounded-lg transition-colors hover:bg-muted"
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

  return (
    <div className="relative theme-dropdown">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg transition-colors hover:bg-muted"
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
              onClick={() => {
                setTheme(value);
                setIsOpen(false);
              }}
              className={`
                flex w-full items-center gap-2 px-3 py-2 text-sm
                transition-colors hover:bg-muted
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