/**
 * @fileoverview 에디터 모듈의 공개 API
 * 기존 호환성을 유지하면서 새로운 구조로 export
 */

// 메인 에디터 컴포넌트
export { BlogSimpleEditor } from '../components/tiptap-templates/simple/blog-simple-editor';
export type { BlogSimpleEditorProps } from '../components/tiptap-templates/simple/blog-simple-editor';

// 컴포넌트들
export { default as ImageUploadManager } from './components/ImageManager/ImageUploadManager';
export { MediumImageNode } from './components/MediumImage/MediumImageNode';

// Hooks
export { useImageUploadManager } from './hooks/useImageUploadManager';
export { useEditorImageMonitor } from './hooks/useEditorImageMonitor';
export { usePostImageTracker } from './hooks/usePostImageTracker';

// Utils
export * from './utils/youtube.utils';
export * from './utils/image-upload.utils';
export * from './utils/pending-image-upload';

// Constants
export * from './constants/editor.constants';

// Config
export * from './config/editor-extensions';

// Types (ImageUploadManager에서 export되는 타입들)
export type { UploadedImageInfo } from './components/ImageManager/ImageUploadManager';
