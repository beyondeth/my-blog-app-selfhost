"use client";

/**
 * Video Node Component
 * 에디터에서 비디오 노드를 렌더링하는 컴포넌트
 *
 * 기능:
 * - 상태별 UI (processing: 로딩, ready: 플레이어, failed: 에러)
 * - 캡션 입력 지원
 * - 고정 너비 685px, max-width: 100%
 */

import React, { useState, useEffect, useCallback } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { Loader2, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getVideoStatus } from '@/services/api/video.service';
import { VideoStatus } from '../../extensions/VideoEmbed.extension';
import { useVideoUploadStore } from '@/stores/videoUploadStore';
import CircularProgress from '@/components/ui/CircularProgress';

// ============================================
// 타입 정의
// ============================================
export interface VideoNodeProps extends NodeViewProps {
  selected: boolean;
}

// ============================================
// 메인 컴포넌트
// ============================================
export const VideoNode: React.FC<VideoNodeProps> = ({
  node,
  updateAttributes,
  selected,
  deleteNode,
  editor,
}) => {
  const videoId = node.attrs['data-video-id'] || '';
  const status = node.attrs.status as VideoStatus;
  const src = node.attrs.src || '';
  const caption = node.attrs.caption || '';

  const [isPolling, setIsPolling] = useState(false);

  // Zustand 스토어에서 업로드 진행률 구독 (uploading 상태에서만 사용)
  const uploadProgress = useVideoUploadStore(
    (state) => state.uploads.get(videoId)
  );

  // 처리 중인 경우 상태 폴링
  useEffect(() => {
    if (status !== 'processing' || !videoId || isPolling) return;

    let cancelled = false;
    setIsPolling(true);

    const pollStatus = async () => {
      try {
        const response = await getVideoStatus(videoId);

        if (cancelled) return;

        if (response.status === 'ready' && response.url) {
          updateAttributes({
            status: 'ready',
            src: response.url,
          });
          setIsPolling(false);
        } else if (response.status === 'failed') {
          updateAttributes({
            status: 'failed',
          });
          setIsPolling(false);
        } else {
          // 계속 폴링 (3초 후)
          setTimeout(pollStatus, 3000);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('비디오 상태 조회 실패:', error);
        // 에러 시에도 재시도
        setTimeout(pollStatus, 5000);
      }
    };

    pollStatus();

    return () => {
      cancelled = true;
    };
  }, [videoId, status, updateAttributes, isPolling]);

  // 캡션 변경 핸들러
  const handleCaptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateAttributes({ caption: e.target.value });
    },
    [updateAttributes],
  );

  // 삭제 핸들러
  const handleDelete = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  return (
    <NodeViewWrapper
      className={cn(
        'video-embed-wrapper relative my-6',
        selected && 'ring-2 ring-blue-500 ring-offset-2 rounded-lg',
      )}
    >
      {/* 삭제 버튼 */}
      {selected && editor?.isEditable && (
        <button
          onClick={handleDelete}
          className="absolute -top-2 -right-2 z-10 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
          title="비디오 삭제"
        >
          <X size={16} />
        </button>
      )}

      <figure className="relative flex flex-col items-center">
        {/* 비디오 컨테이너 */}
        <div
          className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
          style={{ width: '100%', maxWidth: '685px' }}
        >
          {/* Processing 상태 */}
          {status === 'processing' && (
            <div className="flex flex-col items-center justify-center py-16 px-8">
              <Loader2 className="w-10 h-10 text-gray-400 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                비디오 처리 중...
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                약 1-2분 정도 소요됩니다
              </p>
            </div>
          )}

          {/* Failed 상태 */}
          {status === 'failed' && (
            <div className="flex flex-col items-center justify-center py-16 px-8">
              <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
              <p className="text-red-500 text-sm font-medium">
                비디오 처리 실패
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                다시 업로드해 주세요
              </p>
            </div>
          )}

          {/* Uploading 상태 - 원형 프로그레스바 표시 */}
          {status === 'uploading' && (
            <div className="flex flex-col items-center justify-center py-16 px-8">
              <CircularProgress
                progress={uploadProgress?.progress ?? 0}
                size={72}
                strokeWidth={6}
                showText
              />
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-4">
                비디오 업로드 중...
              </p>
            </div>
          )}

          {/* Ready 상태: 비디오 플레이어 */}
          {status === 'ready' && src && (
            <video
              src={src}
              controls
              preload="metadata"
              className="w-full"
              style={{ maxWidth: '685px' }}
            >
              브라우저가 비디오를 지원하지 않습니다.
            </video>
          )}
        </div>

        {/* 캡션 입력 */}
        {editor?.isEditable && (
          <input
            type="text"
            value={caption}
            onChange={handleCaptionChange}
            placeholder="캡션 추가..."
            className={cn(
              'mt-2 w-full max-w-[685px] text-center text-sm',
              'text-gray-500 dark:text-gray-400',
              'bg-transparent border-none outline-none',
              'placeholder:text-gray-400 dark:placeholder:text-gray-500',
              'focus:ring-0',
            )}
          />
        )}

        {/* 읽기 전용 캡션 */}
        {!editor?.isEditable && caption && (
          <figcaption className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
            {caption}
          </figcaption>
        )}
      </figure>
    </NodeViewWrapper>
  );
};

export default VideoNode;
