"use client";

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { parseContent, extractContentMetadata } from './utils/content-parser';
import { ContentProcessingOptions, ContentMetadata } from './types';
import HtmlRenderer from './components/HtmlRenderer';
import CodeRenderer from './components/CodeRenderer';
import YouTubeRenderer from './components/YouTubeRenderer';
import { useModal } from '@/hooks/useModal';
import Modal from '../Modal';

// Mermaid 컴포넌트를 동적 import로 로드 (클라이언트 사이드에서만)
const MermaidRenderer = dynamic(() => import('./components/MermaidRenderer'), {
  ssr: false,
  loading: () => (
    <div className="mermaid-wrapper">
      <div className="text-gray-500 text-center py-8">
        다이어그램 로딩 중...
      </div>
    </div>
  ),
});

interface HtmlContentRendererProps {
  /**
   * 렌더링할 HTML 콘텐츠
   */
  content: string;

  /**
   * 콘텐츠 처리 옵션
   */
  options?: ContentProcessingOptions;

  /**
   * 추가 CSS 클래스
   */
  className?: string;

  /**
   * 메타데이터 변경 콜백
   */
  onMetadataChange?: (metadata: ContentMetadata) => void;
}

/**
 * HTML 콘텐츠 렌더러 (오케스트레이터)
 *
 * HTML 콘텐츠를 파싱하고 적절한 렌더러 컴포넌트로 렌더링합니다.
 * SRP(Single Responsibility Principle)를 따라 각 렌더러는 단일 책임을 가집니다.
 * DOM 조작 없이 순수한 React 컴포넌트 방식으로 구현됩니다.
 */
export default function HtmlContentRenderer({
  content,
  options = {},
  className = '',
  onMetadataChange,
}: HtmlContentRendererProps) {
  const {
    enableCodeHighlight = true,
    enableMermaid = true,
    enableImageModal = true,
    enableCodeCopy = true,
    enableYouTube = true,
  } = options;

  // 통합 모달 상태 관리
  const { modalData, isModalOpen, closeModal, handleImageClick, handleMermaidClick } = useModal();

  /**
   * 콘텐츠를 파싱하고 메타데이터를 추출합니다.
   */
  const { parts, metadata } = useMemo(() => {
    if (!content) {
      return { parts: [], metadata: {} };
    }

    const parsedParts = parseContent(content);
    const extractedMetadata = extractContentMetadata(parsedParts);

    // 읽기 시간 계산 (대략적인 추정)
    const wordCount = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200); // 분당 200단어 기준

    const fullMetadata: ContentMetadata = {
      imageCount: extractedMetadata.imageCount,
      codeBlockCount: extractedMetadata.codeBlockCount,
      mermaidCount: extractedMetadata.mermaidCount,
      youtubeCount: extractedMetadata.youtubeCount,
      languages: extractedMetadata.languages,
      readingTime,
    };

    // 메타데이터 변경 알림
    if (onMetadataChange) {
      onMetadataChange(fullMetadata);
    }

    return { parts: parsedParts, metadata: fullMetadata };
  }, [content, onMetadataChange]);

  // Mermaid 클릭 핸들러는 useModal 훅에서 제공됨

  /**
   * 콘텐츠가 없는 경우
   */
  if (!content) {
    return null;
  }

  /**
   * 각 파트를 적절한 렌더러로 렌더링합니다.
   */
  return (
    <>
      <div className={`prose prose-sm max-w-none ${className}`}>
        {parts.map((part, index) => {
          switch (part.type) {
            case 'html':
              return (
                <HtmlRenderer
                  key={`html-${index}`}
                  content={part.content}
                  onImageClick={enableImageModal ? handleImageClick : undefined}
                />
              );

            case 'code':
              if (!enableCodeHighlight) {
                // 코드 하이라이팅이 비활성화된 경우 기본 pre/code로 렌더링
                return (
                  <pre key={`code-${index}`} className="code-block">
                    <code>{part.content}</code>
                  </pre>
                );
              }
              return (
                <CodeRenderer
                  key={part.id}
                  id={part.id}
                  language={part.language}
                  content={part.content}
                  showCopyButton={enableCodeCopy}
                />
              );

            case 'mermaid':
              if (!enableMermaid) {
                // Mermaid가 비활성화된 경우 코드 블록으로 렌더링
                return (
                  <pre key={`mermaid-${index}`} className="code-block">
                    <code className="language-mermaid">{part.content}</code>
                  </pre>
                );
              }
              return (
                <MermaidRenderer
                  key={part.id}
                  id={part.id}
                  content={part.content}
                  onClick={enableImageModal ? handleMermaidClick : undefined}
                />
              );

            case 'youtube':
              if (!enableYouTube) {
                // YouTube가 비활성화된 경우 링크로 렌더링
                return (
                  <div key={`youtube-${index}`} className="youtube-disabled">
                    <a
                      href={`https://www.youtube.com/watch?v=${part.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      YouTube 비디오 보기: {part.videoId}
                    </a>
                  </div>
                );
              }
              return (
                <YouTubeRenderer
                  key={`youtube-${part.videoId}-${index}`}
                  videoId={part.videoId}
                  title={part.title}
                />
              );

            default:
              return null;
          }
        })}
      </div>

      {/* 통합 모달 (이미지 & Mermaid) */}
      {enableImageModal && modalData && (
        <Modal
          type={modalData.type}
          content={modalData.content}
          alt={modalData.alt}
          title={modalData.title}
          isOpen={isModalOpen}
          onClose={closeModal}
        />
      )}
    </>
  );
}