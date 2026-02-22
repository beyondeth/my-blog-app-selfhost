import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import {
  InitializeRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../../utils/logger.js';
import { TOOL_CATALOG } from '../../tools/catalog.js';
import {
  handleCheckAuth,
  handleCreatePost,
  handleGetWritingStyleGuide,
} from '../../core/handlers/index.js';
import type { ToolContext } from '../../core/types.js';
import {
  ANNOTATIONS,
  OPENAI_MVP_TOOL_NAMES,
  type OpenAiMvpToolName,
} from './AnnotationConfig.js';

type ToolResult = {
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

function sanitizeAuthText(text: string): string {
  // ChatGPT surface에서는 이메일 노출 제거
  return text.replace(/\s+\([^)]+@[^)]+\)/g, '');
}

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s)]+/i);
  return match?.[0] || null;
}

function getBlogUrl(context: ToolContext): string {
  const base = context.config.FRONTEND_URL.endsWith('/')
    ? context.config.FRONTEND_URL
    : `${context.config.FRONTEND_URL}/`;
  return new URL(context.userData.blog.slug, base).toString();
}

function getOpenAiToolDescriptors() {
  return OPENAI_MVP_TOOL_NAMES.map((toolName) => {
    const catalog = TOOL_CATALOG.find((tool) => tool.name === toolName);
    if (!catalog) {
      throw new Error(`Missing tool catalog for ${toolName}`);
    }

    return {
      name: catalog.name,
      description: catalog.description,
      inputSchema: catalog.inputSchema,
      annotations: ANNOTATIONS[toolName],
    };
  });
}

export function getOpenAiDiscoveryTools(): Array<{ name: string; description: string }> {
  return OPENAI_MVP_TOOL_NAMES.map((toolName) => {
    const catalog = TOOL_CATALOG.find((tool) => tool.name === toolName);
    if (!catalog) {
      throw new Error(`Missing tool catalog for ${toolName}`);
    }
    return { name: catalog.name, description: catalog.discoveryDescription };
  });
}

export async function registerOpenAiTools(
  mcpServer: McpServer,
  context: ToolContext
): Promise<void> {
  mcpServer.setRequestHandler(InitializeRequestSchema, async () => {
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: false },
      },
      serverInfo: {
        name: 'codebase-blog-openai-mcp',
        version: '1.0.0',
        title: 'Codebase.blog ChatGPT App MCP Server',
        websiteUrl: 'https://codebase.blog',
      },
      instructions:
        'For publishing, always confirm explicit user intent before create_post.',
    };
  });

  const openAiTools = getOpenAiToolDescriptors();
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: openAiTools as any,
  }));

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name as OpenAiMvpToolName;
    const args = (request.params.arguments || {}) as Record<string, unknown>;

    try {
      let result: ToolResult;

      if (toolName === 'check_auth') {
        const raw = await handleCheckAuth(context);
        const rawText = raw?.content?.[0]?.text || '';
        const sanitizedText = sanitizeAuthText(rawText);

        result = {
          content: [{ type: 'text', text: sanitizedText }],
          structuredContent: {
            status: 'connected',
            username: context.userData.user.username,
            blogName: context.userData.blog.name,
            blogUrl: getBlogUrl(context),
            authMode: context.oauthToken ? 'oauth2' : 'api_key',
          },
        };
      } else if (toolName === 'get_writing_style_guide') {
        const raw = await handleGetWritingStyleGuide(
          {
            style: args.style as string | undefined,
            customMarkdown: args.customMarkdown as string | undefined,
          },
          context
        );
        result = {
          content: raw.content,
          structuredContent: {
            style: (args.style as string) || 'default',
            hasCustomMarkdown: Boolean(args.customMarkdown),
          },
        };
      } else if (toolName === 'create_post') {
        if (!args.publish_intent_confirmed) {
          result = {
            isError: true,
            content: [
              {
                type: 'text',
                text: 'Publishing requires explicit confirmation. Set publish_intent_confirmed=true.',
              },
            ],
            structuredContent: {
              status: 'blocked',
              reason: 'publish_intent_confirmed is required',
            },
          };
        } else {
          const raw = await handleCreatePost(
            {
              title: args.title as string,
              content_markdown: args.content_markdown as string,
              tags: args.tags as string[] | undefined,
              category: args.category as string | undefined,
              writingStyle: args.writingStyle as string | undefined,
            },
            context
          );

          const text = raw?.content?.[0]?.text || '';
          const postUrl = extractFirstUrl(text);
          result = {
            content: raw.content,
            structuredContent: {
              status: 'published',
              postUrl,
              title: args.title as string,
              category: args.category as string,
            },
            _meta: {
              route: 'mcp-openai',
            },
          };
        }
      } else {
        result = {
          isError: true,
          content: [{ type: 'text', text: `Unsupported tool: ${toolName}` }],
        };
      }

      context.metricsService.recordRequest(
        result.isError ? 'error' : 'success',
        toolName,
        context.route
      );

      return result;
    } catch (error: any) {
      logger.error(
        {
          route: 'mcp-openai',
          toolName,
          error: error?.message || 'unknown',
          userId: context.userData.userId.substring(0, 8),
        },
        '❌ OpenAI tool execution failed'
      );

      context.metricsService.recordRequest('error', toolName, context.route);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: error?.message || 'Tool execution failed',
          },
        ],
      };
    }
  });
}
