"use client";

import React, { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { normalizeImageUrl } from '@/utils/imageUtils';
import { stripUnderline } from '@/utils/stripUnderline';
import { useImageModal } from '@/hooks/useImageModal';
import ImageModal from './ImageModal';

interface HtmlContentRendererProps {
  content: string;
  className?: string;
}

/**
 * 백엔드에서 생성된 순수 HTML을 렌더링하는 최적화된 컴포넌트
 * - XSS 보안 처리 (DOMPurify)
 * - highlight.js로 코드 하이라이팅
 * - 이미지 URL 정규화
 * - 이미지 클릭 모달
 */
export default function HtmlContentRenderer({ content, className = '' }: HtmlContentRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { modalImage, isModalOpen, closeModal, handleImageClick } = useImageModal();

  // highlight.js 적용
  useEffect(() => {
    if (contentRef.current) {
      // 모든 pre > code 요소에 highlight.js 적용
      contentRef.current.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
      });
    }
  }, [content]);

  // 이미지 URL 처리
  const processImageUrls = (html: string): string => {
    return html.replace(
      /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
      (match, beforeSrc, originalSrc, afterSrc) => {
        try {
          const normalizedSrc = normalizeImageUrl(originalSrc);
          
          // 기존 속성 정리
          const cleanedAttributes = (beforeSrc + afterSrc)
            .replace(/crossorigin=["'][^"']*["']/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          return `<img ${cleanedAttributes} src="${normalizedSrc}" loading="lazy" data-clickable="true">`;
        } catch (error) {
          console.error('Error processing image URL:', error);
          return match;
        }
      }
    );
  };

  const processContent = (htmlContent: string): string => {
    if (!htmlContent) return '';

    try {
      // 1. 밑줄 제거
      let processedHtml = stripUnderline(htmlContent);
      
      // 2. HTML 보안 처리
      processedHtml = DOMPurify.sanitize(processedHtml, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'code', 'pre', 'span', 'div',
          'hr', 'mark', 'sub', 'sup', 'del', 'ins', 'kbd', 'samp', 'var',
          'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'
        ],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'data-*', 'width', 'height', 'class', 'style'],
        ALLOW_DATA_ATTR: true,
        FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover']
      });
      
      // 3. 이미지 URL 처리
      processedHtml = processImageUrls(processedHtml);
      
      return processedHtml;
    } catch (error) {
      console.error('Error processing content:', error);
      return htmlContent;
    }
  };

  const processedContent = processContent(content);

  return (
    <>
      <div 
        ref={contentRef}
        className={`prose prose-lg max-w-none ${className}`}
        dangerouslySetInnerHTML={{ __html: processedContent }}
        onClick={handleImageClick}
      />
      
      {/* 이미지 모달 */}
      <ImageModal
        src={modalImage?.src || ''}
        alt={modalImage?.alt || ''}
        title={modalImage?.title}
        isOpen={isModalOpen}
        onClose={closeModal}
      />
    </>
  );
}