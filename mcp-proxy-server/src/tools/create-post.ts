/**
 * create_post 도구
 *
 * 인증된 세션을 사용하여 블로그 포스트를 생성합니다.
 * - Bearer token으로 Backend API 호출
 * - Writing style은 도구 description에 이미 포함되어 있음
 *   (Claude Code가 도구 설명을 보고 해당 스타일로 글을 작성함)
 * - 입력 검증 강화 (XSS 방어)
 */

import axios from 'axios';
import { SessionService } from '../services/SessionService.js';
import { CreatePostSchema, type CreatePostInput } from '../validation/schemas.js';
import { z } from 'zod';

export interface CreatePostToolParams {
  title: string;
  content_markdown: string;
  tags?: string[];
  category?: string;
  // writingStyle 파라미터 제거: 스타일은 도구 설명에 이미 포함됨
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
  const { sessionId, title, content_markdown, tags, category } = params;

  // 0. 입력 검증 (XSS/Injection 방어)
  try {
    CreatePostSchema.parse({ title, content_markdown, tags, category });
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
        tags: tags || [],
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

    // 3. 성공 메시지 반환
    const message = [
      '✅ 포스트가 성공적으로 생성되었습니다!',
      '',
      `**제목:** ${post.title}`,
      `**Slug:** ${post.slug}`,
      `**URL:** ${config.BACKEND_BASE_URL}${post.url}`,
      '',
      post.blog ? `**블로그:** ${post.blog.name} (@${post.blog.slug})` : '',
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
