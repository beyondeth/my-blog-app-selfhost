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
}

export function useImageGallerySync({
  editor,
  enableImageManager,
  onFilesChange,
  onThumbnailSelect,
}: UseImageGallerySyncProps) {
  const [images, setImages] = useState<UploadedImageInfo[]>([]);
  const [selectedThumbnailId, setSelectedThumbnailId] = useState<string>('');

  // Image upload manager hook 사용
  const imageUploadManager = useImageUploadManager({
    editor,
    images,
    onImagesChange: (newImages) => {
      console.log('[useImageGallerySync] onImagesChange called with', newImages.length, 'images');
      console.log('[useImageGallerySync] New images:', newImages.map(img => ({ id: img.id, name: img.name })));
      setImages(newImages);
    },
    selectedThumbnailId,
    onThumbnailSelect: (thumbnailId: string) => {
      setSelectedThumbnailId(thumbnailId);
      onThumbnailSelect?.(thumbnailId);
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
    setSelectedThumbnailId,
    imageUploadManager,
  };
}