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

  // 썸네일 상태 관리 (editor storage 사용)
  const [isThumbnail, setIsThumbnail] = useState(false);
  const imageId = node.attrs['data-image-id'] || '';

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
    updateAttributes({ caption: e.target.value });
  }, [updateAttributes]);

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
        if (editor) {
          editor.commands.focus('end');
        }
      }
      // 텍스트 중간에서 엔터 누르면 무시 (한 줄만 입력)
    }
  }, [node.attrs.caption, editor]);

  // 썸네일 토글 핸들러
  const handleThumbnailToggle = useCallback(() => {
    if (!imageId) {
      console.warn('[MediumImage] No image ID found');
      return;
    }

    // 커스텀 이벤트 발생 - 부모 컴포넌트에서 감지
    const event = new CustomEvent('thumbnail-selected', {
      detail: { imageId: isThumbnail ? '' : imageId }
    });
    window.dispatchEvent(event);

    setIsThumbnail(!isThumbnail);
  }, [imageId, isThumbnail]);

  // 에디터 storage에서 썸네일 ID 확인
  useEffect(() => {
    if (!editor || !imageId) return;

    const thumbnailId = (editor.storage as any)?.thumbnailImageId || '';
    setIsThumbnail(thumbnailId === imageId);
  }, [editor, imageId, (editor?.storage as any)?.thumbnailImageId]);

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
    >
      {/* 이미지 툴바 (선택 시 표시) - 이미지 위에 위치 */}
      {selected && isImageLoaded && (
        <ImageToolbar
          currentSize={node.attrs.size}
          availableSizes={availableSizes}
          onSizeChange={handleSizeChange}
          onAltTextClick={() => setAltModalOpen(true)}
          isThumbnail={isThumbnail}
          onThumbnailToggle={imageId ? handleThumbnailToggle : undefined}
        />
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
          src={node.attrs.src}
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
      <input
        type="text"
        placeholder="이미지 캡션 (optional)"
        value={node.attrs.caption || ''}
        onChange={handleCaptionChange}
        onKeyDown={handleCaptionKeyDown}
        className={cn(
          'medium-image-caption-input',
          'w-full border-none outline-none',
          'text-center text-sm text-gray-500 italic',
          'px-4 py-2 mt-2',
          'placeholder:text-gray-400',
          'focus:text-gray-600'
        )}
      />

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
