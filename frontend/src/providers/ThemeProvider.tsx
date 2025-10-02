"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

/**
 * 테마 프로바이더 컴포넌트
 * next-themes를 사용하여 다크/라이트 모드 전환 기능 제공
 *
 * @param children - 하위 컴포넌트
 * @param props - next-themes ThemeProviderProps
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}