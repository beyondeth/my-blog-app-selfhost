"use client";

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface VideoRendererProps {
  /**
   * 비디오 ID (백엔드 Video 엔티티 ID)
   */
  videoId: string;

  /**
   * 비디오 URL (R2 또는 CDN URL)
   * 없으면 API에서 동적으로 조회합니다.
   */
  src?: string;

  /**
   * 캡션 텍스트
   */
  caption?: string;

  /**
   * 최대 너비 (기본값: 685px)
   */
  maxWidth?: number;

  /**
   * 전체 너비 사용 (홈피드 등에서 컨테이너 꽉 채움)
   */
  fullWidth?: boolean;

  /**
   * 자동 재생 (클릭 시 바로 재생)
   */
  autoPlay?: boolean;

  /**
   * 추가 CSS 클래스
   */
  className?: string;
}

/**
 * 비디오 렌더러 컴포넌트
 *
 * 업로드된 비디오를 렌더링합니다.
 * VideoEmbed extension으로 삽입된 비디오를 표시합니다.
 *
 * src가 없는 경우 (포스트 저장 시 비디오 처리 미완료):
 * - videoId로 API를 호출하여 비디오 URL을 동적으로 조회합니다.
 * - 비디오 처리 중이면 "처리 중" 메시지를 표시합니다.
 */
export default function VideoRenderer({
  videoId,
  src: initialSrc,
  caption,
  maxWidth = 685,
  fullWidth = false,
  autoPlay = false,
  className = '',
}: VideoRendererProps) {
  const [videoSrc, setVideoSrc] = useState<string>(initialSrc || '');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!initialSrc);
  const [error, setError] = useState<string | null>(null);

  // src가 없으면 API에서 비디오 URL 조회
  useEffect(() => {
    // 이미 src가 있으면 스킵
    if (initialSrc) {
      setVideoSrc(initialSrc);
      setLoading(false);
      return;
    }

    // videoId가 없으면 에러
    if (!videoId) {
      setError('비디오 ID가 없습니다.');
      setLoading(false);
      return;
    }

    const fetchVideoUrl = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/files/video/${videoId}/public-url`
        );

        if (!response.ok) {
          throw new Error('비디오 정보를 가져올 수 없습니다.');
        }

        const data = await response.json();

        if (data.status === 'ready' && data.url) {
          setVideoSrc(data.url);
          // 썸네일 URL 설정 (있으면)
          if (data.thumbnailUrl) {
            setThumbnailUrl(data.thumbnailUrl);
          }
          setError(null);
        } else if (data.status === 'processing') {
          setError('비디오 처리 중입니다. 잠시 후 새로고침 해주세요.');
        } else if (data.status === 'uploading') {
          setError('비디오 업로드 중입니다.');
        } else if (data.status === 'failed') {
          setError('비디오 처리에 실패했습니다.');
        } else if (data.status === 'not_found') {
          setError('비디오를 찾을 수 없습니다.');
        } else {
          setError('비디오를 불러올 수 없습니다.');
        }
      } catch (err) {
        setError('비디오를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchVideoUrl();
  }, [videoId, initialSrc]);

  // 로딩 중
  if (loading) {
    return (
      <figure
        className={`video-embed-container ${className}`}
        data-video-embed
        data-video-id={videoId}
        style={{ margin: '1.5rem 0', textAlign: 'center' }}
      >
        <div
          className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg"
          style={{
            width: '100%',
            maxWidth: `${maxWidth}px`,
            aspectRatio: '16/9',
            margin: '0 auto',
          }}
        >
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      </figure>
    );
  }

  // 에러 또는 src 없음
  if (error || !videoSrc) {
    return (
      <figure
        className={`video-embed-container ${className}`}
        data-video-embed
        data-video-id={videoId}
        style={{ margin: '1.5rem 0', textAlign: 'center' }}
      >
        <div
          className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg"
          style={{
            width: '100%',
            maxWidth: `${maxWidth}px`,
            aspectRatio: '16/9',
            margin: '0 auto',
          }}
        >
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {error || '비디오를 불러올 수 없습니다.'}
          </p>
        </div>
      </figure>
    );
  }

  // 정상 렌더링
  return (
    <figure
      className={`video-embed-container ${className}`}
      data-video-embed
      data-video-id={videoId}
      style={{
        margin: fullWidth ? 0 : '1.5rem 0',
        textAlign: 'center',
      }}
    >
      <video
        src={videoSrc}
        poster={thumbnailUrl || undefined}
        data-video-id={videoId}
        controls
        autoPlay={autoPlay}
        muted={autoPlay} // autoPlay 시 muted 필요 (브라우저 정책)
        preload="metadata"
        playsInline
        style={{
          width: '100%',
          maxWidth: fullWidth ? 'none' : `${maxWidth}px`,
          margin: '0 auto',
          display: 'block',
          borderRadius: fullWidth ? '12px' : '8px',
          backgroundColor: '#000',
        }}
      >
        브라우저가 비디오를 지원하지 않습니다.
      </video>
      {caption && !fullWidth && (
        <figcaption
          style={{
            marginTop: '0.5rem',
            fontSize: '0.875rem',
            color: 'var(--muted-foreground, #6b7280)',
            textAlign: 'center',
          }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
