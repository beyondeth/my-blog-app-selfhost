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

🌐 언어 설정 (LANGUAGE SETTINGS):
- 기본 언어: 한국어 (Korean)
- 특별 요청 시: 영어 또는 다른 언어 사용
- Default: Write in KOREAN unless specifically requested otherwise

⚠️ AI 어시스턴트를 위한 중요 지침 (CRITICAL INSTRUCTIONS FOR AI ASSISTANTS):
1. 항상 상세하고 포괄적인 포스트 작성 (최소 2000자, 이상적으로 3000-5000자)
2. 항상 auto_enhance: true 사용하여 품질 개선
3. 항상 의미있는 제목 생성 - "Untitled" 절대 금지
4. 항상 여러 섹션, 코드 예제, 상세한 설명 포함
5. 항상 포스팅 전에 마크다운 파일을 로컬에 저장
6. 기본적으로 한국어로 작성, 요청 시에만 다른 언어 사용

콘텐츠 분석 시 제공해야 할 내용:
- 여러 개의 상세한 섹션 (최소 5-7개)
- 설명과 함께 제공되는 코드 예제
- 시각적 요소 (이모지, 볼드, 이탤릭 등)
- 주제에 대한 포괄적인 커버리지
- markdown_quality_guidelines에 따른 전문적인 포맷팅

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

⚠️ AI 어시스턴트 필수 요구사항:
- 최소 길이: 2000자 이상 (목표: 3000-5000자)
- auto_enhance: true 항상 사용
- 포스팅 전 마크다운 파일 생성 필수
- "Untitled" 제목 절대 금지 - 의미있는 제목 생성

콘텐츠 작성 워크플로우:
1. 주제를 철저히 분석
2. 상세하고 포괄적인 콘텐츠 작성 (요약 금지)
3. 다양한 섹션과 풍부한 설명 포함
4. 코드 예제, 다이어그램, 상세 설명 추가
5. markdown_quality_guidelines 따르기

MARKDOWN QUALITY GUIDELINES:
1. Structure Requirements:
   - Use ## for main title (H2 level)
   - Use ### for sections (H3 level)
   - Use #### for subsections (H4 level)
   - Include at least 5-7 major sections
   
2. Visual Enhancement:
   - Start each major section with relevant emoji (🚀, 📋, 💡, etc.)
   - Use **bold** for important terms and key concepts
   - Use *italic* for emphasis
   - Add horizontal rules (---) between major sections

3. Code Blocks:
   - ALWAYS specify language: \`\`\`javascript, \`\`\`python, \`\`\`typescript
   - Include descriptive comments in code examples
   - Keep code examples concise and relevant

4. Content Quality:
   - Include engaging introduction
   - Add "Key Takeaways" or summary section
   - End with conclusion and call-to-action
   - Use conversational but professional tone

5. Lists & Tables:
   - Use - for unordered lists (not * or +)
   - Use numbered lists for sequential steps
   - Format tables with proper alignment

EXAMPLE STRUCTURE:
## 🚀 [Your Title Here]

### 📋 Introduction
[Engaging opening that sets context]

### 💡 Main Content
[Core information with examples]

### 🔍 Key Points
- Important point 1
- Important point 2

### 🎯 Conclusion
[Summary and call-to-action]

Note: Content will be automatically enhanced if quality score is below 70/100.`,
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
            text: `# Professional Markdown Writing Guidelines

When creating markdown content for blog posts, follow these essential quality standards:

## 📋 Structure Requirements

### Title Format
- Use descriptive, SEO-friendly titles
- Keep titles between 30-60 characters when possible
- Include keywords naturally

### Section Organization
1. **Introduction** (소개/개요): Start with a brief overview or hook
2. **Main Content**: Organize with clear H2 (##) and H3 (###) headings
3. **Conclusion** (결론/마무리): End with a summary or call-to-action

### Heading Hierarchy
- Use H2 (##) for main sections with descriptive emojis
- Use H3 (###) for subsections
- Never skip heading levels (don't go from H2 to H4)

## 🎨 Formatting Standards

### Emoji Usage
- Add ONE relevant emoji at the start of each H2 heading
- Examples: 📋 Overview, 🚀 Getting Started, 💡 Key Concepts, ⚙️ Configuration
- Korean section emojis: 📋 개요, 🔍 분석, 💡 핵심 개념, 🎯 결론

### Code Blocks
- ALWAYS specify the language after three backticks
- Languages: javascript, typescript, python, bash, sql, json, yaml, etc.
- Example format: [triple-backtick]javascript[newline]code[newline][triple-backtick]
- Never leave language identifier empty

### Text Emphasis
- Use **bold** for important terms and key concepts
- Use *italics* sparingly for emphasis
- Use \`inline code\` for technical terms, commands, file names

## ✅ Quality Checklist

### Must Have
- [ ] Clear introduction explaining the topic
- [ ] Logical flow with proper headings
- [ ] Code blocks with language specification
- [ ] At least 3-5 **bold** important terms
- [ ] Section dividers (---) between major sections
- [ ] Proper conclusion or summary

### Best Practices
- Keep paragraphs concise (3-5 sentences)
- Use bullet points or numbered lists for clarity
- Include practical examples in code blocks
- Add context and explanations for technical concepts

## 🌐 Bilingual Considerations

For Korean content:
- Maintain professional tone (합쇼체)
- Use appropriate technical terms in English when clearer
- Include both Korean and English keywords for SEO

## 📊 Content Length Guidelines
- Minimum: 500 words for substance
- Optimal: 1000-2000 words for detailed coverage
- Maximum: 3000 words to maintain reader engagement

Remember: Quality over quantity. Every section should provide value to the reader.`
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