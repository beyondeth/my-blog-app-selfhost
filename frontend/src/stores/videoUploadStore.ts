/**
 * 비디오 업로드 진행률 전역 상태 관리 스토어
 *
 * @description
 * - videoId별 업로드 진행률 (0-100) 추적
 * - 업로드 상태 (uploading | processing | complete | error) 관리
 * - VideoNode 컴포넌트에서 구독하여 프로그레스바 렌더링
 * - Zustand 구독 기반으로 해당 컴포넌트만 리렌더링
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// 개별 비디오 업로드 상태
export interface VideoUploadProgress {
  progress: number; // 0-100
  stage: 'uploading' | 'processing' | 'complete' | 'error';
  errorMessage?: string;
}

interface VideoUploadState {
  // videoId -> 진행률 맵
  uploads: Map<string, VideoUploadProgress>;
}

interface VideoUploadActions {
  // 업로드 시작 (uploading 상태로 등록)
  startUpload: (videoId: string) => void;

  // 진행률 업데이트 (0-100)
  updateProgress: (videoId: string, progress: number) => void;

  // processing 단계로 전환 (서버 FFmpeg 처리 중)
  setProcessing: (videoId: string) => void;

  // 업로드 완료
  completeUpload: (videoId: string) => void;

  // 에러 발생
  setError: (videoId: string, errorMessage: string) => void;

  // 특정 비디오 상태 제거 (클린업)
  removeUpload: (videoId: string) => void;

  // videoId 교체 (임시 ID → 실제 ID)
  replaceVideoId: (oldId: string, newId: string) => void;

  // 전체 초기화
  resetAll: () => void;
}

type VideoUploadStore = VideoUploadState & VideoUploadActions;

const initialState: VideoUploadState = {
  uploads: new Map(),
};

export const useVideoUploadStore = create<VideoUploadStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // 업로드 시작 - uploading 상태로 등록
      startUpload: (videoId: string) =>
        set((state) => {
          const newUploads = new Map(state.uploads);
          newUploads.set(videoId, {
            progress: 0,
            stage: 'uploading',
          });
          return { uploads: newUploads };
        }),

      // 진행률 업데이트 (0-100)
      updateProgress: (videoId: string, progress: number) =>
        set((state) => {
          const existing = state.uploads.get(videoId);
          if (!existing || existing.stage !== 'uploading') return state;

          const newUploads = new Map(state.uploads);
          newUploads.set(videoId, {
            ...existing,
            progress: Math.min(100, Math.max(0, progress)),
          });
          return { uploads: newUploads };
        }),

      // processing 단계로 전환
      setProcessing: (videoId: string) =>
        set((state) => {
          const existing = state.uploads.get(videoId);
          if (!existing) return state;

          const newUploads = new Map(state.uploads);
          newUploads.set(videoId, {
            progress: 100,
            stage: 'processing',
          });
          return { uploads: newUploads };
        }),

      // 업로드 완료 - 5초 후 자동 클린업
      completeUpload: (videoId: string) => {
        set((state) => {
          const newUploads = new Map(state.uploads);
          newUploads.set(videoId, {
            progress: 100,
            stage: 'complete',
          });
          return { uploads: newUploads };
        });

        // 5초 후 자동 클린업 (메모리 관리)
        setTimeout(() => {
          get().removeUpload(videoId);
        }, 5000);
      },

      // 에러 발생
      setError: (videoId: string, errorMessage: string) =>
        set((state) => {
          const newUploads = new Map(state.uploads);
          newUploads.set(videoId, {
            progress: 0,
            stage: 'error',
            errorMessage,
          });
          return { uploads: newUploads };
        }),

      // 특정 비디오 상태 제거
      removeUpload: (videoId: string) =>
        set((state) => {
          const newUploads = new Map(state.uploads);
          newUploads.delete(videoId);
          return { uploads: newUploads };
        }),

      // videoId 교체 (임시 ID → 실제 ID)
      replaceVideoId: (oldId: string, newId: string) =>
        set((state) => {
          const existing = state.uploads.get(oldId);
          if (!existing) return state;

          const newUploads = new Map(state.uploads);
          newUploads.delete(oldId);
          newUploads.set(newId, existing);
          return { uploads: newUploads };
        }),

      // 전체 초기화
      resetAll: () => set(initialState),
    }),
    {
      name: 'video-upload-store',
    }
  )
);
