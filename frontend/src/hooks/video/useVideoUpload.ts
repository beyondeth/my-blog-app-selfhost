/**
 * 비디오 업로드 훅
 *
 * 비디오 파일 업로드 전체 플로우를 관리:
 * 1. 파일 검증 (크기, 포맷)
 * 2. Presigned URL 요청 (R2)
 * 3. 원본 영상 R2 업로드
 * 4. 업로드 완료 → BullMQ Job 생성
 * 5. 서버에서 FFmpeg 압축 (백그라운드)
 * 6. 처리 완료 시 결과 반환
 */

import { useState, useCallback, useRef } from 'react';
import {
  VideoUploadState,
  VideoUploadResult,
  DEFAULT_VIDEO_CONFIG,
  isValidVideoMimeType,
  isValidVideoFileSize,
  formatFileSize,
} from '@/types/video';
import {
  createVideoUploadUrl,
  uploadVideoToR2,
  notifyVideoUploadComplete,
  waitForVideoProcessing,
} from '@/services/api/video.service';

interface UseVideoUploadOptions {
  onSuccess?: (result: VideoUploadResult) => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

interface UseVideoUploadReturn {
  state: VideoUploadState;
  uploadVideo: (file: File) => Promise<VideoUploadResult | null>;
  cancelUpload: () => void;
  reset: () => void;
}

const initialState: VideoUploadState = {
  stage: 'idle',
  uploadProgress: 0,
  processingStatus: '',
  error: null,
};

export function useVideoUpload(options: UseVideoUploadOptions = {}): UseVideoUploadReturn {
  const { onSuccess, onError, onProgress } = options;

  const [state, setState] = useState<VideoUploadState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef(false);

  /**
   * 상태 업데이트 헬퍼
   */
  const updateState = useCallback((updates: Partial<VideoUploadState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * 업로드 취소
   */
  const cancelUpload = useCallback(() => {
    isCancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    updateState({
      stage: 'error',
      error: '업로드가 취소되었습니다.',
    });
  }, [updateState]);

  /**
   * 상태 초기화
   */
  const reset = useCallback(() => {
    isCancelledRef.current = false;
    abortControllerRef.current = null;
    setState(initialState);
  }, []);

  /**
   * 비디오 업로드 메인 함수
   */
  const uploadVideo = useCallback(async (file: File): Promise<VideoUploadResult | null> => {
    // 초기화
    reset();
    isCancelledRef.current = false;
    abortControllerRef.current = new AbortController();

    try {
      // 1. 파일 검증
      if (!isValidVideoMimeType(file.type)) {
        throw new Error(
          `지원하지 않는 비디오 형식입니다. (지원: MP4, WebM, MOV)`,
        );
      }

      if (!isValidVideoFileSize(file.size)) {
        throw new Error(
          `파일 크기가 너무 큽니다. (최대: ${formatFileSize(DEFAULT_VIDEO_CONFIG.maxFileSize)})`,
        );
      }

      updateState({
        stage: 'uploading',
        uploadProgress: 0,
        processingStatus: 'Presigned URL 요청 중...',
      });

      // 2. Presigned URL 요청
      const uploadUrlResponse = await createVideoUploadUrl({
        fileName: file.name,
        mimeType: file.type as 'video/mp4' | 'video/webm' | 'video/quicktime',
        fileSize: file.size,
      });

      if (!uploadUrlResponse.uploadUrl) {
        throw new Error(uploadUrlResponse.error || 'Presigned URL 생성 실패');
      }

      if (isCancelledRef.current) {
        throw new Error('업로드가 취소되었습니다.');
      }

      // 3. R2에 비디오 업로드
      updateState({
        processingStatus: '비디오 업로드 중...',
      });

      await uploadVideoToR2(uploadUrlResponse.uploadUrl, file, (progress) => {
        updateState({ uploadProgress: progress });
        onProgress?.(progress);
      });

      if (isCancelledRef.current) {
        throw new Error('업로드가 취소되었습니다.');
      }

      // 4. 업로드 완료 알림 (BullMQ Job 생성)
      updateState({
        stage: 'processing',
        uploadProgress: 100,
        processingStatus: '서버에서 비디오 처리 중...',
      });

      const completeResponse = await notifyVideoUploadComplete({
        fileKey: uploadUrlResponse.fileKey,
        fileName: file.name,
        fileSize: file.size,
      });

      if (!completeResponse.success) {
        throw new Error(completeResponse.error || '업로드 완료 알림 실패');
      }

      // 5. 처리 완료까지 폴링
      const finalStatus = await waitForVideoProcessing(
        uploadUrlResponse.videoId,
        {
          pollInterval: DEFAULT_VIDEO_CONFIG.pollInterval,
          maxAttempts: DEFAULT_VIDEO_CONFIG.maxPollAttempts,
          onProgress: (status) => {
            // 처리 중 상태 메시지 업데이트
            if (status.status === 'processing') {
              updateState({
                processingStatus: '비디오 압축 처리 중... (약 1-2분 소요)',
              });
            }
          },
        },
      );

      if (finalStatus.status === 'failed') {
        throw new Error(finalStatus.error || '비디오 처리 실패');
      }

      // 6. 성공
      const result: VideoUploadResult = {
        success: true,
        videoId: uploadUrlResponse.videoId,
        status: finalStatus.status,
        url: finalStatus.url,
      };

      updateState({
        stage: 'complete',
        processingStatus: '비디오 업로드 완료!',
      });

      onSuccess?.(result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

      updateState({
        stage: 'error',
        error: errorMessage,
        processingStatus: '',
      });

      onError?.(errorMessage);
      return null;
    }
  }, [reset, updateState, onSuccess, onError, onProgress]);

  return {
    state,
    uploadVideo,
    cancelUpload,
    reset,
  };
}

export default useVideoUpload;
