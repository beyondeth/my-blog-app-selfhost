import { logger } from '../../utils/logger.js';
import type { ToolContext } from '../types.js';
import { toPublicBlogUrl } from './shared.js';

/**
 * check_auth 핸들러
 *
 * 사용자 인증 상태를 확인하고 안내 메시지를 반환합니다.
 * 실제 인증은 MCP 연결 시점에 이미 완료되었으므로,
 * 이 함수는 인증된 사용자 정보를 표시하는 역할만 합니다.
 */
export async function handleCheckAuth(context: ToolContext): Promise<any> {
  const authMode = context.oauthToken ? 'OAuth 2.1' : 'API Key';
  const publicBlogUrl = toPublicBlogUrl(
    context.userData.blog.slug,
    context.config.FRONTEND_URL
  );

  logger.info(
    {
      userId: context.userData.userId.substring(0, 8),
      blogSlug: context.userData.blog.slug,
      authMode,
    },
    '🔐 Authentication check'
  );

  return {
    content: [
      {
        type: 'text',
        text: `✅ *** CODEBASE.BLOG 유저 인증이 완료됨 ***
✅ ${context.userData.user.username} (${context.userData.user.email})
✅ 블로그 주소 : ${publicBlogUrl}
✅ 인증 방식 : ${authMode}`,
      },
    ],
  };
}
