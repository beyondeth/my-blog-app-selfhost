import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { deleteFile } from '@/lib/api';

interface TrackedFile {
  id: string;
  size: number;
  name: string;
}

/**
 * 포스트 이미지 용량 추적 Hook
 * 포스트당 최대 30MB 제한 관리
 */
const MAX_TOTAL_SIZE = 30 * 1024 * 1024; // 30MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file

/**
 * 포스트 이미지 용량 추적 Hook
 * 포스트당 최대 30MB 제한 관리
 */
export function usePostImageTracker() {
  const [trackedFiles, setTrackedFiles] = useState<TrackedFile[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const isCleaningUpRef = useRef(false);
  const cleanedUpFilesRef = useRef(new Set<string>());

  // 총 크기 재계산
  useEffect(() => {
    const total = trackedFiles.reduce((sum, file) => sum + file.size, 0);
    setTotalSize(total);
  }, [trackedFiles]);

  /**
   * 파일 크기를 사람이 읽기 쉬운 형태로 변환
   */
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  /**
   * 새 파일을 추가할 수 있는지 확인
   */
  const canAddFile = useCallback((fileSize: number): boolean => {
    // 개별 파일 크기 체크
    if (fileSize > MAX_FILE_SIZE) {
      toast.error(
        `파일 크기가 10MB를 초과합니다. (${formatFileSize(fileSize)})`,
        { duration: 5000 }
      );
      return false;
    }

    // 총 용량 체크
    if (totalSize + fileSize > MAX_TOTAL_SIZE) {
      const remaining = MAX_TOTAL_SIZE - totalSize;
      toast.error(
        `포스트 용량 초과: 총 용량 ${formatFileSize(totalSize + fileSize)} / 30MB (남은 용량: ${formatFileSize(remaining)})`,
        { 
          duration: 7000,
          action: {
            label: '파일 관리',
            onClick: () => {
              // TODO: 파일 관리 모달 열기
              console.log('Open file manager');
            }
          }
        }
      );
      return false;
    }

    return true;
  }, [totalSize, formatFileSize]);

  /**
   * 파일 추가
   */
  const addFile = useCallback((file: { id: string; size: number; name: string }): boolean => {
    if (!canAddFile(file.size)) {
      return false;
    }

    setTrackedFiles(prev => [...prev, file]);
    
    // 용량 경고 (80% 이상 사용 시)
    const newTotal = totalSize + file.size;
    const percentage = (newTotal / MAX_TOTAL_SIZE) * 100;
    
    if (percentage >= 80 && percentage < 100) {
      toast.warning(
        `포스트 용량 ${percentage.toFixed(0)}% 사용 중 (${formatFileSize(newTotal)} / 30MB)`,
        { duration: 3000 }
      );
    }

    return true;
  }, [totalSize, canAddFile, formatFileSize]);

  /**
   * 파일 제거
   */
  const removeFile = useCallback((fileId: string): void => {
    setTrackedFiles(prev => prev.filter(f => f.id !== fileId));
    toast.success('파일이 제거되었습니다.');
  }, []);

  /**
   * 모든 파일 초기화
   */
  const clearFiles = useCallback((): void => {
    setTrackedFiles([]);
    setTotalSize(0);
    cleanedUpFilesRef.current = new Set();
  }, []);

  /**
   * 업로드된 파일들을 서버에서 삭제 (작성 취소시 사용)
   * @deprecated 자동 삭제 비활성화 - 사용자가 수동으로 관리하도록 변경
   */
  const cleanupUploadedFiles = useCallback(async (force: boolean = false): Promise<void> => {
    // 자동 파일 삭제 비활성화
    // 이유: 사용자가 나중에 재사용할 수 있는 이미지를 보존하기 위함
    // 추후 사용자 대시보드에서 수동 관리 기능 제공 예정
    console.log('[Image Tracker] Auto-cleanup disabled - files preserved for user management');
    console.log(`[Image Tracker] ${trackedFiles.length} files uploaded in this session`);
    
    // 로컬 추적 상태만 초기화 (실제 파일은 삭제하지 않음)
    clearFiles();
    
    return;
  }, [trackedFiles, clearFiles]);

  return {
    trackedFiles,
    totalSize,
    remaining: MAX_TOTAL_SIZE - totalSize,
    percentage: (totalSize / MAX_TOTAL_SIZE) * 100,
    maxTotalSize: MAX_TOTAL_SIZE,
    maxFileSize: MAX_FILE_SIZE,
    canAddFile,
    addFile,
    removeFile,
    clearFiles,
    cleanupUploadedFiles,
    formatFileSize,
  };
}