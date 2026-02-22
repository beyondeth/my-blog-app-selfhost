import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { registerOpenAiTools } from './ToolRegistrar.js';
import type { ToolContext } from '../../tools/index.js';

export async function createOpenAiServer(context: ToolContext): Promise<McpServer> {
  const mcpServer = new McpServer(
    {
      name: 'codebase-blog-openai-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  await registerOpenAiTools(mcpServer, context);

  return mcpServer;
}

