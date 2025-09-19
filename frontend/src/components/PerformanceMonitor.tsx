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
 */
export function PerformanceMonitor() {
  const queryClient = useQueryClient();
  const renderCount = useRef(0);
  const [metrics, setMetrics] = useState({
    renderCount: 0,
    cacheHits: 0,
    networkRequests: 0,
    avgResponseTime: 0,
    memoryUsage: 0,
  });

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

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg shadow-lg text-xs font-mono z-50 opacity-90">
      <h3 className="font-bold mb-2">🚀 Performance Monitor</h3>
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