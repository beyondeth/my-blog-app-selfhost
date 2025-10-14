/**
 * get_writing_style_guide 도구
 *
 * 선택한 스타일의 완전한 가이드라인을 반환합니다.
 * - MCP 서버가 자신의 로컬 파일을 읽어서 반환
 * - LLM은 파일 경로를 알 필요 없음
 * - 클라우드 배포 시에도 작동
 * - 정확히 하나의 스타일만 반환 (토큰 절약)
 */

import { WritingStyleService } from '../services/WritingStyleService.js';
import { logger } from '../utils/logger.js';

export interface GetWritingStyleGuideParams {
  style?: string;
}

export interface GetWritingStyleGuideContext {
  // 현재는 필요 없지만 확장성을 위해 정의
  currentSessionId?: string;
}

/**
 * get_writing_style_guide 도구 핸들러
 *
 * 지정된 스타일의 완전한 마크다운 가이드를 반환합니다.
 * YAML front matter에 validation_token과 validation_challenges 포함.
 */
export async function getWritingStyleGuideHandler(
  params: GetWritingStyleGuideParams,
  context: GetWritingStyleGuideContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const styleService = new WritingStyleService();
  const selectedStyle = params.style || 'default';

  logger.info({
    style: selectedStyle,
    sessionId: context.currentSessionId?.substring(0, 8) || 'unknown'
  }, `📖 [WritingStyleGuide] Loading style guide: ${selectedStyle}`);

  try {
    // WritingStyleService를 통해 스타일 파일 읽기
    // 서버가 자신의 로컬 파일 시스템에서 읽음 (../../writing-styles/*.md)
    const styleContent = await styleService.loadStyle(selectedStyle);

    logger.info({
      style: selectedStyle,
      contentLength: styleContent.length,
      sessionId: context.currentSessionId?.substring(0, 8) || 'unknown'
    }, `✅ [WritingStyleGuide] Style guide loaded successfully`);

    // 성공 메시지와 함께 마크다운 반환
    const message = `📖 **${selectedStyle.toUpperCase()} 스타일 가이드**

아래는 "${selectedStyle}" 스타일의 완전한 가이드라인입니다.

**다음 단계:**
1. YAML front matter에서 \`validation_token\`을 찾으세요
2. YAML front matter에서 \`validation_challenges\` 중 하나를 선택하고 답변을 찾으세요
3. \`create_post\` 도구를 호출할 때 토큰과 답변을 포함하세요

---

${styleContent}`;

    return {
      content: [
        {
          type: 'text',
          text: message,
        },
      ],
    };
  } catch (error: any) {
    // 에러 처리
    logger.error({
      style: selectedStyle,
      error: error.message,
      sessionId: context.currentSessionId?.substring(0, 8) || 'unknown'
    }, `❌ [WritingStyleGuide] Failed to load style guide`);

    let errorMessage = `❌ **스타일 가이드 로드 실패**\n\n`;

    if (error.message.includes('유효하지 않은 프리셋 스타일')) {
      errorMessage += `요청하신 스타일 "${selectedStyle}"은(는) 유효하지 않습니다.\n\n`;
      errorMessage += `사용 가능한 스타일: default, novel, tutorial, comedy, podcast`;
    } else if (error.message.includes('찾을 수 없습니다')) {
      errorMessage += `스타일 파일을 찾을 수 없습니다: ${selectedStyle}\n\n`;
      errorMessage += `MCP 서버 설정을 확인해주세요.`;
    } else {
      errorMessage += `오류: ${error.message}`;
    }

    throw new Error(errorMessage);
  }
}
