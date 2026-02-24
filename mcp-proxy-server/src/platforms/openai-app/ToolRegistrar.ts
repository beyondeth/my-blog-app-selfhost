import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { randomUUID } from 'node:crypto';
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
import {
  OPENAI_WIDGET_URI,
  getWidgetResourceListEntry,
  getWidgetResourceTemplateEntry,
  readWidgetResource,
} from './WidgetResource.js';

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
};

type SelectedStyleState = {
  styleId: string;
  selectedAt: number;
};

type PendingStyleSelectionState = {
  nonces: Array<{ nonce: string; issuedAt: number }>;
};

type StyleFlowState = {
  startedAt: number;
  styleConfirmedAt?: number;
};

const STYLE_OPTION_DETAILS: Record<string, Omit<StyleOption, 'id'>> = {
  default: { label: '기본', description: '균형 잡힌 톤으로 일반 독자에게 적합합니다.' },
  novel: { label: '소설형', description: '감정선과 서사를 강조하는 스토리텔링 톤입니다.' },
  tutorial: { label: '튜토리얼형', description: '단계별 설명 중심의 명확한 가이드 톤입니다.' },
  comedy: { label: '유머형', description: '가벼운 위트를 유지하면서 핵심을 전달합니다.' },
  podcast: { label: '팟캐스트형', description: '말하듯 자연스럽고 대화형 흐름을 제공합니다.' },
  vibe: { label: '트렌디형', description: '감성적이고 공유하기 쉬운 표현을 사용합니다.' },
  research: { label: '리서치형', description: '근거와 분석 중심으로 신뢰도를 높입니다.' },
  human: { label: '휴먼형', description: '개인 경험과 공감 중심으로 진정성을 강화합니다.' },
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
      '현재 연결된 Codebase.blog 계정을 확인하고 게시 가능한 상태인지 검증합니다.',
  },
  get_writing_style_guide: {
    title: '글쓰기 스타일 가이드 불러오기',
    description:
      '스타일 프리셋과 작성 규칙을 불러와 글의 톤을 먼저 선택합니다. '
      + 'IMPORTANT WORKFLOW RULES: '
      + '(1) Call this tool ONCE without style arg to show the style selection widget. '
      + '(2) DO NOT call this tool again until the widget automatically submits the user\'s choice. '
      + '(3) When this tool returns status=guide_ready, the style is confirmed. '
      + 'DO NOT recommend, suggest, or ask about styles. Immediately proceed to create_post.',
  },
  create_post: {
    title: '블로그 포스트 발행',
    description:
      '체크_auth와 위젯 스타일 제출 완료 후, 선택한 스타일과 게시 정보를 반영해 연결된 Codebase.blog 계정으로 포스트를 발행합니다.',
  },
};

// OpenAI(ChatGPT) 라우트 전용 상태 저장소.
// /mcp-openai 요청에서만 사용하며 /mcp, /mcp-remote에는 영향을 주지 않는다.
const selectedStyleByUserId = new Map<string, SelectedStyleState>();
const pendingStyleSelectionByUserId = new Map<string, PendingStyleSelectionState>();
const styleFlowByUserId = new Map<string, StyleFlowState>();
// 스타일 선택 세션은 비교적 길게 유지해, 대기 시간이 길어도 사용자가 위젯에서
// 직접 선택/제출하면 플로우가 끊기지 않도록 한다. (/mcp-openai 전용 정책)
const STYLE_SELECTION_TTL_MS = 24 * 60 * 60 * 1000;
const STYLE_FLOW_TTL_MS = 24 * 60 * 60 * 1000;

function createStyleSelectionNonce(userId: string): string {
  const now = Date.now();
  const nonce = randomUUID();
  const current = pendingStyleSelectionByUserId.get(userId)?.nonces || [];
  const fresh = current.filter((item) => now - item.issuedAt <= STYLE_SELECTION_TTL_MS);
  // 모델 재시도로 nonce가 여러 번 갱신되더라도 이전 nonce를 충분히 허용한다.
  const trimmed = fresh.slice(-200);
  pendingStyleSelectionByUserId.set(userId, {
    nonces: [...trimmed, { nonce, issuedAt: now }],
  });
  return nonce;
}

function getOrCreateStyleSelectionNonce(userId: string): string {
  const now = Date.now();
  const current = pendingStyleSelectionByUserId.get(userId)?.nonces || [];
  const fresh = current.filter((item) => now - item.issuedAt <= STYLE_SELECTION_TTL_MS);
  if (fresh.length > 0) {
    pendingStyleSelectionByUserId.set(userId, { nonces: fresh.slice(-200) });
    return fresh[fresh.length - 1].nonce;
  }
  return createStyleSelectionNonce(userId);
}

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

function getOpenAiInputSchema(toolName: OpenAiMvpToolName, schema: unknown): unknown {
  if (toolName === 'check_auth') {
    return schema;
  }

  // OpenAI(ChatGPT) 라우트(/mcp-openai) 전용 입력 스키마 오버라이드.
  // 공용 TOOL_CATALOG는 수정하지 않고, ChatGPT 입력 UX에 필요한 메타만
  // 어댑터에서 확장한다. (/mcp, /mcp-remote에는 영향 없음)
  const source = toObjectInputSchema(schema);
  const baseProperties = source.properties || {};

  if (toolName === 'get_writing_style_guide') {
    return {
      ...source,
      properties: {
        ...baseProperties,
        style: getStyleInputSchemaField(),
        selectionSource: {
          type: 'string',
          enum: ['widget'],
          description:
            'OpenAI(ChatGPT) 위젯에서 스타일 선택 시 내부적으로 전달되는 값입니다. 일반 대화 입력에서는 사용하지 않습니다.',
        },
        selectionNonce: {
          type: 'string',
          description:
            'OpenAI(ChatGPT) 위젯에서 전달되는 스타일 선택 확인 nonce입니다. 일반 대화 입력에서는 사용하지 않습니다.',
        },
        customMarkdown: {
          ...((baseProperties.customMarkdown as Record<string, unknown>) || {}),
          type: 'string',
          description:
            '선택 사항: 직접 작성한 스타일 가이드 마크다운. 입력 시 프리셋보다 우선 적용됩니다.',
        },
      },
      // style만 필수 — nonce가 있으면 위젯 경로, 없으면 모델 직접 선택으로 간주
      required: ['style'],
    };
  }

  // create_post 전용 확장: 스타일 선택 입력을 명시한다.
  // 이 오버라이드는 /mcp-openai에서만 적용되며 공용 tool schema는 변경하지 않는다.
  return {
    ...source,
    properties: {
      ...baseProperties,
    },
    required: [...(source.required || [])],
  };
}

function getOpenAiToolDescriptors() {
  return OPENAI_MVP_TOOL_NAMES.map((toolName) => {
    const catalog = TOOL_CATALOG.find((tool) => tool.name === toolName);
    if (!catalog) {
      throw new Error(`Missing tool catalog for ${toolName}`);
    }

    return {
      name: catalog.name,
      title: OPENAI_TOOL_PRESENTATION[toolName].title,
      description: OPENAI_TOOL_PRESENTATION[toolName].description,
      inputSchema: getOpenAiInputSchema(toolName, catalog.inputSchema),
      annotations: ANNOTATIONS[toolName],
      _meta: {
        // 모든 tool에 위젯 첨부 — 스타일 선택 등 인터랙티브 UI가 필요
        ui: {
          resourceUri: OPENAI_WIDGET_URI,
          visibility: ['model', 'app'],
        },
        'openai/outputTemplate': OPENAI_WIDGET_URI,
        'openai/widgetAccessible': true,
        'openai/visibility': 'public',
        'openai/toolInvocation/invoking':
          toolName === 'create_post'
            ? '포스트 발행 중…'
            : toolName === 'check_auth'
            ? '연결 상태 확인 중…'
            : '가이드 불러오는 중…',
        'openai/toolInvocation/invoked':
          toolName === 'create_post'
            ? '발행 완료'
            : toolName === 'check_auth'
            ? '연결 완료'
            : '가이드 준비 완료',
        // 확인 다이얼로그 한글화 (ChatGPT native UI 제어)
        ...(toolName === 'create_post'
          ? {
              'openai/confirmation/title': 'Codebase.blog에 포스트를 발행하시겠습니까?',
              'openai/confirmation/acceptLabel': '발행',
              'openai/confirmation/rejectLabel': '취소',
              'openai/confirmation/message': '선택한 스타일에 맞춰 블로그에 게시합니다.',
            }
          : {}),
      },
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
        'IMPORTANT: Always follow this exact flow:',
        '1. Call check_auth first to verify connection.',
        '2. ALWAYS show the style selection widget and let the USER choose a writing style.',
        '   NEVER skip the style selection step. NEVER auto-select a style for the user.',
        '   Call get_writing_style_guide ONLY after the user explicitly selects a style in the widget.',
        '3. After the user confirms their style, draft a post and call create_post.',
        'The widget UI handles style selection interactively. Wait for user input.',
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
      let result: ToolResult;

      if (toolName === 'check_auth') {
        // shared handler 재사용 + ChatGPT 노출용 개인정보 최소화(email 제거)
        const raw = await handleCheckAuth(context);
        const rawText = raw?.content?.[0]?.text || '';

        // 매번 check_auth 호출 시 스타일 상태를 초기화한다.
        // 사용자가 대화마다 원하는 스타일을 직접 선택하도록 강제.
        selectedStyleByUserId.delete(context.userData.userId);
        pendingStyleSelectionByUserId.delete(context.userData.userId);
        styleFlowByUserId.set(context.userData.userId, {
          startedAt: Date.now(),
          styleConfirmedAt: undefined,
        });

        const connectionHint = context.oauthToken
          ? 'OAuth로 연결되었습니다.'
          : 'API Key 방식으로 연결되었습니다.';
        const sanitizedText = `${sanitizeAuthText(rawText)}\n\n`
          + 'NEXT STEP: You MUST call get_writing_style_guide tool NOW (without style argument). '
          + 'DO NOT list or present style options as text. The widget will handle style selection UI. '
          + 'DO NOT ask the user to choose a style in chat. Just call the tool.';
        const blogUrl = getBlogUrl(context);

        result = {
          content: [{ type: 'text', text: sanitizedText }],
          structuredContent: {
            status: 'connected',
            tool: 'check_auth',
            username: context.userData.user.username,
            blogName: context.userData.blog.name,
            blogSlug: context.userData.blog.slug,
            blogUrl,
            authMode: context.oauthToken ? 'oauth2' : 'api_key',
            workflowStage: 'awaiting_style_selection',
            capabilities: ['load_style_guide', 'create_post'],
            connectionHint,
            confirmInstruction:
              'Call get_writing_style_guide tool immediately. DO NOT present styles as text.',
          },
          _meta: {
            summary: `연결 완료. 즉시 get_writing_style_guide를 호출하세요.`,
            confirmInstruction:
              'You MUST call get_writing_style_guide tool NOW without any style argument. '
              + 'DO NOT list styles as text. DO NOT recommend styles. The inline widget handles this.',
            status: 'connected',
            publicUrl: blogUrl,
            route: 'mcp-openai',
          },
        };
      } else if (toolName === 'get_writing_style_guide') {
        const styleArg = typeof args.style === 'string' ? args.style : undefined;
        const flowState = styleFlowByUserId.get(context.userData.userId);
        const selectedState = selectedStyleByUserId.get(context.userData.userId);
        const now = Date.now();
        const hasFreshFlow =
          Boolean(flowState) && now - flowState!.startedAt <= STYLE_FLOW_TTL_MS;
        const hasConfirmedStyleInFlow =
          Boolean(flowState?.styleConfirmedAt) &&
          flowState!.styleConfirmedAt! >= flowState!.startedAt &&
          now - flowState!.styleConfirmedAt! <= STYLE_SELECTION_TTL_MS;
        const hasReadyStyle =
          Boolean(selectedState) &&
          hasFreshFlow &&
          hasConfirmedStyleInFlow &&
          selectedState!.selectedAt >= flowState!.styleConfirmedAt! &&
          now - selectedState!.selectedAt <= STYLE_SELECTION_TTL_MS;

        // idempotent 처리: 스타일이 이미 확정되었으면 바로 guide_ready 반환
        // styleArg 유무에 관계없이, 같은 스타일이면 재확정하지 않는다.
        if (hasReadyStyle && (!styleArg || styleArg === selectedState!.styleId)) {
          const selectedStyle = getStyleOption(selectedState!.styleId);
          result = {
            content: [
              {
                type: 'text',
                text: `스타일 '${selectedStyle.label}'이 이미 확정되었습니다. 스타일을 다시 묻거나 추천하지 마세요. 즉시 create_post를 호출하여 포스트를 작성하세요.`,
              },
            ],
            structuredContent: {
              status: 'guide_ready',
              style: selectedStyle.id,
              styleLabel: selectedStyle.label,
              styleDescription: selectedStyle.description,
              hasCustomMarkdown: false,
              confirmInstruction:
                'Style is already confirmed. DO NOT ask about style. Call create_post immediately.',
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
          const nonce = getOrCreateStyleSelectionNonce(context.userData.userId);
          result = {
            content: [
              {
                type: 'text',
                text: '위젯에서 스타일을 선택 중입니다. 사용자가 위젯에서 스타일을 선택하고 가이드 제출 버튼을 누를 때까지 이 도구를 다시 호출하지 마세요. 위젯이 자동으로 처리합니다.',
              },
            ],
            structuredContent: {
              status: 'blocked',
              tool: 'get_writing_style_guide',
              reason: '글쓰기 스타일을 선택하세요',
              workflowStage: 'awaiting_style_selection',
              confirmInstruction:
                '사용자가 위젯에서 스타일을 확정할 때까지 get_writing_style_guide를 재호출하지 마세요.',
            },
            _meta: {
              summary: '스타일 선택 대기 중입니다. 위젯에서 선택 후 자동 진행됩니다.',
              confirmInstruction:
                '사용자가 위젯에서 스타일을 확정할 때까지 get_writing_style_guide를 재호출하지 마세요.',
              status: 'blocked',
              styleSelectionNonce: nonce,
              styleOptions: STYLE_OPTIONS,
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
          // 위젯 경로가 아닌 호출 → 스타일 선택 카드를 다시 보여준다.
          const nonce = getOrCreateStyleSelectionNonce(context.userData.userId);
          result = {
            content: [
              {
                type: 'text',
                text: '위젯에서 스타일을 선택 중입니다. 사용자가 위젯에서 스타일을 선택하고 가이드 제출 버튼을 누를 때까지 이 도구를 다시 호출하지 마세요. 위젯이 자동으로 처리합니다.',
              },
            ],
            structuredContent: {
              status: 'blocked',
              tool: 'get_writing_style_guide',
              reason: '글쓰기 스타일을 선택하세요',
              workflowStage: 'awaiting_style_selection',
              confirmInstruction:
                '사용자가 위젯에서 스타일을 확정할 때까지 get_writing_style_guide를 재호출하지 마세요.',
            },
            _meta: {
              summary: '스타일 선택 대기 중입니다. 위젯에서 선택 후 자동 진행됩니다.',
              confirmInstruction:
                '사용자가 위젯에서 스타일을 확정할 때까지 get_writing_style_guide를 재호출하지 마세요.',
              status: 'blocked',
              styleSelectionNonce: nonce,
              styleOptions: STYLE_OPTIONS,
              route: 'mcp-openai',
            },
          };
          context.metricsService.recordRequest('error', toolName, context.route);
          return result;
        }

        // 위젯 경로 nonce 검증
        const pending = pendingStyleSelectionByUserId.get(context.userData.userId);
        const nonceCheckNow = Date.now();
        const freshPending = (pending?.nonces || []).filter(
          (item) => nonceCheckNow - item.issuedAt <= STYLE_SELECTION_TTL_MS
        );
        if (pending && freshPending.length !== pending.nonces.length) {
          pendingStyleSelectionByUserId.set(context.userData.userId, { nonces: freshPending });
        }
        const nonceValid = freshPending.some((item) => item.nonce === inputNonce);

        if (!nonceValid) {
          const nonce = createStyleSelectionNonce(context.userData.userId);
          result = {
            content: [
              {
                type: 'text',
                text: '스타일 선택 세션이 갱신되었습니다. 카드에서 스타일을 다시 선택한 뒤 가이드 제출을 눌러 주세요.',
              },
            ],
            structuredContent: {
              status: 'blocked',
              tool: 'get_writing_style_guide',
              reason: '스타일 선택 세션이 갱신되어 재선택이 필요합니다.',
              workflowStage: 'awaiting_style_selection',
            },
            _meta: {
              summary: '스타일 선택 세션이 갱신되었습니다. 스타일을 다시 선택해 주세요.',
              status: 'blocked',
              styleSelectionNonce: nonce,
              styleOptions: STYLE_OPTIONS,
              route: 'mcp-openai',
            },
          };
          context.metricsService.recordRequest('error', toolName, context.route);
          return result;
        }

        // nonce 1회성 소비
        const remaining = freshPending.filter((item) => item.nonce !== inputNonce);
        if (remaining.length > 0) {
          pendingStyleSelectionByUserId.set(context.userData.userId, { nonces: remaining });
        } else {
          pendingStyleSelectionByUserId.delete(context.userData.userId);
        }

        // nonce 소비는 위 위젯 경로 블록에서 처리 완료

        // 스타일 가이드는 원문 텍스트(content)를 유지하고 상태만 structuredContent로 전달
        const raw = await handleGetWritingStyleGuide(
          {
            style: styleArg,
            customMarkdown: args.customMarkdown as string | undefined,
          },
          context
        );
        const selectedStyle = getStyleOption(styleArg);
        const currentFlow = styleFlowByUserId.get(context.userData.userId);
        const confirmedAt = Date.now();
        styleFlowByUserId.set(context.userData.userId, {
          startedAt: currentFlow?.startedAt || confirmedAt,
          styleConfirmedAt: confirmedAt,
        });
        selectedStyleByUserId.set(context.userData.userId, {
          styleId: selectedStyle.id,
          selectedAt: confirmedAt,
        });
        // 스타일 확정 이후에는 추가 nonce를 발급하지 않는다.
        // 재호출은 idempotent guide_ready로 흡수하여 루프를 방지한다.
        pendingStyleSelectionByUserId.delete(context.userData.userId);
        result = {
          content: raw.content,
          structuredContent: {
            status: 'guide_ready',
            style: selectedStyle.id,
            styleLabel: selectedStyle.label,
            styleDescription: selectedStyle.description,
            styleOptions: STYLE_OPTIONS,
            hasCustomMarkdown: Boolean(args.customMarkdown),
            confirmInstruction:
              'Style is confirmed. DO NOT ask about style again. Proceed to create_post immediately.',
          },
          _meta: {
            summary: `스타일 '${selectedStyle.label}'이 확정되었습니다. 즈시 create_post를 호출하여 포스트를 작성하세요.`,
            confirmInstruction:
              'Style is confirmed. DO NOT suggest or ask about styles. Call create_post now.',
            status: 'guide_ready',
            selectedStyle: selectedStyle.id,
            route: 'mcp-openai',
          },
        };
      } else if (toolName === 'create_post') {
        // OpenAI(ChatGPT) 라우트에서만 "스타일 선택 선행"을 강제한다.
        // 공용 create_post 핸들러(/mcp, /mcp-remote)는 변경하지 않는다.
        const requestedStyle = args.writingStyle as string | undefined;
        const selectedState = selectedStyleByUserId.get(context.userData.userId);
        const flowState = styleFlowByUserId.get(context.userData.userId);
        const now = Date.now();
        const hasFreshFlow =
          Boolean(flowState) && now - flowState!.startedAt <= STYLE_FLOW_TTL_MS;
        const hasConfirmedStyleInFlow =
          Boolean(flowState?.styleConfirmedAt) &&
          flowState!.styleConfirmedAt! >= flowState!.startedAt &&
          now - flowState!.styleConfirmedAt! <= STYLE_SELECTION_TTL_MS;
        const isSelectedInCurrentFlow =
          Boolean(selectedState && hasConfirmedStyleInFlow) &&
          selectedState!.selectedAt >= flowState!.styleConfirmedAt!;
        const isSelectionExpired = selectedState
          ? now - selectedState.selectedAt > STYLE_SELECTION_TTL_MS
          : false;

        if (!selectedState || !hasFreshFlow || !isSelectedInCurrentFlow || isSelectionExpired) {
          const markdown = (args.content_markdown as string | undefined) || '';
          const preview = summarizeMarkdown(markdown);
          const tags = Array.isArray(args.tags) ? (args.tags as string[]) : [];
          const nonce = getOrCreateStyleSelectionNonce(context.userData.userId);
          const reason = !hasFreshFlow
            ? '스타일 선택 세션이 없거나 만료되었습니다. check_auth부터 다시 시작해야 합니다.'
            : !isSelectedInCurrentFlow
            ? '현재 자동포스팅 플로우에서 스타일을 새로 선택해야 합니다.'
            : isSelectionExpired
            ? '스타일 선택이 만료되었습니다. 다시 선택해야 합니다.'
            : '스타일 선택이 선행되어야 합니다.';
          result = {
            // isError를 빼면 ChatGPT 모델은 실패로 간주하지 않아 위젯을 정상적으로 렌더링함
            // 대신 우리는 content에 이 사실을 적어 모델이 인지하게 하고, UI 상태를 blocked로 줌
            content: [
              {
                type: 'text',
                text:
                  '먼저 스타일을 선택해야 발행할 수 있습니다. 위 화면의 스타일 가이드 선택 위젯을 찾아서 원하는 스타일을 선택한 뒤 다시 실행하세요.',
              },
            ],
            structuredContent: {
              status: 'blocked',
              tool: 'create_post',
              reason,
              title: (args.title as string | undefined) || '',
              category: (args.category as string | undefined) || '',
              writingStyle: requestedStyle ? getStyleOption(requestedStyle).label : null,
              selectedStyle: selectedState ? getStyleOption(selectedState.styleId).label : null,
              tags,
              contentPreview: preview,
              estimatedWordCount: estimateWordCount(markdown),
              workflowStage: 'awaiting_style_selection',
            },
            _meta: {
              summary:
                `'${(args.title as string | undefined) || '제목 없음'}' 발행 전 스타일 선택이 필요합니다.`,
              confirmInstruction:
                '스타일을 선택하기 전에는 발행을 진행하지 않습니다.',
              status: 'blocked',
              styleSelectionNonce: nonce,
              styleOptions: STYLE_OPTIONS,
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
              summary: `'${args.title as string}' 게시가 완료되었습니다.`,
              status: 'published',
              publicUrl: postUrl,
              route: 'mcp-openai',
            },
          };
          // 한 번 게시가 완료되면 스타일 선택 상태를 정리한다.
          // 다음 자동포스팅 요청에서는 다시 check_auth → 스타일 선택을 거치도록 강제한다.
          selectedStyleByUserId.delete(context.userData.userId);
          pendingStyleSelectionByUserId.delete(context.userData.userId);
          styleFlowByUserId.delete(context.userData.userId);
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
