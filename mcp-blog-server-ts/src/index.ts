#!/usr/bin/env node

/**
 * MCP Blog Client - 경량 프록시 버전
 *
 * 모든 핵심 로직은 MCP Proxy Server에서 처리
 * 이 클라이언트는 단순히 요청을 전달만 함
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "http";
import dotenv from "dotenv";
import path from "path";
import { z } from "zod";
import { ProxyClient } from "./lib/auth-proxy";
import { parseMarkdownMetadata } from "./lib/markdown";
import { loadWritingStyle } from "./lib/style-loader";

// CommonJS __dirname is already available

// Load environment variables
dotenv.config();
dotenv.config({ path: path.join(__dirname, "../../.env") });


// Function to create a new server instance with all tools registered
async function createServerInstance() {
  console.log("🚀 MCP Blog Client (경량 프록시 모드) 시작...");

  // ProxyClient 인스턴스 생성
  const proxyClient = new ProxyClient();

  // Load writing style dynamically
  const writingStyle = await loadWritingStyle();

  const server = new McpServer(
    {
      name: "blog-mcp-client",
      version: "2.0.0",
    },
    {
      instructions: `
🚨🚨🚨 CRITICAL AUTHENTICATION REQUIREMENT 🚨🚨🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ ALWAYS EXECUTE 'authenticate' TOOL FIRST - NO EXCEPTIONS! ⚡
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MANDATORY AUTHENTICATION PROTOCOL:
1. ⚡ IMMEDIATELY call 'authenticate' tool before ANY other action
2. ⏳ WAIT for authentication confirmation
3. ✅ ONLY after successful authentication, proceed with other tools

⚠️ AUTHENTICATION IS REQUIRED FOR:
- create_post tool
- Any blog-related operations
- All write operations

🔄 Authentication expires after 24 hours - re-authenticate when needed
🚫 Never skip authentication - it will cause all operations to fail

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${writingStyle.instructions}`,
    }
  );

  // Register authenticate tool
  server.registerTool(
    "authenticate",
    {
      title: "Check Authentication Status & Login",
      description: "Check current authentication status and login if needed. Always call this first to ensure session is valid before creating posts.",
    },
    async () => {
      console.error("🔐 인증 상태 확인 중...");

      // 항상 Proxy Server를 통해 인증 상태를 확인
      // 웹사이트에서 로그아웃했을 수 있으므로 세션 파일만 믿지 않음
      console.error("🔍 백엔드 서버와 인증 상태 동기화 중...");

      try {
        const result = await proxyClient.authenticate();

        if (result.success && result.authenticated) {
          // 이미 인증된 상태
          console.error("✅ 인증 확인됨");
          return {
            content: [
              {
                type: "text",
                text: `✅ 인증 상태가 확인되었습니다!\n\n🆔 세션: ${result.sessionId?.substring(0, 8)}...\n⏱️ 유효 기간: 24시간\n📝 상태: 포스팅 가능\n\n이제 create_post 도구를 사용하여 블로그 포스팅을 할 수 있습니다.`,
              },
            ],
          };
        } else if (result.success && !result.authenticated) {
          // 브라우저 인증이 필요한 경우
          const { spawn } = await import('child_process');
          const { authorizationUrl } = result;

          console.error(`🌐 브라우저에서 인증 페이지 열기: ${authorizationUrl}`);

          // 브라우저 열기
          const platform = process.platform;
          const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
          spawn(command, [authorizationUrl], { detached: true, stdio: 'ignore' }).unref();

          // 콜백 서버 시작하여 인증 코드 수신 (간단한 HTTP 서버)
          return new Promise((resolve) => {
            // 포트 충돌 방지를 위한 체크
            const checkPortInUse = (port: number): Promise<boolean> => {
              return new Promise((resolve) => {
                const testServer = createServer();
                testServer.once('error', () => resolve(true)); // 포트 사용 중
                testServer.once('listening', () => {
                  testServer.close();
                  resolve(false); // 포트 사용 가능
                });
                testServer.listen(port);
              });
            };

            // 콜백 서버 생성
            const server = createServer((req, res) => {
              const url = new URL(req.url!, `http://localhost:7777`);

              if (url.pathname === '/callback') {
                const code = url.searchParams.get('code');
                const state = url.searchParams.get('state');

                if (code) {
                  // Proxy Server에 콜백 처리 요청
                  fetch(`${process.env['PROXY_SERVER_URL'] || 'http://localhost:3002'}/api/v1/mcp/sessions/callback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, sessionId: state }),
                  })
                  .then(response => response.json())
                  .then((_data) => {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`
                      <html>
                        <body style="font-family: system-ui; padding: 40px; text-align: center;">
                          <h1>✅ 인증 성공!</h1>
                          <p>이 창을 닫고 터미널로 돌아가세요.</p>
                          <script>setTimeout(() => window.close(), 3000);</script>
                        </body>
                      </html>
                    `);

                    server.close();

                    // 세션 ID 설정
                    proxyClient.setSessionId(state || undefined);

                    resolve({
                      content: [
                        {
                          type: "text",
                          text: `✅ OAuth2 인증 성공!\n🆔 세션 ID: ${state?.substring(0, 8)}...\n🎯 포스팅 준비 완료!`,
                        },
                      ],
                    });
                  })
                  .catch(error => {
                    console.error('❌ 콜백 처리 실패:', error);
                    res.writeHead(500);
                    res.end('Authentication failed');
                    server.close();

                    resolve({
                      content: [
                        {
                          type: "text",
                          text: `❌ 인증 실패: ${error.message}`,
                        },
                      ],
                    });
                  });
                } else {
                  res.writeHead(400);
                  res.end('No authorization code received');
                }
              } else {
                res.writeHead(404);
                res.end('Not found');
              }
            });

            // 포트 체크 후 서버 시작
            checkPortInUse(7777).then((inUse) => {
              if (inUse) {
                console.error('⚠️ 포트 7777이 이미 사용 중입니다. 기존 인증이 진행 중일 수 있습니다.');
                resolve({
                  content: [
                    {
                      type: "text",
                      text: "⚠️ 포트 7777이 이미 사용 중입니다.\n\n다른 인증이 진행 중이거나, 이전 인증이 완료되지 않았을 수 있습니다.\n잠시 후 다시 시도해주세요.",
                    },
                  ],
                });
              } else {
                server.listen(7777, () => {
                  console.error('🔐 인증 콜백 서버 시작 (포트 7777)...');
                });
              }
            });

            // 타임아웃 설정 (5분)
            setTimeout(() => {
              server.close();
              resolve({
                content: [
                  {
                    type: "text",
                    text: "⏱️ 인증 시간 초과 (5분)",
                  },
                ],
              });
            }, 300000);
          });
        } else {
          return {
            content: [
              {
                type: "text",
                text: `❌ 인증 실패: ${result.error || result.message}`,
              },
            ],
          };
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Proxy Server 연결 실패: ${error.message}\n\nProxy Server가 실행 중인지 확인해주세요.`,
            },
          ],
        };
      }
    }
  );

  // Register create_post tool
  // Zod 스키마 정의 (ZodRawShape로 정의)
  const createPostSchema = {
    title: z.string().describe("블로그 포스트 제목").optional(),
    content_markdown: z.string().describe("마크다운 형식의 포스트 내용").optional(),
    tags: z.array(z.string()).describe("포스트 태그 목록 (선택사항)").optional(),
    file_path: z.string().describe("마크다운 파일 경로 (선택사항)").optional(),
    auto_enhance: z.boolean().describe("품질 자동 개선 여부 (기본값: true)").optional()
  };

  server.registerTool(
    "create_post",
    {
      title: "Create Blog Post (via Proxy)",
      description: "🚨 AUTHENTICATION MANDATORY: You MUST call 'authenticate' tool FIRST before using this tool. This tool creates a blog post through MCP Proxy Server. Will FAIL without prior authentication!",
      inputSchema: createPostSchema
    },
    async (args: any) => {
      // 세션 체크를 가장 먼저 수행 (args 처리 전에!)
      // 1. 먼저 로컬 세션이 있는지 확인 (서버 요청 최소화)
      if (!proxyClient.getSessionId()) {
        console.error("❌ 로컬 세션이 없습니다. 인증이 필요합니다.");
        return {
          content: [
            {
              type: "text",
              text: `❌ 인증이 필요합니다.\n\n현재 세션이 없습니다.\n포스트를 생성하려면 먼저 인증이 필요합니다.\n\n✅ 해결 방법:\n1. 'authenticate' 도구를 실행하여 인증 상태를 확인하세요\n2. 필요시 브라우저에서 로그인이 진행됩니다\n3. 인증 완료 후 다시 포스트 생성을 시도하세요\n\n💡 Tip: 한 번 인증하면 24시간 동안 유효합니다.`,
            },
          ],
        };
      }

      // 2. 세션이 있으면 유효성 검증
      const isAuth = await proxyClient.isAuthenticated();
      if (!isAuth) {
        console.error("❌ 세션이 만료되었습니다. 재인증이 필요합니다.");
        // 만료된 세션은 삭제
        proxyClient.setSessionId(undefined);
        return {
          content: [
            {
              type: "text",
              text: `❌ 세션이 만료되었습니다.\n\n기존 세션이 만료되어 재인증이 필요합니다.\n\n✅ 해결 방법:\n1. 'authenticate' 도구를 실행하여 다시 로그인하세요\n2. 브라우저에서 인증을 완료하세요\n3. 인증 후 포스트 생성을 다시 시도하세요\n\n💡 Tip: 세션은 24시간마다 갱신이 필요합니다.`,
            },
          ],
        };
      }

      console.error("✅ 세션 검증 성공. 포스트 생성 진행...");

      // 이제 args 처리 시작
      console.error("받은 args 타입:", typeof args);
      console.error("받은 args 키:", Object.keys(args || {}));
      console.error("받은 args 전체:", JSON.stringify(args, null, 2));

      try {

        // let으로 선언하여 재할당 가능하게
        let title = args?.title as string;
        let markdownContent = args?.content_markdown as string;
        let tags = (args?.tags || []) as string[];

        // 파일 경로가 제공된 경우
        if (args.file_path) {
          const fs = await import('fs/promises');
          const fileContent = await fs.readFile(args.file_path, 'utf-8');
          const { metadata, body } = parseMarkdownMetadata(fileContent);
          title = title || metadata.title || path.basename(args.file_path, '.md');
          tags = tags.length > 0 ? tags : metadata.tags;
          markdownContent = body; // body만 사용
        }

        // title과 content가 없으면 에러 반환
        if (!title || !markdownContent) {
          return {
            content: [
              {
                type: "text",
                text: `❌ 필수 파라미터가 누락되었습니다.\n\n- title: ${title || '없음'}\n- content_markdown: ${markdownContent ? '있음' : '없음'}\n\n사용법: create_post(title="제목", content_markdown="내용", tags=["태그1", "태그2"])`,
              },
            ],
          };
        }

        // 품질 향상 스킵 (디버깅 중)
        let qualityScore = undefined;
        // 품질 개선은 일단 스킵하고 직접 포스트 생성 시도

        // Proxy Server로 포스트 생성 요청
        console.error("createPost 호출 직전 파라미터 상태:", {
          title,
          markdownContent: markdownContent ? markdownContent.substring(0, 100) + "..." : undefined,
          tags,
          qualityScore
        });
        const result = await proxyClient.createPost(title, markdownContent, tags, qualityScore);

        if (result.success) {
          // 4단계: 완료
          console.log("✅ 포스트 생성 완료!");

          const post = result.data?.post || result.post || result.data;

          // 결과 표시 (콘솔 로그 제거하고 간소화)
          return {
            content: [
              {
                type: "text",
                text: `✅ 포스트가 성공적으로 생성되었습니다: ${post.slug}\n📝 제목: ${post.title}\n🔗 슬러그: ${post.slug}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `❌ 포스트 생성 실패: ${typeof result.error === 'object' ? JSON.stringify(result.error) : (result.error || result.message)}`,
              },
            ],
          };
        }
      } catch (error: any) {
        console.error("❌ 포스트 생성 에러:", error);

        // 세션 관련 에러인지 확인
        if (error.message && (error.message.includes('세션') || error.message.includes('인증'))) {
          return {
            content: [
              {
                type: "text",
                text: `❌ ${error.message}\n\n'authenticate' 도구를 사용하여 다시 로그인해주세요.`,
              },
            ],
          };
        }

        // 에러 메시지를 안전하게 추출
        const errorMessage = error.message || error.error || JSON.stringify(error);

        return {
          content: [
            {
              type: "text",
              text: `❌ 포스트 생성 실패: ${typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : errorMessage}`,
            },
          ],
        };
      }
    }
  );

  // Register diagnose_connection tool
  server.registerTool(
    "diagnose_connection",
    {
      title: "Check connection status",
      description: "Check MCP Proxy Server connection and authentication status",
    },
    async () => {
      console.error("🔍 연결 상태 확인 중...");

      try {
        const health = await proxyClient.checkHealth();

        let statusMessage = `📊 MCP Proxy Server 상태\n`;
        statusMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
        statusMessage += `서비스: ${health.service || 'Unknown'}\n`;
        statusMessage += `상태: ${health.status === 'healthy' ? '✅ 정상' : '❌ 오류'}\n`;

        if (health.session) {
          statusMessage += `\n세션 정보:\n`;
          statusMessage += `  - 유효: ${health.session.valid ? '✅' : '❌'}\n`;
          statusMessage += `  - 토큰: ${health.session.hasToken ? '✅ 있음' : '❌ 없음'}\n`;
        }

        if (health.backend) {
          statusMessage += `\nBackend API:\n`;
          statusMessage += `  - URL: ${health.backend.url}\n`;
          statusMessage += `  - 연결: ${health.backend.connected ? '✅' : '❌'}\n`;
        }

        statusMessage += `\n포스트 생성 가능: ${health.can_create_posts ? '✅' : '❌'}`;

        return {
          content: [
            {
              type: "text",
              text: statusMessage,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Proxy Server 연결 실패\n\nProxy Server가 포트 3002에서 실행 중인지 확인해주세요.`,
            },
          ],
        };
      }
    }
  );

  return server;
}

// Main execution
async function main() {
  const server = await createServerInstance();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 MCP Client 시작됨 (stdio mode) - Proxy Server 연결 대기 중...");
  console.error(`Proxy Server URL: ${process.env['PROXY_SERVER_URL'] || 'http://localhost:3002'}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});