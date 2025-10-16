/**
 * 도구 등록 중앙 관리 모듈 (단순화된 버전)
 *
 * DockashellServer 패턴을 참고하여 모든 도구를 중앙에서 관리
 * 각 도구를 하나의 파일에서 통합 관리하여 복잡성 감소
 */

import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  InitializeRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { McpServices } from '../types/services.js';
import { logger } from '../utils/logger.js';
import {
  createJsonRpcError,
  JsonRpcErrorCode,
  McpErrorCode,
  getErrorMessage,
} from '../types/mcp-errors.js';
import { sessionContext } from '../services/TransportManager.js';
import { loadToolDescription } from '../lib/error-messages.js';

// 기존 핸들러 import
import { authenticateHandler } from './authenticate.js';
// check_auth_status 제거: authenticate에 자동 폴링 추가로 불필요해짐
import { createPostHandler } from './create-post.js';
import { getWritingStyleGuideHandler } from './get-writing-style-guide.js';
// set_preferences 제거: defaultWritingStyle이 더 이상 작동하지 않음
import { diagnoseConnectionHandler } from './diagnose-connection.js';

/**
 * 모든 도구를 MCP 서버에 등록 (DockashellServer 패턴)
 *
 * Writing Style 시스템 (토큰 최적화):
 * - create_post 도구: 간략한 설명 + Prompts 참조
 * - MCP Prompts: 상세 가이드라인 (필요시에만 로드)
 *   - markdown_quality_guidelines: 품질 기준
 *   - blog_post_template: 템플릿 구조
 *   - improve_markdown: 개선 기법
 *
 * @param mcpServer MCP 서버 인스턴스
 * @param services 서비스 계층
 * @returns 도구 관리 헬퍼 함수들
 */
export async function registerAllTools(
  mcpServer: McpServer,
  services: McpServices
) {
  logger.info('📦 Registering all MCP tools...');

  // .md 파일에서 도구 설명 로드 (SuperClaude 문서 기반 패턴)
  const authenticateDescription = await loadToolDescription('authenticate');
  const getWritingStyleGuideDescription = await loadToolDescription('get-writing-style-guide');
  const createPostDescription = await loadToolDescription('create-post');
  const diagnoseConnectionDescription = await loadToolDescription('diagnose-connection');

  /**
   * 모든 도구 정의 (중앙 관리)
   * - 도구 설명은 docs/tool-descriptions/*.md 파일에서 로드
   */
  const allToolDefinitions = [
    // 인증 도구
    {
      name: 'authenticate',
      description: `🔐 **HIGHEST PRIORITY - CALL THIS FIRST**

Start OAuth2 PKCE authentication flow with automatic browser launch and polling.

⚠️ **CRITICAL WORKFLOW REQUIREMENT**:
- ALWAYS call this tool FIRST when handling:
  • Auto-posting (자동포스팅)
  • Blog content creation (블로그 작성)
  • Post creation (포스트 생성)
  • Any writing or publishing requests

This tool MUST be called before create_post or any content publishing operations.
Even if you think authentication might already exist, ALWAYS verify by calling this tool first.

✅ Safe to call multiple times - will reuse existing valid sessions automatically.

${authenticateDescription}`,
      inputSchema: {
        type: 'object',
        title: '🔐 OAuth2 Authentication',
        description: 'ALWAYS call this FIRST before create_post. Required for all posting operations.',
        properties: {},
      },
    },
    // check_auth_status 제거: authenticate가 자동 폴링으로 인증 완료까지 대기함

    // 스타일 가이드 조회 도구
    {
      name: 'get_writing_style_guide',
      description: getWritingStyleGuideDescription,
      inputSchema: {
        type: 'object',
        properties: {
          style: {
            type: 'string',
            enum: ['default', 'novel', 'tutorial', 'comedy', 'podcast'],
            default: 'default',
            description: 'Writing style to get guidelines for'
          }
        },
      },
    },

    // 포스트 도구
    {
      name: 'create_post',
      description: createPostDescription,
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Post title'
          },
          content_markdown: {
            type: 'string',
            description: 'Post content in markdown'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags (optional)'
          },
          category: {
            type: 'string',
            description: 'Category (optional)'
          },
          writingStyle: {
            type: 'string',
            enum: ['default', 'novel', 'tutorial', 'comedy', 'podcast'],
            default: 'default',
            description: 'Writing style preset (optional, default: "default")'
          },
          validationToken: {
            type: 'string',
            description: '🔑 REQUIRED: Validation token from writing-styles/[style].md file'
          },
          challengeAnswer: {
            type: 'string',
            description: 'Phase 2: Answer to challenge question (optional)'
          }
        },
        required: ['title', 'content_markdown']  // validationToken은 create-post.ts에서 체크
      },
    },
    // set_preferences 제거: defaultWritingStyle이 더 이상 작동하지 않음
    // 진단 도구
    {
      name: 'diagnose_connection',
      description: diagnoseConnectionDescription,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ];

  // 0. Initialize 핸들러 등록 (필수!)
  mcpServer.setRequestHandler(InitializeRequestSchema, async (request) => {
    logger.info('🔌 MCP Server initializing...');
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},  // 기본 도구 기능 지원 선언 (빈 객체 = 기본 기능만)
        // OAuth 2.1 지원 명시
        experimental: {
          oauth: {
            authorizationUrl: '/.well-known/oauth-authorization-server',
          },
        },
      },
      serverInfo: {
        name: 'codebase-blog-mcp',
        version: '4.0.0',
        // 🚨 전역 워크플로우 가이드: LLM이 초기화 시 이 지침을 읽음
        instructions: `🚨 CRITICAL WORKFLOW: When handling blog posting, content creation, or auto-posting requests (자동포스팅, 블로그 작성, 포스트 생성), you MUST ALWAYS call the authenticate tool FIRST before any other tools. This is mandatory for all posting operations. Never call create_post directly without authentication.`,
        // 📋 도구 호출 순서 명시 (커스텀 메타데이터)
        workflow_requirements: {
          posting: ['authenticate', 'create_post'],  // 순서 명시
          description: 'authenticate must always be called before create_post',
        },
        // OAuth 메타데이터 (Claude Code가 인식)
        oauth: {
          discoveryUrl: '/.well-known/oauth-authorization-server',
          resourceMetadataUrl: '/.well-known/oauth-resource-metadata',
        },
      },
    };
  });

  // 1. 도구 목록 등록
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allToolDefinitions,
  }));

  // 2. 도구 실행 핸들러 등록 (통합 핸들러)
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request, context: any) => {
    const { name, arguments: args } = request.params;

    // AsyncLocalStorage에서 세션 ID 가져오기 (index.ts에서 sessionContext.run()으로 설정됨)
    const store = sessionContext.getStore();
    const sessionId = store?.sessionId;

    // 세션 ID가 없으면 에러 (AsyncLocalStorage가 올바르게 설정되지 않은 경우)
    if (!sessionId) {
      logger.error({
        tool: name,
        hasStore: !!store,
      }, '❌ Session ID not found in AsyncLocalStorage');
      throw new Error('Session ID is required but not found. Check sessionContext.run() in index.ts');
    }

    logger.debug({
      tool: name,
      sessionId: sessionId.substring(0, 8),
      pattern: 'AsyncLocalStorage'
    }, '🔧 Tool called');

    // 인증 체크는 index.ts의 POST /mcp 엔드포인트에서 처리됨
    // (RFC 9728: 401 + WWW-Authenticate 헤더로 OAuth discovery 플로우 자동 시작)

    // 도구 컨텍스트 생성
    const toolContext = {
      ...services,
      currentSessionId: sessionId,
    };

    // 도구별 실행
    try {
      switch (name) {
        // 인증 도구
        case 'authenticate':
          return await authenticateHandler(args as any, toolContext);

        // check_auth_status 제거: authenticate가 자동으로 처리함

        // 스타일 가이드 조회 도구
        case 'get_writing_style_guide':
          return await getWritingStyleGuideHandler(args as any, toolContext);

        // 포스트 도구
        case 'create_post': {
          const enrichedArgs = { ...args, sessionId };
          return await createPostHandler(enrichedArgs as any, toolContext);
        }

        // 진단 도구
        case 'diagnose_connection': {
          const enrichedArgs = { ...args, sessionId };
          return await diagnoseConnectionHandler(enrichedArgs as any, toolContext);
        }

        default:
          // METHOD_NOT_FOUND 에러 (JSON-RPC 표준)
          logger.error({
            tool: name,
            sessionId: sessionId.substring(0, 8),
          }, '❌ Unknown tool requested');
          throw new Error(
            JSON.stringify(
              createJsonRpcError(
                JsonRpcErrorCode.METHOD_NOT_FOUND,
                `Tool '${name}' does not exist`,
                null
              )
            )
          );
      }
    } catch (error: any) {
      logger.error({
        tool: name,
        sessionId: sessionId.substring(0, 8),
        error: error.message
      }, '❌ Tool execution failed');

      // 이미 JSON-RPC 에러인 경우 그대로 throw
      if (error.message?.startsWith('{') && error.message?.includes('jsonrpc')) {
        throw error;
      }

      // 일반 에러를 JSON-RPC INTERNAL_ERROR로 변환
      throw new Error(
        JSON.stringify(
          createJsonRpcError(
            JsonRpcErrorCode.INTERNAL_ERROR,
            error.message || 'Tool execution failed',
            null,
            { tool: name }
          )
        )
      );
    }
  });

  logger.info({
    count: allToolDefinitions.length,
    tools: allToolDefinitions.map(t => t.name)
  }, '✅ All MCP tools registered successfully');

  // 도구 관리 헬퍼 함수 반환
  return {
    /**
     * 세션 ID 추출 헬퍼
     */
    getSessionId: (context: any): string => {
      return context?.sessionId || 'unknown';
    },

    /**
     * 도구 목록 조회
     */
    getToolDefinitions: () => allToolDefinitions,

    /**
     * 특정 카테고리의 도구만 조회
     */
    getToolsByCategory: (category: 'auth' | 'post' | 'diagnostic') => {
      switch (category) {
        case 'auth':
          return allToolDefinitions.filter(t =>
            ['authenticate'].includes(t.name)  // check_auth_status 제거
          );
        case 'post':
          return allToolDefinitions.filter(t =>
            t.name === 'create_post'  // set_preferences 제거
          );
        case 'diagnostic':
          return allToolDefinitions.filter(t =>
            t.name === 'diagnose_connection'
          );
        default:
          return [];
      }
    },
  };
}