"use client";

import React, { useMemo, useEffect } from 'react';
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
 * - highlight.js로 코드 하이라이팅 (사전 처리)
 * - 이미지 URL 정규화
 * - 이미지 클릭 모달
 * - 코드 블록 복사 기능
 */
export default function HtmlContentRenderer({ content, className = '' }: HtmlContentRendererProps) {
  const { modalImage, isModalOpen, closeModal, handleImageClick } = useImageModal();

  // 모든 처리를 렌더링 전에 완료 (useMemo로 캐싱)
  const processedContent = useMemo(() => {
    if (!content) return '';

    try {
      // 1. 밑줄 제거
      let processedHtml = stripUnderline(content);
      
      // 2. 코드 블록 하이라이팅 (DOMPurify 전에 처리)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = processedHtml;
      
      let codeBlockIndex = 0;
      
      // pre > code 블록 처리
      const codeBlocks = tempDiv.querySelectorAll('pre code');
      codeBlocks.forEach((block) => {
        const element = block as HTMLElement;
        const language = element.className?.match(/language-(\w+)/)?.[1];
        const originalCode = element.textContent || '';
        
        try {
          const result = language 
            ? hljs.highlight(originalCode, { language })
            : hljs.highlightAuto(originalCode);
          
          element.innerHTML = result.value;
          element.classList.add('hljs');
          if (result.language) {
            element.classList.add(`language-${result.language}`);
          }
        } catch (err) {
          // 언어 인식 실패 시 자동 감지
          const result = hljs.highlightAuto(originalCode);
          element.innerHTML = result.value;
          element.classList.add('hljs');
        }
        
        // pre 태그를 wrapper로 감싸고 복사 버튼 추가
        const preElement = element.parentElement as HTMLElement;
        if (preElement && preElement.tagName === 'PRE') {
          const wrapper = document.createElement('div');
          wrapper.className = 'code-block-wrapper';
          wrapper.setAttribute('data-code-id', `code-${codeBlockIndex++}`);
          
          // 복사 버튼 생성
          const copyButton = document.createElement('button');
          copyButton.className = 'copy-code-btn';
          copyButton.setAttribute('data-code', originalCode);
          copyButton.innerHTML = `
            <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <svg class="check-icon" style="display:none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
          
          preElement.parentNode?.insertBefore(wrapper, preElement);
          wrapper.appendChild(copyButton);
          wrapper.appendChild(preElement);
        }
      });
      
      // pre만 있는 경우 처리
      const preBlocks = tempDiv.querySelectorAll('pre:not(:has(code))');
      preBlocks.forEach((block) => {
        const element = block as HTMLElement;
        const code = document.createElement('code');
        const originalText = element.textContent || '';
        
        const result = hljs.highlightAuto(originalText);
        code.innerHTML = result.value;
        code.classList.add('hljs');
        
        element.textContent = '';
        element.appendChild(code);
        
        // wrapper와 복사 버튼 추가
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        wrapper.setAttribute('data-code-id', `code-${codeBlockIndex++}`);
        
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-code-btn';
        copyButton.setAttribute('data-code', originalText);
        copyButton.innerHTML = `
          <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <svg class="check-icon" style="display:none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;
        
        element.parentNode?.insertBefore(wrapper, element);
        wrapper.appendChild(copyButton);
        wrapper.appendChild(element);
      });
      
      processedHtml = tempDiv.innerHTML;
      
      // 3. HTML 보안 처리 (하이라이팅된 HTML 유지)
      processedHtml = DOMPurify.sanitize(processedHtml, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'code', 'pre', 'span', 'div',
          'hr', 'mark', 'sub', 'sup', 'del', 'ins', 'kbd', 'samp', 'var',
          'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
          'button', 'svg', 'rect', 'path', 'polyline' // 복사 버튼 관련 태그 추가
        ],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'data-*', 'width', 'height', 'class', 'style',
          'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'points', 'x', 'y', 'rx', 'ry', 'd' // SVG 속성 추가
        ],
        ALLOW_DATA_ATTR: true,
        FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover'],
        KEEP_CONTENT: true,
        ADD_TAGS: ['span'], // highlight.js가 생성하는 span 태그 허용
        ADD_ATTR: ['class'] // highlight.js 클래스 유지
      });
      
      // 4. 이미지 URL 처리
      processedHtml = processedHtml.replace(
        /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
        (match, beforeSrc, originalSrc, afterSrc) => {
          try {
            const normalizedSrc = normalizeImageUrl(originalSrc);
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
      
      return processedHtml;
    } catch (error) {
      console.error('Error processing content:', error);
      return content;
    }
  }, [content]);

  // 복사 버튼 클릭 이벤트 처리
  useEffect(() => {
    const handleCopyCode = async (e: MouseEvent) => {
      const button = (e.target as HTMLElement).closest('.copy-code-btn');
      if (!button) return;
      
      const codeText = button.getAttribute('data-code');
      if (!codeText) return;
      
      try {
        await navigator.clipboard.writeText(codeText);
        
        // 아이콘 변경 (복사 → 체크)
        const copyIcon = button.querySelector('.copy-icon') as HTMLElement;
        const checkIcon = button.querySelector('.check-icon') as HTMLElement;
        
        if (copyIcon && checkIcon) {
          copyIcon.style.display = 'none';
          checkIcon.style.display = 'block';
          
          // 2초 후 원래대로 복구
          setTimeout(() => {
            copyIcon.style.display = 'block';
            checkIcon.style.display = 'none';
          }, 2000);
        }
      } catch (err) {
        console.error('Failed to copy code:', err);
      }
    };
    
    // 이벤트 리스너 등록
    document.addEventListener('click', handleCopyCode);
    
    return () => {
      document.removeEventListener('click', handleCopyCode);
    };
  }, []);

  return (
    <>
      <div 
        className={`prose prose-sm max-w-none ${className}`}
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