"use client";

import React, { useEffect, useRef, useState } from 'react';
import { renderMermaidDiagram } from '@/lib/mermaid-config';
import { MermaidInfo } from '../types';

interface MermaidRendererProps extends MermaidInfo {
  /**
   * 클릭 핸들러
   */
  onClick?: (svg: string, content: string) => void;

  /**
   * 추가 CSS 클래스
   */
  className?: string;
}

/**
 * Mermaid 다이어그램 렌더러 컴포넌트
 *
 * Mermaid 다이어그램을 렌더링합니다.
 * React 방식으로 구현되어 DOM 직접 조작을 피합니다.
 */
export default function MermaidRenderer({
  id,
  content,
  theme = 'default',
  onClick,
  className = '',
}: MermaidRendererProps) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Mermaid 다이어그램을 렌더링합니다.
   */
  useEffect(() => {
    if (!content) return;

    const renderDiagram = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 전역 설정을 사용하여 렌더링
        const renderedSvg = await renderMermaidDiagram(id, content);
        setSvg(renderedSvg);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : '다이어그램 렌더링 실패');
      } finally {
        setIsLoading(false);
      }
    };

    renderDiagram();
  }, [id, content]); // theme 제거 - 전역 설정 사용

  /**
   * 다이어그램 클릭 핸들러
   */
  const handleClick = () => {
    if (onClick && svg) {
      onClick(svg, content);
    }
  };

  /**
   * 로딩 상태를 렌더링합니다.
   */
  if (isLoading) {
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

  /**
   * 에러 상태를 렌더링합니다.
   */
  if (error) {
    return (
      <div className={`mermaid-wrapper mermaid-error ${className}`}>
        <div className="text-red-600 text-sm mb-2">
          ⚠️ 다이어그램 렌더링 실패
        </div>
        <pre className="mermaid-source">
          <code>{content}</code>
        </pre>
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-500 mt-2">
            Error: {error}
          </div>
        )}
      </div>
    );
  }

  /**
   * 다이어그램을 렌더링합니다.
   */
  return (
    <div
      className={`mermaid-wrapper ${className}`}
      ref={containerRef}
      data-mermaid-id={id}
    >
      <div
        className="mermaid-content cursor-pointer hover:opacity-90 transition-opacity"
        dangerouslySetInnerHTML={{ __html: svg }}
        onClick={handleClick}
      />
    </div>
  );
}