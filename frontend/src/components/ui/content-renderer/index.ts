/**
 * Content Renderer 모듈 엔트리 포인트
 *
 * 새로운 아키텍처의 콘텐츠 렌더링 시스템을 제공합니다.
 * SRP 원칙에 따라 각 컴포넌트가 단일 책임을 가지며,
 * DOM 조작 없이 순수한 React 방식으로 구현됩니다.
 */

// 메인 렌더러
export { default as HtmlContentRenderer } from './HtmlContentRenderer';

// 개별 렌더러 컴포넌트
export { default as HtmlRenderer } from './components/HtmlRenderer';
export { default as CodeRenderer } from './components/CodeRenderer';
export { default as MermaidRenderer } from './components/MermaidRenderer';
export { default as DiagramRenderer } from './components/DiagramRenderer';
export { default as YouTubeRenderer } from './components/YouTubeRenderer';

// 유틸리티
export { parseContent, extractContentMetadata } from './utils/content-parser';

// 타입
export type {
  ContentPart,
  ContentProcessingOptions,
  ImageInfo,
  CodeBlockInfo,
  MermaidInfo,
  DiagramInfo,
  ContentMetadata,
  RendererContext,
} from './types';
