/**
 * 도구 등록 - API Key 인증 버전 (간단화)
 *
 * 변경 사항:
 * - OAuth2 세션 제거
 * - userData 직접 전달 (API Key 검증 결과)
 * - AsyncLocalStorage 제거 (불필요)
 * - 깔끔한 구조
 */

import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  InitializeRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { WritingStyleService } from '../services/WritingStyleService.js';
import axios from 'axios';

/**
 * 도구 컨텍스트 (API Key 검증 결과)
 */
interface ToolContext {
  userData: {
    keyId: string;
    userId: string;
    blogId: string;
    user: { id: string; username: string; email: string };
    blog: { id: string; name: string; slug: string };
  };
  apiKey: string; // 원본 API Key (Backend 인증용)
  config: {
    MCP_BASE_URL: string;
    BACKEND_BASE_URL: string;
    BACKEND_PUBLIC_URL: string;
  };
}

/**
 * 모든 도구 등록
 *
 * @param mcpServer MCP 서버 인스턴스
 * @param context API Key 검증 결과 + 설정
 */
export async function registerAllTools(
  mcpServer: McpServer,
  context: ToolContext
): Promise<void> {
  // Initialize 핸들러
  mcpServer.setRequestHandler(InitializeRequestSchema, async () => {
    logger.info('🔌 MCP Server initializing...');
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        prompts: { listChanged: true },
      },
      serverInfo: {
        name: 'codebase-blog-mcp',
        version: '8.0.0',
        title: 'Codebase.blog MCP Server',
        websiteUrl: 'https://codebase.blog'
      },
      instructions: `# Codebase.blog 자동포스팅 MCP 서버

## 🚀 자동포스팅 워크플로우

사용자가 "자동포스팅해줘 --novel" 같은 요청을 하면:

1. **check_auth** 먼저 호출 (인증 상태 확인)
2. **get_writing_style_guide** 호출 with style parameter:
   - --novel → style: 'novel'
   - --tutorial → style: 'tutorial'
   - --comedy → style: 'comedy'
   - --podcast → style: 'podcast'
   - --default 또는 플래그 없음 → style: 'default'
3. 스타일 가이드에 따라 블로그 글 작성
4. **create_post** 호출하여 포스트 생성

## 📝 사용 가능한 Writing Styles

- **default**: 전문적인 기술 블로그 (형식적, 상세함)
- **novel**: 내러티브 스토리텔링 (생동감 있는 묘사)
- **tutorial**: 단계별 교육 형식 (초보자 친화적)
- **comedy**: 유머러스하고 재미있는 톤
- **podcast**: 대화체이고 참여를 유도하는 스타일

## 🔑 한국어 트리거 감지

다음 키워드 감지 시 자동포스팅 워크플로우 시작:
- "자동포스팅", "블로그 작성", "포스트 생성", "글 써줘"
- "위 내용으로", "이거로", "다음 내용을"

스타일 플래그는 "--" 형태로 감지 (예: "--novel", "--tutorial")

## 🛠️ 도구 설명

- **check_auth**: 인증 상태 확인 (필수 우선 호출)
- **get_writing_style_guide**: 글쓰기 스타일 가이드 조회
- **create_post**: 블로그 포스트 생성

## 📚 프롬프트

- **markdown_quality_guidelines**: 마크다운 품질 가이드라인
- **blog_post_template**: 블로그 포스트 템플릿
- **improve_markdown**: 마크다운 개선 기법`
    };
  });

  // 도구 정의
  const tools = [
    {
      name: 'check_auth',
      description: '🔐 REQUIRED FIRST: Verify authentication status with codebase.blog. Always call this first before creating posts to confirm user identity and blog access.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_writing_style_guide',
      description: 'Get writing style guidelines for blog posts. Returns validation token and challenges needed for create_post.',
      inputSchema: {
        type: 'object',
        properties: {
          style: {
            type: 'string',
            enum: ['default', 'novel', 'tutorial', 'comedy', 'podcast'],
            default: 'default',
            description: 'Writing style preset',
          },
        },
      },
    },
    {
      name: 'create_post',
      description: 'Create a new blog post. Requires validation token from get_writing_style_guide.',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Post title',
          },
          content_markdown: {
            type: 'string',
            description: 'Post content in markdown',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags (optional, max 10)',
          },
          category: {
            type: 'string',
            description: 'Category (optional)',
          },
          writingStyle: {
            type: 'string',
            enum: ['default', 'novel', 'tutorial', 'comedy', 'podcast'],
            default: 'default',
            description: 'Writing style preset',
          },
          validationToken: {
            type: 'string',
            description: '🔑 REQUIRED: Validation token from get_writing_style_guide',
          },
          challengeAnswer: {
            type: 'string',
            description: 'Answer to validation challenge (optional)',
          },
        },
        required: ['title', 'content_markdown'],
      },
    },
  ];

  // 도구 목록 핸들러
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  // 도구 실행 핸들러
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logger.debug({
      tool: name,
      userId: context.userData.userId.substring(0, 8),
      blogSlug: context.userData.blog.slug,
    }, '🔧 Tool called');

    switch (name) {
      case 'check_auth':
        return await handleCheckAuth(context);

      case 'get_writing_style_guide':
        return await handleGetWritingStyleGuide(args as any, context);

      case 'create_post':
        return await handleCreatePost(args as any, context);

      default:
        throw new Error(`Tool '${name}' not found`);
    }
  });

  // Prompts 등록
  await registerPrompts(mcpServer);

  logger.info({
    toolCount: tools.length,
    tools: tools.map((t) => t.name),
    userId: context.userData.userId.substring(0, 8),
  }, '✅ Tools registered');
}

/**
 * Prompts 등록 (Writing Style 가이드)
 */
async function registerPrompts(mcpServer: McpServer): Promise<void> {
  const styleService = new WritingStyleService();
  const defaultStyle = await styleService.loadAndParseStyle('default');

  const prompts = [
    {
      name: 'markdown_quality_guidelines',
      description: 'Professional markdown writing guidelines for blog posts',
    },
    {
      name: 'blog_post_template',
      description: 'Standard blog post template structure',
    },
    {
      name: 'improve_markdown',
      description: 'Techniques for enhancing blog post quality',
    },
  ];

  mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts,
  }));

  mcpServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;

    let content: string;

    switch (name) {
      case 'markdown_quality_guidelines':
        content = defaultStyle.qualityGuidelinesPrompt;
        break;
      case 'blog_post_template':
        content = defaultStyle.blogPostTemplatePrompt;
        break;
      case 'improve_markdown':
        content = defaultStyle.improveMarkdownPrompt;
        break;
      default:
        throw new Error(`Prompt '${name}' not found`);
    }

    return {
      description: `Writing style guide: ${name}`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: content,
          },
        },
      ],
    };
  });

  logger.debug({
    promptCount: prompts.length,
  }, '✅ Prompts registered');
}

/**
 * check_auth 핸들러
 *
 * 사용자 인증 상태를 확인하고 안내 메시지를 반환합니다.
 * 실제 인증은 MCP 연결 시점에 이미 완료되었으므로,
 * 이 함수는 인증된 사용자 정보를 표시하는 역할만 합니다.
 */
async function handleCheckAuth(context: ToolContext): Promise<any> {
  logger.info({
    userId: context.userData.userId.substring(0, 8),
    blogSlug: context.userData.blog.slug,
  }, '🔐 Authentication check');

  return {
    content: [
      {
        type: 'text',
        text: `✅ *** CODEBASE.BLOG 유저 인증이 완료됨 ***
✅ ${context.userData.user.username} (${context.userData.user.email})
✅ 블로그 주소 : https://www.codebase.blog/${context.userData.blog.slug}`,
      },
    ],
  };
}

/**
 * get_writing_style_guide 핸들러
 */
async function handleGetWritingStyleGuide(
  args: { style?: string },
  context: ToolContext
): Promise<any> {
  const style = args.style || 'default';

  const styleService = new WritingStyleService();
  const styleData = await styleService.loadAndParseStyle(style);

  logger.info({
    style,
    userId: context.userData.userId.substring(0, 8),
  }, '📖 Writing style guide retrieved');

  // 전체 스타일 가이드 조합
  const fullGuide = [
    `# Writing Style Guide: ${styleData.metadata.styleName}`,
    '',
    '## Metadata',
    `- Language: ${styleData.metadata.language}`,
    `- Min Length: ${styleData.metadata.minLength}`,
    `- Target Length: ${styleData.metadata.targetLength}`,
    `- AI Tag Required: ${styleData.metadata.aiTagRequired}`,
    '',
    '## Instructions',
    styleData.instructions,
    '',
    '## Create Post Description',
    styleData.createPostDescription,
  ].join('\n');

  return {
    content: [
      {
        type: 'text',
        text: fullGuide,
      },
    ],
  };
}

/**
 * create_post 핸들러
 */
async function handleCreatePost(
  args: {
    title: string;
    content_markdown: string;
    tags?: string[];
    category?: string;
    writingStyle?: string;
    validationToken?: string;
    challengeAnswer?: string;
  },
  context: ToolContext
): Promise<any> {
  try {
    // 태그 10개 제한
    const tags = args.tags ? args.tags.slice(0, 10) : [];

    logger.debug({
      title: args.title,
      contentLength: args.content_markdown.length,
      tagCount: tags.length,
      userId: context.userData.userId.substring(0, 8),
      blogSlug: context.userData.blog.slug,
    }, '📝 Creating post...');

    // Backend MCP API 호출 (포스트 생성 - API Key 인증)
    // /api/v1/mcp/posts 엔드포인트 사용 (Fast Path, API Key 인증)
    const response = await axios.post(
      `${context.config.BACKEND_BASE_URL}/api/v1/mcp/posts`,
      {
        title: args.title,
        content_markdown: args.content_markdown, // 원본 마크다운
        tags,
        category: args.category,
      },
      {
        headers: {
          'X-API-Key': context.apiKey, // API Key 인증
        },
        timeout: 30000,
      }
    );

    // Backend MCP 엔드포인트는 Fast Path 응답 (status 202)
    // response.data = { id, slug, title, url, blog, _meta }
    const post = response.data;

    // MCP API Key의 postsCreated 카운트 증가 (비동기, 블로킹 안 함)
    incrementPostsCreated(context.userData.keyId, context.config.BACKEND_BASE_URL).catch((err) => {
      logger.warn({ error: err.message }, '⚠️ Failed to increment postsCreated');
    });

    logger.info({
      postId: post.id.substring(0, 8),
      slug: post.slug,
      userId: context.userData.userId.substring(0, 8),
    }, '✅ Post created (Fast Path)');

    return {
      content: [
        {
          type: 'text',
          text: `✅ Post created successfully!

**Title:** ${post.title}
**Slug:** ${post.slug}
**URL:** https://codebase.blog${post.url}

The post has been published to your blog "${context.userData.blog.name}".
${post._meta ? `\n_Processing in background: ${post._meta.processingTime || 'ongoing'}_` : ''}`,
        },
      ],
    };
  } catch (error: any) {
    logger.error({
      error: error.message,
      userId: context.userData.userId.substring(0, 8),
      title: args.title,
    }, '❌ Failed to create post');

    // 에러 메시지 포맷팅
    let errorMessage = 'Failed to create post';

    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
}

/**
 * MCP API Key의 postsCreated 카운트 증가 (비동기)
 */
async function incrementPostsCreated(
  keyId: string,
  backendUrl: string
): Promise<void> {
  await axios.post(
    `${backendUrl}/api/v1/mcp/keys/${keyId}/increment-posts`,
    {},
    { timeout: 3000 }
  );
}
