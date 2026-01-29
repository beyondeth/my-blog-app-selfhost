"use client";

import React, { useEffect, useId, useMemo, useRef } from 'react';

type YouTubeEmbedPlayerProps = {
  videoId: string;
  title?: string;
  className?: string;
  iframeClassName?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
};

const YT_API_SRC = 'https://www.youtube.com/iframe_api';
let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  const win = window as any;
  if (win.YT && win.YT.Player) {
    return Promise.resolve();
  }

  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve) => {
      const existingScript = document.querySelector(`script[src="${YT_API_SRC}"]`);
      const previousReady = win.onYouTubeIframeAPIReady;

      win.onYouTubeIframeAPIReady = () => {
        if (typeof previousReady === 'function') {
          previousReady();
        }
        resolve();
      };

      if (existingScript) {
        return;
      }

      const script = document.createElement('script');
      script.src = YT_API_SRC;
      document.head.appendChild(script);
    });
  }

  return youtubeApiPromise;
}

export default function YouTubeEmbedPlayer({
  videoId,
  title,
  className = '',
  iframeClassName = '',
  width = 685,
  height = 540,
  aspectRatio,
}: YouTubeEmbedPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<any>(null);
  const forcedVolumeRef = useRef(false);
  const reactId = useId();

  const iframeId = useMemo(() => {
    const sanitized = reactId.replace(/[^a-zA-Z0-9_-]/g, '');
    return `yt-player-${sanitized}-${videoId}`;
  }, [reactId, videoId]);

  const embedUrl = useMemo(() => {
    if (!videoId) return '';
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      enablejsapi: '1',
    });
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }, [videoId]);

  useEffect(() => {
    if (!videoId) return;

    let cancelled = false;

    loadYouTubeApi().then(() => {
      if (cancelled) return;
      if (!iframeRef.current) return;

      const win = window as any;
      if (!win.YT || !win.YT.Player) return;

      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      forcedVolumeRef.current = false;

      playerRef.current = new win.YT.Player(iframeRef.current, {
        events: {
          onStateChange: (event: any) => {
            if (!win.YT?.PlayerState) return;
            if (event.data === win.YT.PlayerState.PLAYING && !forcedVolumeRef.current) {
              try {
                event.target.setVolume(50);
              } catch {
                // ignore volume set failures
              }
              forcedVolumeRef.current = true;
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }
      playerRef.current = null;
      forcedVolumeRef.current = false;
    };
  }, [videoId, iframeId]);

  if (!videoId) {
    return null;
  }

  const wrapperStyle: React.CSSProperties = aspectRatio
    ? {
        position: 'relative',
        width: '100%',
        paddingBottom: `${aspectRatio * 100}%`,
      }
    : {
        position: 'relative',
        width: `${width}px`,
        height: `${height}px`,
        maxWidth: '100%',
        margin: '0 auto',
      };

  const iframeStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  };

  return (
    <div className={className} style={wrapperStyle} data-youtube-video>
      <iframe
        ref={iframeRef}
        id={iframeId}
        src={embedUrl}
        title={title || `YouTube video ${videoId}`}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        className={iframeClassName}
        style={iframeStyle}
      />
    </div>
  );
}
