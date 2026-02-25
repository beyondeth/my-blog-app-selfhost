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
import {
  MCP_SERVER_INSTRUCTIONS,
  TOOL_CATALOG,
  type ToolName,
} from './catalog.js';
import type { ToolContext } from '../core/types.js';
import {
  handleCheckAuth,
  handleCreatePost,
  handleFinalizeUploadedImage,
  handleGetImageUploadUrl,
  handleGetWritingStyleGuide,
} from '../core/handlers/index.js';

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

    logger.debug({
      tool: toolName,
      userId: context.userData.userId.substring(0, 8),
      blogSlug: context.userData.blog.slug,
    }, '🔧 Tool called');

    const handlers: Record<ToolName, (toolArgs: any) => Promise<any>> = {
      check_auth: async () => handleCheckAuth(context),
      get_writing_style_guide: async (toolArgs) =>
        handleGetWritingStyleGuide((toolArgs || {}) as any, context),
      create_post: async (toolArgs) => handleCreatePost((toolArgs || {}) as any, context),
      get_image_upload_url: async (toolArgs) =>
        handleGetImageUploadUrl((toolArgs || {}) as any, context),
      finalize_uploaded_image: async (toolArgs) =>
        handleFinalizeUploadedImage((toolArgs || {}) as any, context),
    };

    const handler = handlers[toolName];
    if (!handler) {
      context.metricsService.recordRequest('error', toolName, context.route);
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
              2
            ),
          },
        ],
      };
    }

    try {
      const result = await handler(args);

      // 메트릭 기록 (성공)
      context.metricsService.recordRequest('success', toolName, context.route);

      return result;
    } catch (error) {
      // 메트릭 기록 (실패)
      context.metricsService.recordRequest('error', toolName, context.route);
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

export type { ToolContext } from '../core/types.js';
export {
  handleCheckAuth,
  handleGetWritingStyleGuide,
  handleCreatePost,
  handleGetImageUploadUrl,
  handleFinalizeUploadedImage,
} from '../core/handlers/index.js';
