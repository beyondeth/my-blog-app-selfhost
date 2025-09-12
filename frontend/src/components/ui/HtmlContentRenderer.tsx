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
            <span class="copy-text" style="color: rgba(255, 255, 255, 0.6); font-size: 12px; font-weight: 500;">Copy</span>
            <span class="check-text" style="display:none; color: #4ade80; font-size: 12px; font-weight: 500;">Copied!</span>
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
          <span class="copy-text" style="color: rgba(255, 255, 255, 0.6); font-size: 12px; font-weight: 500;">Copy</span>
          <span class="check-text" style="display:none; color: #4ade80; font-size: 12px; font-weight: 500;">Copied!</span>
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
          'button', 'svg', 'rect', 'path', 'polyline', 'use', 'g', 'defs', 'symbol', // 모든 SVG 태그 추가
          'iframe' // YouTube iframe 지원 추가
        ],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'data-*', 'width', 'height', 'class', 'style',
          'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'points', 'x', 'y', 'rx', 'ry', 'd', 'xmlns', 'transform', // 모든 SVG 속성 추가
          'frameborder', 'allow', 'allowfullscreen', 'loading' // iframe 속성 추가
        ],
        ALLOW_DATA_ATTR: true,
        FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover'],
        KEEP_CONTENT: true,
        ADD_TAGS: ['span', 'iframe'], // highlight.js가 생성하는 span 태그와 iframe 허용
        ADD_ATTR: ['class', 'frameborder', 'allow', 'allowfullscreen', 'xmlns'], // highlight.js 클래스와 iframe, SVG 속성 유지
        // 모든 HTTPS URL 허용 (S3, YouTube 등)
        ALLOWED_URI_REGEXP: /^https?:\/\//i
      });
      
      // 4. YouTube iframe 크기 조정 (640x360 -> 685x540)
      processedHtml = processedHtml.replace(
        /(<div[^>]*data-youtube-video[^>]*>)([\s\S]*?)(<iframe[^>]*>)/gi,
        (match, divStart, middle, iframeTag) => {
          // div 태그의 스타일 속성 업데이트
          const updatedDiv = divStart.replace(
            /style="[^"]*"/,
            'style="position: relative; width: 685px; height: 540px; max-width: 100%; margin: 0 auto;"'
          );
          
          // iframe에서 width와 height 속성 제거 (CSS로 처리)
          const updatedIframe = iframeTag
            .replace(/width="[^"]*"/gi, 'width="100%"')
            .replace(/height="[^"]*"/gi, 'height="100%"');
          
          return updatedDiv + middle + updatedIframe;
        }
      );
      
      // 5. 이미지 URL 처리
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
        
        // 텍스트 변경 (Copy → Copied!)
        const copyText = button.querySelector('.copy-text') as HTMLElement;
        const checkText = button.querySelector('.check-text') as HTMLElement;
        
        if (copyText && checkText) {
          copyText.style.display = 'none';
          checkText.style.display = 'inline';
          
          // 2초 후 원래대로 복구
          setTimeout(() => {
            copyText.style.display = 'inline';
            checkText.style.display = 'none';
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