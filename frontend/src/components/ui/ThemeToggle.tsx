"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * 테마 토글 컴포넌트
 * 라이트/다크 모드 전환을 위한 토글 버튼
 * 시스템 테마 설정도 지원
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
        className="p-2 rounded-lg transition-colors hover:bg-muted"
        aria-label="테마 토글"
      >
        <Sun className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg transition-colors hover:bg-muted"
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