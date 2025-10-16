/**
 * MCP 서버 관리자 (Stateless Transport 패턴)
 *
 * 공식 SDK 권장 패턴:
 * - 단일 MCP 서버 인스턴스 (모든 세션이 공유)
 * - 요청마다 Transport 새로 생성 (index.ts에서 처리)
 * - 세션 상태는 Redis로 관리 (SessionService)
 */

import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SessionService } from './SessionService.js';
import { logger } from '../utils/logger.js';
import { registerAllTools } from '../tools/index.js';
import { McpServices } from '../types/services.js';
import { AsyncLocalStorage } from 'async_hooks';
import { WritingStyleService } from './WritingStyleService.js';
import {
  recordTransportCreated,
  recordTransportCreationFailed,
  recordSessionDeleted,
  recordTransportClosed,
  updateActiveSessions,
  updateActiveTransports,
  updatePeakSessions,
  updateAverageSessionLifetime,
  updateAverageTransportLifetime,
} from '../metrics/collectors/session.metrics.js';

/**
 * AsyncLocalStorage를 사용한 세션 ID 추적
 * 각 요청마다 독립적인 컨텍스트 유지
 */
export const sessionContext = new AsyncLocalStorage<{ sessionId: string }>();

interface TransportManagerConfig {
  sessionService: SessionService;
  config: {
    MCP_BASE_URL: string;
    BACKEND_BASE_URL: string;
    BACKEND_PUBLIC_URL: string;  // 브라우저 OAuth 인증용 공개 URL
    OAUTH_CLIENT_ID: string;
    OAUTH_REDIRECT_URI: string;
  };
}

/**
 * Transport Manager - Session-Scoped Transport 패턴
 *
 * 단일 MCP 서버 인스턴스만 유지
 * Transport는 세션별로 생성되어 재사용됨
 */
export class TransportManager {
  // 단일 MCP 서버 인스턴스 (모든 요청이 공유)
  private mcpServer: McpServer;

  // 서비스 계층
  private services: McpServices;

  // 도구 등록 완료 여부
  private toolsRegistered: boolean = false;

  // 세션별 Transport 저장 (세션 ID → Transport)
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();

  // Transport 생성 시간 추적 (세션 ID → 생성 시간)
  private transportCreatedAt: Map<string, number> = new Map();

  // 피크 세션 수 추적
  private peakSessions: number = 0;

  // 세션 수명 통계
  private sessionLifetimes: number[] = [];

  // 통계 업데이트 인터벌
  private statsInterval: NodeJS.Timeout | null = null;

  // TransportManager 설정
  private config: {
    MCP_BASE_URL: string;
    BACKEND_BASE_URL: string;
    BACKEND_PUBLIC_URL: string;  // 브라우저 OAuth 인증용 공개 URL
    OAUTH_CLIENT_ID: string;
    OAUTH_REDIRECT_URI: string;
  };

  constructor(managerConfig: TransportManagerConfig) {
    // 서비스 계층 초기화
    this.services = {
      sessionService: managerConfig.sessionService,
      config: managerConfig.config,
    };

    // 설정 저장 (Transport 생성 시 사용)
    this.config = managerConfig.config;

    // 단일 MCP 서버 인스턴스 생성
    this.mcpServer = this.initializeMcpServer();

    logger.info(
      {
        pattern: 'Session-Scoped Transport',
        info: '단일 MCP 서버 + 세션별 Transport 재사용'
      },
      '🚀 Transport Manager initialized with Session-Scoped Transport pattern'
    );

    // 통계 업데이트 인터벌 시작 (1분마다)
    this.startStatsUpdateInterval();
  }

  /**
   * 통계 업데이트 인터벌 시작
   * 1분마다 세션 메트릭을 업데이트
   */
  private startStatsUpdateInterval(): void {
    this.statsInterval = setInterval(() => {
      this.updateSessionMetrics();
    }, 60000); // 1분마다

    logger.info('📊 Session metrics update interval started (every 1 minute)');
  }

  /**
   * 세션 메트릭 업데이트
   * 현재 활성 세션, 피크 세션, 평균 수명 등을 계산하여 메트릭 업데이트
   */
  private updateSessionMetrics(): void {
    const currentActive = this.transports.size;

    // 활성 Transport 수 업데이트 (새로운 메트릭)
    updateActiveTransports(currentActive);

    // 기존 활성 세션 수도 유지 (하위 호환성)
    updateActiveSessions(currentActive);

    // 피크 세션 수 업데이트
    if (currentActive > this.peakSessions) {
      this.peakSessions = currentActive;
      updatePeakSessions(this.peakSessions);
    }

    // 평균 Transport 수명 계산 및 업데이트
    if (this.sessionLifetimes.length > 0) {
      const avgLifetime = this.sessionLifetimes.reduce((sum, lt) => sum + lt, 0) / this.sessionLifetimes.length;

      // Transport 평균 수명 업데이트 (새로운 메트릭)
      updateAverageTransportLifetime(avgLifetime);

      // 기존 세션 평균 수명도 유지 (하위 호환성)
      updateAverageSessionLifetime(avgLifetime);

      // 최근 100개 세션만 유지 (메모리 관리)
      if (this.sessionLifetimes.length > 100) {
        this.sessionLifetimes = this.sessionLifetimes.slice(-100);
      }
    }

    logger.debug({
      activeTransports: currentActive,
      peakSessions: this.peakSessions,
      avgLifetime: this.sessionLifetimes.length > 0
        ? Math.round(this.sessionLifetimes.reduce((sum, lt) => sum + lt, 0) / this.sessionLifetimes.length / 1000)
        : 0
    }, '📊 Transport metrics updated');
  }

  /**
   * 단일 MCP 서버 초기화
   */
  private initializeMcpServer(): McpServer {
    const mcpServer = new McpServer(
      {
        name: 'codebase-blog-mcp',
        version: '7.0.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},  // Prompts 지원 선언
        },
      }
    );

    logger.info('✅ MCP Server created with Prompts support (Session-Scoped pattern)');

    return mcpServer;
  }

  /**
   * 도구 등록 (초기화 시 한 번만 호출)
   */
  async registerTools(): Promise<void> {
    if (this.toolsRegistered) {
      logger.warn('⚠️ Tools already registered, skipping...');
      return;
    }

    // 모듈화된 도구 등록
    const toolHelpers = await registerAllTools(this.mcpServer, this.services);

    logger.info({
      toolCount: toolHelpers.getToolDefinitions().length,
      tools: toolHelpers.getToolDefinitions().map(t => t.name)
    }, '✅ MCP tools registered (Session-Scoped pattern)');

    // Prompts 등록
    await this.registerPrompts();

    this.toolsRegistered = true;
  }

  /**
   * Prompts 등록 (Writing Style 가이드)
   *
   * 500줄짜리 스타일 가이드를 도구 description에서 분리하여
   * LLM이 필요시에만 prompts/get으로 가져가도록 최적화
   */
  private async registerPrompts(): Promise<void> {
    try {
      // default.md 스타일 로드
      const styleService = new WritingStyleService();
      const defaultStyle = await styleService.loadAndParseStyle('default');

      // 프롬프트 정의 (3개)
      const allPromptDefinitions = [
        {
          name: 'markdown_quality_guidelines',
          description: 'Professional markdown writing guidelines for blog posts - Quality structure, technical accuracy, code integration, and formatting standards',
        },
        {
          name: 'blog_post_template',
          description: 'Standard blog post template structure for professional technical posts - Sections, headers, code blocks, and tone guidelines',
        },
        {
          name: 'improve_markdown',
          description: 'Techniques for enhancing technical blog post quality - Strengthening openings, code integration, paragraph structure, and clarity',
        },
      ];

      // 1. prompts/list 핸들러 등록
      this.mcpServer.setRequestHandler(
        ListPromptsRequestSchema,
        async () => ({
          prompts: allPromptDefinitions,
        })
      );

      // 2. prompts/get 핸들러 등록
      this.mcpServer.setRequestHandler(
        GetPromptRequestSchema,
        async (request) => {
          const { name } = request.params;

          // 요청된 프롬프트에 따라 콘텐츠 반환
          let promptContent: string;

          switch (name) {
            case 'markdown_quality_guidelines':
              promptContent = defaultStyle.qualityGuidelinesPrompt;
              break;

            case 'blog_post_template':
              promptContent = defaultStyle.blogPostTemplatePrompt;
              break;

            case 'improve_markdown':
              promptContent = defaultStyle.improveMarkdownPrompt;
              break;

            default:
              throw new Error(`Unknown prompt: ${name}`);
          }

          logger.debug({
            promptName: name,
            contentLength: promptContent.length
          }, '📝 Prompt requested');

          return {
            description: `Writing style guide: ${name}`,
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: promptContent,
                },
              },
            ],
          };
        }
      );

      logger.info({
        promptCount: allPromptDefinitions.length,
        prompts: allPromptDefinitions.map(p => p.name),
        styleName: defaultStyle.metadata.styleName
      }, '✅ MCP Prompts registered (Writing Style guides)');
    } catch (error: any) {
      logger.error({
        error: error.message
      }, '❌ Failed to register prompts');
      // 프롬프트 등록 실패해도 도구는 작동해야 함 (non-blocking)
    }
  }

  /**
   * MCP 서버 인스턴스 반환
   * index.ts에서 요청마다 새로운 Transport를 이 서버에 연결
   */
  getMcpServer(): McpServer {
    return this.mcpServer;
  }

  /**
   * 도구 등록 완료 여부 확인
   */
  isReady(): boolean {
    return this.toolsRegistered;
  }

  /**
   * 세션별 Transport 가져오기 또는 생성
   *
   * @param sessionId 세션 ID
   * @returns 해당 세션의 Transport
   */
  async getOrCreateTransport(sessionId: string): Promise<StreamableHTTPServerTransport> {
    // 기존 Transport가 있으면 재사용
    let transport = this.transports.get(sessionId);

    if (transport) {
      logger.debug({
        sessionId: sessionId.substring(0, 8),
        action: 'reuse'
      }, '♻️ Reusing existing Transport for session');
      return transport;
    }

    // 새 Transport 생성
    logger.info({
      sessionId: sessionId.substring(0, 8),
      action: 'create'
    }, '🆕 Creating new Transport for session');

    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      enableJsonResponse: true,
      enableDnsRebindingProtection: false,
      allowedHosts: [
        'mcp.codebase.blog',
        'localhost',
        'localhost:3002',
        '127.0.0.1',
        '127.0.0.1:3002',
      ],
      allowedOrigins: [
        'https://codebase.blog',
        'https://www.codebase.blog',
        'http://localhost',
        'http://localhost:3002',
        'http://127.0.0.1',
        'http://127.0.0.1:3002',
        '*',  // Development
      ],
    });

    // MCP 서버와 Transport 연결
    await this.mcpServer.connect(transport);

    // Transport 저장
    this.transports.set(sessionId, transport);
    this.transportCreatedAt.set(sessionId, Date.now());

    // Transport 생성 메트릭 기록
    recordTransportCreated();

    // 활성 Transport 수 즉시 업데이트
    const currentActive = this.transports.size;
    updateActiveTransports(currentActive);
    updateActiveSessions(currentActive); // 하위 호환성

    // 피크 세션 수 체크 및 업데이트
    if (currentActive > this.peakSessions) {
      this.peakSessions = currentActive;
      updatePeakSessions(this.peakSessions);
    }

    logger.info({
      sessionId: sessionId.substring(0, 8),
      totalTransports: this.transports.size,
      metrics: {
        active: currentActive,
        peak: this.peakSessions
      }
    }, '✅ Transport created and connected');

    return transport;
  }

  /**
   * 세션의 Transport 제거 및 정리
   *
   * @param sessionId 세션 ID
   */
  async removeTransport(sessionId: string): Promise<void> {
    const transport = this.transports.get(sessionId);

    if (transport) {
      try {
        // Transport 종료 (연결 해제)
        await transport.close();

        // 세션 수명 계산
        const createdAt = this.transportCreatedAt.get(sessionId);
        let lifetime = 0;
        if (createdAt) {
          lifetime = Date.now() - createdAt;
          this.sessionLifetimes.push(lifetime);
        }

        // Map에서 제거
        this.transports.delete(sessionId);
        this.transportCreatedAt.delete(sessionId);

        // Transport 종료 메트릭 기록
        recordTransportClosed('manual', lifetime);
        recordSessionDeleted('manual', lifetime); // 하위 호환성

        // 활성 Transport 수 즉시 업데이트
        const currentActive = this.transports.size;
        updateActiveTransports(currentActive);
        updateActiveSessions(currentActive); // 하위 호환성

        logger.info({
          sessionId: sessionId.substring(0, 8),
          remainingTransports: this.transports.size,
          lifetime: Math.round(lifetime / 1000), // 초 단위로 표시
          metrics: {
            active: currentActive,
            peak: this.peakSessions
          }
        }, '🗑️ Transport removed and cleaned up');
      } catch (error: any) {
        logger.error({
          sessionId: sessionId.substring(0, 8),
          error: error.message
        }, '❌ Failed to close transport');
      }
    }
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    // 통계 업데이트 인터벌 정리
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
      logger.info('📊 Session metrics update interval stopped');
    }

    // 모든 Transport 정리
    logger.info({
      count: this.transports.size
    }, '🔄 Closing all transports...');

    for (const [sessionId, transport] of this.transports.entries()) {
      try {
        await transport.close();

        // 세션 수명 계산
        const createdAt = this.transportCreatedAt.get(sessionId);
        if (createdAt) {
          const lifetime = Date.now() - createdAt;
          recordTransportClosed('manual', lifetime);
          recordSessionDeleted('manual', lifetime); // 하위 호환성
        }

        logger.debug({
          sessionId: sessionId.substring(0, 8)
        }, '✅ Transport closed');
      } catch (error: any) {
        logger.error({
          sessionId: sessionId.substring(0, 8),
          error: error.message
        }, '❌ Failed to close transport');
      }
    }

    this.transports.clear();
    this.transportCreatedAt.clear();

    // 최종 메트릭 업데이트
    updateActiveTransports(0);
    updateActiveSessions(0); // 하위 호환성

    logger.info('✅ Transport Manager closed (Session-Scoped pattern)');
  }
}
