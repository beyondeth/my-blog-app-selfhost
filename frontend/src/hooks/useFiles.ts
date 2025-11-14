import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { FileUpload, FileType, FileTypeType } from '@/types';
import { getErrorMessage } from '@/utils/queryHelpers';
import { convertImageToWebP, validateImageFile } from '@/utils/imageUtils';

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
    mutationFn: async ({ file, fileType }: { file: File; fileType?: FileTypeType }) => {
      // 타입 안전성을 위한 유효성 검사
      const validFileType = fileType && Object.values(FileType).includes(fileType)
        ? fileType
        : FileType.GENERAL;

      let fileToUpload = file;

      // 이미지 파일이고 WebP가 아니면 변환
      if (validFileType === FileType.IMAGE && file.type !== 'image/webp') {
        try {
          console.log('[useUploadFile] Converting image to WebP:', {
            originalName: file.name,
            originalType: file.type,
            originalSize: file.size
          });

          fileToUpload = await convertImageToWebP(file);

          console.log('[useUploadFile] WebP conversion completed:', {
            convertedName: fileToUpload.name,
            convertedType: fileToUpload.type,
            convertedSize: fileToUpload.size
          });
        } catch (error) {
          console.error('[useUploadFile] WebP conversion failed:', error);
          throw new Error(typeof error === 'string' ? error : 'WebP 변환에 실패했습니다. 이미지는 WebP 형식만 업로드할 수 있습니다.');
        }
      }

      return await apiClient.uploadFile(fileToUpload, validFileType);
    },
    retry: 1,
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