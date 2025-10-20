import { useState, useEffect, useCallback } from 'react';
import { Theme } from '@/types';

/**
 * @deprecated 이 hook은 더 이상 사용되지 않습니다.
 * 대신 next-themes의 useTheme을 사용하세요:
 * import { useTheme } from "next-themes";
 *
 * 현재 프로젝트는 next-themes를 사용하여 테마를 관리합니다.
 * 이 파일은 하위 호환성을 위해 유지되지만, 새로운 코드에서는 사용하지 마세요.
 */

const THEME_STORAGE_KEY = 'theme';
const VALID_THEMES: Theme[] = ['light', 'dark'];

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');
  const [isInitialized, setIsInitialized] = useState(false);

  // 초기 테마 설정 (한 번만 실행)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
      
      if (savedTheme && VALID_THEMES.includes(savedTheme)) {
      setTheme(savedTheme);
    } else {
      // 시스템 테마 감지
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      setTheme(systemTheme);
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error);
      setTheme('light'); // 폴백
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // 테마 변경 시 DOM 적용 (초기화 후에만)
  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return;
    
    try {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn('Failed to apply theme:', error);
    }
  }, [theme, isInitialized]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  return { theme, toggleTheme, isInitialized };
} 