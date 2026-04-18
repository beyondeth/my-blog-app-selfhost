"use client";

import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  threshold?: number;        // 교차 비율 (0~1)
  rootMargin?: string;       // 관찰 영역 확장
  root?: Element | null;     // 관찰 기준 루트
  enabled?: boolean;         // 스크롤 활성화 여부
  onLoadMore: () => void;    // 다음 페이지 로드 콜백
  hasMore?: boolean;         // 더 로드할 콘텐츠 여부
  loading?: boolean;         // 현재 로딩 상태
  cooldownMs?: number;       // 연속 호출 방지 쿨다운
}

export function useInfiniteScroll({
  threshold = 0.8,
  rootMargin = '200px',
  root = null,
  enabled = true,
  onLoadMore,
  hasMore = false,
  loading = false,
  cooldownMs = 400,
}: UseInfiniteScrollOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const lastTriggerTimeRef = useRef(0);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      
      // 타겟이 보이고, 더 로드할 수 있고, 현재 로딩 중이 아닐 때
      if (target.isIntersecting && hasMore && !loadingRef.current) {
        const now = performance.now();
        if (now - lastTriggerTimeRef.current < cooldownMs) {
          return;
        }
        lastTriggerTimeRef.current = now;
        loadingRef.current = true;
        onLoadMore();
      }
    },
    [hasMore, onLoadMore, cooldownMs]
  );

  // 로딩 상태 동기화
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    // Observer 생성
    if (enabled && hasMore && !loading) {
      observerRef.current = new IntersectionObserver(handleIntersect, {
        root,
        threshold,
        rootMargin,
      });

      // 타겟 요소 관찰 시작
      if (targetRef.current) {
        observerRef.current.observe(targetRef.current);
      }
    }

    // 클린업
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [enabled, hasMore, loading, threshold, rootMargin, root, handleIntersect]);

  // 수동으로 타겟 요소 설정하는 콜백
  const setTargetRef = useCallback((node: HTMLDivElement | null) => {
    // 이전 관찰 해제
    if (observerRef.current && targetRef.current) {
      observerRef.current.unobserve(targetRef.current);
    }

    targetRef.current = node;

    // 새 요소 관찰
    if (observerRef.current && node) {
      observerRef.current.observe(node);
    }
  }, []);

  return {
    targetRef: setTargetRef,
    isObserving: !!observerRef.current,
  };
}

// 스크롤 위치 복원을 위한 훅
interface UseScrollRestorationOptions {
  scrollElement?: HTMLElement | null;
}

export function useScrollRestoration(
  key: string,
  options: UseScrollRestorationOptions = {},
) {
  const { scrollElement = null } = options;
  const scrollPositionRef = useRef(0);
  const storageKey = `scroll-${key}`;

  // 스크롤 위치 저장
  const saveScrollPosition = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextPosition = scrollElement ? scrollElement.scrollTop : window.scrollY;
    scrollPositionRef.current = nextPosition;
    sessionStorage.setItem(storageKey, String(nextPosition));
  }, [scrollElement, storageKey]);

  // 스크롤 위치 복원
  const restoreScrollPosition = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const savedPosition = sessionStorage.getItem(storageKey);
    if (savedPosition) {
      const nextTop = parseInt(savedPosition, 10);
      requestAnimationFrame(() => {
        if (scrollElement) {
          scrollElement.scrollTo({ top: nextTop, behavior: 'auto' });
          return;
        }
        window.scrollTo(0, nextTop);
      });
    }
  }, [scrollElement, storageKey]);

  useEffect(() => {
    // 페이지 로드 시 스크롤 위치 복원
    restoreScrollPosition();

    // 페이지 떠날 때 스크롤 위치 저장
    window.addEventListener('beforeunload', saveScrollPosition);
    window.addEventListener('pagehide', saveScrollPosition);

    if (scrollElement) {
      scrollElement.addEventListener('scroll', saveScrollPosition, { passive: true });
    } else {
      window.addEventListener('scroll', saveScrollPosition, { passive: true });
    }
    
    return () => {
      saveScrollPosition();
      window.removeEventListener('beforeunload', saveScrollPosition);
      window.removeEventListener('pagehide', saveScrollPosition);

      if (scrollElement) {
        scrollElement.removeEventListener('scroll', saveScrollPosition);
      } else {
        window.removeEventListener('scroll', saveScrollPosition);
      }
    };
  }, [saveScrollPosition, restoreScrollPosition, scrollElement]);

  return {
    saveScrollPosition,
    restoreScrollPosition,
  };
}
