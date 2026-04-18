/**
 * Content Renderer 타입 정의
 *
 * 콘텐츠 렌더링 시스템에서 사용되는 모든 타입을 정의합니다.
 */

/**
 * 처리된 콘텐츠 파트 타입
 */
export type ContentPart =
  | { type: 'html'; content: string }
  | { type: 'mermaid'; content: string; id: string }
  | { type: 'diagram'; content: string; id: string }
  | { type: 'code'; content: string; language: string; id: string }
  | { type: 'youtube'; videoId: string; title?: string }
  | { type: 'video'; videoId: string; src?: string; caption?: string }
  | { type: 'link-card'; url: string; label?: string };

/**
 * 콘텐츠 처리 옵션
 */
export interface ContentProcessingOptions {
  /**
   * 코드 하이라이팅 활성화
   */
  enableCodeHighlight?: boolean;

  /**
   * Mermaid 다이어그램 렌더링 활성화
   */
  enableMermaid?: boolean;

  /**
   * Custom diagram block 렌더링 활성화
   */
  enableDiagram?: boolean;

  /**
   * 이미지 모달 활성화
   */
  enableImageModal?: boolean;

  /**
   * 코드 복사 버튼 활성화
   */
  enableCodeCopy?: boolean;

  /**
   * YouTube 임베드 활성화
   */
  enableYouTube?: boolean;
}

/**
 * 이미지 정보
 */
export interface ImageInfo {
  src: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
}

/**
 * 코드 블록 정보
 */
export interface CodeBlockInfo {
  id: string;
  language: string;
  content: string;
  lineNumbers?: boolean;
}

/**
 * Mermaid 다이어그램 정보
 */
export interface MermaidInfo {
  id: string;
  content: string;
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
}

export interface DiagramInfo {
  id: string;
  content: string;
}

/**
 * 콘텐츠 메타데이터
 */
export interface ContentMetadata {
  /**
   * 포함된 이미지 수
   */
  imageCount?: number;

  /**
   * 포함된 코드 블록 수
   */
  codeBlockCount?: number;

  /**
   * 포함된 Mermaid 다이어그램 수
   */
  mermaidCount?: number;

  /**
   * 포함된 custom diagram block 수
   */
  diagramCount?: number;

  /**
   * 포함된 YouTube 비디오 수
   */
  youtubeCount?: number;

  /**
   * 사용된 프로그래밍 언어 목록
   */
  languages?: string[];

  /**
   * 추정 읽기 시간 (분)
   */
  readingTime?: number;
}

/**
 * 렌더러 컨텍스트
 */
export interface RendererContext {
  /**
   * 기본 URL (이미지 등의 상대 경로 처리용)
   */
  baseUrl?: string;

  /**
   * 테마 모드
   */
  theme?: 'light' | 'dark';

  /**
   * 사용자 설정
   */
  userPreferences?: {
    fontSize?: 'small' | 'medium' | 'large';
    lineHeight?: 'compact' | 'normal' | 'relaxed';
    codeTheme?: string;
  };
}
