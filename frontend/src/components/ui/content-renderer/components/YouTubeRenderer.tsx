"use client";

import React from 'react';
import YouTubeEmbedPlayer from '@/components/ui/YouTubeEmbedPlayer';

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

  return (
    <YouTubeEmbedPlayer
      videoId={videoId}
      title={title}
      width={width}
      height={height}
      className={`youtube-wrapper ${className}`}
      iframeClassName="youtube-iframe"
    />
  );
}
