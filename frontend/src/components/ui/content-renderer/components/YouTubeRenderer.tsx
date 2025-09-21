"use client";

import React from 'react';

interface YouTubeRendererProps {
  /**
   * YouTube 비디오 ID
   */
  videoId: string;

  /**
   * 비디오 제목 (접근성용)
   */
  title?: string;

  /**
   * 너비 (기본값: 685)
   */
  width?: number;

  /**
   * 높이 (기본값: 540)
   */
  height?: number;

  /**
   * 추가 CSS 클래스
   */
  className?: string;
}

/**
 * YouTube 비디오 렌더러 컴포넌트
 *
 * YouTube 비디오를 임베드합니다.
 * 표준 크기(685x540)를 유지하면서 반응형으로 조정됩니다.
 */
export default function YouTubeRenderer({
  videoId,
  title,
  width = 685,
  height = 540,
  className = '',
}: YouTubeRendererProps) {
  if (!videoId) {
    return null;
  }

  const embedUrl = `https://www.youtube.com/embed/${videoId}`;

  return (
    <div
      className={`youtube-wrapper ${className}`}
      data-youtube-video
      style={{
        position: 'relative',
        width: `${width}px`,
        height: `${height}px`,
        maxWidth: '100%',
        margin: '0 auto',
      }}
    >
      <iframe
        src={embedUrl}
        title={title || `YouTube video ${videoId}`}
        width="100%"
        height="100%"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}