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
 * Mermaid 다이어그램 렌더링
 *
 * @param id - 다이어그램 고유 ID
 * @param content - Mermaid 다이어그램 코드
 * @returns 렌더링된 SVG 문자열
 */
export async function renderMermaidDiagram(id: string, content: string): Promise<string> {
  // 초기화 확인
  initializeMermaid();

  // 고유 ID 생성
  const uniqueId = `mermaid_${id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 기존 엘리먼트 제거 (중복 방지)
  const existingElement = document.getElementById(uniqueId);
  if (existingElement) {
    existingElement.remove();
  }

  try {
    const { svg } = await mermaid.render(uniqueId, content);
    return svg;
  } catch (error) {
    console.error(`[Mermaid] 렌더링 실패 (${uniqueId}):`, error);
    throw error;
  }
}