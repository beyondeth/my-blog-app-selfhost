"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { DarkModeIcon } from "@/components/icons/DarkModeIcon";
import { LightModeIcon } from "@/components/icons/LightModeIcon";

/**
 * 심플한 테마 전환 버튼 컴포넌트
 * 다크모드 ↔ 라이트모드 전환
 * - 다크모드일 때: 태양 아이콘 표시 (라이트모드로 전환)
 * - 라이트모드일 때: 달 아이콘 표시 (다크모드로 전환)
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

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`${isDark ? "라이트" : "다크"} 모드로 전환`}
    >
      {isDark ? (
        <LightModeIcon size={24} className="transition-transform duration-200 hover:rotate-45" />
      ) : (
        <DarkModeIcon size={24} className="transition-transform duration-200 hover:-rotate-12" />
      )}
    </button>
  );
}