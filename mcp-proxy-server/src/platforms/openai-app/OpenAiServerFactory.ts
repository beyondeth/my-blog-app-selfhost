import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { registerOpenAiTools } from './ToolRegistrar.js';
import type { ToolContext } from '../../core/types.js';
import type { OpenAiStyleStateStore } from './OpenAiStyleStateStore.js';

// OpenAI 라우트에서만 사용하는 MCP 서버 팩토리.
// shared handler(core)를 주입받아 ChatGPT용 descriptor/resource 메타를 등록한다.
export async function createOpenAiServer(
  context: ToolContext,
  styleStateStore: OpenAiStyleStateStore
): Promise<McpServer> {
  const mcpServer = new McpServer(
    {
      name: 'codebase-blog-openai-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  await registerOpenAiTools(mcpServer, context, styleStateStore);

  return mcpServer;
}
