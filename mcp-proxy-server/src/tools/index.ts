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

import { MetricsService } from '../services/MetricsService.js';

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
  metricsService: MetricsService; // 메트릭 서비스 (도구 호출 추적용)
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
      instructions: `# Codebase.blog Auto-posting MCP Server

## Workflow

When user requests auto-posting with style flags (e.g., "create post --default"):

1. Call check_auth() to verify authentication
2. Call get_writing_style_guide(style) with appropriate style parameter:
   - --novel → 'novel'
   - --tutorial → 'tutorial'
   - --comedy → 'comedy'
   - --podcast → 'podcast'
   - --default or no flag → 'default'
3. Write content following the retrieved style guide
4. **Select a category** that best describes the post content (REQUIRED)
5. Call create_post() to publish (must include title, content_markdown, and category)

## Available Styles

**Priority:** Preset styles (default if no flag) → Custom markdown (if user provides)

- **default**: Professional technical blog (formal, detailed analysis) - used when no flag specified
- **novel**: Narrative storytelling (vivid descriptions, emotional journey)
- **tutorial**: Step-by-step guide (beginner-friendly, verification checkpoints)
- **comedy**: Humorous tone (self-deprecating, relatable developer experiences)
- **podcast**: Conversational dialogue (audio-friendly, zero visual dependency)
- **custom**: If user provides custom style markdown in conversation, pass it to customMarkdown parameter (highest priority override)

## Important Requirements

- **Category is REQUIRED**: Every post must have exactly 1 category that describes its content
- **Tags are optional**: Add up to 10 tags to help with post discoverability

## Tools

- **check_auth**: Verify authentication status (required first call)
- **get_writing_style_guide**: Retrieve writing style guidelines
- **create_post**: Publish blog post to codebase.blog (requires: title, content_markdown, category)`
    };
  });

  // 도구 정의
  const tools = [
    {
      name: 'check_auth',
      description: 'REQUIRED FIRST: Verify authentication status. Always call this before creating posts to confirm user identity and blog access.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_writing_style_guide',
      description: 'Retrieve writing style guidelines for blog posts. Returns comprehensive style guide with instructions and validation requirements.',
      inputSchema: {
        type: 'object',
        properties: {
          customMarkdown: {
            type: 'string',
            description: 'User-provided custom style markdown (highest priority). Use this when user provides their own style guide in the conversation.',
          },
          style: {
            type: 'string',
            enum: ['default', 'novel', 'tutorial', 'comedy', 'podcast'],
            default: 'default',
            description: 'Preset style (used if customMarkdown not provided)',
          },
        },
      },
    },
    {
      name: 'create_post',
      description: 'Create and publish a new blog post to codebase.blog.',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Post title',
          },
          content_markdown: {
            type: 'string',
            description: 'Post content in markdown format',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags (optional, max 10)',
          },
          category: {
            type: 'string',
            description: 'Category (required) - Select exactly 1 category that best describes the post content',
          },
          writingStyle: {
            type: 'string',
            enum: ['default', 'novel', 'tutorial', 'comedy', 'podcast'],
            default: 'default',
            description: 'Writing style preset',
          },
        },
        required: ['title', 'content_markdown', 'category'],
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

    try {
      let result;

      switch (name) {
        case 'check_auth':
          result = await handleCheckAuth(context);
          break;

        case 'get_writing_style_guide':
          result = await handleGetWritingStyleGuide(args as any, context);
          break;

        case 'create_post':
          result = await handleCreatePost(args as any, context);
          break;

        default:
          throw new Error(`Tool '${name}' not found`);
      }

      // 메트릭 기록 (성공)
      context.metricsService.recordRequest('success', name);

      return result;
    } catch (error) {
      // 메트릭 기록 (실패)
      context.metricsService.recordRequest('error', name);
      throw error;
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
  args: { style?: string; customMarkdown?: string },
  context: ToolContext
): Promise<any> {
  const styleService = new WritingStyleService();
  let styleData;

  // 우선순위 1: 사용자 제공 커스텀 마크다운 (최우선)
  if (args.customMarkdown) {
    logger.info({
      userId: context.userData.userId.substring(0, 8),
      source: 'custom-markdown',
    }, '📖 Using user-provided custom markdown style');
    styleData = await styleService.parseRawMarkdown(args.customMarkdown);
  } else {
    // 우선순위 2: 프리셋 스타일 (플래그 없으면 default)
    const style = args.style || 'default';
    logger.info({
      style,
      userId: context.userData.userId.substring(0, 8),
      source: 'preset',
    }, '📖 Writing style guide retrieved');
    styleData = await styleService.loadAndParseStyle(style);
  }

  // 전체 스타일 가이드 조합
  const fullGuide = [
    `# ${styleData.metadata.styleName}`,
    '',
    `**Requirements:** ${styleData.metadata.minLength}+ chars (target: ${styleData.metadata.targetLength}) | Language: ${styleData.metadata.language} | AI tag: ${styleData.metadata.aiTagRequired ? 'required' : 'optional'}`,
    '',
    styleData.instructions,
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
