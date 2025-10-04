import React, { useState, useCallback, useRef, useEffect } from 'react';
import { NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';
import { Resizable, ResizeCallbackData } from 'react-resizable';
import 'react-resizable/css/styles.css';

// ============================================
// 설정 상수 (Configuration Constants)
// ============================================
const IMAGE_CONFIG = {
  MAX_WIDTH: 800,
  MIN_SIZE: 100,
  MAX_SIZE: 1200,
  DEFAULT_WIDTH: 600,
  DEFAULT_HEIGHT: 400,
  RESIZE_HANDLE_SIZE: 30,
  RESIZE_HANDLE_OFFSET: -5,
} as const;

// ============================================
// 헬퍼 함수 (Helper Functions)
// ============================================

/**
 * ProseMirror 노드 속성을 안전하게 업데이트
 * DRY 원칙: 반복되는 requestAnimationFrame + try/catch 패턴 통합
 */
const updateNodeSafely = (
  getPos: (() => number | undefined) | undefined,
  updateAttributes: (attrs: Record<string, any>) => void,
  attributes: Record<string, any>
) => {
  requestAnimationFrame(() => {
    try {
      if (typeof getPos === 'function') {
        const pos = getPos();
        if (pos !== undefined && pos !== null) {
          updateAttributes(attributes);
        }
      }
    } catch (error) {
      // ProseMirror 노드가 삭제되거나 이동한 경우 무시
      console.debug('Node update skipped:', error);
    }
  });
};

/**
 * 이미지 표시 크기 계산
 * 최대 너비를 초과하지 않도록 비율 유지
 */
const calculateDisplaySize = (
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number = IMAGE_CONFIG.MAX_WIDTH
) => {
  const ratio = naturalHeight / naturalWidth;
  const displayWidth = Math.min(naturalWidth, maxWidth);
  const displayHeight = displayWidth * ratio;
  return { width: displayWidth, height: displayHeight, ratio };
};

// ============================================
// 타입 정의 (Type Definitions)
// ============================================
interface ResizableImageNodeProps extends NodeViewProps {
  selected: boolean;
}

interface ImageOverlayProps {
  selected: boolean;
  isResizing: boolean;
  isImageLoaded: boolean;
  dimensions: { width: number; height: number };
  naturalSize: { width: number; height: number };
  onReset: (e: React.MouseEvent) => void;
}

// ============================================
// UI 서브 컴포넌트 (UI Sub-components)
// ============================================

/**
 * 이미지 오버레이 UI (크기 표시, 리셋 버튼)
 * SRP: UI 렌더링 책임 분리
 */
const ImageOverlay: React.FC<ImageOverlayProps> = ({
  selected,
  isResizing,
  isImageLoaded,
  dimensions,
  naturalSize,
  onReset,
}) => {
  if (!selected && !isResizing) return null;

  return (
    <>
      {/* 선택 시 UI */}
      {selected && !isResizing && (
        <>
          {/* 크기 표시 */}
          <div className="image-size-display">
            {Math.round(dimensions.width)} × {Math.round(dimensions.height)}
          </div>
          
          {/* 리셋 버튼 */}
          {isImageLoaded && naturalSize.width > 0 && (
            <button
              className="image-reset-button"
              onClick={onReset}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              title="원본 크기로 복원"
            >
              ↻ 원본 크기
            </button>
          )}
        </>
      )}
      
      {/* 리사이징 중 크기 표시 */}
      {isResizing && (
        <div className="image-resize-indicator">
          {Math.round(dimensions.width)} × {Math.round(dimensions.height)}
        </div>
      )}
    </>
  );
};


// ============================================
// 메인 컴포넌트 (Main Component)
// ============================================

export const ResizableImageComponent: React.FC<ResizableImageNodeProps> = ({ 
  node, 
  updateAttributes, 
  selected,
  getPos
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [aspectRatio, setAspectRatio] = useState(1);
  const [isResizing, setIsResizing] = useState(false);
  
  // 초기 dimensions 설정 - SSOT: node.attrs를 기준으로
  const [dimensions, setDimensions] = useState(() => {
    if (node?.attrs?.width && node?.attrs?.height) {
      return {
        width: node.attrs.width,
        height: node.attrs.height
      };
    }
    return { 
      width: IMAGE_CONFIG.DEFAULT_WIDTH, 
      height: IMAGE_CONFIG.DEFAULT_HEIGHT 
    };
  });

  // 이미지 로드 시 자연 크기 설정
  const handleImageLoad = useCallback(() => {
    if (imgRef.current && !isImageLoaded) {
      const naturalWidth = imgRef.current.naturalWidth;
      const naturalHeight = imgRef.current.naturalHeight;
      
      if (naturalWidth && naturalHeight) {
        const { width, height } = calculateDisplaySize(
          naturalWidth, 
          naturalHeight
        );
        
        setNaturalSize({ width: naturalWidth, height: naturalHeight });
        setAspectRatio(naturalWidth / naturalHeight); // 종횡비는 width/height
        setIsImageLoaded(true);
        
        // attrs가 없는 경우에만 자연 크기로 설정
        if (!node?.attrs?.width && !node?.attrs?.height) {
          setDimensions({ width, height });
          updateNodeSafely(getPos, updateAttributes, { width, height });
        }
      }
    }
  }, [node?.attrs?.width, node?.attrs?.height, updateAttributes, getPos, isImageLoaded]);

  // node.attrs 변경 시 dimensions 동기화
  useEffect(() => {
    if (node?.attrs?.width && node?.attrs?.height) {
      setDimensions({
        width: node.attrs.width,
        height: node.attrs.height
      });
    }
  }, [node?.attrs?.width, node?.attrs?.height]);

  // 리사이즈 핸들러
  const handleResize = useCallback((
    _event: React.SyntheticEvent,
    data: ResizeCallbackData
  ) => {
    const { size } = data;
    // lockAspectRatio가 true이므로 react-resizable이 자동으로 height 계산
    setDimensions({
      width: size.width,
      height: size.height
    });
  }, []);

  const handleResizeStart = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }, []);

  const handleResizeStop = useCallback((
    _event: React.SyntheticEvent,
    data: ResizeCallbackData
  ) => {
    const { size } = data;
    
    setIsResizing(false);
    updateNodeSafely(getPos, updateAttributes, {
      width: Math.round(size.width),
      height: Math.round(size.height)
    });
  }, [updateAttributes, getPos]);

  // 원본 크기로 리셋
  const handleReset = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (naturalSize.width && naturalSize.height) {
      const { width, height } = calculateDisplaySize(
        naturalSize.width,
        naturalSize.height
      );
      
      setDimensions({ width, height });
      updateNodeSafely(getPos, updateAttributes, { width, height });
    }
  }, [naturalSize, updateAttributes, getPos]);

  return (
    <NodeViewWrapper 
      className={`resizable-image-wrapper ${selected ? 'selected' : ''} ${isResizing ? 'resizing' : ''}`}
      style={{ 
        display: 'inline-block', 
        maxWidth: '100%', 
        position: 'relative',
        userSelect: isResizing ? 'none' : 'auto'
      }}
      contentEditable={false}
      draggable={!isResizing}
      data-drag-handle={!isResizing}
    >
      <Resizable
        width={typeof dimensions.width === 'number' ? dimensions.width : parseInt(dimensions.width) || 200}
        height={typeof dimensions.height === 'number' ? dimensions.height : parseInt(dimensions.height) || 150}
        onResize={handleResize}
        onResizeStart={handleResizeStart}
        onResizeStop={handleResizeStop}
        minConstraints={[IMAGE_CONFIG.MIN_SIZE, IMAGE_CONFIG.MIN_SIZE]}
        maxConstraints={[IMAGE_CONFIG.MAX_SIZE, IMAGE_CONFIG.MAX_SIZE]}
        lockAspectRatio={aspectRatio > 0}
        resizeHandles={['se']}
        handleSize={[20, 20]}
        handle={(handleAxis, ref) => (
          <span
            ref={ref}
            className={`react-resizable-handle react-resizable-handle-${handleAxis}`}
            style={{
              position: 'absolute',
              width: '30px',
              height: '30px',
              bottom: -5,
              right: -5,
              cursor: 'nwse-resize',
              zIndex: 10,
            }}
          >
            <div className={`resize-handle-indicator ${selected || isResizing ? 'visible' : ''}`} />
          </span>
        )}
      >
        <div 
          style={{ 
            width: dimensions.width, 
            height: dimensions.height,
            position: 'relative',
            overflow: 'hidden',
          }}
          className="resizable-image-container"
        >
          <img
            ref={imgRef}
            src={node.attrs.src}
            alt={node.attrs.alt || ''}
            title={node.attrs.title || ''}
            onLoad={handleImageLoad}
            className={`resizable-image ${selected ? 'selected' : ''}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
            draggable={false}
            data-image-id={node.attrs['data-image-id'] || ''}
          />
          
          <ImageOverlay
            selected={selected}
            isResizing={isResizing}
            isImageLoaded={isImageLoaded}
            dimensions={dimensions}
            naturalSize={naturalSize}
            onReset={handleReset}
          />
        </div>
      </Resizable>
    </NodeViewWrapper>
  );
};

// ============================================
// Export
// ============================================

// Helper function to create the React node view renderer
export const createResizableImageExtension = () => {
  return ReactNodeViewRenderer(ResizableImageComponent);
};