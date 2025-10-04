"use client";

import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
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
          return `<img ${cleanedAttributes} src="${normalizedSrc}" loading="lazy">`;
        } catch (error) {
          return match;
        }
      },
    );

    // 클라이언트 사이드 살균 (백엔드에서 이미 처리되었지만 추가 보안)
    const sanitized = DOMPurify.sanitize(processed, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'code', 'pre', 'span', 'div',
        'hr', 'mark', 'sub', 'sup', 'del', 'ins', 'kbd', 'samp', 'var',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
        'button', 'svg', 'rect', 'path', 'polyline', 'use', 'g', 'defs', 'symbol',
        'iframe',
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'target', 'rel', 'data-*', 'width', 'height',
        'class', 'style', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
        'stroke-linejoin', 'points', 'x', 'y', 'rx', 'ry', 'd', 'xmlns', 'transform',
        'frameborder', 'allow', 'allowfullscreen', 'loading',
      ],
      ALLOW_DATA_ATTR: true,
      KEEP_CONTENT: true,
      ADD_TAGS: ['span', 'iframe'],
      ADD_ATTR: ['class', 'frameborder', 'allow', 'allowfullscreen', 'xmlns'],
      ALLOWED_URI_REGEXP: /^https?:\/\//i,
    });

    return sanitized;
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