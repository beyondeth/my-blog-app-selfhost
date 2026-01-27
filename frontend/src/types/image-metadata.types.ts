/**
 * Image Metadata Types
 *
 * 리치 텍스트 & 마크다운 에디터 간 공통 이미지 메타데이터 타입
 * 양방향 동기화를 위한 통합 타입 정의
 */

/**
 * 이미지 크기 옵션
 * MediumStyleImage 확장과 동일한 크기 옵션
 */
export type ImageSize = 'small' | 'medium' | 'default' | 'full';

/**
 * 이미지 메타데이터 (리치텍스트 & 마크다운 공통)
 * HTML figure 구조 및 확장 마크다운 문법과 매핑됨
 *
 * @example
 * // HTML (리치 텍스트)
 * <figure data-medium-image>
 *   <img src="url" data-size="medium" data-image-id="abc123" />
 *   <figcaption>이미지 설명</figcaption>
 * </figure>
 *
 * // 확장 마크다운
 * ![alt](url){#abc123 size=medium caption="이미지 설명"}
 */
export interface ImageMetadata {
  /** 이미지 ID (data-image-id) */
  id?: string;
  /** 이미지 소스 URL */
  src: string;
  /** 대체 텍스트 (alt) */
  alt?: string;
  /** 이미지 크기 */
  size?: ImageSize;
  /** 이미지 설명 (figcaption) */
  caption?: string;
}

/**
 * 마크다운 이미지 목록 아이템
 * 업로드된 이미지 정보를 관리하기 위한 확장 타입
 */
export interface MarkdownImageInfo {
  /** 파일 ID (서버에서 부여) */
  id: string;
  /** CDN URL */
  url: string;
  /** 파일명 */
  name?: string;
  /** 이미지 크기 옵션 */
  size?: ImageSize;
  /** 이미지 설명 (caption) */
  caption?: string;
}

/**
 * 확장 마크다운 이미지 문법 정규식
 *
 * 패턴: ![alt](url){#id size=value caption="text"}
 *
 * 캡처 그룹:
 * 1. alt - 대체 텍스트
 * 2. url - 이미지 URL
 * 3. attrs - 확장 속성 (선택적)
 */
export const EXTENDED_IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?/g;

/**
 * 확장 마크다운 속성 파싱
 *
 * @param attrs - 확장 속성 문자열 (예: "#abc123 size=medium caption=\"설명\"")
 * @returns 파싱된 ImageMetadata
 */
export function parseImageAttributes(attrs?: string): Partial<ImageMetadata> {
  if (!attrs) return {};

  const result: Partial<ImageMetadata> = {};

  // #imageId
  const idMatch = attrs.match(/#([^\s}]+)/);
  if (idMatch) result.id = idMatch[1];

  // size=value
  const sizeMatch = attrs.match(/size=(\w+)/);
  if (sizeMatch && isValidImageSize(sizeMatch[1])) {
    result.size = sizeMatch[1] as ImageSize;
  }

  // caption="value" (따옴표 내 문자열, 이스케이프 처리)
  const captionMatch = attrs.match(/caption="([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (captionMatch) {
    // 이스케이프된 따옴표 복원
    result.caption = captionMatch[1].replace(/\\"/g, '"');
  }

  return result;
}

/**
 * ImageMetadata를 확장 마크다운 속성 문자열로 변환
 *
 * @param metadata - 이미지 메타데이터
 * @returns 확장 속성 문자열 (예: "{#abc123 size=medium caption=\"설명\"}")
 */
export function serializeImageAttributes(metadata: Partial<ImageMetadata>): string {
  const attrs: string[] = [];

  if (metadata.id) {
    attrs.push(`#${metadata.id}`);
  }

  if (metadata.size && metadata.size !== 'default') {
    attrs.push(`size=${metadata.size}`);
  }

  if (metadata.caption) {
    // 따옴표 이스케이프
    const escapedCaption = metadata.caption.replace(/"/g, '\\"');
    attrs.push(`caption="${escapedCaption}"`);
  }

  return attrs.length > 0 ? `{${attrs.join(' ')}}` : '';
}

/**
 * 유효한 이미지 크기 값인지 확인
 */
function isValidImageSize(value: string): value is ImageSize {
  return ['small', 'medium', 'default', 'full'].includes(value);
}
