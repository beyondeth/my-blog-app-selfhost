/**
 * 에러 메시지 로더 유틸리티
 *
 * .md 파일에서 에러 메시지를 로드하고 변수를 치환합니다.
 * SuperClaude의 문서 기반 패턴을 적용하여 코드와 메시지를 분리합니다.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 에러 메시지 로드 및 변수 치환
 *
 * @param messageName - 메시지 파일명 (확장자 제외)
 * @param variables - 치환할 변수 객체 (예: { token: "abc", style: "novel" })
 * @returns 변수가 치환된 에러 메시지
 *
 * @example
 * const message = await loadErrorMessage('token-missing', { style: 'novel' });
 * throw new Error(message);
 */
export async function loadErrorMessage(
  messageName: string,
  variables?: Record<string, string>
): Promise<string> {
  try {
    // 1. .md 파일 경로 구성
    const filePath = path.join(__dirname, '../../docs/error-messages', `${messageName}.md`);

    // 2. 파일 읽기
    let message = await fs.readFile(filePath, 'utf-8');

    // 3. 변수 치환 (있으면)
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        // {key} 패턴을 실제 값으로 치환
        const pattern = new RegExp(`\\{${key}\\}`, 'g');
        message = message.replace(pattern, value);
      }
    }

    return message;
  } catch (error: any) {
    // 파일을 찾을 수 없는 경우 fallback 메시지
    if (error.code === 'ENOENT') {
      return `❌ 에러가 발생했습니다 (메시지 파일 없음: ${messageName})`;
    }

    // 기타 에러
    throw error;
  }
}

/**
 * 도구 설명 로드
 *
 * @param toolName - 도구 이름
 * @returns 도구 설명 텍스트
 *
 * @example
 * const description = await loadToolDescription('create-post');
 */
export async function loadToolDescription(toolName: string): Promise<string> {
  try {
    // 1. .md 파일 경로 구성
    const filePath = path.join(__dirname, '../../docs/tool-descriptions', `${toolName}.md`);

    // 2. 파일 읽기
    const description = await fs.readFile(filePath, 'utf-8');

    return description;
  } catch (error: any) {
    // 파일을 찾을 수 없는 경우 fallback
    if (error.code === 'ENOENT') {
      return `Tool: ${toolName} (description file not found)`;
    }

    // 기타 에러
    throw error;
  }
}
