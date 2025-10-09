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
import { savePostToFile } from "./lib/filesystem";

// CommonJS __dirname is already available

// Load environment variables
// 컴파일된 dist 디렉토리에서 실행되므로, 상위 디렉토리의 .env 파일을 로드
// __dirname = dist 폴더이므로 ../.env가 프로젝트 루트의 .env를 가리킴
dotenv.config({ path: path.join(__dirname, "../.env") });
// 백업: 현재 작업 디렉토리에서도 .env 찾기 시도
dotenv.config();


// Function to create a new server instance with all tools registered
async function createServerInstance() {
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
      // 1. 먼저 로컬 세션이 있고 유효한지 확인
      if (proxyClient.getSessionId()) {
        try {
          const isValid = await proxyClient.isAuthenticated();
          if (isValid) {
            return {
              content: [
                {
                  type: "text",
                  text: `✅ 기존 세션이 유효합니다! (인증 성공)\n🆔 세션: xxxxxxxx...\n📝 자동포스팅 생성중 입니다. 잠시만 기다려주세요...\n\n이제 create_post 도구를 사용하여 블로그 포스팅을 할 수 있습니다.`,
                },
              ],
            };
          } else {
            proxyClient.setSessionId(undefined); // 만료된 세션 삭제
          }
        } catch (error) {
          // 세션 검증 실패
        }
      }

      // 2. 세션이 없거나 만료된 경우에만 새 인증 시작

      try {
        const result = await proxyClient.authenticate();

        if (result.success && result.authenticated) {
          // 이미 인증된 상태 (드물지만 가능한 경우)
          return {
            content: [
              {
                type: "text",
                text: `✅ 인증 상태가 확인되었습니다! (인증 성공)\n🆔 세션: xxxxxxxx...\n📝 자동포스팅 생성중 입니다. 잠시만 기다려주세요...\n\n이제 create_post 도구를 사용하여 블로그 포스팅을 할 수 있습니다.`,
              },
            ],
          };
        } else if (result.success && !result.authenticated) {
          // 브라우저 인증이 필요한 경우
          const { spawn } = await import('child_process');
          const { authorizationUrl } = result;

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
                          text: `✅ OAuth2 인증 성공! (로그인 완료)\n🆔 세션 ID: xxxxxxxx...\n📝 자동포스팅 생성중 입니다. 잠시만 기다려주세요...\n\n🎯 포스팅 준비 완료!`,
                        },
                      ],
                    });
                  })
                  .catch(error => {
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
                resolve({
                  content: [
                    {
                      type: "text",
                      text: "⚠️ 포트 7777이 이미 사용 중입니다.\n\n다른 인증이 진행 중이거나, 이전 인증이 완료되지 않았을 수 있습니다.\n잠시 후 다시 시도해주세요.",
                    },
                  ],
                });
              } else {
                server.listen(7777);
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
    content_markdown: z.string()
      .describe("마크다운 형식의 포스트 내용 (⚠️ IMPORTANT: DO NOT display full content in LLM output - only show length)")
      .optional(),
    tags: z.array(z.string()).describe("포스트 태그 목록 (선택사항)").optional(),
    file_path: z.string().describe("마크다운 파일 경로 (선택사항)").optional(),
    auto_enhance: z.boolean().describe("품질 자동 개선 여부 (기본값: true)").optional()
  };

  server.registerTool(
    "create_post",
    {
      title: "Create Blog Post (via Proxy)",
      description: `🚨 AUTHENTICATION MANDATORY: You MUST call 'authenticate' tool FIRST before using this tool. This tool creates a blog post through MCP Proxy Server. Will FAIL without prior authentication!

⚠️ OUTPUT NOTICE: When displaying tool parameters, show content_markdown as [length] only, not full text.

${writingStyle.createPostDescription}`,
      inputSchema: createPostSchema
    },
    async (args: any) => {
      // 세션 체크
      if (!proxyClient.getSessionId()) {
        return {
          content: [
            {
              type: "text",
              text: `❌ 인증이 필요합니다. 'authenticate' 도구를 먼저 실행하세요.`,
            },
          ],
        };
      }

      // 세션 유효성 검증
      const isAuth = await proxyClient.isAuthenticated();
      if (!isAuth) {
        proxyClient.setSessionId(undefined);
        return {
          content: [
            {
              type: "text",
              text: `❌ 세션이 만료되었습니다. 'authenticate' 도구를 실행하여 재인증하세요.`,
            },
          ],
        };
      }

      // 세션 검증 성공 - 로그 제거하여 출력 간소화

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
        const result = await proxyClient.createPost(title, markdownContent, tags, qualityScore);

        if (result.success) {

          const post = result.data?.post || result.post || result.data;

          // 포스트를 로컬 파일로도 저장
          let fileMessage = '';
          try {
            const savedFilePath = await savePostToFile(title, markdownContent, tags);
            if (savedFilePath) {
              console.log(`📁 포스트 파일 저장: ${savedFilePath}`);
              fileMessage = `\n📁 파일 저장: ${path.basename(savedFilePath)}`;
            }
          } catch (error) {
            console.error('📁 파일 저장 실패:', error);
            // 파일 저장 실패해도 포스트 생성 성공은 유지
          }

          // MCP 응답 최적화: 간단한 성공 메시지만 반환 (병목 현상 제거)
          return {
            content: [
              {
                type: "text",
                text: `✅ 포스트 생성 완료: ${post.title}\n🔗 URL: ${post.url || `/posts/${post.slug}`}${fileMessage}`,
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
        // 에러 발생 시에만 최소한의 로그

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

  // Register prompts for writing style guidance
  server.registerPrompt(
    "markdown_quality_guidelines",
    {
      title: "Markdown Quality Guidelines for Blog Posts",
      description: "Professional markdown writing guidelines for high-quality blog posts with consistent formatting and structure"
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: writingStyle.qualityGuidelinesPrompt
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "blog_post_template",
    {
      title: "Blog Post Markdown Template",
      description: "A structured template for creating consistent, high-quality blog posts"
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: writingStyle.blogPostTemplatePrompt
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "improve_markdown",
    {
      title: "Improve Existing Markdown",
      description: "Guidelines for enhancing and standardizing existing markdown content"
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: writingStyle.improveMarkdownPrompt
          }
        }
      ]
    })
  );

  return server;
}

// Main execution
async function main() {
  const server = await createServerInstance();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((_error) => {
  process.exit(1);
});