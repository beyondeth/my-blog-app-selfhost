/**
 * useImageGallerySync Hook
 * 이미지 갤러리와 에디터 간의 동기화 관리
 */

import { useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { UploadedImageInfo } from '../components/ImageManager/ImageUploadManager';
import { useImageUploadManager } from './useImageUploadManager';

interface UseImageGallerySyncProps {
  editor: Editor | null;
  enableImageManager?: boolean;
  onFilesChange?: (fileIds: string[]) => void;
  onThumbnailSelect?: (thumbnailId: string) => void;
  selectedThumbnailId?: string;  // Parent에서 전달받은 값
}

export function useImageGallerySync({
  editor,
  enableImageManager,
  onFilesChange,
  onThumbnailSelect,
  selectedThumbnailId = '',  // Parent에서 전달받은 값 사용
}: UseImageGallerySyncProps) {
  const [images, setImages] = useState<UploadedImageInfo[]>([]);
  // 로컬 selectedThumbnailId 상태 제거
  
  console.log('[useImageGallerySync] 🔍 Editor 상태:', !!editor, editor?.isDestroyed);

  // Image upload manager hook 사용
  const imageUploadManager = useImageUploadManager({
    editor,
    images,
    onImagesChange: (newImages) => {
      setImages(newImages);
    },
    selectedThumbnailId,
    onThumbnailSelect: (thumbnailId: string) => {
      onThumbnailSelect?.(thumbnailId);  // Parent의 상태만 업데이트
    },
  });

  // Update image upload manager when editor changes
  useEffect(() => {
    if (enableImageManager && editor) {
      // Update the image upload manager with the current editor instance
      // This allows the manager to insert images directly into the editor
    }
  }, [editor, enableImageManager]);

  return {
    images,
    setImages,
    selectedThumbnailId,
    // setSelectedThumbnailId 제거 - parent에서 관리
    imageUploadManager,
  };
}