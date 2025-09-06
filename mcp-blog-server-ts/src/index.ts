#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { Command } from "commander";
import { z } from "zod";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { SecureAPIKeyAuth } from "./lib/auth.js";
import { parseMarkdownMetadata } from "./lib/markdown.js";
import { savePostToFile } from "./lib/filesystem.js";
import { BlogAPIClient } from "./lib/api-client.js";
import { getClientIp } from "./lib/utils.js";
import { qualityEnhancer } from "./lib/quality-enhancer.js";

// ES Module support for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();
dotenv.config({ path: path.join(__dirname, "../../.env") });

// Parse CLI arguments
const program = new Command()
  .option("--transport <stdio|http>", "transport type", "stdio")
  .option("--port <number>", "port for HTTP transport", "3000")
  .option("--api-key <key>", "API key for authentication")
  .allowUnknownOption()
  .parse(process.argv);

const cliOptions = program.opts<{
  transport: string;
  port: string;
  apiKey?: string;
}>();

// Validate transport option
const allowedTransports = ["stdio", "http"];
if (!allowedTransports.includes(cliOptions.transport)) {
  console.error(
    `Invalid --transport value: '${cliOptions.transport}'. Must be one of: stdio, http.`
  );
  process.exit(1);
}

const TRANSPORT_TYPE = (cliOptions.transport || "stdio") as "stdio" | "http";

// Validate incompatible flags
if (TRANSPORT_TYPE === "http" && process.argv.includes("--api-key")) {
  console.error(
    "The --api-key flag is not allowed when using --transport http. Use header-based auth at the HTTP layer instead."
  );
  process.exit(1);
}

if (TRANSPORT_TYPE === "stdio" && process.argv.includes("--port")) {
  console.error("The --port flag is not allowed when using --transport stdio.");
  process.exit(1);
}

// HTTP port configuration
const CLI_PORT = (() => {
  const parsed = parseInt(cliOptions.port, 10);
  return isNaN(parsed) ? undefined : parsed;
})();

// Store SSE transports by session ID
const sseTransports: Record<string, SSEServerTransport> = {};

// Function to create a new server instance with all tools registered
function createServerInstance(_clientIp?: string, _apiKey?: string) {
  // Create new instances for each server instance to ensure fresh environment variables
  const auth = new SecureAPIKeyAuth();
  const apiClient = new BlogAPIClient(auth);
  const server = new McpServer(
    {
      name: "blog-mcp-typescript",
      version: "1.0.0",
    },
    {
      instructions: `TypeScript-based MCP server for HIGH-QUALITY blog post creation.

🔴 AUTHENTICATION FIRST RULE (필수 인증 우선 규칙):
⚠️ ALWAYS call authenticate() BEFORE creating any content or files!
⚠️ 반드시 authenticate() 호출 후 성공 확인 후에만 콘텐츠 작성!
Never waste time creating markdown before authentication succeeds.
인증 없이 콘텐츠 작성 금지 - 시간 낭비 방지를 위한 필수 규칙

🌐 언어 설정 (LANGUAGE SETTINGS):
- 기본 언어: 한국어 (Korean)
- 특별 요청 시: 영어 또는 다른 언어 사용
- Default: Write in KOREAN unless specifically requested otherwise

⚠️ AI 어시스턴트 핵심 규칙 (CORE RULES FOR AI ASSISTANTS):
1. 최소 2000자, 이상적으로 3000-5000자
2. auto_enhance: true 항상 사용
3. 의미있는 제목 필수 ("Untitled" 금지)
4. 기본 한국어, 영어는 요청시만

📝 콘텐츠 작성은 create_post 도구의 상세 가이드라인 참조
🎨 스타일 가이드는 markdown_quality_guidelines 프롬프트 참조

Remember: Quality over speed. Generate rich, valuable content that readers will appreciate.`,
    }
  );

  // Note: Resources are not used in this implementation
  // All functionality is exposed through tools

  // Register tools
  server.registerTool(
    "authenticate",
    {
      title: "Authenticate with API Key",
      description: "Authenticate using HMAC-SHA256 signed API key credentials",
      inputSchema: {},
    },
    async () => {
      const result = await auth.authenticate();
      if (result) {
        if (auth.blogInfo) {
          return {
            content: [
              {
                type: "text",
                text: `✅ Authentication successful!\n📝 Blog: ${auth.blogInfo.name}\n🔗 Slug: ${auth.blogInfo.slug}\n🎯 Ready to post!`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: "✅ Authentication successful!\n🎯 API Key authenticated\n⚠️ Could not retrieve blog information",
              },
            ],
          };
        }
      } else {
        return {
          content: [
            {
              type: "text",
              text: `❌ Authentication failed\n⚠️ Please check the following in your .env file:\n- BLOG_API_KEY_ID (starts with akid_)\n- BLOG_API_KEY_SECRET (starts with aks_)\n- BLOG_API_URL\nOr legacy format:\n- BLOG_API_KEY (starts with sk_)`,
            },
          ],
        };
      }
    }
  );

  server.registerTool(
    "create_post",
    {
      title: "Create High-Quality Blog Post",
      description: `고품질 블로그 포스트 생성 (기본: 한국어)
Create a professional blog post (Default: KOREAN, use English only if requested)

🌐 언어 설정:
- 기본: 한국어로 작성
- 영어는 명시적 요청 시에만 사용

📝 자연스러운 글쓰기 가이드 (NATURAL WRITING GUIDELINES):
1. 스토리텔링 우선 - 실제 경험이나 사례로 시작하세요
2. 코드블록은 최소화 (전체의 20% 이하) - 꼭 필요한 경우만
3. 설명은 대화체로 자연스럽게 - 독자와 대화하듯이
4. 개인적 의견과 감정 표현 포함 - "제 생각에는", "흥미롭게도"
5. 자연스러운 전환구 사용 - "그런데", "하지만", "예를 들어"
6. ⚠️ 제목과 첫 문장 차별화 - 제목을 그대로 반복하지 말고 다른 표현으로 시작

❌ 피해야 할 것들 (AVOID):
- 과도한 코드블록 (정보 전달용 코드블록 절대 금지)
- 기계적인 나열식 설명
- 감정 없는 딱딱한 문체
- "다음과 같습니다", "아래와 같습니다" 같은 틀에 박힌 표현
- 불필요한 기술 용어 나열
- 제목을 첫 문장에서 그대로 반복 (예: 제목 "React 시작하기" → 첫문장 "React 시작하기에 대해 알아보겠습니다" ❌)

⚠️ AI 어시스턴트 필수 요구사항:
- 최소 길이: 2000자 이상 (목표: 3000-5000자)
- auto_enhance: true 항상 사용
- 포스팅 전 마크다운 파일 생성 필수
- "Untitled" 제목 절대 금지 - 의미있는 제목 생성

✅ 작성 체크리스트:
- 스토리텔링으로 시작했는가?
- 코드블록이 20% 이하인가?
- 대화체와 감정 표현을 사용했는가?
- 최소 2000자 이상인가?

📚 상세 가이드라인은 'markdown_quality_guidelines' 프롬프트 참조
Note: Quality score 70점 미만시 자동 개선됨`,
      inputSchema: {
        title: z.string().optional().describe("Post title (optional, can be extracted from markdown)"),
        content: z.string().optional().describe("Markdown content following quality guidelines"),
        file_path: z.string().optional().describe("Path to markdown file (either content or file_path required)"),
        tags: z.array(z.string()).optional().describe("List of tags for the post (5-10 recommended)"),
        auto_enhance: z.boolean().optional().default(true).describe("Automatically enhance markdown quality (STRONGLY RECOMMENDED - default: true)"),
        quality_report: z.boolean().optional().describe("Include quality analysis report (default: false)"),
      },
    },
    async ({ title, content, file_path, tags, auto_enhance = true, quality_report = false }) => {
      // Force auto_enhance to true if not explicitly set to false
      if (auto_enhance === undefined || auto_enhance === null) {
        auto_enhance = true;
        console.error("📌 Auto-enhance enabled by default for quality content");
      }
      // Log start for debugging (visible in server logs)
      console.error("🚀 Starting blog post creation...");
      
      // Check authentication
      console.error("📋 Step 1/5: Checking authentication...");
      if (!auth.accessToken || !auth.blogInfo) {
        console.error("🔑 Authenticating with API...");
        const authResult = await auth.authenticate();
        if (!authResult) {
          return {
            content: [
              {
                type: "text",
                text: "❌ Authentication required. Please run authenticate() first.",
              },
            ],
          };
        }
      }
      console.error("✅ Authentication verified");

      // Get markdown content
      console.error("📋 Step 2/5: Processing markdown content...");
      let markdownContent: string;
      if (file_path) {
        const fs = await import("fs/promises");
        try {
          console.error(`📂 Reading file: ${file_path}`);
          markdownContent = await fs.readFile(file_path, "utf-8");
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ File not found: ${file_path}`,
              },
            ],
          };
        }
      } else if (content) {
        markdownContent = content;
      } else {
        return {
          content: [
            {
              type: "text",
              text: "❌ Either content or file_path is required.",
            },
          ],
        };
      }
      console.error(`✅ Content processed (${markdownContent.length} characters)`);
      
      // Check minimum content length
      if (markdownContent.length < 2000) {
        console.error(`⚠️ WARNING: Content is only ${markdownContent.length} characters. Minimum recommended: 2000`);
        console.error("📝 AI Assistants: Please generate more detailed, comprehensive content!");
        // Add warning to the content
        markdownContent = `<!-- WARNING: This content is below minimum quality standards (${markdownContent.length} chars) -->\n\n${markdownContent}`;
      }

      // Quality enhancement (NEW)
      console.error("📋 Step 3/6: Analyzing and enhancing content quality...");
      let enhancedContent = markdownContent;
      let qualityReportText = "";
      
      if (auto_enhance || quality_report) {
        const beforeMetrics = qualityEnhancer.analyzeQuality(markdownContent);
        console.error(`📊 Original quality score: ${beforeMetrics.score}/100`);
        
        if (auto_enhance && beforeMetrics.score < 70) {
          console.error("🔧 Enhancing markdown quality...");
          enhancedContent = qualityEnhancer.enhance(markdownContent);
          const afterMetrics = qualityEnhancer.analyzeQuality(enhancedContent);
          console.error(`✨ Enhanced quality score: ${afterMetrics.score}/100 (improved by ${afterMetrics.score - beforeMetrics.score} points)`);
        }
        
        if (quality_report) {
          qualityReportText = qualityEnhancer.generateReport(enhancedContent);
        }
      }

      // Parse markdown metadata
      console.error("📋 Step 4/6: Parsing metadata...");
      const { metadata, body } = parseMarkdownMetadata(enhancedContent);
      const finalTitle = title || metadata.title;
      const finalTags = tags || metadata.tags;
      console.error(`✅ Title: "${finalTitle}", Tags: ${finalTags?.length || 0}`);

      // Save to file
      console.error("📋 Step 5/6: Saving to local file...");
      const savedFilePath = await savePostToFile(finalTitle, body, finalTags);
      const savedMessage = savedFilePath
        ? `💾 MD file saved: ${path.basename(savedFilePath)}`
        : "⚠️ MD file save failed";
      console.error(savedMessage);

      // Create post via API
      console.error("📋 Step 6/6: Creating post via API...");
      try {
        console.error(`🌐 Sending to: ${auth.baseUrl}`);
        const post = await apiClient.createPost(finalTitle, body, finalTags);
        console.error("✅ Post created successfully!");
        const blogSlug = post.blogSlug || auth.blogInfo?.slug;
        const postUrl = `${auth.baseUrl}/blog/${blogSlug}/posts/${post.slug}`;

        const responseText = quality_report && qualityReportText
          ? `✅ Post created successfully!\n${savedMessage}\n📝 Title: ${post.title}\n🔗 Slug: ${post.slug}\n🏷️ Tags: ${finalTags?.join(", ") || "none"}\n📅 Created: ${post.createdAt}\n🌐 URL: ${postUrl}\n\n${qualityReportText}`
          : `✅ Post created successfully!\n${savedMessage}\n📝 Title: ${post.title}\n🔗 Slug: ${post.slug}\n🏷️ Tags: ${finalTags?.join(", ") || "none"}\n📅 Created: ${post.createdAt}\n🌐 URL: ${postUrl}`;
        
        return {
          content: [
            {
              type: "text",
              text: responseText,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Post creation failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  server.registerTool(
    "create_post_from_file",
    {
      title: "Create Post from File",
      description: "마크다운 파일로부터 블로그 포스트 생성 (기본: 한국어) / Create a blog post from a markdown file (Default: Korean)",
      inputSchema: {
        file_path: z.string().describe("Path to the markdown file"),
      },
    },
    async ({ file_path }) => {
      // Delegate to create_post tool
      // Reuse create_post logic by calling the handler directly
      // Since we can't access other tools directly, we need to duplicate the logic
      // or refactor into a shared function
      if (!auth.accessToken || !auth.blogInfo) {
        const authResult = await auth.authenticate();
        if (!authResult) {
          return {
            content: [
              {
                type: "text",
                text: "❌ Authentication required. Please run authenticate() first.",
              },
            ],
          };
        }
      }

      const fs = await import("fs/promises");
      let markdownContent: string;
      try {
        markdownContent = await fs.readFile(file_path, "utf-8");
      } catch (error) {
        return {
          content: [
            {
                type: "text",
                text: `❌ File not found: ${file_path}`,
            },
          ],
        };
      }

      const { metadata, body } = parseMarkdownMetadata(markdownContent);
      const finalTitle = metadata.title;
      const finalTags = metadata.tags;

      const savedFilePath = await savePostToFile(finalTitle, body, finalTags);
      const savedMessage = savedFilePath
        ? `💾 MD file saved: ${path.basename(savedFilePath)}`
        : "⚠️ MD file save failed";

      try {
        const post = await apiClient.createPost(finalTitle, body, finalTags);
        const blogSlug = post.blogSlug || auth.blogInfo?.slug;
        const postUrl = `${auth.baseUrl}/blog/${blogSlug}/posts/${post.slug}`;

        return {
          content: [
            {
              type: "text",
              text: `✅ Post created successfully!\n${savedMessage}\n📝 Title: ${post.title}\n🔗 Slug: ${post.slug}\n🏷️ Tags: ${finalTags?.join(", ") || "none"}\n📅 Created: ${post.createdAt}\n🌐 URL: ${postUrl}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Post creation failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  server.registerTool(
    "diagnose_connection",
    {
      title: "Diagnose Connection",
      description: "Check connection status and diagnose issues",
      inputSchema: {},
    },
    async () => {
      const results: string[] = [];

      // Check environment variables
      const hasNewKeys = process.env["BLOG_API_KEY_ID"] && process.env["BLOG_API_KEY_SECRET"];
      const hasLegacyKey = process.env["BLOG_API_KEY"];

      if (!hasNewKeys && !hasLegacyKey) {
        results.push("❌ Missing environment variables: BLOG_API_KEY_ID/SECRET or BLOG_API_KEY");
      } else {
        results.push("✅ Environment variables configured");
      }

      // Test API connection
      try {
        const response = await fetch(`${auth.baseUrl}/health`);
        if (response.ok) {
          results.push("✅ API server connection successful");
        } else {
          results.push(`⚠️ API server response abnormal: ${response.status}`);
        }
      } catch (error) {
        results.push(`❌ API server connection failed: ${String(error)}`);
      }

      // Check authentication status
      if (auth.accessToken && auth.blogInfo) {
        results.push("✅ Authentication status: Active");
        results.push(`📝 Blog: ${auth.blogInfo.name}`);
      } else {
        results.push("⚠️ Authentication status: Inactive");
      }

      return {
        content: [
          {
            type: "text",
            text: `🔍 Connection Status Diagnostic Report\n${'='.repeat(30)}\n${results.join('\n')}`,
          },
        ],
      };
    }
  );

  // Register prompts for markdown quality guidelines
  // These prompts will be available to LLMs BEFORE they generate content
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
            text: `# Professional Markdown Writing Guidelines for Natural Blog Posts

When creating markdown content for blog posts, focus on natural, engaging writing that connects with readers.

## 📝 자연스러운 글쓰기 원칙 (Natural Writing Principles)

### 스토리텔링과 경험 공유
- 실제 경험이나 사례로 시작하여 독자의 관심을 끌기
- "제가 처음 이 문제를 만났을 때..." 같은 개인적 이야기 활용
- 기술적 내용도 스토리로 풀어서 설명
- 독자가 공감할 수 있는 상황 제시

### 대화체와 감정 표현
- 독자와 대화하듯 자연스러운 문체 사용
- "흥미롭게도", "놀랍게도", "재미있는 것은" 같은 감정 표현
- 질문을 통한 독자 참여 유도: "어떻게 생각하시나요?"
- 개인적 의견 표현: "제 생각에는", "개인적으로 선호하는 방법은"

### 자연스러운 전환구 사용
- "그런데", "하지만", "예를 들어" 등으로 문단 연결
- "여기서 중요한 점은", "그래서 결론적으로" 같은 연결 표현
- 딱딱한 나열 대신 흐름있는 설명

## ⚠️ 코드블록 사용 가이드 (Code Block Guidelines)

### 코드블록 최소화 원칙
- **전체 콘텐츠의 20% 이하로 제한**
- 꼭 필요한 코드 예제만 포함
- 코드보다는 설명에 중점

### 코드 대신 설명 우선
- 코드로 보여주기보다 말로 설명하기
- 개념 설명은 텍스트로, 구현만 코드로
- 코드 블록 전후에 충분한 설명 추가

### 올바른 코드블록 사용
\`\`\`javascript
// 꼭 필요한 예제만 간단하게
const example = "필수적인 코드만";
\`\`\`

## ❌ 피해야 할 것들 (Things to Avoid)

### 기계적인 표현
- "다음과 같습니다", "아래와 같습니다" → "살펴보죠", "예를 들면"
- "상기 내용을 정리하면" → "지금까지 이야기한 것을 정리하면"
- 번호 나열식 설명 → 스토리텔링으로 연결

### 과도한 기술 용어
- 전문 용어 남발 자제
- 어려운 개념은 쉬운 비유로 설명
- 독자 수준을 고려한 설명

### 감정 없는 문체
- 단순 정보 전달 → 경험과 감정을 담은 설명
- 객관적 서술만 → 주관적 의견도 포함
- 형식적 문장 → 친근한 대화체

## 🎨 구조와 형식 (Structure & Format)

### 제목과 섹션
- H2 (##)에는 이모지 1개와 설명적 제목
- H3 (###)로 하위 섹션 구성
- 섹션 간 자연스러운 연결

### 강조와 포맷팅
- **중요한 용어**는 굵게 표시 (3-5개 정도)
- *감정 표현*은 이탤릭으로
- \`기술 용어\`는 인라인 코드로

### 길이와 구성
- 최소 2000자, 이상적으로 3000-5000자
- 도입부: 흥미 유발과 문제 제시
- 본문: 경험과 해결 과정
- 결론: 핵심 정리와 독자 행동 유도

## 💡 좋은 블로그 포스트 예시

### 도입부 예시 (제목과 다르게 시작)
제목: "React 성능 최적화 완벽 가이드"
❌ 나쁜 시작: "React 성능 최적화 완벽 가이드에 대해 알아보겠습니다."
✅ 좋은 시작: "최근 프로젝트에서 렌더링이 너무 느려져서 고민이 많았습니다. 
사용자가 버튼을 클릭하면 2초나 기다려야 했죠. 
이 문제를 해결하면서 배운 최적화 기법들을 공유하려고 합니다."

### 본문 예시
"그런데 흥미로운 점을 발견했습니다. 
제가 처음 시도한 방법은 완전히 틀렸더라고요. 
하지만 실패를 통해 더 나은 해결책을 찾을 수 있었습니다."

### 결론 예시
"이 경험을 통해 배운 것은 간단합니다. 
때로는 돌아가는 길이 가장 빠른 길일 수 있다는 거죠. 
여러분의 경험은 어떠신가요? 댓글로 공유해주세요!"

Remember: 독자와 소통하는 따뜻한 글쓰기를 지향하세요. 정보 전달보다 경험 공유가 더 가치있습니다.`
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
            text: `# Blog Post Template

Use this template structure for all blog posts:

# Template Structure:

---
title: "Your SEO-Friendly Title Here"
tags: ["tag1", "tag2", "tag3"]
date: YYYY-MM-DD
---

## 📋 Introduction
Start with a compelling hook or problem statement that explains why this topic matters.

[section divider]

## 🔍 Background/Context
Provide necessary background information or context for understanding the main content.

### Subsection if needed
Additional details organized logically.

[section divider]

## 💡 Main Content

### Key Concept 1
**Important term**: Clear explanation with examples.

[code block with javascript language]
const example = {
  property: "value"
};
[end code block]

### Key Concept 2
Continue with well-structured sections, each with:
- Clear explanations
- Practical examples
- **Bold** key terms

[section divider]

## 🎯 Conclusion
Summarize the key points and provide:
- Main takeaways
- Next steps for readers
- Call to action if applicable

[section divider]

## 📚 References (Optional)
- [Link Title](URL)
- Additional resources

Remember to:
1. Replace placeholder text with actual content
2. Add relevant emojis to H2 headings
3. Specify language for ALL code blocks
4. Use **bold** for important terms
5. Include section dividers (---) between major sections`
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
            text: `# Markdown Improvement Checklist

When improving existing markdown, ensure these enhancements:

## 🔧 Quick Fixes
1. **Add language identifiers** to code blocks (use: javascript, typescript, python, etc.)
2. **Add emojis** to H2 headings for visual appeal
3. **Bold important terms** for emphasis (at least 3-5 per document)
4. **Add section dividers** (---) between major sections
5. **Ensure proper heading hierarchy** (H1 → H2 → H3)

## 📈 Structure Improvements
- Add introduction if missing
- Add conclusion/summary if missing  
- Group related content under clear headings
- Break long paragraphs into smaller ones
- Convert long text into bullet points where appropriate

## 🎨 Visual Enhancements
- Use tables for comparative data
- Add code examples where helpful
- Include practical use cases
- Use consistent formatting throughout

## ✨ Polish
- Fix any grammar or spelling issues
- Ensure consistent tone and style
- Add context for technical terms
- Include "why" not just "what"

Transform mediocre content into professional, engaging blog posts!`
          }
        }
      ]
    })
  );

  return server;
}

async function main() {
  if (TRANSPORT_TYPE === "http") {
    const initialPort = CLI_PORT ?? 3001;
    let actualPort = initialPort;

    const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || "", `http://${req.headers.host}`).pathname;

      // Set CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,DELETE");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, MCP-Session-Id, MCP-Protocol-Version, X-API-Key, Authorization"
      );
      res.setHeader("Access-Control-Expose-Headers", "MCP-Session-Id");

      // Handle preflight OPTIONS requests
      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      // Extract API key from headers
      const extractHeaderValue = (value: string | string[] | undefined): string | undefined => {
        if (!value) return undefined;
        return typeof value === "string" ? value : value[0];
      };

      const extractBearerToken = (authHeader: string | string[] | undefined): string | undefined => {
        const header = extractHeaderValue(authHeader);
        if (!header) return undefined;
        if (header.startsWith("Bearer ")) {
          return header.substring(7).trim();
        }
        return header;
      };

      const apiKey =
        extractBearerToken(req.headers.authorization) ||
        extractHeaderValue(req.headers["x-api-key"]) ||
        extractHeaderValue(req.headers["X-API-Key"]);

      try {
        const clientIp = getClientIp(req);
        const requestServer = createServerInstance(clientIp, apiKey);

        if (url === "/mcp") {
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
          });
          await requestServer.connect(transport);
          await transport.handleRequest(req, res);
        } else if (url === "/sse" && req.method === "GET") {
          const sseTransport = new SSEServerTransport("/messages", res);
          sseTransports[sseTransport.sessionId] = sseTransport;
          res.on("close", () => {
            delete sseTransports[sseTransport.sessionId];
          });
          await requestServer.connect(sseTransport);
        } else if (url === "/messages" && req.method === "POST") {
          const sessionId =
            new URL(req.url || "", `http://${req.headers.host}`).searchParams.get("sessionId") || "";

          if (!sessionId) {
            res.writeHead(400);
            res.end("Missing sessionId parameter");
            return;
          }

          const sseTransport = sseTransports[sessionId];
          if (!sseTransport) {
            res.writeHead(400);
            res.end(`No transport found for sessionId: ${sessionId}`);
            return;
          }

          await sseTransport.handlePostMessage(req, res);
        } else {
          res.writeHead(404);
          res.end("Not found");
        }
      } catch (error) {
        console.error("HTTP server error:", error);
        res.writeHead(500);
        res.end("Internal server error");
      }
    });

    httpServer.listen(actualPort, () => {
      console.log(`🚀 TypeScript MCP Blog Server running on http://localhost:${actualPort}`);
      console.log(`📍 Endpoints:\n  - /mcp (streamable HTTP)\n  - /sse (Server-Sent Events)`);
    });

    httpServer.on("error", (error: any) => {
      if (error.code === "EADDRINUSE") {
        console.error(`❌ Port ${actualPort} is already in use`);
        process.exit(1);
      } else {
        console.error("❌ HTTP server error:", error);
        process.exit(1);
      }
    });
  } else {
    // stdio transport
    const server = createServerInstance();
    const transport = new StdioServerTransport();
    
    console.error("🚀 TypeScript MCP Blog Server running in stdio mode");
    await server.connect(transport);
  }
}

// Run the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});