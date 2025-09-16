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
import { loadWritingStyle } from "./lib/style-loader.js";

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

// Helper function to ensure authentication
async function ensureAuthenticated(auth: SecureAPIKeyAuth) {
  if (!auth.accessToken || !auth.blogInfo) {
    console.error("🔑 Authenticating with API...");
    const authResult = await auth.authenticate();
    if (!authResult) {
      return {
        content: [{
          type: "text" as const,
          text: "❌ Authentication required. Please run authenticate() first.",
        }],
      };
    }
  }
  return null; // Success
}

// Function to create a new server instance with all tools registered
async function createServerInstance(_clientIp?: string, _apiKey?: string) {
  // Create new instances for each server instance to ensure fresh environment variables
  const auth = new SecureAPIKeyAuth();
  const apiClient = new BlogAPIClient(auth);

  // Load writing style dynamically
  const writingStyle = await loadWritingStyle();

  const server = new McpServer(
    {
      name: "blog-mcp-typescript",
      version: "1.0.0",
    },
    {
      instructions: writingStyle.instructions,
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
      description: writingStyle.createPostDescription,
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
      const authError = await ensureAuthenticated(auth);
      if (authError) return authError;
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

      // Always analyze quality to get the score
      const beforeMetrics = qualityEnhancer.analyzeQuality(markdownContent);
      console.error(`📊 Original quality score: ${beforeMetrics.score}/100`);
      let finalQualityScore = beforeMetrics.score;

      if (auto_enhance && beforeMetrics.score < 70) {
        console.error("🔧 Enhancing markdown quality...");
        enhancedContent = qualityEnhancer.enhance(markdownContent);
        const afterMetrics = qualityEnhancer.analyzeQuality(enhancedContent);
        console.error(`✨ Enhanced quality score: ${afterMetrics.score}/100 (improved by ${afterMetrics.score - beforeMetrics.score} points)`);
        finalQualityScore = afterMetrics.score;
      }

      if (quality_report) {
        qualityReportText = qualityEnhancer.generateReport(enhancedContent);
      }

      // Parse markdown metadata
      console.error("📋 Step 4/6: Parsing metadata...");
      const { metadata, body } = parseMarkdownMetadata(enhancedContent);
      const finalTitle = title || metadata.title;
      const finalTags = tags || metadata.tags || [];
      
      // Check for AI identification tag
      const hasAiTag = finalTags.some((tag: string) => tag.startsWith('ai:'));
      if (!hasAiTag) {
        console.error("⚠️ WARNING: No AI identification tag found (ai:claude, ai:chatgpt, etc.)");
        console.error("📌 Please add appropriate AI tag for tracking purposes!");
      } else {
        const aiTag = finalTags.find((tag: string) => tag.startsWith('ai:'));
        console.error(`🤖 AI identification tag found: ${aiTag}`);
      }
      
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
        const post = await apiClient.createPost(finalTitle, body, finalTags, finalQualityScore);
        console.error("✅ Post created successfully!");
        const blogSlug = post.blogSlug || auth.blogInfo?.slug;
        const postUrl = `${auth.baseUrl}/blog/${blogSlug}/posts/${post.slug}`;

        // Debug log for quality score
        console.error(`🔍 DEBUG: finalQualityScore = ${finalQualityScore}`);

        const responseText = quality_report && qualityReportText
          ? `✅ Post created successfully! (Quality: ${finalQualityScore}/100)\n${savedMessage}\n📝 Title: ${post.title}\n🔗 Slug: ${post.slug}\n🏷️ Tags: ${finalTags?.join(", ") || "none"}\n📊 Quality Score: ${finalQualityScore}/100\n📅 Created: ${post.createdAt}\n🌐 URL: ${postUrl}\n\n${qualityReportText}`
          : `✅ Post created successfully! (Quality: ${finalQualityScore}/100)\n${savedMessage}\n📝 Title: ${post.title}\n🔗 Slug: ${post.slug}\n🏷️ Tags: ${finalTags?.join(", ") || "none"}\n📊 Quality Score: ${finalQualityScore}/100\n📅 Created: ${post.createdAt}\n🌐 URL: ${postUrl}`;
        
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
      // Check authentication using helper
      const authError = await ensureAuthenticated(auth);
      if (authError) return authError;

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
      const finalTags = metadata.tags || [];
      
      // Check for AI identification tag
      const hasAiTag = finalTags.some((tag: string) => tag.startsWith('ai:'));
      if (!hasAiTag) {
        console.error("⚠️ WARNING: No AI identification tag found in file");
        console.error("📌 Please ensure AI tags (ai:claude, ai:chatgpt, etc.) are included!");
      } else {
        const aiTag = finalTags.find((tag: string) => tag.startsWith('ai:'));
        console.error(`🤖 AI identification tag found: ${aiTag}`);
      }

      // Analyze quality score for the markdown content
      const qualityMetrics = qualityEnhancer.analyzeQuality(body);
      const finalQualityScore = qualityMetrics.score;
      console.error(`📊 Quality score for file: ${finalQualityScore}/100`);

      const savedFilePath = await savePostToFile(finalTitle, body, finalTags);
      const savedMessage = savedFilePath
        ? `💾 MD file saved: ${path.basename(savedFilePath)}`
        : "⚠️ MD file save failed";

      try {
        const post = await apiClient.createPost(finalTitle, body, finalTags, finalQualityScore);
        const blogSlug = post.blogSlug || auth.blogInfo?.slug;
        const postUrl = `${auth.baseUrl}/blog/${blogSlug}/posts/${post.slug}`;

        return {
          content: [
            {
              type: "text",
              text: `✅ Post created successfully! (Quality: ${finalQualityScore}/100)\n${savedMessage}\n📝 Title: ${post.title}\n🔗 Slug: ${post.slug}\n🏷️ Tags: ${finalTags?.join(", ") || "none"}\n📊 Quality Score: ${finalQualityScore}/100\n📅 Created: ${post.createdAt}\n🌐 URL: ${postUrl}`,
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
        const requestServer = await createServerInstance(clientIp, apiKey);

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
    const server = await createServerInstance();
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