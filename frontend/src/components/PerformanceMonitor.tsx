'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProviderV2';
import { authQueryKeys } from '@/lib/auth/queries';

/**
 * 성능 측정 컴포넌트
 * - TanStack Query 캐시 히트율
 * - 컴포넌트 리렌더링 횟수
 * - 네트워크 요청 횟수
 * - 응답 시간 측정
 * - 토글 가능 (localStorage에 상태 저장)
 */
export function PerformanceMonitor() {
  const queryClient = useQueryClient();
  const renderCount = useRef(0);
  const [mounted, setMounted] = useState(false);

  // 초기값은 항상 true로 설정 (서버와 클라이언트 일치)
  const [isOpen, setIsOpen] = useState(true);

  const [metrics, setMetrics] = useState({
    renderCount: 0,
    cacheHits: 0,
    networkRequests: 0,
    avgResponseTime: 0,
    memoryUsage: 0,
  });

  // 클라이언트에서 마운트된 후 localStorage에서 상태 로드
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('perfMonitorOpen');
    if (saved !== null) {
      setIsOpen(saved === 'true');
    }
  }, []);

  // 토글 함수 - localStorage에 상태 저장
  const toggleMonitor = () => {
    setIsOpen(prev => {
      const newState = !prev;
      localStorage.setItem('perfMonitorOpen', String(newState));
      return newState;
    });
  };

  // 리렌더링 카운트 - 컴포넌트가 실제로 렌더링될 때마다 증가
  renderCount.current++;

  // 캐시 상태 모니터링
  useEffect(() => {
    const interval = setInterval(() => {
      const queryCache = queryClient.getQueryCache();
      const queries = queryCache.getAll();

      let cacheHits = 0;
      let networkRequests = 0;

      queries.forEach(query => {
        if (query.state.dataUpdateCount > 0) {
          if (query.state.fetchStatus === 'idle') {
            cacheHits++;
          } else {
            networkRequests++;
          }
        }
      });

      // 메모리 사용량 (브라우저 지원시)
      const memoryUsage = (performance as any).memory?.usedJSHeapSize
        ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
        : 0;

      setMetrics(prev => ({
        ...prev,
        renderCount: renderCount.current,  // 현재 렌더 카운트 포함
        cacheHits,
        networkRequests,
        memoryUsage,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [queryClient]);

  // 개발 환경에서만 표시
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // 최소화된 상태: 작은 버튼만 표시
  if (!isOpen) {
    return (
      <button
        onClick={toggleMonitor}
        className="fixed bottom-4 right-4 bg-black text-white p-3 rounded-full shadow-lg text-sm font-mono z-50 opacity-90 hover:opacity-100 transition-opacity"
        title="성능 모니터 열기"
      >
        🚀
      </button>
    );
  }

  // 펼쳐진 상태: 전체 모니터 표시
  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg shadow-lg text-xs font-mono z-50 opacity-90 min-w-[200px]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold">🚀 Performance Monitor</h3>
        <button
          onClick={toggleMonitor}
          className="text-gray-400 hover:text-white transition-colors ml-2"
          title="최소화"
        >
          ✕
        </button>
      </div>
      <div className="space-y-1">
        <div>Renders: {metrics.renderCount}</div>
        <div>Cache Hits: {metrics.cacheHits}</div>
        <div>Network: {metrics.networkRequests}</div>
        <div>Memory: {metrics.memoryUsage}MB</div>
        <div className="mt-2 pt-2 border-t border-gray-700">
          <div className="text-green-400">
            Cache Hit Rate: {metrics.cacheHits + metrics.networkRequests > 0
              ? Math.round((metrics.cacheHits / (metrics.cacheHits + metrics.networkRequests)) * 100)
              : 0}%
          </div>
        </div>
      </div>
    </div>
  );
}

// 성능 측정 HOC
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return function PerformanceTrackedComponent(props: P) {
    const renderTime = useRef(performance.now());
    const mountTime = useRef(0);

    useEffect(() => {
      mountTime.current = performance.now() - renderTime.current;
      console.log(`[Performance] ${componentName} mounted in ${mountTime.current.toFixed(2)}ms`);
    }, []);

    useEffect(() => {
      const renderDuration = performance.now() - renderTime.current;
      if (renderDuration > 16) { // 60fps = 16ms per frame
        console.warn(`[Performance] ${componentName} slow render: ${renderDuration.toFixed(2)}ms`);
      }
      renderTime.current = performance.now();
    });

    return <Component {...props} />;
  };
}