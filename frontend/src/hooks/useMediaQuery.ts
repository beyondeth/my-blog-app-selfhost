import { useState, useEffect } from 'react';

/**
 * 미디어 쿼리 매칭 여부를 감지하는 Hook
 *
 * @param query - CSS 미디어 쿼리 문자열 (예: '(max-width: 768px)')
 * @returns 미디어 쿼리 매칭 여부
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 768px)');
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 */
export function useMediaQuery(query: string): boolean {
  // SSR 환경에서 false 반환
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // 클라이언트 환경에서만 실행
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(query);

    // 초기값 설정
    setMatches(mediaQuery.matches);

    // 미디어 쿼리 변경 감지
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // 리스너 등록
    mediaQuery.addEventListener('change', handleChange);

    // 클린업
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}
