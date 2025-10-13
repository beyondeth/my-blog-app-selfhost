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
import { SessionService } from './SessionService.js';
import { logger } from '../utils/logger.js';
import { registerAllTools } from '../tools/index.js';
import { McpServices } from '../types/services.js';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * AsyncLocalStorage를 사용한 세션 ID 추적
 * 각 요청마다 독립적인 컨텍스트 유지
 */
export const sessionContext = new AsyncLocalStorage<{ sessionId: string }>();

interface TransportManagerConfig {
  sessionService: SessionService;
  config: {
    BACKEND_BASE_URL: string;
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

  // TransportManager 설정
  private config: {
    BACKEND_BASE_URL: string;
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
  }

  /**
   * 단일 MCP 서버 초기화
   */
  private initializeMcpServer(): McpServer {
    const mcpServer = new McpServer(
      {
        name: 'codebase-blog-mcp',
        version: '5.0.0',  // Stateless version
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    logger.info('✅ MCP Server created (Stateless pattern)');

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
    }, '✅ MCP tools registered (Stateless pattern)');

    this.toolsRegistered = true;
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

    logger.info({
      sessionId: sessionId.substring(0, 8),
      totalTransports: this.transports.size
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

        // Map에서 제거
        this.transports.delete(sessionId);

        logger.info({
          sessionId: sessionId.substring(0, 8),
          remainingTransports: this.transports.size
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
    // 모든 Transport 정리
    logger.info({
      count: this.transports.size
    }, '🔄 Closing all transports...');

    for (const [sessionId, transport] of this.transports.entries()) {
      try {
        await transport.close();
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
    logger.info('✅ Transport Manager closed (Session-Scoped pattern)');
  }
}
