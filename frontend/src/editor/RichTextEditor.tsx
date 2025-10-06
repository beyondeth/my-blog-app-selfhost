"use client";

import React, { useCallback, useState, useEffect } from 'react';
import { EditorContent } from '@tiptap/react';
import { toast } from 'sonner';

// Hooks
import { useUploadFile } from '@/hooks/useFiles';
import {
  useEditorSetup,
  useEditorEventManager,
  useYouTubeEmbed,
  useImageGallerySync,
  usePostImageTracker,
} from './hooks';

// Components
import EnhancedEditorToolbar from './components/Toolbar/EnhancedEditorToolbar';
import ImageUploadManager, { UploadedImageInfo } from './components/ImageManager/ImageUploadManager';

// Utils
import { validateImageFile } from '@/utils/imageUtils';
import { getProxyImageUrl, normalizeImageUrl, debugLog } from '@/utils/imageUtils';
import { getErrorMessage } from '@/utils/queryHelpers';
import { stripUnderline } from '@/utils/stripUnderline';

// Styles
import './styles/editor.css';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onFilesChange?: (fileIds: string[]) => void;
  onThumbnailSelect?: (thumbnailId: string) => void;
  selectedThumbnailId?: string;  // Add this to pass selected thumbnail
  onImagesChange?: (images: UploadedImageInfo[]) => void;  // Add this to expose images
  onValidationChange?: (isValid: boolean, reason?: string) => void;  // Validation callback
  initialImages?: UploadedImageInfo[];  // Initial images for edit mode
  placeholder?: string;
  className?: string;
  enableImageManager?: boolean;
  maxImages?: number;
  enableCleanupOnUnmount?: boolean;
}

export default function BlogRichTextEditor({
  content,
  onChange,
  onFilesChange,
  onThumbnailSelect,
  selectedThumbnailId: parentSelectedThumbnailId,
  onImagesChange,
  onValidationChange,
  initialImages,
  placeholder = "내용을 입력하세요...",
  className = "",
  enableImageManager = false,
  maxImages = 5,
  enableCleanupOnUnmount = false
}: RichTextEditorProps) {
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  
  // 파일 업로드 및 트래커 훅
  const uploadMutation = useUploadFile();
  const imageTracker = usePostImageTracker();

  // 썸네일 선택 핸들러를 useCallback으로 메모이제이션
  const handleThumbnailSelectCallback = useCallback((thumbnailId: string) => {
    onThumbnailSelect?.(thumbnailId);
  }, [onThumbnailSelect]);

  // 이미지 업로드 핸들러 - URL과 ID를 모두 반환
  const handleImageUpload = useCallback(async (file: File) => {
    try {
      setIsUploading(true);
      
      const validation = validateImageFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const result = await uploadMutation.mutateAsync({
        file,
        fileType: 'image' as const,
      });
      const imageUrl = (result as any).url || (result as any).accessUrl;
      
      const normalizedUrl = normalizeImageUrl(imageUrl);
      const finalUrl = getProxyImageUrl(normalizedUrl) || normalizedUrl;
      const imageId = String(result.id);
      
      debugLog('image-upload', '이미지 업로드 성공');

      // 파일 ID 업데이트
      setUploadedFiles(prev => {
        const newFiles = [...prev, imageId];
        setTimeout(() => onFilesChange?.(newFiles), 0);
        return newFiles;
      });

      // 이미지 트래커에 파일 추가
      setTimeout(() => imageTracker.addFile({
        id: imageId,
        size: (result as any).size || file.size,
        name: (result as any).name || file.name
      }), 0);

      // 갤러리에 이미지 추가 (중요!) - setGalleryImages 사용
      const newImage = {
        id: imageId,
        url: finalUrl,
        name: file.name,
        size: file.size,
        isUploading: false,
      };
      
      // 갤러리 이미지 상태 업데이트 (동기화를 위해 setGalleryImages 사용)
      if (setGalleryImages) {
        setGalleryImages(prev => [...prev, newImage]);
      }

      toast.success('이미지가 업로드되었습니다');
      return { url: finalUrl, id: imageId };

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [uploadMutation, onFilesChange, imageTracker]);

  // 에디터 업데이트 핸들러
  const handleEditorUpdate = useCallback((newContent: string) => {
    const strippedContent = stripUnderline(newContent);
    if (strippedContent !== content) {
      onChange(strippedContent);
    }
  }, [content, onChange]);

  // 이미지 갤러리 동기화 - 먼저 선언해야 함
  const {
    images: galleryImages,
    setImages: setGalleryImages,
    selectedThumbnailId: localSelectedThumbnailId,  // Hook에서 반환하는 값 (parent의 값)
    imageUploadManager,
  } = useImageGallerySync({
    editor: editorInstance, // 에디터 인스턴스를 동적으로 전달
    enableImageManager,
    onFilesChange,
    onThumbnailSelect: handleThumbnailSelectCallback,  // 메모이제이션된 콜백 사용
    selectedThumbnailId: parentSelectedThumbnailId,  // Parent의 값 전달
    initialImages,  // 초기 이미지 전달
  });

  // Call onImagesChange whenever galleryImages changes
  useEffect(() => {
    if (onImagesChange) {
      onImagesChange(galleryImages);
    }
  }, [galleryImages, onImagesChange]);

  // YouTube 임베드 훅 - setGalleryImages 직접 연결 (동기화 락 우회)
  const { addYouTubeThumbnail, clearProcessedYouTubeId } = useYouTubeEmbed({
    enableImageManager,
    images: galleryImages,
    setImages: setGalleryImages,  // ✅ handleGalleryImageChange 우회하여 직접 상태 업데이트
    setSelectedThumbnailId: onThumbnailSelect as React.Dispatch<React.SetStateAction<string>> || (() => {}),
    onThumbnailSelect,
    setUploadedFiles,
    onFilesChange,
  });

  // 에디터에서 YouTube가 삭제되었을 때 이벤트 리스너
  useEffect(() => {
    const handleYouTubeDeletedFromEditor = (event: CustomEvent) => {
      const { videoId } = event.detail;
      clearProcessedYouTubeId(videoId);
    };

    window.addEventListener('youtubeDeletedFromEditor', handleYouTubeDeletedFromEditor as EventListener);
    
    return () => {
      window.removeEventListener('youtubeDeletedFromEditor', handleYouTubeDeletedFromEditor as EventListener);
    };
  }, [clearProcessedYouTubeId]);

  // YouTube가 추가되었을 때 처리 (이제 CustomYoutube extension에서 직접 처리)
  // 이벤트는 갤러리 동기화를 위해 여전히 필요함

  // YouTube 삭제 감지를 위한 래퍼 함수
  const handleGalleryImageChangeWithYouTubeCleanup = useCallback((newImages: UploadedImageInfo[]) => {
    // 삭제된 YouTube 썸네일 찾기
    const deletedYouTubeIds = galleryImages
      .filter(oldImg => 
        oldImg.id.startsWith('yt_thumb_') && 
        !newImages.some(newImg => newImg.id === oldImg.id)
      )
      .map(img => img.id.replace('yt_thumb_', ''));
    
    // 삭제된 YouTube ID들을 processedVideoIds에서 제거
    deletedYouTubeIds.forEach(videoId => {
      clearProcessedYouTubeId(videoId);
    });
    
    // 원래 함수 호출
    imageUploadManager.handleGalleryImageChange(newImages);
  }, [galleryImages, clearProcessedYouTubeId, imageUploadManager]);

  // 에디터 설정
  const { editor, editorRef } = useEditorSetup({
    content,
    placeholder,
    onChange: handleEditorUpdate,
    handleImageUpload,
    addYouTubeThumbnail,
  });

  // 에디터가 생성되면 editorInstance 상태 업데이트
  useEffect(() => {
    if (editor) {
      setEditorInstance(editor);
    }
  }, [editor]);

  // 양방향 동기화 제거 - galleryImages가 진실의 단일 소스 (Single Source of Truth)

  // 이벤트 매니저
  useEditorEventManager(editor, {
    onImageUpload: handleImageUpload,
    onYouTubeEmbed: addYouTubeThumbnail,
    imageTracker,
    enableCleanupOnUnmount,
  });

  // 이미지 업로드 트리거 (툴바에서 사용)
  const triggerImageUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      
      for (const file of files) {
        try {
          const result = await handleImageUpload(file);
          
          if (editor && !editor.isDestroyed) {
            // 이미지 삽입시 data-image-id 추가 (동기화를 위해)
            const attrs: any = {
              src: result.url, 
              alt: file.name,
              title: file.name
            };
            attrs['data-image-id'] = result.id; // 동기화를 위한 ID 추가
            
            // 현재 줄의 전체 텍스트 확인 (YouTube URL 체크)
            const { state } = editor;
            const { selection, doc } = state;
            const $pos = doc.resolve(selection.from);
            const start = $pos.start($pos.depth);
            const end = $pos.end($pos.depth); // 줄 끝까지 가져오기
            const lineText = doc.textBetween(start, end, '', '').trim();
            
            // YouTube URL 패턴 체크
            const youtubeRegex = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)(\/(watch\?v=|embed\/|v\/|shorts\/)?)([\w-]+)(&\S+)?$/;

            if (lineText && youtubeRegex.test(lineText)) {
              // YouTube URL이 있으면 먼저 변환
              
              // 현재 줄 전체를 YouTube로 변환하고 이미지 추가
              editor
                .chain()
                .setTextSelection({ from: start, to: end })
                .deleteSelection()
                .insertContent([
                  {
                    type: 'youtube',
                    attrs: {
                      src: lineText,
                      width: 685,
                      height: 540,
                    }
                  },
                  { type: 'paragraph' },
                  {
                    type: 'image',
                    attrs
                  },
                  { type: 'paragraph' }
                ])
                .focus('end')
                .run();
            } else {
              // YouTube 블록 보호 로직
              const currentPos = selection.from;
              let isInYouTube = false;
              let youtubeEndPos: number | null = null;
              
              doc.descendants((node, pos) => {
                if (node.type.name === 'youtube') {
                  const nodeEnd = pos + node.nodeSize;
                  if (pos <= currentPos && currentPos <= nodeEnd) {
                    isInYouTube = true;
                    youtubeEndPos = nodeEnd;
                    return false;
                  }
                }
              });

              if (isInYouTube && youtubeEndPos !== null) {
                // YouTube 블록 내부에 있으면 블록 다음에 삽입
                editor
                  .chain()
                  .setTextSelection(youtubeEndPos)
                  .focus()
                  .insertContent([
                    { type: 'paragraph' },
                    { type: 'image', attrs },
                    { type: 'paragraph' }
                  ])
                  .focus('end')
                  .run();
              } else {
                // 안전한 경우 기존 방식대로
                editor
                  .chain()
                  .focus()
                  .setImage(attrs)
                  .insertContent('<p></p>') // 새 단락 추가
                  .focus('end') // 커서를 끝으로 이동
                  .run();
              }
            }
          }
        } catch (error) {
          console.error('Failed to upload image:', error);
        }
      }
    };
    
    input.click();
  }, [editor, handleImageUpload]);

  if (!editor) {
    return null;
  }

  return (
    <div className={`editor-container ${className}`}>
      <EnhancedEditorToolbar 
        editor={editor} 
        onImageUpload={triggerImageUpload}
      />
      
      <EditorContent editor={editor} />
      
      {/* Enhanced Image Upload Manager - 에디터가 준비된 후에만 렌더링 */}
      {enableImageManager && editorInstance && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="p-4">
            <ImageUploadManager
              images={galleryImages}  // galleryImages를 사용해야 함!
              maxImages={maxImages}
              onImagesChange={handleGalleryImageChangeWithYouTubeCleanup}
              onImagesUploaded={imageUploadManager.handleImagesUploaded}
              onImagesReordered={imageUploadManager.handleImageReorder}
              onThumbnailSelect={imageUploadManager.handleThumbnailSelect}
              selectedThumbnailId={parentSelectedThumbnailId || localSelectedThumbnailId}
              onValidationChange={onValidationChange}
              className=""
            />
          </div>
        </div>
      )}
      
      {/* 용량 표시 바 */}
      {imageTracker.totalSize > 0 && (
        <div className="p-3 bg-gray-50 border-t border-gray-300">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              이미지 용량: {imageTracker.formatFileSize(imageTracker.totalSize)} / 30MB
            </span>
            <span className={`font-medium ${
              imageTracker.percentage >= 80 ? 'text-destructive' :
              imageTracker.percentage >= 60 ? 'text-muted-foreground' :
              'text-primary'
            }`}>
              {imageTracker.percentage.toFixed(0)}% 사용
            </span>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                imageTracker.percentage >= 80 ? 'bg-destructive' :
                imageTracker.percentage >= 60 ? 'bg-muted-foreground' :
                'bg-primary'
              }`}
              style={{ width: `${Math.min(imageTracker.percentage, 100)}%` }}
            />
          </div>
        </div>
      )}
      
      {isUploading && (
        <div className="p-2 bg-blue-50 border-t border-gray-300">
          <div className="flex items-center text-sm text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            이미지를 업로드하는 중...
          </div>
        </div>
      )}
    </div>
  );
}

// 컨텐츠에서 파일 ID 추출 함수
export const extractFileIdsFromContent = (htmlContent: string): string[] => {
  const fileIds: string[] = [];
  const imgRegex = /<img[^>]+src="[^"]*\/files\/([^"/]+)"/g;
  let match;
  
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    fileIds.push(match[1]);
  }
  
  return fileIds;
};