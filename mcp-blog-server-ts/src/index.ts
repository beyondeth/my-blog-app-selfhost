#!/usr/bin/env node

/**
 * MCP Blog Client - Simple & Clean
 *
 * Core workflow:
 * 1. authenticate() - Get session token
 * 2. create_post() - Create blog post with style from .env
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import path from "path";
import { z } from "zod";
import { ProxyClient } from "./lib/auth-proxy";
import { parseMarkdownMetadata } from "./lib/markdown";
import { loadWritingStyle, WritingStyle } from "./lib/style-loader";
import { savePostToFile } from "./lib/filesystem";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config();

// Global writing style (loaded from .env WRITING_STYLE)
let writingStyle: WritingStyle;

// Create server instance
async function createServerInstance() {
  const proxyClient = new ProxyClient();

  // Load writing style from .env
  writingStyle = await loadWritingStyle();

  const server = new McpServer(
    {
      name: "blog-mcp-client",
      version: "2.0.0",
    },
    {
      instructions: writingStyle.instructions
    }
  );

  // Register authenticate tool
  server.registerTool(
    "authenticate",
    {
      title: "Check Authentication Status & Login",
      description: "Check authentication status and login if needed. Call this first before creating posts.",
    },
    async () => {
      // Check existing session
      if (proxyClient.getSessionId()) {
        try {
          const isValid = await proxyClient.isAuthenticated();
          if (isValid) {
            return {
              content: [{
                type: "text",
                text: `✅ 기존 세션이 유효합니다! (인증 성공)\n🆔 세션: xxxxxxxx...\n📝 자동포스팅 생성중 입니다. 잠시만 기다려주세요...\n\n이제 create_post 도구를 사용하여 블로그 포스팅을 할 수 있습니다.`
              }]
            };
          } else {
            proxyClient.setSessionId(undefined);
          }
        } catch (error) {
          // Session validation failed
        }
      }

      // Start new authentication
      try {
        const result = await proxyClient.authenticate();

        if (result.success && result.authenticated) {
          return {
            content: [{
              type: "text",
              text: `✅ 인증 상태가 확인되었습니다! (인증 성공)\n🆔 세션: xxxxxxxx...\n📝 자동포스팅 생성중 입니다. 잠시만 기다려주세요...\n\n이제 create_post 도구를 사용하여 블로그 포스팅을 할 수 있습니다.`,
            }]
          };
        } else if (result.success && !result.authenticated) {
          // Open browser for OAuth
          const { spawn } = await import('child_process');
          const { authorizationUrl, sessionId } = result.data;
          const platform = process.platform;
          const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
          spawn(command, [authorizationUrl], { detached: true, stdio: 'ignore' }).unref();

          // Save sessionId
          proxyClient.setSessionId(sessionId);

          // 폴링 방식: 2초마다 세션 상태 확인
          return new Promise((resolve) => {
            const proxyServerUrl = process.env['PROXY_SERVER_URL'] || 'http://localhost:3002';
            const pollInterval = 2000; // 2초
            const timeout = 300000; // 5분
            const startTime = Date.now();

            const poll = async () => {
              try {
                // 세션 상태 확인
                const response = await fetch(`${proxyServerUrl}/api/v1/mcp/sessions/${sessionId}/status`);
                const data = await response.json() as any;

                // 인증 완료 감지
                if (data.success && data.data?.valid && data.data?.hasToken) {
                  resolve({
                    content: [{
                      type: "text",
                      text: `✅ OAuth2 인증 성공! (로그인 완료)\n🆔 세션 ID: xxxxxxxx...\n📝 자동포스팅 생성중 입니다. 잠시만 기다려주세요...\n\n🎯 포스팅 준비 완료!`,
                    }]
                  });
                  return;
                }

                // 타임아웃 체크
                if (Date.now() - startTime > timeout) {
                  resolve({
                    content: [{
                      type: "text",
                      text: "⏱️ 인증 시간 초과 (5분)"
                    }]
                  });
                  return;
                }

                // 다음 폴링 스케줄
                setTimeout(poll, pollInterval);

              } catch (error: any) {
                // 폴링 실패 시 재시도
                if (Date.now() - startTime < timeout) {
                  setTimeout(poll, pollInterval);
                } else {
                  resolve({
                    content: [{
                      type: "text",
                      text: `❌ 인증 확인 실패: ${error.message}`
                    }]
                  });
                }
              }
            };

            // 첫 번째 폴링 시작
            poll();
          });
        } else {
          return {
            content: [{
              type: "text",
              text: `❌ 인증 실패: ${result.error || result.message}`
            }]
          };
        }
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: `❌ Proxy Server 연결 실패: ${error.message}\n\nProxy Server가 실행 중인지 확인하세요.`
          }]
        };
      }
    }
  );

  // Register create_post tool
  server.registerTool(
    "create_post",
    {
      title: "Create Blog Post",
      description: writingStyle.createPostDescription,
      inputSchema: {
        title: z.string().describe("블로그 포스트 제목").optional(),
        content_markdown: z.string()
          .describe("마크다운 형식의 포스트 내용")
          .optional(),
        tags: z.array(z.string()).describe("포스트 태그 목록 (선택사항)").optional(),
        file_path: z.string().describe("마크다운 파일 경로 (선택사항)").optional(),
        auto_enhance: z.boolean().describe("품질 자동 개선 여부 (기본값: true)").optional(),
      }
    },
    async (args: {
      title?: string;
      content_markdown?: string;
      tags?: string[];
      file_path?: string;
      auto_enhance?: boolean;
    }) => {
      // Check session
      if (!proxyClient.getSessionId()) {
        return {
          content: [{
            type: "text",
            text: `❌ 인증이 필요합니다. 'authenticate' 도구를 먼저 실행하세요.`
          }]
        };
      }

      // Validate session
      const isAuth = await proxyClient.isAuthenticated();
      if (!isAuth) {
        proxyClient.setSessionId(undefined);
        return {
          content: [{
            type: "text",
            text: `❌ 세션이 만료되었습니다. 'authenticate' 도구를 실행하여 재인증하세요.`
          }]
        };
      }

      try {
        let title = args?.title as string;
        let markdownContent = args?.content_markdown as string;
        let tags = (args?.tags || []) as string[];

        // Load from file if provided
        if (args.file_path) {
          const fs = await import('fs/promises');
          const fileContent = await fs.readFile(args.file_path, 'utf-8');
          const { metadata, body } = parseMarkdownMetadata(fileContent);
          title = title || metadata.title || path.basename(args.file_path, '.md');
          tags = tags.length > 0 ? tags : metadata.tags;
          markdownContent = body;
        }

        // title 유무와 관계없이 항상 front matter 체크 및 제거
        if (markdownContent) {
          const { metadata, body } = parseMarkdownMetadata(markdownContent);

          // title이 파라미터로 안 왔으면 front matter에서 가져옴
          if (!title && metadata.title) {
            title = metadata.title;
          }

          // tags가 비어있으면 front matter에서 가져옴
          if (tags.length === 0 && metadata.tags) {
            tags = metadata.tags;
          }

          // 항상 front matter 제거된 본문만 사용
          markdownContent = body;
        }

        // Validate required fields
        if (!title || !markdownContent) {
          return {
            content: [{
              type: "text",
              text: `❌ 필수 파라미터 누락\n\n- title: ${title || '없음'}\n- content_markdown: ${markdownContent ? '있음' : '없음'}\n\n사용법: create_post(title="제목", content_markdown="내용", tags=["태그1"])`
            }]
          };
        }

        // Create post via proxy
        const result = await proxyClient.createPost(title, markdownContent, tags);

        if (result.success) {
          const post = result.data?.post || result.post || result.data;

          // Save to local file
          let fileMessage = '';
          try {
            const savedFilePath = await savePostToFile(title, markdownContent, tags);
            if (savedFilePath) {
              fileMessage = `\n📁 파일 저장: ${path.basename(savedFilePath)}`;
            }
          } catch (error) {
            console.error('📁 파일 저장 실패:', error);
          }

          return {
            content: [{
              type: "text",
              text: `✅ 포스트 생성 완료: ${post.title}\n🔗 URL: ${post.url || `/posts/${post.slug}`}${fileMessage}`
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: `❌ 포스트 생성 실패: ${typeof result.error === 'object' ? JSON.stringify(result.error) : (result.error || result.message)}`
            }]
          };
        }
      } catch (error: any) {
        if (error.message && (error.message.includes('세션') || error.message.includes('인증'))) {
          return {
            content: [{
              type: "text",
              text: `❌ ${error.message}\n\n'authenticate' 도구를 사용하여 다시 로그인해주세요.`
            }]
          };
        }

        const errorMessage = error.message || error.error || JSON.stringify(error);
        return {
          content: [{
            type: "text",
            text: `❌ 포스트 생성 실패: ${typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : errorMessage}`
          }]
        };
      }
    }
  );

  // Register diagnose_connection tool
  server.registerTool(
    "diagnose_connection",
    {
      title: "Check Connection Status",
      description: "Check MCP Proxy Server connection and authentication status",
    },
    async () => {
      try {
        const health = await proxyClient.checkHealth();

        let statusMessage = `📊 MCP Proxy Server 상태\n━━━━━━━━━━━━━━━━━━━━\n`;
        statusMessage += `서비스: ${health.service || 'Unknown'}\n`;
        statusMessage += `상태: ${health.status === 'healthy' ? '✅ 정상' : '❌ 오류'}\n`;

        if (health.session) {
          statusMessage += `\n세션: ${health.session.valid ? '✅' : '❌'}\n`;
          statusMessage += `토큰: ${health.session.hasToken ? '✅' : '❌'}\n`;
        }

        if (health.backend) {
          statusMessage += `\nBackend: ${health.backend.connected ? '✅' : '❌'}\n`;
        }

        statusMessage += `\n포스트 생성 가능: ${health.can_create_posts ? '✅' : '❌'}`;

        return {
          content: [{
            type: "text",
            text: statusMessage
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: `❌ Proxy Server 연결 실패\n\nProxy Server가 포트 3002에서 실행 중인지 확인하세요.`
          }]
        };
      }
    }
  );

  // Register prompts
  server.registerPrompt(
    "markdown_quality_guidelines",
    {
      title: "Markdown Quality Guidelines",
      description: "Professional markdown writing guidelines for blog posts"
    },
    () => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: writingStyle.qualityGuidelinesPrompt
        }
      }]
    })
  );

  server.registerPrompt(
    "blog_post_template",
    {
      title: "Blog Post Template",
      description: "Standard blog post template structure for the selected writing style"
    },
    () => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: writingStyle.blogPostTemplatePrompt
        }
      }]
    })
  );

  server.registerPrompt(
    "improve_markdown",
    {
      title: "Improve Markdown Content",
      description: "Style-specific markdown enhancement guidelines and techniques"
    },
    () => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: writingStyle.improveMarkdownPrompt
        }
      }]
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
