/**
 * create_post 도구
 *
 * 인증된 세션을 사용하여 블로그 포스트를 생성합니다.
 * - Bearer token으로 Backend API 호출
 * - Writing style은 도구 description에 이미 포함되어 있음
 *   (Claude Code가 도구 설명을 보고 해당 스타일로 글을 작성함)
 * - writingStyle 파라미터: 사용자가 원하는 스타일 지정 (default, novel, tutorial, comedy, podcast)
 * - 입력 검증 강화 (XSS 방어)
 * - 로컬 .md 백업 자동 저장
 */

import axios from 'axios';
import { SessionService } from '../services/SessionService.js';
import { WritingStyleService } from '../services/WritingStyleService.js';
import { CreatePostSchema, type CreatePostInput } from '../validation/schemas.js';
import { z } from 'zod';
import { savePostToFile } from '../lib/filesystem.js';
import { loadErrorMessage } from '../lib/error-messages.js';
import { logger } from '../utils/logger.js';
import * as path from 'path';

export interface CreatePostToolParams {
  title?: string;
  content_markdown?: string;
  tags?: string[];
  category?: string;
  writingStyle?: string;
  validationToken?: string;  // 검증 토큰 추가 (Phase 1)
  challengeAnswer?: string;  // 챌린지 답변 추가 (Phase 2)
}

export interface CreatePostToolContext {
  sessionService: SessionService;
  config: {
    BACKEND_BASE_URL: string;
  };
}

/**
 * create_post 도구 핸들러
 */
export async function createPostHandler(
  params: CreatePostToolParams & { sessionId: string },
  context: CreatePostToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { sessionService, config } = context;
  const { sessionId, title, content_markdown, tags, category, writingStyle, validationToken, challengeAnswer } = params;

  // Writing Style 로드 및 검증
  const styleService = new WritingStyleService();
  const selectedStyle = writingStyle || 'default';

  // Phase 1: 토큰 검증 로직
  if (!validationToken) {
    // 토큰이 없으면 get_writing_style_guide 도구 호출을 유도
    const errorMessage = await loadErrorMessage('token-missing', {
      style: selectedStyle
    });
    throw new Error(errorMessage);
  }

  // 토큰 유효성 검증
  const tokenValidation = await styleService.validateToken(validationToken);
  if (!tokenValidation.valid) {
    const errorMessage = await loadErrorMessage('token-invalid', {
      token: validationToken
    });
    throw new Error(errorMessage);
  }

  // 토큰이 맞는 스타일인지 확인
  if (tokenValidation.styleName !== selectedStyle) {
    const errorMessage = await loadErrorMessage('token-mismatch', {
      requestedStyle: selectedStyle,
      tokenStyle: tokenValidation.styleName || 'unknown'
    });
    throw new Error(errorMessage);
  }

  logger.info({
    styleName: tokenValidation.style?.metadata.styleName,
    language: tokenValidation.style?.metadata.language,
    selectedStyle: selectedStyle,
    tokenProvided: true
  }, `✅ [WritingStyle] Style validated with token: ${selectedStyle}`);

  // Phase 2: 동적 챌린지 검증 (스타일 가이드 이해도 확인)
  if (!challengeAnswer) {
    // 답변이 없으면 랜덤 질문 던지기
    const challenge = await styleService.getRandomChallenge(tokenValidation.styleName!);

    if (!challenge) {
      // 챌린지가 없으면 Phase 1만 통과로 진행 (하위 호환성)
      logger.warn({
        styleName: tokenValidation.styleName,
        phase: 'Phase2-Skip'
      }, '⚠️ [Challenge] No challenges found for style, proceeding with Phase 1 only');
    } else {
      // 챌린지가 있으면 답변 요구
      const errorMessage = await loadErrorMessage('challenge-missing', {
        question: challenge.question,
        title: title || '제목',
        tags: JSON.stringify(tags || []),
        token: validationToken
      });
      throw new Error(errorMessage);
    }
  } else {
    // challengeAnswer가 있으면 검증
    const answerValidation = await styleService.validateAnswerForStyle(
      tokenValidation.styleName!,
      challengeAnswer
    );

    if (!answerValidation.valid) {
      // 오답일 경우 다른 질문 던지기
      const newChallenge = await styleService.getRandomChallenge(tokenValidation.styleName!);

      logger.warn({
        styleName: tokenValidation.styleName,
        providedAnswer: challengeAnswer.substring(0, 20),
        phase: 'Phase2-Failed'
      }, '❌ [Challenge] Wrong answer provided');

      const errorMessage = await loadErrorMessage('challenge-wrong', {
        providedAnswer: challengeAnswer,
        newQuestion: newChallenge?.question || '질문을 찾을 수 없습니다',
        style: selectedStyle
      });
      throw new Error(errorMessage);
    }

    // 답변이 맞으면 로그 기록하고 계속 진행
    logger.info({
      styleName: tokenValidation.styleName,
      matchedQuestion: answerValidation.matchedQuestion,
      phase: 'Phase2-Success'
    }, `✅ [Challenge] Correct answer provided`);
  }

  // 태그 자동 절단 (최대 10개)
  let validatedTags = tags || [];
  if (validatedTags.length > 10) {
    logger.warn({
      sessionId: sessionId.substring(0, 8),
      originalCount: validatedTags.length,
      truncatedTags: validatedTags.slice(10)
    }, '⚠️ [Tag Validation] Tag count exceeded limit (max 10), auto-truncating');

    validatedTags = validatedTags.slice(0, 10);
  }

  // 입력 검증 (XSS/Injection 방어)
  try {
    CreatePostSchema.parse({ title, content_markdown, tags: validatedTags, category });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map(issue =>
        `${issue.path.join('.')}: ${issue.message}`
      );
      throw new Error(`입력 검증 실패:\n${errorMessages.join('\n')}`);
    }
    throw error;
  }

  // 1. 세션 검증 및 access token 가져오기
  const session = await sessionService.getSession(sessionId);
  if (!session) {
    throw new Error(
      '❌ Authentication required!\n\n' +
      '👉 Please call the authenticate tool FIRST before creating posts.\n' +
      '💡 Tip: Always authenticate before attempting to create content.'
    );
  }

  const accessToken = await sessionService.getAccessToken(sessionId);
  if (!accessToken) {
    throw new Error(
      '❌ Access token expired!\n\n' +
      '👉 Please call the authenticate tool again to refresh your session.\n' +
      '💡 Tip: Authentication tokens expire after 24 hours.'
    );
  }

  // 2. Backend API 호출
  // Writing style은 Claude Code가 이미 적용하여 작성했으므로 별도 처리 불필요
  try {
    const response = await axios.post(
      `${config.BACKEND_BASE_URL}/api/v1/mcp/posts`,
      {
        title,
        content_markdown,
        tags: validatedTags,
        category,
        // writingStyle 필드 제거: 백엔드에서 받지 않음
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30초 타임아웃
      }
    );

    const post = response.data;

    // 3. 로컬 파일 저장 (non-blocking: 실패해도 포스트 생성은 성공 유지)
    let fileMessage = '';
    try {
      const savedFilePath = await savePostToFile(
        title!,
        content_markdown!,
        tags
      );

      if (savedFilePath) {
        fileMessage = `\n📁 **로컬 파일 저장:** ${path.basename(savedFilePath)}`;
        logger.info({
          filePath: savedFilePath,
          title: title
        }, '📁 Post saved to local file');
      }
    } catch (error: any) {
      // 로컬 저장 실패는 로그만 남기고 포스트 생성 성공 메시지는 그대로 반환
      logger.error({
        error: error.message,
        title: title
      }, '📁 Failed to save post to local file');
    }

    // 4. 성공 메시지 반환
    const message = [
      '✅ 포스트가 성공적으로 생성되었습니다!',
      '',
      `**제목:** ${post.title}`,
      `**Slug:** ${post.slug}`,
      `**URL:** ${config.BACKEND_BASE_URL}${post.url}`,
      '',
      post.blog ? `**블로그:** ${post.blog.name} (@${post.blog.slug})` : '',
      fileMessage, // 로컬 파일 저장 정보 추가
    ]
      .filter(Boolean)
      .join('\n');

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
    let errorMessage = '포스트 생성 중 오류가 발생했습니다.';

    if (error.response) {
      // Backend API 에러 응답
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        errorMessage = '인증이 만료되었습니다. authenticate 도구로 다시 인증해주세요.';
      } else if (status === 403) {
        errorMessage = '포스트 생성 권한이 없습니다.';
      } else if (status === 400) {
        errorMessage = `잘못된 요청입니다: ${data.message || '알 수 없는 오류'}`;
      } else if (status === 429) {
        errorMessage = 'API 호출 제한을 초과했습니다. 잠시 후 다시 시도해주세요.';
      } else {
        errorMessage = `서버 오류 (${status}): ${data.message || '알 수 없는 오류'}`;
      }
    } else if (error.request) {
      // 네트워크 오류
      errorMessage = 'Backend 서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
    } else {
      // 기타 오류
      errorMessage = `오류: ${error.message}`;
    }

    throw new Error(errorMessage);
  }
}

/**
 * MCP 도구 스키마
 */
export const createPostTool = {
  schema: {
    method: 'tools/call',
    params: {
      name: 'create_post',
      arguments: {
        sessionId: 'string',
        title: 'string',
        content_markdown: 'string',
        tags: 'array (optional)',
        category: 'string (optional)',
        // writingStyle 제거: 도구 설명에 이미 포함됨
      },
    },
  },
  handler: createPostHandler,
};
