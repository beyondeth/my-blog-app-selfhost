/**
 * Mermaid 전역 설정 파일
 *
 * Mermaid를 한 번만 초기화하여 중복 초기화 문제를 방지합니다.
 */

import mermaid from 'mermaid';

// 초기화 상태 추적
let isInitialized = false;

/**
 * Mermaid 전역 초기화
 * 한 번만 실행되도록 보장합니다.
 */
export function initializeMermaid() {
  if (isInitialized) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    themeVariables: {
      fontSize: '16px',  // 고정 글씨 크기
    },
    flowchart: {
      useMaxWidth: true,  // 컨테이너에 맞춤
      htmlLabels: true,
      curve: 'basis'
    },
    securityLevel: 'loose', // SVG 렌더링 허용
  });

  isInitialized = true;
  console.log('[Mermaid] 전역 초기화 완료');
}

/**
 * Mermaid 콘텐츠를 정규화합니다.
 *
 * HTML 태그와 특수문자를 Mermaid가 이해할 수 있는 형식으로 변환합니다.
 * - HTML 엔티티 디코딩
 * - <br> 태그를 Mermaid 라인 브레이크로 변환
 * - 노드 레이블의 특수문자를 따옴표로 감싸기
 * - 불필요한 공백 제거
 *
 * @param content - 원본 Mermaid 다이어그램 코드
 * @returns 정규화된 Mermaid 코드
 */
function normalizeMermaidContent(content: string): string {
  if (!content) return '';

  let normalized = content;

  // 1. HTML 엔티티 디코딩
  const entities: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#039;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x5C;': '\\',
    '&#x60;': '`',
    '&nbsp;': ' ',
  };

  normalized = normalized.replace(
    /&[#\w]+;/g,
    (entity) => entities[entity] || entity,
  );

  // 2. <br> 태그 제거 또는 공백으로 변환
  // Mermaid 노드 레이블 안에서 <br/>는 문제를 일으킬 수 있으므로 공백으로 변환
  normalized = normalized.replace(/<br\s*\/?>/gi, ' ');

  // 3. 노드 레이블의 특수문자 처리
  // 대괄호 안의 텍스트에 특수문자가 있으면 따옴표로 감싸기
  normalized = fixNodeLabels(normalized);

  // 4. 연속된 공백 정리 (코드 블록 내부는 제외)
  normalized = normalized
    .split('\n')
    .map(line => line.trimEnd())  // 각 줄 끝 공백 제거
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');  // 3개 이상의 연속 줄바꿈을 2개로 축소

  return normalized.trim();
}

/**
 * Mermaid 노드 레이블의 특수문자를 안전하게 처리합니다.
 *
 * 노드 정의 형식:
 * - nodeId[레이블]
 * - nodeId(레이블)
 * - nodeId{레이블}
 * - nodeId>레이블]
 * - nodeId([레이블])
 * 등등
 *
 * 특수문자가 포함된 레이블을 따옴표로 감싸줍니다.
 */
function fixNodeLabels(content: string): string {
  // 특수문자 패턴 (Mermaid에서 문제를 일으킬 수 있는 문자들)
  const specialCharsPattern = /[\/\{\}:\|<>]/;

  // 노드 레이블 패턴 매칭
  // 형태: nodeId[label] 또는 nodeId(label) 등
  const nodeLabelPatterns = [
    // 1. 대괄호 형태: nodeId[label]
    {
      pattern: /(\w+)\[([^\]"]+)\]/g,
      replacer: (match: string, nodeId: string, label: string) => {
        // 이미 따옴표가 있으면 스킵
        if (label.trim().startsWith('"') && label.trim().endsWith('"')) {
          return match;
        }
        // 특수문자가 있으면 따옴표로 감싸기
        if (specialCharsPattern.test(label)) {
          const cleanLabel = label.trim();
          return `${nodeId}["${cleanLabel}"]`;
        }
        return match;
      }
    },
    // 2. 소괄호 형태: nodeId(label)
    {
      pattern: /(\w+)\(([^\)"]+)\)/g,
      replacer: (match: string, nodeId: string, label: string) => {
        if (label.trim().startsWith('"') && label.trim().endsWith('"')) {
          return match;
        }
        if (specialCharsPattern.test(label)) {
          const cleanLabel = label.trim();
          return `${nodeId}("${cleanLabel}")`;
        }
        return match;
      }
    },
    // 3. 중괄호 형태: nodeId{label}
    {
      pattern: /(\w+)\{([^\}"]+)\}/g,
      replacer: (match: string, nodeId: string, label: string) => {
        if (label.trim().startsWith('"') && label.trim().endsWith('"')) {
          return match;
        }
        if (specialCharsPattern.test(label)) {
          const cleanLabel = label.trim();
          return `${nodeId}{"${cleanLabel}"}`;
        }
        return match;
      }
    }
  ];

  let result = content;

  // 각 패턴에 대해 처리
  for (const { pattern, replacer } of nodeLabelPatterns) {
    result = result.replace(pattern, replacer);
  }

  return result;
}

/**
 * Mermaid 다이어그램 렌더링
 *
 * @param id - 다이어그램 고유 ID
 * @param content - Mermaid 다이어그램 코드
 * @returns 렌더링된 SVG 문자열
 */
export async function renderMermaidDiagram(id: string, content: string): Promise<string> {
  // 초기화 확인
  initializeMermaid();

  // 콘텐츠 정규화 - 파싱 오류 방지
  const normalizedContent = normalizeMermaidContent(content);

  // 고유 ID 생성
  const uniqueId = `mermaid_${id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 기존 엘리먼트 제거 (중복 방지)
  const existingElement = document.getElementById(uniqueId);
  if (existingElement) {
    existingElement.remove();
  }

  try {
    const { svg } = await mermaid.render(uniqueId, normalizedContent);
    return svg;
  } catch (error) {
    console.error(`[Mermaid] 렌더링 실패 (${uniqueId}):`, error);

    // 개발 환경에서는 원본 콘텐츠도 출력
    if (process.env.NODE_ENV === 'development') {
      console.error('[Mermaid] 원본 콘텐츠:', content);
      console.error('[Mermaid] 정규화된 콘텐츠:', normalizedContent);
    }

    throw error;
  }
}