"use client";

/**
 * Medium Style Image Node
 * Medium 스타일 이미지 노드 컴포넌트
 *
 * 기능:
 * - 이미지 선택 시 툴바 표시
 * - 3가지 크기 옵션 (원본 크기에 따라 자동 계산)
 * - Alt text 모달
 * - Caption 입력
 * - 썸네일 선택
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { ImageToolbar } from './ImageToolbar';
import { AltTextModal } from './AltTextModal';
import { ImageSize } from '../../extensions/MediumStyleImage.extension';
import { cn } from '@/lib/utils';
import { normalizeImageUrl } from '@/utils/imageUtils';
import { toast } from 'sonner';

// ============================================
// 설정 상수 (Configuration Constants)
// ============================================
const IMAGE_SIZE_CONFIG = {
  SMALL: 300,
  MEDIUM: 500,
  DEFAULT: 680,
  FULL: 1000,
} as const;

// ============================================
// 타입 정의 (Type Definitions)
// ============================================
export interface MediumImageNodeProps extends NodeViewProps {
  selected: boolean;
}

// ============================================
// 메인 컴포넌트 (Main Component)
// ============================================
export const MediumImageNode: React.FC<MediumImageNodeProps> = ({
  node,
  updateAttributes,
  selected,
  getPos,
  editor,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 상태 관리
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [altModalOpen, setAltModalOpen] = useState(false);

  // 썸네일 상태
  const imageId = node.attrs['data-image-id'] || '';
  const [isThumbnail, setIsThumbnail] = useState(false);

  // 디버깅: 이미지 속성 출력
  console.log('🎯 [MEDIUM_IMAGE_NODE] Rendered with attrs:', {
    allAttrs: node.attrs,
    imageId,
    hasImageId: !!imageId,
    src: node.attrs.src
  });

  
  // 사용 가능한 크기 옵션 계산
  // 원본 이미지 크기에 따라 2~4개 옵션 제공
  const availableSizes = useMemo((): ImageSize[] => {
    if (!isImageLoaded || naturalWidth === 0) {
      return ['default']; // 로딩 중엔 기본값만
    }

    if (naturalWidth < IMAGE_SIZE_CONFIG.SMALL) {
      // 300px 미만: Small만
      return ['small'];
    } else if (naturalWidth < IMAGE_SIZE_CONFIG.MEDIUM) {
      // 300px ~ 500px: Small, Medium
      return ['small', 'medium'];
    } else if (naturalWidth < IMAGE_SIZE_CONFIG.DEFAULT) {
      // 500px ~ 680px: Small, Medium, Default
      return ['small', 'medium', 'default'];
    } else {
      // 680px 이상: 전체 옵션
      return ['small', 'medium', 'default', 'full'];
    }
  }, [naturalWidth, isImageLoaded]);

  // 현재 크기가 사용 가능한 옵션에 없으면 조정
  useEffect(() => {
    if (isImageLoaded && !availableSizes.includes(node.attrs.size)) {
      const newSize = availableSizes[availableSizes.length - 1]; // 가장 큰 사이즈로
      updateAttributes({ size: newSize });
    }
  }, [availableSizes, isImageLoaded, node.attrs.size, updateAttributes]);

  // 이미지 로드 핸들러
  const handleImageLoad = useCallback(() => {
    if (imgRef.current && !isImageLoaded) {
      const width = imgRef.current.naturalWidth;
      const height = imgRef.current.naturalHeight;

      setNaturalWidth(width);
      setIsImageLoaded(true);
    }
  }, [isImageLoaded]);

  // 크기 변경 핸들러
  const handleSizeChange = useCallback((size: ImageSize) => {
    updateAttributes({ size });
  }, [updateAttributes]);

  // Alt text 변경 핸들러
  const handleAltChange = useCallback((alt: string) => {
    updateAttributes({ alt });
  }, [updateAttributes]);

  // Caption 변경 핸들러
  const handleCaptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const captionValue = e.target.value;
    console.log('🖼️ [CAPTION_DEBUG] Caption input changed:', {
      newCaption: captionValue,
      imageId,
      previousCaption: node.attrs.caption
    });
    updateAttributes({ caption: captionValue });
  }, [updateAttributes, node.attrs.caption, imageId]);

  // Caption 입력에서 엔터 키 처리
  const handleCaptionKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Form submit 방지
      e.stopPropagation();

      const input = e.currentTarget;
      const cursorPosition = input.selectionStart || 0;
      const textLength = (node.attrs.caption || '').length;

      // 커서가 텍스트 끝에 있을 때만 다음 입력칸(에디터)으로 이동
      if (cursorPosition === textLength) {
        // Caption 입력 완료 → 에디터 본문으로 포커스 이동
        // getPos()를 사용하여 현재 노드 위치를 찾고 그 다음으로 포커스 이동
        const pos = getPos();
        if (pos !== undefined) {
          // TipTap의 chain() API를 사용하여 더 안전하게 처리
          editor.chain().focus().setTextSelection(pos + node.nodeSize).run();
        }
      }
      // 텍스트 중간에서 엔터 누르면 무시 (한 줄만 입력)
    }
  }, [node.attrs.caption, editor, getPos, node.nodeSize]);

  // 썸네일 상태 동기화
  useEffect(() => {
    if (!editor || !imageId) return;

    const storage = editor.storage;
    if (!storage) return;

    // 현재 선택된 썸네일 ID 확인
    const thumbnailImageId = (storage as any).thumbnailImageId;
    const isCurrentThumbnail = thumbnailImageId === imageId;

    setIsThumbnail(isCurrentThumbnail);
  }, [editor, imageId]);

  // 썸네일 토글 핸들러
  const handleThumbnailToggle = useCallback(() => {
    console.log('🎯 [THUMBNAIL_TOGGLE] Thumbnail button clicked!', {
      imageId,
      isThumbnail,
      hasEditor: !!editor
    });

    if (!editor || !imageId) {
      console.warn('🎯 [THUMBNAIL_TOGGLE] Missing editor or imageId', { editor: !!editor, imageId });
      return;
    }

    // 썸네일 상태 토글
    const newThumbnailId = isThumbnail ? null : imageId;

    console.log('🎯 [THUMBNAIL_TOGGLE] Toggling thumbnail:', {
      from: isThumbnail ? imageId : null,
      to: newThumbnailId
    });

    // 에디터 스토리지 업데이트
    if (editor.storage) {
      (editor.storage as any).thumbnailImageId = newThumbnailId;
      console.log('🎯 [THUMBNAIL_TOGGLE] Updated editor.storage.thumbnailImageId:', newThumbnailId);
    }

    // 커스텀 이벤트 발생 (BlogSimpleEditor에서 수신)
    if (newThumbnailId) {
      const event = new CustomEvent('thumbnail-selected', {
        detail: { imageId: newThumbnailId }
      });
      window.dispatchEvent(event);
      console.log('🎯 [THUMBNAIL_TOGGLE] Dispatched thumbnail-selected event:', { imageId: newThumbnailId });
    }

    // 로컬 상태 업데이트
    setIsThumbnail(!isThumbnail);

    // 사용자 피드백
    if (isThumbnail) {
      toast.success('썸네일이 해제되었습니다.');
    } else {
      toast.success('썸네일로 설정되었습니다.');
    }
  }, [editor, imageId, isThumbnail]);

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className={cn(
        'medium-image-wrapper',
        'relative my-4 mx-auto',
        selected && 'medium-image-selected'
      )}
      contentEditable={false}
      draggable={true}
      data-drag-handle
      as="figure"
      data-medium-image=""
    >
      {/* 이미지 툴바 (선택 시 표시) - 이미지 위에 위치 */}
      {selected && isImageLoaded && (
        <>
          <ImageToolbar
            currentSize={node.attrs.size}
            availableSizes={availableSizes}
            onSizeChange={handleSizeChange}
            onAltTextClick={() => setAltModalOpen(true)}
            isThumbnail={isThumbnail}
            onThumbnailToggle={handleThumbnailToggle}
          />

          </>
      )}

      {/* 이미지 */}
      <div
        className={cn(
          'medium-image-container',
          'relative w-full flex justify-center'
        )}
      >
        <img
          ref={imgRef}
          src={normalizeImageUrl(node.attrs.src)}
          alt={node.attrs.alt || ''}
          className={cn(
            'medium-image',
            `medium-image-${node.attrs.size}`,
            'object-contain',
            selected && 'ring-4 ring-emerald-500'
          )}
          onLoad={handleImageLoad}
          draggable={false}
        />
      </div>

      {/* Caption 입력 */}
      <figcaption className="medium-image-caption">
        <input
          type="text"
          placeholder="이미지 캡션 (optional)"
          value={node.attrs.caption || ''}
          onChange={handleCaptionChange}
          onKeyDown={handleCaptionKeyDown}
          className={cn(
            'medium-image-caption-input',
            'w-full border-none outline-none bg-transparent text-center text-sm text-gray-500 italic px-4 py-2 mt-2',
            'placeholder:text-gray-400',
            'focus:text-gray-600'
          )}
        />
      </figcaption>

    
      {/* Alt Text 모달 */}
      {altModalOpen && (
        <AltTextModal
          isOpen={altModalOpen}
          onClose={() => setAltModalOpen(false)}
          value={node.attrs.alt || ''}
          onChange={handleAltChange}
        />
      )}
    </NodeViewWrapper>
  );
};
