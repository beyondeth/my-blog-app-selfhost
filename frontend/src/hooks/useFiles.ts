import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { FileUpload, FileType, FileTypeType } from '@/types';
import { convertImageToWebP, validateImageFile } from '@/utils/imageUtils';
import type { UploadFileOptions } from '@/lib/api/endpoints/files';
import {
  getImageUploadProgress,
  type ImageUploadProgress,
} from '@/utils/imageUpload';

export interface UploadFileVariables extends Omit<UploadFileOptions, 'onProgress'> {
  file: File;
  fileType?: FileTypeType;
  onProgress?: (event: ImageUploadProgress) => void;
}

// File Query Keys
export const fileQueryKeys = {
  all: ['files'] as const,
  lists: () => [...fileQueryKeys.all, 'list'] as const,
  list: (filters: { fileType?: string; page?: number; limit?: number }) => 
    [...fileQueryKeys.lists(), filters] as const,
  details: () => [...fileQueryKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...fileQueryKeys.details(), id] as const,
};

// 파일 목록 조회 훅
export function useFiles(params?: {
  fileType?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: fileQueryKeys.list(params || {}),
    queryFn: () => apiClient.getUserFiles(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// 파일 업로드 뮤테이션 훅 - WebP 변환 로직 추가
export function useUploadFile() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ file, fileType, onProgress, signal }: UploadFileVariables) => {
      onProgress?.(getImageUploadProgress('validating'));
      // 타입 안전성을 위한 유효성 검사
      const validFileType = fileType && Object.values(FileType).includes(fileType)
        ? fileType
        : FileType.GENERAL;

      let fileToUpload = file;

      // 모든 게시물 이미지는 동일한 입력 정책을 통과한 뒤 WebP로 최적화합니다.
      if (validFileType === FileType.IMAGE) {
        const validation = validateImageFile(file);
        if (!validation.valid) {
          throw new Error(validation.error || '이미지 파일을 확인해주세요.');
        }

        try {
          console.log('[useUploadFile] Converting image to WebP:', {
            originalName: file.name,
            originalType: file.type,
            originalSize: file.size
          });

          fileToUpload = await convertImageToWebP(file, {
            signal,
            onProgress: (progress) => {
              onProgress?.(getImageUploadProgress('optimizing', progress));
            },
          });

          console.log('[useUploadFile] WebP conversion completed:', {
            convertedName: fileToUpload.name,
            convertedType: fileToUpload.type,
            convertedSize: fileToUpload.size
          });
        } catch (error) {
          console.error('[useUploadFile] WebP conversion failed:', error);
          if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
          }
          throw new Error(typeof error === 'string' ? error : 'WebP 변환에 실패했습니다. 이미지는 WebP 형식만 업로드할 수 있습니다.');
        }
      }

      return await apiClient.uploadFile(fileToUpload, validFileType, {
        signal,
        onProgress: (progress) => {
          if (progress <= 5) {
            onProgress?.(getImageUploadProgress('preparing', progress * 20));
          } else if (progress < 95) {
            onProgress?.(getImageUploadProgress('uploading', ((progress - 5) / 90) * 100));
          } else if (progress < 100) {
            onProgress?.(getImageUploadProgress('finalizing'));
          } else {
            onProgress?.(getImageUploadProgress('complete'));
          }
        },
      });
    },
  });

  // 성공 처리
  React.useEffect(() => {
    if (mutation.isSuccess) {
      // 파일 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: fileQueryKeys.lists() });
    }
  }, [mutation.isSuccess, queryClient]);

  // 에러 처리
  React.useEffect(() => {
    if (mutation.isError && mutation.error) {
      console.error('File upload error:', mutation.error);
    }
  }, [mutation.isError, mutation.error]);

  return mutation;
}

// 파일 삭제 뮤테이션 훅
export function useDeleteFile() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (fileId: string | number) => {
      const id = typeof fileId === 'string' ? fileId : fileId.toString();
      return apiClient.deleteFile(id);
    },
    retry: 1,
  });

  // 성공 처리
  React.useEffect(() => {
    if (mutation.isSuccess && mutation.variables) {
      const deletedFileId = mutation.variables;

      // 삭제된 파일 캐시 제거
      queryClient.removeQueries({ queryKey: fileQueryKeys.detail(deletedFileId) });
      // 파일 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: fileQueryKeys.lists() });
    }
  }, [mutation.isSuccess, mutation.variables, queryClient]);

  return mutation;
}

// 파일 크기 포맷팅 유틸리티
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
