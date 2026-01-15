export const getMcpJsonConfig = (apiKey: string) => `{
  "mcpServers": {
    "codebase-blog-mcp": {
      "type": "http",
      "url": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`;

export const getCursorConfig = (apiKey: string, includeComment: boolean = true) =>
  includeComment
    ? `// 설정 위치: ~/.cursor/mcp.json
{
  "mcpServers": {
    "codebase-blog-mcp": {
      "url": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`
    : `{
  "mcpServers": {
    "codebase-blog-mcp": {
      "url": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`;

export const getClaudeCodeConfig = (apiKey: string, includeComment: boolean = true) =>
  includeComment
    ? `# 터미널에서 실행
claude mcp add codebase-blog-mcp --url https://mcp.codebase.blog/mcp --header "Authorization: Bearer ${apiKey}"`
    : `claude mcp add codebase-blog-mcp --url https://mcp.codebase.blog/mcp --header "Authorization: Bearer ${apiKey}"`;

export const getWindsurfConfig = (apiKey: string, includeComment: boolean = true) =>
  includeComment
    ? `// 설정 위치: ~/.windsurf/mcp.json
{
  "mcpServers": {
    "codebase-blog-mcp": {
      "serverUrl": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`
    : `{
  "mcpServers": {
    "codebase-blog-mcp": {
      "serverUrl": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`;

export const getVSCodeConfig = (apiKey: string, includeComment: boolean = true) =>
  includeComment
    ? `// 설정 위치: 프로젝트 루트/.mcp.json
{
  "mcpServers": {
    "codebase-blog-mcp": {
      "url": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`
    : `{
  "mcpServers": {
    "codebase-blog-mcp": {
      "url": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`;

export const getGeminiConfig = (apiKey: string, includeComment: boolean = true) =>
  includeComment
    ? `// 설정 위치: ~/.gemini/mcp.json
{
  "mcpServers": {
    "codebase-blog-mcp": {
      "httpUrl": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}`
    : `{
  "mcpServers": {
    "codebase-blog-mcp": {
      "httpUrl": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}`;

export const getQwenConfig = (apiKey: string, includeComment: boolean = true) =>
  includeComment
    ? `// 설정 위치: ~/.qwen/mcp.json
{
  "mcpServers": {
    "codebase-blog-mcp": {
      "httpUrl": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}`
    : `{
  "mcpServers": {
    "codebase-blog-mcp": {
      "httpUrl": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}`;

export const getCodexEnvSnippet = (apiKey: string, includeComment: boolean = true) =>
  includeComment
    ? `# macOS / Linux: ~/.zshrc 또는 ~/.bashrc
export CODEBASE_MCP_TOKEN="${apiKey}"`
    : `export CODEBASE_MCP_TOKEN="${apiKey}"`;

export const getCodexWindowsEnvSnippet = (apiKey: string, includeComment: boolean = true) =>
  includeComment
    ? `# 현재 PowerShell 세션에서 즉시 반영
$Env:CODEBASE_MCP_TOKEN = "${apiKey}"`
    : `$Env:CODEBASE_MCP_TOKEN = "${apiKey}"`;

export const getCodexWindowsPersistentSnippet = (apiKey: string, includeComment: boolean = true) =>
  includeComment
    ? `# 새 PowerShell을 열 때마다 유지 (실행 후 새 터미널을 열어야 적용)
setx CODEBASE_MCP_TOKEN "${apiKey}"`
    : `setx CODEBASE_MCP_TOKEN "${apiKey}"`;

export const getCodexConfig = (apiKey: string, includeComment: boolean = true) =>
  includeComment
    ? `# 설정 위치: ~/.codex/config.toml
# 모델 설정이 이미 있다면 [features]/[mcp_servers] 블록만 추가하세요.
model = "gpt-5-codex"
model_reasoning_effort = "high"

[features]
rmcp_client = true

[mcp_servers.codebase-blog-mcp]
url = "https://mcp.codebase.blog/mcp"
bearer_token_env_var = "CODEBASE_MCP_TOKEN"
http_headers = { Accept = "application/json, text/event-stream" }`
    : `model = "gpt-5-codex"
model_reasoning_effort = "high"

[features]
rmcp_client = true

[mcp_servers.codebase-blog-mcp]
url = "https://mcp.codebase.blog/mcp"
bearer_token_env_var = "CODEBASE_MCP_TOKEN"
http_headers = { Accept = "application/json, text/event-stream" }`;
