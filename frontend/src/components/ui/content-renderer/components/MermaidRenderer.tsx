"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { renderMermaidDiagram, PieChartOptions } from '@/lib/mermaid-config';
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

  /**
   * 파이 차트 처리 옵션
   */
  pieChartOptions?: PieChartOptions;
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
  pieChartOptions,
}: MermaidRendererProps) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{ negativeValues?: boolean, suggestions?: string[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutOverride, setLayoutOverride] = useState<string | null>(null);
  const [mermaidMetrics, setMermaidMetrics] = useState<{ width: number; height: number; ratio: number } | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setLayoutOverride(null);
  }, [content]);

  const parseSvgMetrics = (svgMarkup: string) => {
    const widthMatch = svgMarkup.match(/\bwidth="([\d.]+)"/i);
    const heightMatch = svgMarkup.match(/\bheight="([\d.]+)"/i);
    if (!widthMatch || !heightMatch) return null;
    const width = parseFloat(widthMatch[1]);
    const height = parseFloat(heightMatch[1]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }
    return { width, height, ratio: height / width };
  };

  const getFlowDirection = (source: string) => {
    const match = source.match(/(?:^|\n)\s*(flowchart|graph)\s+([A-Za-z]{1,2})\b/i);
    if (!match) {
      return null;
    }
    return match[2].toUpperCase();
  };

  const forceFlowchartLR = (source: string) => {
    const match = source.match(/(?:^|\n)\s*(flowchart|graph)\s+([A-Za-z]{1,2})\b/i);
    if (!match) {
      return source;
    }
    return source.replace(match[0], match[0].replace(match[2], 'LR'));
  };

  /**
   * Mermaid 다이어그램을 렌더링합니다.
   */
  useEffect(() => {
    if (!content) return;

    const renderDiagram = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (typeof document !== 'undefined' && document.fonts?.ready) {
          await document.fonts.ready;
        }

        // 전역 설정을 사용하여 렌더링
        const source = layoutOverride ?? content;
        const renderedSvg = await renderMermaidDiagram(id, source, pieChartOptions);
        const metrics = parseSvgMetrics(renderedSvg);
        setMermaidMetrics(metrics);

        // 세로로 지나치게 긴 다이어그램은 LR로 재시도
        if (!layoutOverride && metrics && metrics.ratio > 3.0) {
          const direction = getFlowDirection(content);
          if (!direction || direction === 'TD' || direction === 'TB' || direction === 'BT') {
            const rotatedContent = forceFlowchartLR(content);
            if (rotatedContent !== content) {
              setLayoutOverride(rotatedContent);
              return;
            }
          }
        }

        setSvg(renderedSvg);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        const errorMessage = err instanceof Error ? err.message : '다이어그램 렌더링 실패';
        setError(errorMessage);

        // 파이 차트 음수 값 오류 확인
        if (content && content.toLowerCase().includes('pie') && errorMessage.includes('음수 값')) {
          setErrorDetails({
            negativeValues: true,
            suggestions: [
              '음수 값은 파이 차트에서 표시할 수 없습니다',
              '양수 값으로 변경하거나 0으로 설정하세요',
              '또는 막대 그래프(bar chart) 사용을 고려하세요'
            ]
          });
        } else {
          setErrorDetails(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    renderDiagram();
  }, [id, content, pieChartOptions, layoutOverride]); // theme 제거 - 전역 설정 사용

  useLayoutEffect(() => {
    if (!mermaidMetrics || !containerRef.current) {
      setScale(1);
      return;
    }

    const node = containerRef.current;
    const computed = window.getComputedStyle(node);
    const paddingX =
      parseFloat(computed.paddingLeft || '0') + parseFloat(computed.paddingRight || '0');
    const availableWidth = node.clientWidth - paddingX;

    if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
      setScale(1);
      return;
    }

    if (mermaidMetrics.width <= availableWidth) {
      setScale(1);
      return;
    }

    const nextScale = Math.max(0.8, Math.min(1, availableWidth / mermaidMetrics.width));
    setScale(nextScale);
  }, [mermaidMetrics]);

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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-3">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h4 className="text-red-800 text-sm font-medium mb-1">
                ⚠️ Mermaid 다이어그램 렌더링 실패
              </h4>
              <p className="text-red-700 text-xs mb-2">
                {errorDetails?.negativeValues
                  ? '파이 차트에 음수 값이 포함되어 있습니다.'
                  : '다이어그램 구문에 오류가 있습니다. 아래 원본 코드를 확인해주세요.'
                }
              </p>

              {/* 파이 차트 특화된 제안 */}
              {errorDetails?.negativeValues && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
                  <p className="text-yellow-800 text-xs font-medium mb-1">💡 파이 차트 제안:</p>
                  <ul className="text-yellow-700 text-xs list-disc list-inside space-y-1">
                    {errorDetails.suggestions?.map((suggestion, idx) => (
                      <li key={idx}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
              {process.env.NODE_ENV === 'development' && (
                <details className="text-xs text-red-600 mt-2">
                  <summary className="cursor-pointer hover:text-red-800 font-medium">
                    에러 상세 정보 (개발 모드)
                  </summary>
                  <div className="mt-2 p-2 bg-red-100 rounded border border-red-300 font-mono text-xs whitespace-pre-wrap break-all">
                    {error}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>

        {/* 원본 Mermaid 코드를 코드 블록으로 표시 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-3 py-2 border-b border-gray-200">
            <span className="text-xs font-medium text-gray-600">
              원본 Mermaid 코드
            </span>
          </div>
          <pre className="mermaid-source p-4 overflow-x-auto text-sm">
            <code className="language-mermaid">{content}</code>
          </pre>
        </div>

        {/* 도움말 */}
        <div className="mt-3 text-xs text-gray-600">
          <strong>일반적인 해결 방법:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>구문 오류가 있는지 확인하세요 (괄호, 화살표 등)</li>
            <li>특수문자는 따옴표로 감싸주세요 (예: <code className="bg-gray-200 px-1 rounded">"텍스트 {'{'} 특수문자 {'}'}"</code>)</li>
            <li>Mermaid 공식 문서를 참고하세요: <a href="https://mermaid.js.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">mermaid.js.org</a></li>
          </ul>
        </div>
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
      data-mermaid-layout={
        mermaidMetrics
          ? mermaidMetrics.ratio > 3
            ? 'tall'
            : mermaidMetrics.width > 1200
              ? 'wide'
              : 'normal'
          : 'unknown'
      }
      style={
        mermaidMetrics
          ? ({
              ['--mermaid-width' as string]: `${mermaidMetrics.width}px`,
              ['--mermaid-height' as string]: `${mermaidMetrics.height}px`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div
        className="mermaid-content cursor-pointer hover:opacity-90 transition-opacity"
        style={
          mermaidMetrics
            ? ({
                width: `${mermaidMetrics.width * scale}px`,
                height: `${mermaidMetrics.height * scale}px`,
              } as React.CSSProperties)
            : undefined
        }
        onClick={handleClick}
      >
        <div
          className="mermaid-canvas"
          style={
            mermaidMetrics
              ? ({
                  width: `${mermaidMetrics.width}px`,
                  height: `${mermaidMetrics.height}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                } as React.CSSProperties)
              : undefined
          }
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
