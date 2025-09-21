"use client";

import React, { useEffect, useRef, useState } from 'react';
import { renderMermaidDiagram } from '@/lib/mermaid-config';

interface MermaidDiagramProps {
  content: string;
  id?: string;
  className?: string;
}

/**
 * Mermaid 다이어그램을 렌더링하는 React 컴포넌트
 *
 * 기능:
 * - SSR 안전: 'use client' 디렉티브로 클라이언트에서만 실행
 * - 에러 처리: Mermaid 렌더링 실패 시 fallback UI 제공
 * - React 통합: 라이프사이클과 완벽 동기화
 *
 * 최적화:
 * - useEffect 의존성 최적화로 불필요한 렌더링 방지
 * - 비동기 렌더링으로 UI 블로킹 방지
 * - 에러 바운더리로 안정성 향상
 */
export default function MermaidDiagram({ content, id, className = '' }: MermaidDiagramProps) {
  const [hasError, setHasError] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [svg, setSvg] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<Error | null>(null);

  // 클라이언트 사이드 감지 - 빈 의존성으로 한 번만 실행
  useEffect(() => {
    setIsClient(true);
  }, []); // 빈 배열: 마운트 시 한 번만 실행 (무한루프 없음)

  // Mermaid 초기화 및 렌더링 - 필수 의존성만 포함
  useEffect(() => {
    // 클라이언트가 아니거나 콘텐츠가 없으면 렌더링 안 함
    if (!isClient || !content) return;

    const renderDiagram = async () => {
      try {
        // 전역 설정을 사용하여 렌더링
        const uniqueId = id || `diagram_${Date.now()}`;
        const renderedSvg = await renderMermaidDiagram(uniqueId, content);

        setSvg(renderedSvg);
        setHasError(false);
      } catch (error) {
        // 에러 처리
        console.error('[MermaidDiagram] 렌더링 에러:', error);
        errorRef.current = error as Error;
        setHasError(true);
        setSvg(''); // SVG 초기화
      }
    };

    renderDiagram();
  }, [isClient, content, id]); // id는 optional이지만 변경 시 재렌더링 필요

  // 서버 사이드 렌더링 중
  if (!isClient) {
    return (
      <div className={`mermaid-wrapper ${className}`}>
        <div className="mermaid-loading">
          <div className="text-gray-500 text-center py-8">
            다이어그램 로딩 중...
          </div>
        </div>
      </div>
    );
  }

  // 에러 발생 시
  if (hasError) {
    return (
      <div className={`mermaid-wrapper mermaid-error ${className}`}>
        <div className="text-red-600 text-sm mb-2">
          ⚠️ 다이어그램 렌더링 실패
        </div>
        <pre className="mermaid-source">
          <code>{content}</code>
        </pre>
        {process.env.NODE_ENV === 'development' && errorRef.current && (
          <div className="text-xs text-gray-500 mt-2">
            Error: {errorRef.current.message}
          </div>
        )}
      </div>
    );
  }

  // 정상 렌더링
  if (svg) {
    return (
      <div
        className={`mermaid-wrapper ${className}`}
        ref={containerRef}
      >
        <div
          className="mermaid-content cursor-pointer hover:opacity-90 transition-opacity"
          dangerouslySetInnerHTML={{ __html: svg }}
          onClick={() => {
            // 클릭 이벤트를 부모로 전달
            const event = new CustomEvent('mermaid-click', {
              detail: { svg, content }
            });
            window.dispatchEvent(event);
          }}
        />
      </div>
    );
  }

  // 로딩 중
  return (
    <div className={`mermaid-wrapper ${className}`}>
      <div className="mermaid-loading">
        <div className="text-gray-500 text-center py-8">
          다이어그램 생성 중...
        </div>
      </div>
    </div>
  );
}

/**
 * Lazy loading을 위한 동적 import wrapper
 */
export const LazyMermaidDiagram = React.lazy(() =>
  import('./MermaidDiagram').then(module => ({
    default: module.default
  }))
);