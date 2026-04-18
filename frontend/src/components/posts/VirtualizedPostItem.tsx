"use client";

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface VirtualizedPostItemProps {
  children: React.ReactNode;
  estimatedHeight?: number;
  initialVisible?: boolean;
  className?: string;
  placeholder?: React.ReactNode;
  observerRoot?: Element | null;
}

/**
 * VirtualizedPostItem
 *
 * - IntersectionObserver로 가시 영역에 들어올 때만 실제 콘텐츠 렌더링
 * - 가시 영역 밖에서는 마지막 측정 높이만큼 placeholder를 유지해 레이아웃 안정화
 */
const RELEASE_DISTANCE = 5000;
const OBSERVER_ROOT_MARGIN = '1200px 0px';

const VirtualizedPostItem = React.memo(function VirtualizedPostItem({
  children,
  estimatedHeight = 520,
  initialVisible = false,
  className,
  placeholder,
  observerRoot = null,
}: VirtualizedPostItemProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [shouldRenderContent, setShouldRenderContent] = useState(initialVisible);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const rootBounds = entry.rootBounds ??
          observerRoot?.getBoundingClientRect() ?? {
            top: 0,
            bottom: typeof window !== 'undefined' ? window.innerHeight : 0,
          };
        const aboveDistance = rootBounds.top - entry.boundingClientRect.bottom;
        const belowDistance = entry.boundingClientRect.top - rootBounds.bottom;
        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          setShouldRenderContent(true);
          return;
        }
        if (aboveDistance > RELEASE_DISTANCE || belowDistance > RELEASE_DISTANCE) {
          setShouldRenderContent(false);
        }
      },
      {
        root: observerRoot,
        rootMargin: OBSERVER_ROOT_MARGIN,
        threshold: 0,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [observerRoot]);

  useEffect(() => {
    if (!shouldRenderContent || !contentRef.current) return;
    const node = contentRef.current;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextHeight = Math.max(entry.contentRect.height, 1);
      setMeasuredHeight((prev) => {
        if (prev === null) {
          return nextHeight;
        }
        if (Math.abs(nextHeight - prev) > 2) {
          return nextHeight;
        }
        return prev;
      });
    });

    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, [shouldRenderContent]);

  const layoutHeight = measuredHeight ?? estimatedHeight;

  return (
    <div
      ref={containerRef}
      className={cn('w-full', className)}
      style={{ minHeight: layoutHeight }}
    >
      {shouldRenderContent ? (
        <div ref={contentRef}>
          {children}
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none select-none"
          style={{ height: layoutHeight }}
        >
          {placeholder ?? (
            <div className="opacity-0" style={{ height: layoutHeight }} />
          )}
        </div>
      )}
    </div>
  );
});

export default VirtualizedPostItem;
