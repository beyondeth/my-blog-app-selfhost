/**
 * Content Parser 유틸리티
 *
 * HTML 콘텐츠를 파싱하고 다양한 콘텐츠 타입으로 분리합니다.
 * DOM 조작 없이 순수한 문자열 처리와 React 컴포넌트 방식으로 구현됩니다.
 *
 * SRP(Single Responsibility Principle) 적용:
 * - 각 함수는 하나의 명확한 책임만 가짐
 * - 파싱, 추출, 변환, 유틸리티 기능이 분리됨
 */

import { ContentPart } from '../types';

// 상수 정의 - 매직 넘버 제거
const PLACEHOLDER_TYPES = {
  MERMAID: 'MERMAID',
  CODE: 'CODE',
  YOUTUBE: 'YOUTUBE',
} as const;

const DEFAULT_LANGUAGE = 'plaintext';
const READING_SPEED_WPM = 200; // 분당 읽기 속도 (단어)

/**
 * HTML 콘텐츠를 파싱하여 ContentPart 배열로 변환합니다.
 * 메인 오케스트레이터 함수 - 파싱 프로세스 조정
 *
 * @param html - 파싱할 HTML 문자열
 * @returns ContentPart 배열
 */
export function parseContent(html: string): ContentPart[] {
  // 빈 콘텐츠 체크 - 빠른 반환
  if (!html || !html.trim()) return [];

  try {
    // 파싱 파이프라인 실행
    const pipeline = createParsingPipeline(html);
    return pipeline.execute();
  } catch (error) {
    // 에러 처리를 전용 함수로 위임
    return handleParsingError(error, html);
  }
}

/**
 * 파싱 파이프라인 생성 - 체이닝 패턴 적용
 * 각 단계는 독립적으로 실행되며 실패시에도 다음 단계 진행
 */
function createParsingPipeline(html: string) {
  let processedHtml = html;
  const extractedBlocks: ExtractedBlocks = {
    mermaid: [],
    code: [],
    youtube: [],
  };

  return {
    execute(): ContentPart[] {
      // 1단계: 특수 콘텐츠 추출
      processedHtml = extractSpecialContent(processedHtml, extractedBlocks);

      // 2단계: HTML 파트 분할
      const htmlParts = splitHtmlParts(processedHtml);

      // 3단계: 순서대로 조합
      return assembleContentParts(htmlParts, extractedBlocks);
    }
  };
}

/**
 * 특수 콘텐츠(Mermaid, Code, YouTube) 추출
 * 순서가 중요: Mermaid → Code → YouTube
 */
function extractSpecialContent(html: string, blocks: ExtractedBlocks): string {
  let processedHtml = html;

  // Mermaid 먼저 추출 (코드 블록 내부에 있을 수 있음)
  const mermaidResult = extractMermaidBlocks(processedHtml);
  processedHtml = mermaidResult.processedHtml;
  blocks.mermaid = mermaidResult.blocks;

  // 일반 코드 블록 추출
  const codeResult = extractCodeBlocks(processedHtml);
  processedHtml = codeResult.processedHtml;
  blocks.code = codeResult.blocks;

  // YouTube 임베드 추출
  const youtubeResult = extractYouTubeEmbeds(processedHtml);
  processedHtml = youtubeResult.processedHtml;
  blocks.youtube = youtubeResult.embeds;

  return processedHtml;
}

/**
 * 파싱 에러 처리 전용 함수
 */
function handleParsingError(error: unknown, originalHtml: string): ContentPart[] {
  console.error('[Content Parser] 파싱 실패:', error);

  // 개발 환경에서는 더 자세한 에러 정보 출력
  if (process.env.NODE_ENV === 'development') {
    console.error('[Content Parser] 원본 HTML:', originalHtml.substring(0, 500));
  }

  // fallback: 전체를 HTML 파트로 반환
  return [{ type: 'html', content: originalHtml }];
}

// 타입 정의
interface ExtractedBlocks {
  mermaid: Array<{ placeholder: string; part: ContentPart }>;
  code: Array<{ placeholder: string; part: ContentPart }>;
  youtube: Array<{ placeholder: string; part: ContentPart }>;
}

/**
 * Mermaid 블록을 추출합니다.
 * 책임: Mermaid 다이어그램 식별 및 추출
 */
function extractMermaidBlocks(html: string): {
  processedHtml: string;
  blocks: Array<{ placeholder: string; part: ContentPart }>;
} {
  const blocks: Array<{ placeholder: string; part: ContentPart }> = [];
  let processedHtml = html;

  // Mermaid 패턴 정의 - 더 정확한 매칭
  const patterns = {
    // 표준 코드 블록 형태
    standard: /<pre[^>]*><code[^>]*class="[^"]*language-mermaid[^"]*"[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    // data-language 속성 사용하는 경우
    dataLang: /<pre[^>]*data-language="mermaid"[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    // data-diagram 속성 사용하는 경우 (백엔드에서 생성된 형태)
    dataDiagram: /<pre[^>]*data-diagram="mermaid"[^>]*><code[^>]*(?:class="[^"]*language-mermaid[^"]*")?[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
  };

  // 각 패턴으로 추출 시도
  for (const [patternName, pattern] of Object.entries(patterns)) {
    processedHtml = extractWithPattern(
      processedHtml,
      pattern,
      blocks,
      'mermaid',
      patternName
    );
  }

  return { processedHtml, blocks };
}

/**
 * 패턴을 사용한 콘텐츠 추출 헬퍼 함수
 * 책임: 정규식 패턴으로 콘텐츠 매칭 및 추출
 */
function extractWithPattern(
  html: string,
  pattern: RegExp,
  blocks: Array<{ placeholder: string; part: ContentPart }>,
  type: 'mermaid' | 'code',
  patternName: string
): string {
  let processedHtml = html;
  let match;
  let index = blocks.length;

  // 패턴 리셋 (g 플래그 사용시 필요)
  pattern.lastIndex = 0;

  while ((match = pattern.exec(html)) !== null) {
    const content = match[1];

    // 빈 콘텐츠는 스킵
    if (!content || !content.trim()) continue;

    // 이미 처리된 placeholder는 스킵
    const placeholderType = type.toUpperCase() as keyof typeof PLACEHOLDER_TYPES;
    if (content.includes(`${PLACEHOLDER_TYPES[placeholderType]}_PLACEHOLDER`)) continue;

    const id = generateUniqueId(type, index++);
    const placeholder = createPlaceholder(type, id);

    blocks.push({
      placeholder,
      part: {
        type,
        content: decodeHtmlEntities(content),
        id,
        ...(type === 'code' ? { language: DEFAULT_LANGUAGE } : {}),
      } as ContentPart,
    });

    processedHtml = processedHtml.replace(match[0], placeholder);
  }

  return processedHtml;
}

/**
 * 유니크 ID 생성
 * 책임: 충돌 방지를 위한 고유 식별자 생성
 */
function generateUniqueId(prefix: string, index: number): string {
  return `${prefix}_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`;
}

/**
 * Placeholder 생성
 * 책임: 일관된 placeholder 형식 생성
 */
function createPlaceholder(type: string, id: string): string {
  return `<!--${type.toUpperCase()}_PLACEHOLDER_${id}-->`;
}

/**
 * 코드 블록을 추출합니다.
 * 책임: 일반 코드 블록 식별 및 추출 (Mermaid 제외)
 */
function extractCodeBlocks(html: string): {
  processedHtml: string;
  blocks: Array<{ placeholder: string; part: ContentPart }>;
} {
  const blocks: Array<{ placeholder: string; part: ContentPart }> = [];
  let processedHtml = html;

  // 코드 블록 패턴 - Mermaid를 명시적으로 제외
  const codePattern = /<pre[^>]*(?:data-language="([^"]*)")?[^>]*><code[^>]*(?:class="[^"]*language-(?!mermaid)([^"]*)")?[^>]*>([\s\S]*?)<\/code><\/pre>/gi;

  let match;
  let index = 0;

  // 패턴 리셋
  codePattern.lastIndex = 0;

  while ((match = codePattern.exec(html)) !== null) {
    const content = match[3];

    // 유효성 검사를 별도 함수로 분리
    if (!isValidCodeBlock(content)) continue;

    const language = detectLanguage(match[1], match[2]);
    const id = generateUniqueId('code', index++);
    const placeholder = createPlaceholder('code', id);

    blocks.push({
      placeholder,
      part: {
        type: 'code',
        content: decodeHtmlEntities(content),
        language,
        id,
      },
    });

    processedHtml = processedHtml.replace(match[0], placeholder);
  }

  return { processedHtml, blocks };
}

/**
 * 코드 블록 유효성 검사
 * 책임: 코드 블록이 처리 가능한지 확인
 */
function isValidCodeBlock(content: string): boolean {
  // 빈 콘텐츠 체크
  if (!content || !content.trim()) return false;

  // 이미 처리된 placeholder 체크
  const placeholderTypes = Object.values(PLACEHOLDER_TYPES);
  for (const type of placeholderTypes) {
    if (content.includes(`${type}_PLACEHOLDER`)) {
      return false;
    }
  }

  return true;
}

/**
 * 프로그래밍 언어 감지
 * 책임: 코드 블록의 언어 식별
 */
function detectLanguage(dataLang?: string, classLang?: string): string {
  // 우선순위: data-language > class language > default
  const detectedLang = dataLang || classLang || DEFAULT_LANGUAGE;

  // 언어 정규화 (예: js → javascript)
  return normalizeLanguage(detectedLang);
}

/**
 * 언어 이름 정규화
 * 책임: 언어 이름을 표준 형식으로 변환
 */
function normalizeLanguage(lang: string): string {
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'yml': 'yaml',
    'sh': 'bash',
    'shell': 'bash',
  };

  const normalized = lang.toLowerCase().trim();
  return languageMap[normalized] || normalized;
}

/**
 * YouTube 임베드를 추출합니다.
 * 책임: YouTube 비디오 임베드 식별 및 추출
 */
function extractYouTubeEmbeds(html: string): {
  processedHtml: string;
  embeds: Array<{ placeholder: string; part: ContentPart }>;
} {
  const embeds: Array<{ placeholder: string; part: ContentPart }> = [];
  let processedHtml = html;

  // YouTube 패턴들 - 다양한 임베드 형식 지원
  const patterns = {
    // 표준 iframe 임베드
    standard: /<div[^>]*data-youtube-video[^>]*>[\s\S]*?<iframe[^>]*src="https?:\/\/(?:www\.)?youtube\.com\/embed\/([^"?]+)[^"]*"[^>]*>[\s\S]*?<\/iframe>[\s\S]*?<\/div>/gi,
    // 단순 iframe (div 래퍼 없음)
    simple: /<iframe[^>]*src="https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([^"?]+)[^"]*"[^>]*><\/iframe>/gi,
  };

  let index = 0;

  for (const [patternName, pattern] of Object.entries(patterns)) {
    processedHtml = extractYouTubeWithPattern(
      processedHtml,
      pattern,
      embeds,
      index
    );
    index = embeds.length; // 다음 패턴을 위해 인덱스 업데이트
  }

  return { processedHtml, embeds };
}

/**
 * YouTube 패턴으로 추출
 * 책임: 특정 패턴으로 YouTube 비디오 추출
 */
function extractYouTubeWithPattern(
  html: string,
  pattern: RegExp,
  embeds: Array<{ placeholder: string; part: ContentPart }>,
  startIndex: number
): string {
  let processedHtml = html;
  let match;
  let index = startIndex;

  // 패턴 리셋
  pattern.lastIndex = 0;

  while ((match = pattern.exec(html)) !== null) {
    const videoId = extractVideoId(match[1]);

    if (!isValidVideoId(videoId)) continue;

    // 중복 체크
    if (embeds.some(e => e.part.type === 'youtube' && e.part.videoId === videoId)) {
      continue;
    }

    const placeholder = `<!--${PLACEHOLDER_TYPES.YOUTUBE}_PLACEHOLDER_${videoId}_${index++}-->`;

    embeds.push({
      placeholder,
      part: {
        type: 'youtube',
        videoId,
      },
    });

    processedHtml = processedHtml.replace(match[0], placeholder);
  }

  return processedHtml;
}

/**
 * YouTube 비디오 ID 추출 및 정리
 * 책임: URL에서 비디오 ID만 추출
 */
function extractVideoId(rawId: string): string {
  // 쿼리 파라미터 제거
  return rawId.split('?')[0].split('&')[0].trim();
}

/**
 * YouTube 비디오 ID 유효성 검사
 * 책임: 비디오 ID가 유효한 형식인지 확인
 */
function isValidVideoId(videoId: string): boolean {
  // YouTube 비디오 ID는 11자 (예: dQw4w9WgXcQ)
  // 하지만 더 유연하게 처리
  return !!videoId && videoId.length >= 8 && videoId.length <= 15 && /^[a-zA-Z0-9_-]+$/.test(videoId);
}

/**
 * HTML을 파트로 분할합니다.
 * 책임: placeholder 기준으로 HTML을 세그먼트로 분할
 */
function splitHtmlParts(html: string): Array<{ placeholder?: string; content: string }> {
  // 빈 HTML 체크
  const trimmedHtml = html.trim();
  if (!trimmedHtml) return [];

  // placeholder 패턴 - 모든 타입 포함
  const placeholderTypes = Object.values(PLACEHOLDER_TYPES).join('|');
  const placeholderPattern = new RegExp(
    `<!--(${placeholderTypes})_PLACEHOLDER_[^>]+-->`,
    'g'
  );

  return splitByPattern(trimmedHtml, placeholderPattern);
}

/**
 * 패턴으로 문자열 분할
 * 책임: 정규식 패턴으로 문자열을 세그먼트로 분할
 */
function splitByPattern(
  text: string,
  pattern: RegExp
): Array<{ placeholder?: string; content: string }> {
  const parts: Array<{ placeholder?: string; content: string }> = [];
  let lastIndex = 0;
  let match;

  // 패턴 리셋
  pattern.lastIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    // 매치 이전 부분 추가
    if (match.index > lastIndex) {
      const segment = text.substring(lastIndex, match.index);
      const trimmedSegment = segment.trim();

      if (trimmedSegment) {
        parts.push({ content: trimmedSegment });
      }
    }

    // placeholder 추가
    parts.push({
      placeholder: match[0],
      content: ''
    });

    lastIndex = match.index + match[0].length;
  }

  // 마지막 세그먼트 추가
  if (lastIndex < text.length) {
    const finalSegment = text.substring(lastIndex).trim();
    if (finalSegment) {
      parts.push({ content: finalSegment });
    }
  }

  return parts;
}

/**
 * 모든 파트를 원래 순서대로 조합합니다.
 * 책임: HTML 파트와 추출된 특수 콘텐츠를 올바른 순서로 재조합
 */
function assembleContentParts(
  htmlParts: Array<{ placeholder?: string; content: string }>,
  extractedBlocks: ExtractedBlocks
): ContentPart[] {
  const result: ContentPart[] = [];

  // placeholder 맵 생성 (빠른 검색을 위해)
  const placeholderMap = createPlaceholderMap(extractedBlocks);

  for (const part of htmlParts) {
    const assembled = assembleSinglePart(part, placeholderMap);
    if (assembled) {
      result.push(assembled);
    }
  }

  return result;
}

/**
 * Placeholder 맵 생성
 * 책임: 빠른 검색을 위한 placeholder → ContentPart 매핑
 */
function createPlaceholderMap(
  blocks: ExtractedBlocks
): Map<string, ContentPart> {
  const map = new Map<string, ContentPart>();

  // 모든 블록 타입을 맵에 추가
  const allBlocks = [
    ...blocks.mermaid,
    ...blocks.code,
    ...blocks.youtube,
  ];

  for (const block of allBlocks) {
    map.set(block.placeholder, block.part);
  }

  return map;
}

/**
 * 단일 파트 조립
 * 책임: 하나의 파트를 ContentPart로 변환
 */
function assembleSinglePart(
  part: { placeholder?: string; content: string },
  placeholderMap: Map<string, ContentPart>
): ContentPart | null {
  // placeholder가 있는 경우
  if (part.placeholder) {
    const mappedPart = placeholderMap.get(part.placeholder);
    if (mappedPart) {
      return mappedPart;
    }

    // placeholder를 찾지 못한 경우 로깅
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Content Parser] Unknown placeholder:', part.placeholder);
    }

    // fallback: content가 있으면 HTML로 처리
    if (part.content) {
      return { type: 'html', content: part.content };
    }

    return null;
  }

  // 일반 HTML 콘텐츠
  if (part.content) {
    return { type: 'html', content: part.content };
  }

  return null;
}

/**
 * HTML 엔티티를 디코드합니다.
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x5C;': '\\',
    '&#x60;': '`',
  };

  return text.replace(
    /&[#\w]+;/g,
    (entity) => entities[entity] || entity,
  );
}

/**
 * 콘텐츠에서 메타데이터를 추출합니다.
 * 책임: 콘텐츠 파트 배열에서 통계 정보 수집
 */
export function extractContentMetadata(parts: ContentPart[]): {
  imageCount: number;
  codeBlockCount: number;
  mermaidCount: number;
  youtubeCount: number;
  languages: string[];
} {
  const metadata = initializeMetadata();

  for (const part of parts) {
    updateMetadataForPart(metadata, part);
  }

  return finalizeMetadata(metadata);
}

/**
 * 메타데이터 초기화
 * 책임: 빈 메타데이터 구조 생성
 */
function initializeMetadata() {
  return {
    imageCount: 0,
    codeBlockCount: 0,
    mermaidCount: 0,
    youtubeCount: 0,
    languages: new Set<string>(),
  };
}

/**
 * 파트별 메타데이터 업데이트
 * 책임: 각 파트 타입에 따라 메타데이터 갱신
 */
function updateMetadataForPart(
  metadata: ReturnType<typeof initializeMetadata>,
  part: ContentPart
): void {
  switch (part.type) {
    case 'mermaid':
      metadata.mermaidCount++;
      break;

    case 'code':
      metadata.codeBlockCount++;
      if (part.language && part.language !== DEFAULT_LANGUAGE) {
        metadata.languages.add(part.language);
      }
      break;

    case 'youtube':
      metadata.youtubeCount++;
      break;

    case 'html':
      metadata.imageCount += countImagesInHtml(part.content);
      break;
  }
}

/**
 * HTML 내 이미지 개수 계산
 * 책임: HTML 문자열에서 img 태그 개수 계산
 */
function countImagesInHtml(html: string): number {
  const imgPattern = /<img[^>]*>/gi;
  const matches = html.match(imgPattern);
  return matches ? matches.length : 0;
}

/**
 * 메타데이터 최종 처리
 * 책임: Set을 Array로 변환 등 최종 형태로 변환
 */
function finalizeMetadata(
  metadata: ReturnType<typeof initializeMetadata>
): {
  imageCount: number;
  codeBlockCount: number;
  mermaidCount: number;
  youtubeCount: number;
  languages: string[];
} {
  return {
    imageCount: metadata.imageCount,
    codeBlockCount: metadata.codeBlockCount,
    mermaidCount: metadata.mermaidCount,
    youtubeCount: metadata.youtubeCount,
    languages: Array.from(metadata.languages).sort(), // 알파벳 순 정렬
  };
}

/**
 * 읽기 시간 계산
 * 책임: 콘텐츠의 예상 읽기 시간 계산
 */
export function calculateReadingTime(content: string): number {
  // HTML 태그 제거
  const textOnly = content.replace(/<[^>]*>/g, '');

  // 단어 수 계산
  const words = textOnly.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;

  // 읽기 시간 계산 (분 단위, 최소 1분)
  return Math.max(1, Math.ceil(wordCount / READING_SPEED_WPM));
}