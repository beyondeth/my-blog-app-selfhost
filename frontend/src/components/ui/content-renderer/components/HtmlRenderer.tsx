"use client";

import React, { useMemo } from 'react';
import { normalizeImageUrl } from '@/utils/imageUtils';
import { stripUnderline } from '@/utils/stripUnderline';

interface HtmlRendererProps {
  /**
   * 렌더링할 HTML 콘텐츠
   */
  content: string;

  /**
   * 이미지 클릭 핸들러
   */
  onImageClick?: (event: React.MouseEvent<HTMLDivElement>) => void;

  /**
   * 추가 CSS 클래스
   */
  className?: string;
}

/**
 * HTML 렌더러 컴포넌트
 *
 * 백엔드에서 이미 처리된 안전한 HTML을 렌더링합니다.
 * 추가적인 클라이언트 사이드 살균과 이미지 처리를 수행합니다.
 */
export default function HtmlRenderer({ content, onImageClick, className = '' }: HtmlRendererProps) {
  /**
   * HTML 콘텐츠를 클라이언트 사이드에서 추가 처리합니다.
   */
  const processedHtml = useMemo(() => {
    if (!content) return '';

    // 디버그: 캡션 포함 여부 확인
    if (process.env.NODE_ENV === 'development') {
      console.log('🖼️ [CAPTION_DEBUG] HtmlRenderer received content:', {
        hasFigure: content.includes('<figure'),
        hasFigcaption: content.includes('<figcaption'),
        figcaptionCount: (content.match(/<figcaption/g) || []).length,
        contentLength: content.length,
        preview: content.substring(0, 300) + (content.length > 300 ? '...' : '')
      });
    }

    // 밑줄 제거
    let processed = stripUnderline(content);

    // YouTube iframe 크기 조정
    processed = processed.replace(
      /(<div[^>]*data-youtube-video[^>]*>)([\s\S]*?)(<iframe[^>]*>)/gi,
      (match: string, divStart: string, middle: string, iframeTag: string) => {
        const updatedDiv = divStart.replace(
          /style="[^"]*"/,
          'style="position: relative; width: 685px; height: 540px; max-width: 100%; margin: 0 auto;"',
        );
        const updatedIframe = iframeTag
          .replace(/width="[^"]*"/gi, 'width="100%"')
          .replace(/height="[^"]*"/gi, 'height="100%"');
        return updatedDiv + middle + updatedIframe;
      },
    );

    // 이미지 URL 정규화
    processed = processed.replace(
      /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
      (match: string, beforeSrc: string, originalSrc: string, afterSrc: string) => {
        try {
          const normalizedSrc = normalizeImageUrl(originalSrc);
          const cleanedAttributes = (beforeSrc + afterSrc)
            .replace(/crossorigin=["'][^"']*["']/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

          // loading 속성 중복 방지 (Hydration mismatch 해결)
          // 이미 loading 속성이 있으면 유지, 없으면 추가
          const hasLoading = /loading=/i.test(beforeSrc + afterSrc);
          const loadingAttr = hasLoading ? '' : ' loading="lazy"';

          return `<img ${cleanedAttributes} src="${normalizedSrc}"${loadingAttr}>`;
        } catch (error) {
          return match;
        }
      },
    );

    // 백엔드에서 이미 HTML sanitization 처리됨
    // Hydration mismatch 방지를 위해 클라이언트 사이드 DOMPurify 제거
    return processed;
  }, [content]);

  if (!content) {
    return null;
  }

  return (
    <div
      className={`html-content ${className}`}
      dangerouslySetInnerHTML={{ __html: processedHtml }}
      onClick={onImageClick}
    />
  );
}