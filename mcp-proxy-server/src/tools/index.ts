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
import {
  MCP_SERVER_INSTRUCTIONS,
  TOOL_CATALOG,
  type ToolName,
} from './catalog.js';

import { MetricsService } from '../services/MetricsService.js';

/**
 * 도구 컨텍스트 (API Key 또는 OAuth 인증 결과)
 */
export interface ToolContext {
  userData: {
    keyId: string;
    userId: string;
    blogId: string;
    user: { id: string; username: string; email: string };
    blog: { id: string; name: string; slug: string };
  };
  apiKey: string | null; // API Key 인증 시 사용 (Backend 인증용)
  oauthToken?: string; // OAuth 인증 시 사용 (Claude 커스텀 커넥터용)
  metricsService: MetricsService; // 메트릭 서비스 (도구 호출 추적용)
  config: {
    MCP_BASE_URL: string;
    BACKEND_BASE_URL: string;
    BACKEND_PUBLIC_URL: string;
    PUBLIC_SITE_URL: string;
    MCP_SHARED_SECRET?: string;
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
  context: ToolContext,
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
        name: 'aigory-blog-mcp',
        version: '8.0.0',
        title: 'Aigory MCP Server',
        websiteUrl: context.config.PUBLIC_SITE_URL,
      },
      instructions: MCP_SERVER_INSTRUCTIONS,
    };
  });

  const tools = TOOL_CATALOG.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));

  // 도구 목록 핸들러
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  // 도구 실행 핸들러
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolName = name as ToolName;

    logger.debug(
      {
        tool: toolName,
        userId: context.userData.userId.substring(0, 8),
        blogSlug: context.userData.blog.slug,
      },
      '🔧 Tool called',
    );

    const handlers: Record<ToolName, (toolArgs: any) => Promise<any>> = {
      check_auth: async () => handleCheckAuth(context),
      get_writing_style_guide: async (toolArgs) =>
        handleGetWritingStyleGuide((toolArgs || {}) as any, context),
      create_post: async (toolArgs) =>
        handleCreatePost((toolArgs || {}) as any, context),
      get_image_upload_url: async (toolArgs) =>
        handleGetImageUploadUrl((toolArgs || {}) as any, context),
      finalize_uploaded_image: async (toolArgs) =>
        handleFinalizeUploadedImage((toolArgs || {}) as any, context),
    };

    const handler = handlers[toolName];
    if (!handler) {
      context.metricsService.recordRequest('error', toolName);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'failed',
                error: `Tool '${toolName}' is not registered`,
                availableTools: TOOL_CATALOG.map((tool) => tool.name),
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    try {
      const result = await handler(args);

      // 메트릭 기록 (성공)
      context.metricsService.recordRequest('success', toolName);

      return result;
    } catch (error) {
      // 메트릭 기록 (실패)
      context.metricsService.recordRequest('error', toolName);
      throw error;
    }
  });

  // Prompts 등록
  await registerPrompts(mcpServer);

  logger.info(
    {
      toolCount: tools.length,
      tools: tools.map((t) => t.name),
      userId: context.userData.userId.substring(0, 8),
    },
    '✅ Tools registered',
  );
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

  logger.debug(
    {
      promptCount: prompts.length,
    },
    '✅ Prompts registered',
  );
}

/**
 * check_auth 핸들러
 *
 * 사용자 인증 상태를 확인하고 안내 메시지를 반환합니다.
 * 실제 인증은 MCP 연결 시점에 이미 완료되었으므로,
 * 이 함수는 인증된 사용자 정보를 표시하는 역할만 합니다.
 */
async function handleCheckAuth(context: ToolContext): Promise<any> {
  const authMode = context.oauthToken ? 'OAuth 2.1' : 'API Key';

  logger.info(
    {
      userId: context.userData.userId.substring(0, 8),
      blogSlug: context.userData.blog.slug,
      authMode,
    },
    '🔐 Authentication check',
  );

  return {
    content: [
      {
        type: 'text',
        text: `✅ *** BLOG 유저 인증이 완료됨 ***
✅ ${context.userData.user.username} (${context.userData.user.email})
✅ 블로그 주소 : ${context.config.PUBLIC_SITE_URL}/${context.userData.blog.slug}
✅ 인증 방식 : ${authMode}`,
      },
    ],
  };
}

/**
 * get_writing_style_guide 핸들러
 */
async function handleGetWritingStyleGuide(
  args: { style?: string; customMarkdown?: string },
  context: ToolContext,
): Promise<any> {
  const styleService = new WritingStyleService();
  let styleData;

  // 우선순위 1: 사용자 제공 커스텀 마크다운 (최우선)
  if (args.customMarkdown) {
    logger.info(
      {
        userId: context.userData.userId.substring(0, 8),
        source: 'custom-markdown',
      },
      '📖 Using user-provided custom markdown style',
    );
    styleData = await styleService.parseRawMarkdown(args.customMarkdown);
  } else {
    // 우선순위 2: 프리셋 스타일 (플래그 없으면 default)
    const style = args.style || 'default';
    logger.info(
      {
        style,
        userId: context.userData.userId.substring(0, 8),
        source: 'preset',
      },
      '📖 Writing style guide retrieved',
    );
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
    attachedFileIds?: string[];
    thumbnailImageId?: string;
  },
  context: ToolContext,
): Promise<any> {
  try {
    // 태그 10개 제한
    const tags = args.tags ? args.tags.slice(0, 10) : [];

    logger.debug(
      {
        title: args.title,
        contentLength: args.content_markdown.length,
        tagCount: tags.length,
        userId: context.userData.userId.substring(0, 8),
        blogSlug: context.userData.blog.slug,
      },
      '📝 Creating post...',
    );

    // Backend MCP API 호출 (포스트 생성)
    // API Key 또는 OAuth 토큰 인증
    const headers = buildBackendAuthHeaders(context);

    const response = await axios.post(
      `${context.config.BACKEND_BASE_URL}/api/v1/mcp/posts`,
      {
        title: args.title,
        content_markdown: args.content_markdown, // 원본 마크다운
        tags,
        category: args.category,
        attachedFileIds: args.attachedFileIds,
        thumbnailImageId: args.thumbnailImageId,
      },
      {
        headers,
        timeout: 30000,
      },
    );

    // Backend MCP 엔드포인트는 Fast Path 응답 (status 202)
    // response.data = { id, slug, title, url, blog, _meta }
    const post = response.data;

    // MCP API Key의 postsCreated 카운트 증가 (비동기, 블로킹 안 함)
    // OAuth 모드에서는 API Key가 없으므로 건너뜀
    if (context.apiKey && !context.userData.keyId.startsWith('oauth:')) {
      incrementPostsCreated(
        context.userData.keyId,
        context.config.BACKEND_BASE_URL,
        context.config.MCP_SHARED_SECRET,
      ).catch((err) => {
        logger.warn(
          { error: err.message },
          '⚠️ Failed to increment postsCreated',
        );
      });
    }

    logger.info(
      {
        postId: post.id.substring(0, 8),
        slug: post.slug,
        userId: context.userData.userId.substring(0, 8),
      },
      '✅ Post created (Fast Path)',
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ Post created successfully!

**Title:** ${post.title}
**Slug:** ${post.slug}
**URL:** ${context.config.PUBLIC_SITE_URL}${post.url}

The post has been published to your blog "${context.userData.blog.name}".
${post._meta ? `\n_Processing in background: ${post._meta.processingTime || 'ongoing'}_` : ''}`,
        },
      ],
    };
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        userId: context.userData.userId.substring(0, 8),
        title: args.title,
      },
      '❌ Failed to create post',
    );

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

function buildBackendAuthHeaders(context: ToolContext): Record<string, string> {
  const headers: Record<string, string> = {};

  if (context.apiKey) {
    headers['X-API-Key'] = context.apiKey;
  } else if (context.oauthToken) {
    headers['Authorization'] = `Bearer ${context.oauthToken}`;
    headers['X-OAuth-User-Id'] = context.userData.userId;
    headers['X-OAuth-Blog-Id'] = context.userData.blogId;
  }

  if (context.config.MCP_SHARED_SECRET) {
    headers['X-Internal-Secret'] = context.config.MCP_SHARED_SECRET;
  }

  return headers;
}

async function handleGetImageUploadUrl(
  args: { mimeType: string; fileSize: number },
  context: ToolContext,
): Promise<any> {
  const backendUrl = context.config.BACKEND_BASE_URL || 'http://localhost:3000';
  const mimeType = args.mimeType;
  const fileSize = args.fileSize;

  if (
    mimeType !== 'image/webp' ||
    !Number.isSafeInteger(fileSize) ||
    fileSize < 1 ||
    fileSize > 10 * 1024 * 1024
  ) {
    return imageToolError(
      'mimeType must be image/webp and fileSize must be an integer from 1 to 10485760',
      '/api/v1/mcp/files/upload-url',
    );
  }

  const fileName = `generated-${Date.now()}.webp`;

  try {
    const response = await axios.post(
      `${backendUrl}/api/v1/mcp/files/upload-url`,
      {
        fileName,
        mimeType,
        fileSize,
        fileType: mimeType.startsWith('image/') ? 'image' : 'general',
      },
      {
        headers: buildBackendAuthHeaders(context),
      },
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              uploadUrl: response.data.uploadUrl,
              tempId: response.data.tempId,
              fileKey: response.data.fileKey,
              fileName: response.data.fileName,
              mimeType: response.data.mimeType,
              fileSize: response.data.fileSize,
              instructions: `Run locally: curl -X PUT -H "Content-Type: ${mimeType}" -T <path_to_file> "${response.data.uploadUrl}"`,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get upload URL');
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'failed',
              endpoint: '/api/v1/mcp/files/upload-url',
              error: error.response?.data?.message || error.message,
              instruction:
                "Image upload URL request failed. Stop retrying image upload and continue with text-only 'create_post'.",
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}

async function handleFinalizeUploadedImage(
  args: {
    tempId: string;
    fileKey: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  },
  context: ToolContext,
): Promise<any> {
  if (
    !args.tempId ||
    !args.fileKey ||
    !args.fileName ||
    args.mimeType !== 'image/webp' ||
    !Number.isSafeInteger(args.fileSize) ||
    args.fileSize < 1 ||
    args.fileSize > 10 * 1024 * 1024
  ) {
    return imageToolError(
      'tempId, fileKey, fileName, image/webp mimeType, and a positive integer fileSize are required',
      '/api/v1/mcp/files/upload-complete',
    );
  }

  const backendUrl = context.config.BACKEND_BASE_URL || 'http://localhost:3000';

  try {
    const response = await axios.post(
      `${backendUrl}/api/v1/mcp/files/upload-complete`,
      {
        tempId: args.tempId,
        fileKey: args.fileKey,
        fileUrl: args.fileKey,
        fileName: args.fileName,
        mimeType: args.mimeType,
        fileSize: args.fileSize,
        fileType: 'image',
      },
      {
        headers: buildBackendAuthHeaders(context),
      },
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              fileId: response.data.fileId,
              publicUrl: response.data.publicUrl,
              descriptor: response.data.descriptor,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to finalize upload');
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'failed',
              endpoint: '/api/v1/mcp/files/upload-complete',
              error: error.response?.data?.message || error.message,
              instruction:
                "Image finalization failed. Stop retrying and continue with text-only 'create_post'.",
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}

function imageToolError(error: string, endpoint: string): any {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            status: 'failed',
            endpoint,
            error,
            instruction:
              "Stop retrying image upload and continue with text-only 'create_post'.",
          },
          null,
          2,
        ),
      },
    ],
  };
}

/**
 * MCP API Key의 postsCreated 카운트 증가 (비동기)
 */
async function incrementPostsCreated(
  keyId: string,
  backendUrl: string,
  sharedSecret?: string,
): Promise<void> {
  const headers: Record<string, string> = {};
  if (sharedSecret) {
    headers['X-Internal-Secret'] = sharedSecret;
  }

  await axios.post(
    `${backendUrl}/api/v1/mcp/keys/${keyId}/increment-posts`,
    {},
    { timeout: 3000, headers },
  );
}
