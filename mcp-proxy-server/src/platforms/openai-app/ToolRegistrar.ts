import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import {
  InitializeRequestSchema,
  ListToolsRequestSchema,
  ListResourceTemplatesRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../../utils/logger.js';
import { TOOL_CATALOG, WRITING_STYLE_PRESETS } from '../../tools/catalog.js';
import { expandLegacyScopeTokens } from '../../oauth/scope-normalization.js';
import {
  handleCheckAuth,
  handleListMyPublishedPosts,
  handleReadMyPublishedPost,
  handleSearchMyPublishedPosts,
  handleCreatePost,
  handleGetWritingStyleGuide,
} from '../../core/handlers/index.js';
import type { ToolContext } from '../../core/types.js';
import {
  ANNOTATIONS,
  OPENAI_MVP_TOOL_NAMES,
  type OpenAiMvpToolName,
} from './AnnotationConfig.js';
import {
  OPENAI_WIDGET_URI,
  getWidgetResourceListEntry,
  getWidgetResourceTemplateEntry,
  readWidgetResource,
} from './WidgetResource.js';
import type {
  OpenAiStyleStateStore,
} from './OpenAiStyleStateStore.js';

/**
 * OpenAI(ChatGPT) 전용 MCP 어댑터.
 *
 * 핵심 원칙:
 * - 비즈니스 로직은 core handlers를 그대로 재사용한다.
 * - ChatGPT surface 요구사항(_meta.ui.resourceUri, openai/* 호환 키)만 여기서 매핑한다.
 * - /mcp, /mcp-remote 경로 동작은 건드리지 않는다.
 */
type ToolResult = {
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

type ObjectInputSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

type StyleOption = {
  id: string;
  label: string;
  description: string;
};

type OpenAiToolPresentation = {
  title: string;
  description: string;
  inputSchema: ObjectInputSchema;
};

const STYLE_OPTION_DETAILS: Record<string, Omit<StyleOption, 'id'>> = {
  default: { label: '기본', description: '균형 잡힌 톤으로 일반 독자에게 적합합니다.' },
  novel: { label: '소설형', description: '감정선과 서사를 강조하는 스토리텔링 톤입니다.' },
  podcast: { label: '팟캐스트형', description: '말하듯 자연스럽고 대화형 흐름을 제공합니다.' },
  vibe: { label: '개발 성장형', description: '학습법, 커리어 성장, 멘토링 인사이트에 맞춘 톤입니다.' },
  research: { label: '리서치형', description: '근거와 분석 중심으로 신뢰도를 높입니다.' },
  pm: { label: 'PM형', description: '문제 정의, 의사결정 이유, trade-off를 설득력 있게 정리합니다.' },
  designer: { label: '디자이너형', description: '맥락, 제약, 선택 근거와 사용자 영향을 case study로 풀어냅니다.' },
  marketer: { label: '마케터형', description: '가설, 실험, 전환 지표와 배운 점을 growth 중심으로 정리합니다.' },
};

const STYLE_OPTIONS: StyleOption[] = WRITING_STYLE_PRESETS.map((preset) => ({
  id: preset,
  label: STYLE_OPTION_DETAILS[preset]?.label || preset,
  description:
    STYLE_OPTION_DETAILS[preset]?.description || 'Codebase.blog writing style preset.',
}));

const OPENAI_TOOL_PRESENTATION: Record<OpenAiMvpToolName, OpenAiToolPresentation> = {
  check_auth: {
    title: '연결 상태 확인',
    description:
      '현재 연결된 Codebase.blog 계정을 확인합니다. 새 포스트 작성 전 반드시 가장 먼저 호출하세요.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  list_my_published_posts: {
    title: '내 발행글 목록',
    description:
      '현재 연결된 계정이 발행한 글 목록을 페이지, 태그, 카테고리, 기간 기준으로 조회합니다.',
    inputSchema: toObjectInputSchema(
      TOOL_CATALOG.find((tool) => tool.name === 'list_my_published_posts')?.inputSchema
    ),
  },
  search_my_published_posts: {
    title: '내 발행글 검색',
    description:
      '현재 연결된 계정의 발행글에서 키워드 검색을 실행합니다. 검색어와 메타데이터 필터를 함께 사용할 수 있습니다.',
    inputSchema: toObjectInputSchema(
      TOOL_CATALOG.find((tool) => tool.name === 'search_my_published_posts')?.inputSchema
    ),
  },
  read_my_published_post: {
    title: '내 발행글 읽기',
    description:
      '현재 연결된 계정이 발행한 글 1건의 본문과 메타데이터를 읽습니다.',
    inputSchema: toObjectInputSchema(
      TOOL_CATALOG.find((tool) => tool.name === 'read_my_published_post')?.inputSchema
    ),
  },
  render_style_picker: {
    title: '글쓰기 스타일 선택',
    description:
      '글쓰기 스타일 선택 UI를 표시합니다. 이 도구만 위젯을 렌더링합니다. '
      + '사용자가 위젯에서 선택할 때까지 기다리세요. 스타일을 채팅으로 다시 묻지 마세요.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  confirm_style: {
    title: '글쓰기 스타일 확정',
    description:
      'INTERNAL UI SUBMISSION TOOL. The widget uses this to confirm the selected style. '
      + 'The assistant must never call it directly unless explicitly instructed by the UI flow.',
    inputSchema: {
      type: 'object',
      properties: {
        style: getStyleInputSchemaField(),
        selectionSource: {
          type: 'string',
          enum: ['widget'],
          description: 'INTERNAL UI FIELD. The assistant must leave this empty.',
        },
        selectionNonce: {
          type: 'string',
          description: 'INTERNAL UI FIELD. The assistant must leave this empty.',
        },
        customMarkdown: {
          type: 'string',
          description: 'Optional custom style guide markdown.',
        },
        styleAlias: {
          type: 'string',
          description: 'Optional alias for customMarkdown styles.',
        },
      },
      required: ['style', 'selectionSource', 'selectionNonce'],
    },
  },
  create_post: {
    title: '블로그 포스트 발행',
    description:
      '스타일 확정 후 실행되는 최종 블로그 포스트 발행 도구입니다. '
      + '스타일이 아직 확정되지 않았다면 이 도구는 차단됩니다. '
      + '카테고리는 기존 글을 조회하지 말고 현재 글에 가장 맞는 하나를 바로 선택하세요.',
    inputSchema: toObjectInputSchema(
      TOOL_CATALOG.find((tool) => tool.name === 'create_post')?.inputSchema
    ),
  },
};

const OPENAI_REQUIRED_SCOPES: Record<OpenAiMvpToolName, string[]> = {
  check_auth: ['mcp:tools'],
  list_my_published_posts: ['mcp:tools', 'mcp:read'],
  search_my_published_posts: ['mcp:tools', 'mcp:read'],
  read_my_published_post: ['mcp:tools', 'mcp:read'],
  render_style_picker: ['mcp:tools'],
  confirm_style: ['mcp:tools'],
  create_post: ['mcp:tools', 'mcp:write'],
};

// 스타일 선택 세션은 비교적 길게 유지해, 대기 시간이 길어도 사용자가 위젯에서
// 직접 선택/제출하면 플로우가 끊기지 않도록 한다. (/mcp-openai 전용 정책)
const STYLE_SELECTION_TTL_MS = 24 * 60 * 60 * 1000;
const STYLE_FLOW_TTL_MS = 24 * 60 * 60 * 1000;
const OPENAI_WIDGET_TOOL_NAMES = new Set<OpenAiMvpToolName>([
  'render_style_picker',
]);

function summarizeMarkdown(raw: string | undefined): string {
  if (!raw) return '';
  const compact = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    .replace(/\[([^\]]+)\]\((.*?)\)/g, '$1')
    .replace(/[>#*_~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (compact.length <= 180) return compact;
  return `${compact.slice(0, 177)}...`;
}

function estimateWordCount(raw: string | undefined): number {
  if (!raw) return 0;
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

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

function toObjectInputSchema(schema: unknown): ObjectInputSchema {
  if (schema && typeof schema === 'object') {
    const candidate = schema as ObjectInputSchema;
    if (candidate.type === 'object' && candidate.properties) {
      return candidate;
    }
  }
  return {
    type: 'object',
    properties: {},
  };
}

function getStyleInputSchemaField(defaultValue?: string): Record<string, unknown> {
  const field: Record<string, unknown> = {
    type: 'string',
    enum: WRITING_STYLE_PRESETS,
    description:
      '글쓰기 스타일을 선택하세요. 대상 독자와 글의 목적에 맞는 톤을 고르면 됩니다.',
    oneOf: STYLE_OPTIONS.map((option) => ({
      const: option.id,
      title: option.label,
      description: option.description,
    })),
  };
  if (defaultValue) {
    field.default = defaultValue;
  }
  return field;
}

function getStyleOption(style: string | undefined): StyleOption {
  const normalized = (style || 'default').toLowerCase();
  return (
    STYLE_OPTIONS.find((option) => option.id === normalized) || {
      id: normalized,
      label: normalized,
      description: 'Custom style preset.',
    }
  );
}

function getOpenAiScopeAuthorizationError(
  toolName: OpenAiMvpToolName,
  context: ToolContext
): { requiredScopes: string[]; grantedScopes: string[]; missingScopes: string[] } | null {
  if (!context.oauthToken) {
    return null;
  }

  const requiredScopes = OPENAI_REQUIRED_SCOPES[toolName] || ['mcp:tools'];
  const grantedScopes = Array.from(expandLegacyScopeTokens(context.oauthScope));
  const missingScopes = requiredScopes.filter((scope) => !grantedScopes.includes(scope));

  if (missingScopes.length === 0) {
    return null;
  }

  return {
    requiredScopes,
    grantedScopes,
    missingScopes,
  };
}

function getOpenAiToolDescriptors() {
  return OPENAI_MVP_TOOL_NAMES.map((toolName) => {
    return {
      name: toolName,
      title: OPENAI_TOOL_PRESENTATION[toolName].title,
      description: OPENAI_TOOL_PRESENTATION[toolName].description,
      inputSchema: OPENAI_TOOL_PRESENTATION[toolName].inputSchema,
      annotations: ANNOTATIONS[toolName],
      _meta: {
        'openai/toolInvocation/invoking':
          toolName === 'create_post'
            ? '포스트 발행 중…'
            : toolName === 'check_auth'
            ? '연결 상태 확인 중…'
            : toolName === 'render_style_picker'
            ? '스타일 선택 UI 여는 중…'
            : toolName === 'confirm_style'
            ? '선택한 스타일 확정 중…'
            : toolName === 'list_my_published_posts'
            ? '발행글 목록 불러오는 중…'
            : toolName === 'search_my_published_posts'
            ? '발행글 검색 중…'
            : toolName === 'read_my_published_post'
            ? '글 읽는 중…'
            : '처리 중…',
        'openai/toolInvocation/invoked':
          toolName === 'create_post'
            ? '발행 완료'
            : toolName === 'check_auth'
            ? '연결 완료'
            : toolName === 'render_style_picker'
            ? '스타일 선택 준비 완료'
            : toolName === 'confirm_style'
            ? '스타일 확정 완료'
            : toolName === 'list_my_published_posts'
            ? '목록 준비 완료'
            : toolName === 'search_my_published_posts'
            ? '검색 완료'
            : toolName === 'read_my_published_post'
            ? '글 로드 완료'
            : '처리 완료',
        // 확인 다이얼로그 한글화 (ChatGPT native UI 제어)
        ...(toolName === 'create_post'
          ? {
              'openai/confirmation/title': 'Codebase.blog에 포스트를 발행하시겠습니까?',
              'openai/confirmation/acceptLabel': '발행',
              'openai/confirmation/rejectLabel': '취소',
              'openai/confirmation/message': '선택한 스타일에 맞춰 블로그에 게시합니다.',
            }
          : {}),
        ...(OPENAI_WIDGET_TOOL_NAMES.has(toolName)
          ? {
              ui: {
                resourceUri: OPENAI_WIDGET_URI,
                visibility: ['model', 'app'],
              },
              'openai/outputTemplate': OPENAI_WIDGET_URI,
              'openai/widgetAccessible': true,
              'openai/visibility': 'public',
            }
          : {}),
      },
    };
  });
}

export function getOpenAiDiscoveryTools(): Array<{ name: string; description: string }> {
  return OPENAI_MVP_TOOL_NAMES.map((toolName) => ({
    name: toolName,
    description: OPENAI_TOOL_PRESENTATION[toolName].description,
  }));
}

export async function registerOpenAiTools(
  mcpServer: McpServer,
  context: ToolContext,
  styleStateStore: OpenAiStyleStateStore
): Promise<void> {
  // OpenAI route는 tools + resources를 같이 노출해야 위젯 렌더링이 가능하다.
  mcpServer.setRequestHandler(InitializeRequestSchema, async () => {
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false },
      },
      serverInfo: {
        name: 'codebase-blog-openai-mcp',
        version: '1.0.0',
        title: 'Codebase.blog ChatGPT App MCP Server',
        websiteUrl: 'https://codebase.blog',
      },
      instructions: [
        '# Codebase.blog ChatGPT App Global Instructions',
        '',
        'CRITICAL: You are an AI assistant for a blog posting platform. You MUST follow this EXACT workflow for EVERY single post.',
        '',
        '## Step 1: Authentication',
        '- Always call `check_auth` first to verify the connection.',
        '',
        '## Read Tools Policy',
        '- During auto-posting, DO NOT call `list_my_published_posts`, `search_my_published_posts`, or `read_my_published_post` unless the user explicitly asks to review previous posts.',
        '- DO NOT use read tools to decide category, tone, or writing direction during auto-posting.',
        '',
        '## Step 2: Show Style Widget',
        '- You MUST call `render_style_picker` to display the style selection widget to the user.',
        '- CRITICAL RULE: DO NOT write any draft, DO NOT decide on a tone, and DO NOT ask the user to type their style choice in chat. Just call the tool and wait.',
        '',
        '## Step 3: Wait for User',
        "- Wait silently for the widget to return the user's choice. The widget handles `confirm_style` internally.",
        '- When style confirmation completes, you will receive a compact execution brief. Use it directly and continue.',
        '',
        '## Step 4: Draft and Publish',
        '- Write the post using ONLY the exact style chosen by the user in Step 3.',
        '- Pick the best fitting category directly from the current request. Do not inspect previous posts to infer it.',
        '- Call `create_post` to publish it.',
        '',
        '## Step 5: NEXT POST',
        '- After publishing, ALL tools (like create_post) remain perfectly active and available.',
        '- To write the next post, call `check_auth` first, then call `render_style_picker`.',
        '- DO NOT ask the user to select a style in chat. Just wait for the widget.',
        '- If you ever receive `status="guide_ready"` after style confirmation, YOU MUST IMMEDIATELY PROCEED TO `create_post`. NEVER ask for reconfirmation if the status is ready.',
      ].join('\n'),
    };
  });

  const openAiTools = getOpenAiToolDescriptors();
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: openAiTools as any,
  }));

  // 단일 위젯 리소스를 모든 MVP 툴에서 재사용한다.
  mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [getWidgetResourceListEntry()],
  }));

  mcpServer.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [getWidgetResourceTemplateEntry()],
  }));

  mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    if (uri !== OPENAI_WIDGET_URI) {
      throw new Error(`Unknown resource URI: ${uri}`);
    }
    return readWidgetResource(context) as any;
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name as OpenAiMvpToolName;
    const args = (request.params.arguments || {}) as Record<string, unknown>;

    try {
      const scopeError = getOpenAiScopeAuthorizationError(toolName, context);
      if (scopeError) {
        context.metricsService.recordRequest('error', toolName, context.route);
        logger.warn(
          {
            route: 'mcp-openai',
            toolName,
            userId: context.userData.userId.substring(0, 8),
            missingScopes: scopeError.missingScopes,
            grantedScopes: scopeError.grantedScopes,
          },
          '⛔ OpenAI tool blocked by OAuth scope policy'
        );
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text:
                `이 도구를 실행할 권한이 없습니다. `
                + `필요 scope: ${scopeError.requiredScopes.join(', ')} / `
                + `현재 scope: ${scopeError.grantedScopes.join(', ') || '(none)'}`,
            },
          ],
          structuredContent: {
            status: 'forbidden',
            error: 'insufficient_scope',
            tool: toolName,
            requiredScopes: scopeError.requiredScopes,
            grantedScopes: scopeError.grantedScopes,
            missingScopes: scopeError.missingScopes,
          },
          _meta: {
            summary: `권한 부족으로 ${toolName} 호출이 차단되었습니다.`,
            status: 'forbidden',
            route: 'mcp-openai',
          },
        } satisfies ToolResult;
      }

      let result: ToolResult;

      if (toolName === 'check_auth') {
        // shared handler 재사용 + ChatGPT 노출용 개인정보 최소화(email 제거)
        const raw = await handleCheckAuth(context);
        const rawText = raw?.content?.[0]?.text || '';
        const userId = context.userData.userId;
        await styleStateStore.clearAll(userId);

        const connectionHint = context.oauthToken
          ? 'OAuth로 연결되었습니다.'
          : 'API Key 방식으로 연결되었습니다.';
        const blogUrl = getBlogUrl(context);
        const baseStructuredContent = {
          tool: 'check_auth',
          username: context.userData.user.username,
          blogName: context.userData.blog.name,
          blogSlug: context.userData.blog.slug,
          blogUrl,
          authMode: context.oauthToken ? 'oauth2' : 'api_key',
          connectionHint,
          capabilities: [
            'render_style_picker',
            'confirm_style',
            'create_post',
            'list_my_published_posts',
            'search_my_published_posts',
            'read_my_published_post',
          ],
        };

        const sanitizedText = `${sanitizeAuthText(rawText)}\n\n`
          + 'Next step: call render_style_picker. Do not ask the user to type their style in chat.';

        result = {
          content: [{ type: 'text', text: sanitizedText }],
          structuredContent: {
            ...baseStructuredContent,
            status: 'connected',
            workflowStage: 'connected',
          },
          _meta: {
            summary: '연결 완료. 다음 단계로 render_style_picker를 호출하세요.',
            confirmInstruction:
              'Call render_style_picker next. Do not ask the user to type a style in chat.',
            status: 'connected',
            publicUrl: blogUrl,
            route: 'mcp-openai',
          },
        };
      } else if (toolName === 'render_style_picker') {
        const userId = context.userData.userId;
        const blogUrl = getBlogUrl(context);

        const nonce = await styleStateStore.getOrCreateStyleSelectionNonce(
          userId,
          STYLE_SELECTION_TTL_MS
        );
        result = {
          content: [
            {
              type: 'text',
              text: '아래 UI에서 글쓰기 스타일을 선택하고 [가이드 제출]을 눌러주세요. 스타일 확정 전에는 초안을 쓰지 마세요.',
            },
          ],
          structuredContent: {
            status: 'awaiting_style_selection',
            tool: 'render_style_picker',
            workflowStage: 'awaiting_style_selection',
            username: context.userData.user.username,
            blogName: context.userData.blog.name,
            blogSlug: context.userData.blog.slug,
            blogUrl,
            authMode: context.oauthToken ? 'oauth2' : 'api_key',
            styleSelectionNonce: nonce,
            styleOptions: STYLE_OPTIONS,
            canSelectStyle: true,
          },
          _meta: {
            summary: '아래 UI에서 글쓰기 스타일을 선택해 주세요.',
            status: 'awaiting_style_selection',
            styleSelectionNonce: nonce,
            styleOptions: STYLE_OPTIONS,
            publicUrl: blogUrl,
            route: 'mcp-openai',
          },
        };
      } else if (toolName === 'list_my_published_posts') {
        result = await handleListMyPublishedPosts(
          {
            page: typeof args.page === 'number' ? args.page : undefined,
            limit: typeof args.limit === 'number' ? args.limit : undefined,
            category: typeof args.category === 'string' ? args.category : undefined,
            tag: typeof args.tag === 'string' ? args.tag : undefined,
            dateFrom: typeof args.dateFrom === 'string' ? args.dateFrom : undefined,
            dateTo: typeof args.dateTo === 'string' ? args.dateTo : undefined,
          },
          context
        );
      } else if (toolName === 'search_my_published_posts') {
        result = await handleSearchMyPublishedPosts(
          {
            query: typeof args.query === 'string' ? args.query : '',
            page: typeof args.page === 'number' ? args.page : undefined,
            limit: typeof args.limit === 'number' ? args.limit : undefined,
            category: typeof args.category === 'string' ? args.category : undefined,
            tag: typeof args.tag === 'string' ? args.tag : undefined,
            dateFrom: typeof args.dateFrom === 'string' ? args.dateFrom : undefined,
            dateTo: typeof args.dateTo === 'string' ? args.dateTo : undefined,
          },
          context
        );
      } else if (toolName === 'read_my_published_post') {
        result = await handleReadMyPublishedPost(
          {
            postId: typeof args.postId === 'string' ? args.postId : '',
          },
          context
        );
      } else if (toolName === 'confirm_style') {
        const userId = context.userData.userId;
        const styleArg = typeof args.style === 'string' ? args.style : undefined;
        const selectedState = await styleStateStore.getSelectedStyle(userId);
        const hasReadyStyle = Boolean(selectedState);

        const nonceValidInRequest =
          typeof args.selectionNonce === 'string' &&
          typeof args.selectionSource === 'string' &&
          args.selectionSource === 'widget';

        // 멱등성(idempotence) 처리:
        // 같은 글쓰기 세션에서 단순히 도구호출이 반복된 경우는 guide_ready를 그대로 반환한다.
        // 하지만 위젯(nonce)을 통한 검증 없이, LLM이 임의로 과거 스타일을 인자로 넘긴 경우는
        // 이전 캐시가 남아있더라도 새로 위젯에서 선택하도록 차단해야 한다. (AI의 과거세션 도용 방지)
        // 단, 위젯에서 이제 막 제출된 순간(nonce가 넘어온 요청)이 아닐 때만 차단.
        if (hasReadyStyle && !nonceValidInRequest) {
          // AI가 이전 상태를 무단으로 우회 재사용하려는 경우 강제 초기화
          await styleStateStore.resetConfirmedStyle(userId);
        }

        const recheckedSelectedState = await styleStateStore.getSelectedStyle(userId);

        if (recheckedSelectedState) {
          const selectedStyle = getStyleOption(recheckedSelectedState.styleId);
          let styleBrief = recheckedSelectedState.styleBrief || '';

          if (!styleBrief) {
            const regenerated = await handleGetWritingStyleGuide(
              { style: recheckedSelectedState.styleId },
              context
            );
            const regeneratedStructuredContent =
              (regenerated?.structuredContent as Record<string, unknown> | undefined) || {};
            styleBrief = typeof regeneratedStructuredContent.compactBrief === 'string'
              ? regeneratedStructuredContent.compactBrief
              : '';
            if (styleBrief) {
              await styleStateStore.updateSelectedStyleBrief(
                userId,
                styleBrief,
                STYLE_FLOW_TTL_MS
              );
            }
          }

          result = {
            content: [
              {
                type: 'text',
                text:
                  styleBrief
                    || `스타일 '${selectedStyle.label}'이 이미 확정되었습니다. 스타일을 다시 묻거나 추천하지 마세요. 즉시 create_post를 호출하여 포스트를 작성하세요.`,
              },
            ],
            structuredContent: {
              status: 'guide_ready',
              workflowStage: 'drafting',
              tool: 'confirm_style',
              style: selectedStyle.id,
              styleLabel: selectedStyle.label,
              styleDescription: selectedStyle.description,
              styleBrief,
              hasCustomMarkdown: false,
            },
            _meta: {
              summary: `스타일 '${selectedStyle.label}'이 이미 확정되어 있습니다. create_post로 진행하세요.`,
              confirmInstruction:
                'Style is already confirmed. DO NOT ask about style. Call create_post immediately.',
              status: 'guide_ready',
              selectedStyle: selectedStyle.id,
              route: 'mcp-openai',
            },
          };
          return result;
        }
        if (!styleArg) {
          result = {
            content: [
              {
                type: 'text',
                text: '스타일 확정에는 style 인자와 위젯 nonce가 필요합니다. 먼저 render_style_picker를 호출하세요.',
              },
            ],
            structuredContent: {
              status: 'blocked',
              tool: 'confirm_style',
              reason: '먼저 render_style_picker를 호출해 스타일 선택 UI를 표시해야 합니다.',
              workflowStage: 'awaiting_style_selection',
            },
            _meta: {
              summary: '먼저 render_style_picker를 호출해 스타일 선택 UI를 표시하세요.',
              status: 'blocked',
              route: 'mcp-openai',
            },
          };
          context.metricsService.recordRequest('error', toolName, context.route);
          return result;
        }

        // 스타일 선택은 반드시 위젯(nonce + selectionSource=widget)을 통해서만 가능.
        // 모델이 style 인자를 직접 넣어 호출해도 nonce가 없으면 차단한다.
        const inputNonce = typeof args.selectionNonce === 'string' ? args.selectionNonce : undefined;
        const inputSource = typeof args.selectionSource === 'string' ? args.selectionSource : undefined;

        if (inputSource !== 'widget' || !inputNonce) {
          result = {
            content: [
              {
                type: 'text',
                text: 'confirm_style는 위젯 내부 제출 전용입니다. 먼저 render_style_picker에서 스타일을 고르세요.',
              },
            ],
            structuredContent: {
              status: 'blocked',
              tool: 'confirm_style',
              reason: 'confirm_style는 위젯 제출 전용입니다.',
              workflowStage: 'awaiting_style_selection',
            },
            _meta: {
              summary: 'render_style_picker를 호출한 뒤 위젯에서 스타일을 선택하세요.',
              status: 'blocked',
              route: 'mcp-openai',
            },
          };
          context.metricsService.recordRequest('error', toolName, context.route);
          return result;
        }

        // 위젯 경로 nonce 검증(1회성 소비 포함)
        const nonceValid = await styleStateStore.consumeStyleSelectionNonce(
          userId,
          inputNonce,
          STYLE_SELECTION_TTL_MS
        );

        if (!nonceValid) {
          const nonce = await styleStateStore.createStyleSelectionNonce(
            userId,
            STYLE_SELECTION_TTL_MS
          );
          result = {
            content: [
              {
                type: 'text',
                text: '스타일 선택 화면이 닫히거나 오래되었습니다. 표시된 UI 창에서 원하시는 스타일을 다시 고르고 [가이드 제출] 버튼을 눌러주세요.',
              },
            ],
            structuredContent: {
              status: 'blocked',
              tool: 'confirm_style',
              reason: '스타일 선택 재확인 필요',
              workflowStage: 'awaiting_style_selection',
            },
            _meta: {
              summary: '스타일 선택 UI 창에서 원하시는 스타일을 다시 고르고 [가이드 제출]을 눌러주세요.',
              status: 'blocked',
              styleSelectionNonce: nonce,
              styleOptions: STYLE_OPTIONS,
              route: 'mcp-openai',
            },
          };
          context.metricsService.recordRequest('error', toolName, context.route);
          return result;
        }

        // 스타일 가이드는 원문 텍스트(content)를 유지하고 상태만 structuredContent로 전달
        const raw = await handleGetWritingStyleGuide(
          {
            style: styleArg,
            customMarkdown: args.customMarkdown as string | undefined,
            styleAlias: args.styleAlias as string | undefined,
          },
          context
        );
        const selectedStyle = getStyleOption(styleArg);
        const confirmedAt = Date.now();
        const rawStructuredContent = (raw.structuredContent as Record<string, unknown> | undefined) || {};
        const styleBrief =
          typeof rawStructuredContent.compactBrief === 'string'
            ? rawStructuredContent.compactBrief
            : '';
        await styleStateStore.confirmStyleSelection(
          userId,
          {
            styleId: selectedStyle.id,
            selectedAt: confirmedAt,
            styleBrief,
          },
          STYLE_FLOW_TTL_MS
        );
        result = {
          content: [
            {
              type: 'text',
              text:
                styleBrief
                  || `스타일 '${selectedStyle.label}'이 확정되었습니다. 이 스타일로 글을 작성하고 발행하세요.`,
            },
          ],
          structuredContent: {
            ...rawStructuredContent,
            status: 'guide_ready',
            workflowStage: 'drafting',
            tool: 'confirm_style',
            style: selectedStyle.id,
            styleLabel: selectedStyle.label,
            styleDescription: selectedStyle.description,
            styleBrief,
            styleOptions: STYLE_OPTIONS,
            hasCustomMarkdown: Boolean(args.customMarkdown),
          },
          _meta: {
            summary: `스타일 '${selectedStyle.label}'이 확정되었습니다. 이제 포스트 초안을 작성합니다.`,
            confirmInstruction:
              'Style is confirmed. DO NOT suggest or ask about styles. Call create_post now.',
            status: 'guide_ready',
            workflowStage: 'drafting',
            selectedStyle: selectedStyle.id,
            route: 'mcp-openai',
          },
        };
      } else if (toolName === 'create_post') {
        const userId = context.userData.userId;
        // OpenAI(ChatGPT) 라우트에서만 "스타일 선택 선행"을 강제한다.
        // 공용 create_post 핸들러(/mcp, /mcp-remote)는 변경하지 않는다.
        const requestedStyle = args.writingStyle as string | undefined;
        const selectedState = await styleStateStore.getSelectedStyle(userId);

        if (!selectedState) {
          const markdown = (args.content_markdown as string | undefined) || '';
          const preview = summarizeMarkdown(markdown);
          const tags = Array.isArray(args.tags) ? (args.tags as string[]) : [];
          result = {
            content: [
              {
                type: 'text',
                text:
                  '[SYSTEM ALERT] 스타일 선택이 누락되었습니다. 초안 작성을 멈추고 render_style_picker를 호출해 사용자가 위젯에서 스타일을 고를 때까지 기다리세요.',
              },
            ],
            structuredContent: {
              status: 'blocked',
              tool: 'create_post',
              reason: '스타일 선택이 선행되어야 합니다. 글을 미리 작성하지 마세요.',
              title: (args.title as string | undefined) || '',
              category: (args.category as string | undefined) || '',
              writingStyle: requestedStyle ? getStyleOption(requestedStyle).label : null,
              selectedStyle: null,
              tags,
              contentPreview: preview,
              estimatedWordCount: estimateWordCount(markdown),
              workflowStage: 'awaiting_style_selection',
            },
            _meta: {
              summary:
                `'${(args.title as string | undefined) || '제목 없음'}' 발행 전 스타일 선택이 필요합니다.`,
              confirmInstruction:
                'Call render_style_picker next. Do not write or suggest a tone before the user confirms a style.',
              status: 'blocked',
              route: 'mcp-openai',
            },
          };
        } else {
          // 사용자가 위젯에서 확정한 스타일을 최종 기준으로 사용한다.
          // 모델 입력 writingStyle과 달라도 사용자 선택을 우선한다.
          const finalStyle = getStyleOption(selectedState.styleId);
          // 실제 게시 로직은 core handler에 위임한다(어댑터는 결과 포맷만 담당).
          const raw = await handleCreatePost(
            {
              title: args.title as string,
              content_markdown: args.content_markdown as string,
              tags: args.tags as string[] | undefined,
              category: args.category as string | undefined,
              visibility: args.visibility as 'public' | 'private' | undefined,
              writingStyle: finalStyle.id,
            },
            context
          );

          const text = raw?.content?.[0]?.text || '';
          const postUrl = extractFirstUrl(text);
          const tags = Array.isArray(args.tags) ? (args.tags as string[]) : [];
          result = {
            content: raw.content,
            structuredContent: {
              status: 'published',
              tool: 'create_post',
              postUrl,
              title: args.title as string,
              category: args.category as string,
              writingStyle: finalStyle.label,
              tags,
              contentPreview: summarizeMarkdown(args.content_markdown as string | undefined),
              estimatedWordCount: estimateWordCount(args.content_markdown as string | undefined),
              publishedAt: new Date().toISOString(),
              blogName: context.userData.blog.name,
              workflowStage: 'published',
            },
            _meta: {
              summary: `'${args.title as string}' 게시가 완료되었습니다. 다음 포스트 작성을 원한다면, 반드시 새 스타일을 골라야 합니다. API는 모두 정상 작동 중입니다.`,
              confirmInstruction: 'Post is published successfully. ALL TOOLS ARE STILL AVAILABLE. However, for the next post, you MUST call check_auth again to let the user pick a new style.',
              status: 'published',
              publicUrl: postUrl,
              route: 'mcp-openai',
            },
          };
          // 한 번 게시가 완료되면 스타일 선택 상태를 정리한다.
          // 다음 자동포스팅 요청에서는 다시 check_auth → 스타일 선택을 거치도록 강제한다.
          await styleStateStore.clearAll(userId);
        }
      } else {
        result = {
          isError: true,
          content: [{ type: 'text', text: `Unsupported tool: ${toolName}` }],
          _meta: {
            summary: `Unsupported tool requested: ${toolName}`,
            status: 'error',
            route: 'mcp-openai',
          },
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
        _meta: {
          summary: 'Tool execution failed.',
          status: 'error',
          route: 'mcp-openai',
        },
      };
    }
  });
}
