"use client";

import React from 'react';
import DOMPurify from 'dompurify';
import { normalizeImageUrl } from '@/utils/imageUtils';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import sql from 'highlight.js/lib/languages/sql';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';
// 모바일 개발 언어
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import dart from 'highlight.js/lib/languages/dart';
import objectivec from 'highlight.js/lib/languages/objectivec';
// 백엔드 언어
import go from 'highlight.js/lib/languages/go';
import ruby from 'highlight.js/lib/languages/ruby';
import java from 'highlight.js/lib/languages/java';
import csharp from 'highlight.js/lib/languages/csharp';
import php from 'highlight.js/lib/languages/php';
import rust from 'highlight.js/lib/languages/rust';
// 기타 언어
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import nginx from 'highlight.js/lib/languages/nginx';
import graphql from 'highlight.js/lib/languages/graphql';
import { stripUnderline } from '@/utils/stripUnderline';
import { useImageModal } from '@/hooks/useImageModal';
import ImageModal from './ImageModal';

// lowlight 인스턴스 생성 및 언어 등록
const lowlight = createLowlight();
lowlight.register({ 
  // 웹 개발
  javascript, 
  typescript, 
  css,
  xml,
  json,
  graphql,
  
  // 모바일 개발
  swift,      // iOS
  kotlin,     // Android
  dart,       // Flutter
  objectivec, // iOS (Objective-C)
  java,       // Android/Spring
  
  // 백엔드 개발
  python,
  go,         // Golang
  ruby,       // Ruby on Rails
  php,
  rust,
  csharp,     // C#/.NET
  
  // DevOps & 기타
  bash,
  sql,
  yaml,
  dockerfile,
  nginx,
  markdown,
  
  // 별칭 등록
  js: javascript, 
  ts: typescript,
  jsx: javascript,
  tsx: typescript,
  sh: bash,
  shell: bash,
  html: xml,
  yml: yaml,
  golang: go,
  objc: objectivec,
  'c#': csharp,
  cs: csharp,
  docker: dockerfile,
  gql: graphql,
  rb: ruby
});

interface ContentRendererProps {
  content: string;
  className?: string;
}

// HTML 엔티티 디코딩
const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
};

// 안전한 클래스 필터링 - 마크다운 클래스 포함
const filterSafeClasses = (classNames: string): string => {
  return classNames
    .split(/\s+/)
    .filter(className => 
      className.startsWith('hljs') ||
      className.startsWith('language-') ||
      className.startsWith('editor-') ||
      className.startsWith('markdown-') ||
      className.startsWith('content-') ||
      ['code-block', 'code', 'pre'].includes(className)
    )
    .join(' ');
};

// 링크 처리 - 하늘색 스타일과 아이콘 추가
const processLinks = (html: string): string => {
  return html.replace(
    /<a([^>]*?)href=["']([^"']+)["']([^>]*?)>([^<]+)<\/a>/gi,
    (match, beforeHref, href, afterHref, linkText) => {
      try {
        // target="_blank" 추가 (외부 링크의 경우)
        const isExternal = href.startsWith('http') || href.startsWith('//');
        const targetAttr = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
        
        // 링크 아이콘 추가 (외부 링크의 경우)
        const linkIcon = isExternal ? 
          '<svg class="inline-block w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>' : '';
        
        return `<a ${beforeHref} href="${href}" ${afterHref} ${targetAttr} class="content-link">${linkText}${linkIcon}</a>`;
      } catch (error) {
        console.error('Error processing link:', error);
        return match;
      }
    }
  );
};

// 이미지 URL 처리 (클릭 가능하게 수정)
const processImageUrls = (html: string): string => {
  return html.replace(
    /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
    (match, beforeSrc, originalSrc, afterSrc) => {
      try {
        const normalizedSrc = normalizeImageUrl(originalSrc);
        
        // width, height 속성 추출
        const widthMatch = match.match(/width=["']([^"']+)["']/);
        const heightMatch = match.match(/height=["']([^"']+)["']/);
        
        const cleanedAttributes = (beforeSrc + afterSrc)
          .replace(/crossorigin=["'][^"']*["']/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // 스타일 속성 구성 (클릭 가능한 스타일 추가)
        let styleAttr = 'max-width: 100%; height: auto; cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease;';
        if (widthMatch) {
          styleAttr += ` width: ${widthMatch[1]}px;`;
        }
        if (heightMatch) {
          styleAttr += ` height: ${heightMatch[1]}px;`;
        }
        
        // 클릭 가능한 이미지로 변경 (data-clickable 속성 추가)
        return `<img ${cleanedAttributes} src="${normalizedSrc}" loading="lazy" style="${styleAttr}" data-clickable="true" class="content-image hover:transform hover:scale-105 hover:shadow-lg rounded-lg">`;
      } catch (error) {
        console.error('Error processing image URL:', error);
        return match;
      }
    }
  );
};

// 신택스 하이라이팅 적용
const applySyntaxHighlighting = (html: string): string => {
  // 백엔드에서 이미 렌더링된 HTML에 하이라이팅 적용
  return html.replace(
    /<pre[^>]*><code(?:\s+class="language-([\w#\-]+)")?[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    (match, language, codeContent) => {
      try {
        // 지원하는 언어 확장
        const supportedLanguages = [
          // 웹 개발
          'typescript', 'javascript', 'ts', 'js', 'jsx', 'tsx',
          'html', 'xml', 'css', 'json', 'graphql', 'gql',
          
          // 모바일 개발
          'swift', 'kotlin', 'dart', 'flutter',
          'objectivec', 'objc', 'java',
          
          // 백엔드 개발
          'python', 'go', 'golang', 'ruby', 'rb', 'rails',
          'php', 'rust', 'csharp', 'c#', 'cs', 'dotnet',
          
          // DevOps & 기타
          'bash', 'sh', 'shell', 'sql', 
          'yaml', 'yml', 'dockerfile', 'docker',
          'nginx', 'markdown', 'md'
        ];
        if (!supportedLanguages.includes(language.toLowerCase())) {
          // 지원하지 않는 언어는 기본 스타일로 반환
          return `<pre class="hljs"><code class="language-${language}">${codeContent}</code></pre>`;
        }
        
        // 언어 별칭 매핑
        const languageMap: Record<string, string> = {
          // 웹 개발
          'ts': 'typescript',
          'js': 'javascript',
          'jsx': 'javascript',
          'tsx': 'typescript',
          'html': 'xml',
          'gql': 'graphql',
          
          // 모바일 개발
          'flutter': 'dart',
          'objc': 'objectivec',
          
          // 백엔드 개발
          'golang': 'go',
          'rb': 'ruby',
          'rails': 'ruby',
          'c#': 'csharp',
          'cs': 'csharp',
          'dotnet': 'csharp',
          
          // DevOps
          'sh': 'bash',
          'shell': 'bash',
          'yml': 'yaml',
          'docker': 'dockerfile',
          'md': 'markdown'
        };
        
        const mappedLanguage = languageMap[language.toLowerCase()] || language.toLowerCase();
        
        const result = lowlight.highlight(mappedLanguage, codeContent);
        
        if (result?.children) {
          const highlightedHtml = result.children.map((child: any) => {
            if (child.type === 'text') return child.value;
            if (child.type === 'element') {
              const className = child.properties?.className?.join(' ') || '';
              const content = child.children?.map((c: any) => {
                if (c.type === 'text') return c.value;
                if (c.type === 'element') {
                  const childClass = c.properties?.className?.join(' ') || '';
                  const childContent = c.children?.map((cc: any) => cc.value || '').join('') || '';
                  return `<span class="${childClass}">${childContent}</span>`;
                }
                return '';
              }).join('') || '';
              return `<span class="${className}">${content}</span>`;
            }
            return '';
          }).join('');
          
          return `<pre class="hljs"><code class="language-${language}">${highlightedHtml}</code></pre>`;
        }
      } catch (error) {
        console.error('Failed to highlight code:', error);
      }
      
      return match;
    }
  );
};

/**
 * HTML 콘텐츠를 안전하게 렌더링하는 컴포넌트
 * - XSS 보안 처리 (DOMPurify)
 * - 이미지 URL 프록시 처리
 * - 코드 블록 신택스 하이라이팅
 * - 안전한 클래스만 허용
 * - 이미지 클릭으로 모달 열기 (커스텀 훅 활용)
 */
export default function ContentRenderer({ content, className = '' }: ContentRendererProps) {
  const { modalImage, isModalOpen, closeModal, handleImageClick } = useImageModal();

  const processContent = (htmlContent: string): string => {
    if (!htmlContent) return '';

    try {
      // 0. <u> 태그, underline 스타일 제거 (sanitize 전)
      let sanitizedHtml = stripUnderline(htmlContent);
      // 1. HTML 보안 처리
      const cleanHtml = DOMPurify.sanitize(sanitizedHtml, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'code', 'pre', 'span', 'div',
          // 구분선, 위/아래 첨자, 마크 등 추가
          'hr', 'mark', 'sub', 'sup', 'del', 'ins', 'kbd', 'samp', 'var',
          // 테이블 관련 태그 추가 (안전한 구조적 태그들)
          'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'
        ],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'data-*', 'width', 'height', 'class', 'style', 'data-text-align'],
        ALLOW_DATA_ATTR: true,
        FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover']
        // style 속성은 테이블 스타일링을 위해 허용하되, 위험한 내용은 DOMPurify가 자동 필터링
      });
      // 2. sanitize 후에도 혹시 남은 밑줄 제거
      let processedHtml = stripUnderline(cleanHtml);
      // 3. 링크 처리 (하늘색 스타일과 아이콘 추가)
      processedHtml = processLinks(processedHtml);
      // 4. 이미지 URL 처리 (클릭 가능하게)
      processedHtml = processImageUrls(processedHtml);
      // 5. 안전한 클래스만 유지 (마크다운 클래스 포함)
      processedHtml = processedHtml.replace(/class=["']([^"']*?)["']/gi, (_, classNames) => {
        const safeClasses = filterSafeClasses(classNames);
        return safeClasses ? `class="${safeClasses}"` : '';
      });
      // 6. 신택스 하이라이팅 적용
      processedHtml = applySyntaxHighlighting(processedHtml);
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
        className={`prose prose-lg max-w-none ${className}`}
        dangerouslySetInnerHTML={{ __html: processedContent }}
        onClick={handleImageClick}
        style={{ lineHeight: '1.7', fontSize: '16px' }}
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