/**
 * @fileoverview 에디터 모듈의 공개 API
 * 기존 호환성을 유지하면서 새로운 구조로 export
 */

// 메인 에디터 컴포넌트
export { default as BlogRichTextEditor } from './RichTextEditor';
export { default as RichTextEditor } from './RichTextEditor';

// 컴포넌트들
export { default as ImageUploadManager } from './components/ImageManager/ImageUploadManager';
export * from './components/ImageManager/ResizableImageNode';
export { default as EditorToolbar } from './components/Toolbar/EditorToolbar';
export { default as EnhancedEditorToolbar } from './components/Toolbar/EnhancedEditorToolbar';

// Hooks
export { useImageUploadManager } from './hooks/useImageUploadManager';
export { useEditorImageMonitor } from './hooks/useEditorImageMonitor';
export { useRichTextEditor } from './hooks/useRichTextEditor';
export { usePostImageTracker } from './hooks/usePostImageTracker';

// Utils
export * from './utils/youtube.utils';
export * from './utils/image-upload.utils';

// Constants
export * from './constants/editor.constants';

// Config
export * from './config/editor-extensions';

// Types (ImageUploadManager에서 export되는 타입들)
export type { UploadedImageInfo } from './components/ImageManager/ImageUploadManager';