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
 * 파이 차트 데이터 인터페이스
 */
interface PieChartData {
  label: string;
  value: number;
}

/**
 * 파이 차트 음수 값 처리 옵션
 */
export type PieChartNegativeValueStrategy = 'filter' | 'absolute' | 'zero';

/**
 * 파이 차트 설정 옵션
 */
export interface PieChartOptions {
  negativeValueStrategy?: PieChartNegativeValueStrategy;
  showWarningForNegative?: boolean;
}

/**
 * 파이 차트 여부를 감지합니다.
 */
function detectPieChart(content: string): boolean {
  return /^\s*pie\b/i.test(content.trim());
}

/**
 * 파이 차트 데이터를 추출합니다.
 */
function extractPieChartValues(content: string): PieChartData[] {
  const values: PieChartData[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // 파이 차트 데이터 라인 패턴: "label" : value
    const match = line.match(/^\s*"([^"]+)"\s*:\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (match) {
      values.push({
        label: match[1],
        value: parseFloat(match[2])
      });
    }
  }

  return values;
}

/**
 * 파이 차트의 음수 값을 처리합니다.
 */
function handleNegativeValues(values: PieChartData[], strategy: PieChartNegativeValueStrategy = 'filter'): PieChartData[] {
  switch (strategy) {
    case 'filter':
      // 음수 값 제거
      return values.filter(item => item.value >= 0);

    case 'absolute':
      // 절대값으로 변환 (라벨에 표시)
      return values.map(item => ({
        ...item,
        value: Math.abs(item.value),
        label: item.value < 0 ? `${item.label} (음수)` : item.label
      }));

    case 'zero':
      // 음수 값을 0으로 변환
      return values.map(item => ({
        ...item,
        value: Math.max(0, item.value),
        label: item.value < 0 ? `${item.label} (0으로 처리)` : item.label
      }));

    default:
      return values;
  }
}

/**
 * 파이 차트 데이터를 정규화합니다.
 */
function normalizePieChartData(content: string, options?: PieChartOptions): string {
  if (!detectPieChart(content)) {
    return content;
  }

  const values = extractPieChartValues(content);
  const negativeValues = values.filter(v => v.value < 0);

  if (negativeValues.length === 0) {
    return content; // 음수가 없으면 그대로 반환
  }

  // 음수 값 처리
  const strategy = options?.negativeValueStrategy || 'filter';
  const processedValues = handleNegativeValues(values, strategy);

  // 경고 로그
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Mermaid] 파이 차트 음수 값 ${negativeValues.length}개 발견 (${strategy} 전략으로 처리)`);
    console.log('[Mermaid] 원본 음수 값:', negativeValues);
  }

  // 새로운 파이 차트 콘텐츠 생성
  const lines = content.split('\n');
  const result: string[] = [];
  let inDataSection = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 파이 차트 헤더는 그대로 유지
    if (trimmedLine.toLowerCase().startsWith('pie')) {
      result.push(line);
      inDataSection = true;
      continue;
    }

    // 데이터 섹션에서 음수 값이 있는 라인은 건너뛰기
    if (inDataSection && /^\s*"/.test(trimmedLine)) {
      const match = trimmedLine.match(/^\s*"([^"]+)"\s*:\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (match) {
        const value = parseFloat(match[2]);
        if (value < 0 && strategy === 'filter') {
          // 필터 전략에서는 음수 라인을 건너뜀
          continue;
        }
      }
    }

    result.push(line);
  }

  // 처리된 데이터 추가 (필터 전략이 아닌 경우)
  if (strategy !== 'filter') {
    // 결과 배열에서 이미 처리된 데이터가 있으므로 추가할 필요 없음
    // normalizeContent에서 이미 처리됨
  }

  return result.join('\n');
}

/**
 * Mermaid 콘텐츠를 정규화합니다.
 *
 * HTML 태그와 특수문자를 Mermaid가 이해할 수 있는 형식으로 변환합니다.
 * - HTML 엔티티 디코딩
 * - <br> 태그를 Mermaid 라인 브레이크로 변환
 * - 노드 레이블의 특수문자를 따옴표로 감싸기
 * - 파이 차트의 음수 값 처리
 * - 불필요한 공백 제거
 *
 * @param content - 원본 Mermaid 다이어그램 코드
 * @param options - 파이 차트 처리 옵션
 * @returns 정규화된 Mermaid 코드
 */
function normalizeMermaidContent(content: string, options?: PieChartOptions): string {
  if (!content) return '';

  let normalized = content;

  // 0. 파이 차트 음수 값 처리 (먼저 처리해야 함)
  normalized = normalizePieChartData(normalized, options);

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
 * @param options - 파이 차트 처리 옵션
 * @returns 렌더링된 SVG 문자열
 */
export async function renderMermaidDiagram(id: string, content: string, options?: PieChartOptions): Promise<string> {
  // 초기화 확인
  initializeMermaid();

  // 콘텐츠 정규화 - 파싱 오류 방지
  const normalizedContent = normalizeMermaidContent(content, options);

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

    // 파이 차트 관련 에러인 경우 더 구체적인 메시지 제공
    if (detectPieChart(content)) {
      const values = extractPieChartValues(content);
      const negativeValues = values.filter(v => v.value < 0);

      if (negativeValues.length > 0) {
        const errorMessage = `파이 차트에 음수 값이 포함되어 있습니다: ${negativeValues.map(v => `"${v.label}": ${v.value}`).join(', ')}\n\n` +
          '해결 방법:\n' +
          '1. 음수 값을 제거\n' +
          '2. 양수 값으로 변경\n' +
          '3. 다른 차트 타입(막대 그래프 등) 사용';

        console.error('[Mermaid] 파이 차트 오류 상세:', errorMessage);

        // 새로운 에러 생성 (error 객체를 직접 수정하지 않음)
        const pieChartError = new Error(errorMessage);
        throw pieChartError;
      }
    }

    throw error;
  }
}