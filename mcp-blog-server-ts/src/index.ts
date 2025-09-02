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

// Global instances
const auth = new SecureAPIKeyAuth();
const apiClient = new BlogAPIClient(auth);

// Function to create a new server instance with all tools registered
function createServerInstance(_clientIp?: string, _apiKey?: string) {
  const server = new McpServer(
    {
      name: "blog-mcp-typescript",
      version: "1.0.0",
    },
    {
      instructions:
        "TypeScript-based MCP server for secure blog post creation. Uses HMAC-SHA256 authentication for API security. Supports OAuth users posting with API keys without passwords.",
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
      title: "Create Blog Post",
      description: "Create a new blog post from markdown content",
      inputSchema: {
        title: z.string().optional().describe("Post title (optional, can be extracted from markdown)"),
        content: z.string().optional().describe("Markdown content (either content or file_path required)"),
        file_path: z.string().optional().describe("Path to markdown file (either content or file_path required)"),
        tags: z.array(z.string()).optional().describe("List of tags for the post"),
      },
    },
    async ({ title, content, file_path, tags }) => {
      // Check authentication
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

      // Get markdown content
      let markdownContent: string;
      if (file_path) {
        const fs = await import("fs/promises");
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

      // Parse markdown metadata
      const { metadata, body } = parseMarkdownMetadata(markdownContent);
      const finalTitle = title || metadata.title;
      const finalTags = tags || metadata.tags;

      // Save to file
      const savedFilePath = await savePostToFile(finalTitle, body, finalTags);
      const savedMessage = savedFilePath
        ? `💾 MD file saved: ${path.basename(savedFilePath)}`
        : "⚠️ MD file save failed";

      // Create post via API
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
    "create_post_from_file",
    {
      title: "Create Post from File",
      description: "Create a blog post from a markdown file",
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