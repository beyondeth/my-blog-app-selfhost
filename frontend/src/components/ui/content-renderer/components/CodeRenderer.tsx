"use client";

import React, { useState, useEffect } from 'react';
import hljs from 'highlight.js';
import { CodeBlockInfo } from '../types';

interface CodeRendererProps extends CodeBlockInfo {
  /**
   * 코드 복사 버튼 표시 여부
   */
  showCopyButton?: boolean;

  /**
   * 라인 번호 표시 여부
   */
  showLineNumbers?: boolean;

  /**
   * 추가 CSS 클래스
   */
  className?: string;
}

/**
 * 코드 렌더러 컴포넌트
 *
 * 코드 블록을 하이라이팅하고 복사 기능을 제공합니다.
 * React 방식으로 구현되어 DOM 직접 조작을 피합니다.
 */
export default function CodeRenderer({
  id,
  language,
  content,
  showCopyButton = true,
  showLineNumbers = false,
  className = '',
}: CodeRendererProps) {
  const [highlighted, setHighlighted] = useState<string>('');
  const [copied, setCopied] = useState(false);

  /**
   * 코드 하이라이팅을 수행합니다.
   */
  useEffect(() => {
    if (!content) return;

    try {
      let result;
      if (language && language !== 'plaintext') {
        try {
          result = hljs.highlight(content, { language });
        } catch {
          // 언어를 인식하지 못한 경우 자동 감지
          result = hljs.highlightAuto(content);
        }
      } else {
        result = hljs.highlightAuto(content);
      }
      setHighlighted(result.value);
    } catch (error) {
      console.error('Error highlighting code:', error);
      // 하이라이팅 실패시 원본 콘텐츠 사용
      setHighlighted(escapeHtml(content));
    }
  }, [content, language]);

  /**
   * 코드를 클립보드에 복사합니다.
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  /**
   * HTML을 이스케이프합니다.
   */
  function escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }

  /**
   * 라인 번호를 생성합니다.
   */
  const renderLineNumbers = () => {
    if (!showLineNumbers) return null;

    const lines = content.split('\n');
    return (
      <div className="code-line-numbers" aria-hidden="true">
        {lines.map((_, index) => (
          <div key={index} className="code-line-number">
            {index + 1}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`code-block-wrapper ${className}`} data-code-id={id}>
      {showCopyButton && (
        <button
          className="copy-code-btn"
          onClick={handleCopy}
          aria-label="Copy code"
          title={copied ? 'Copied!' : 'Copy code'}
        >
          <span
            className="copy-text"
            style={{
              display: copied ? 'none' : 'inline',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            Copy
          </span>
          <span
            className="check-text"
            style={{
              display: copied ? 'inline' : 'none',
              color: '#4ade80',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            Copied!
          </span>
        </button>
      )}
      <pre className="code-block" data-language={language}>
        <div className="code-content">
          {showLineNumbers && renderLineNumbers()}
          <code
            className={`hljs language-${language}`}
            data-language={language}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </div>
      </pre>
    </div>
  );
}