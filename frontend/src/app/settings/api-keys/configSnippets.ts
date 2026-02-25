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


export const getAntigravityConfig = (apiKey: string, includeComment: boolean = true) =>
  includeComment
    ? `// 설정 위치: Antigravity > Manage MCP Servers > View raw config (mcp_config.json)
// 주의: Antigravity 버전에 따라 URL 키명이 serverUrl/httpUrl로 다를 수 있습니다.
{
  "mcpServers": {
    "codebase-blog-mcp": {
      "serverUrl": "https://mcp.codebase.blog/mcp",
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
      "serverUrl": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}",
        "Accept": "application/json, text/event-stream"
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
claude mcp add --transport http codebase-blog-mcp https://mcp.codebase.blog/mcp --header "Authorization: Bearer ${apiKey}"`
    : `claude mcp add --transport http codebase-blog-mcp https://mcp.codebase.blog/mcp --header "Authorization: Bearer ${apiKey}"`;

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
    ? `// 설정 위치: ~/.gemini/settings.json
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

const SKILL_SOURCE_REPO = "beyondeth/codebase-skills";
const SKILL_NAME = "codebase-skill";
const SKILL_AGENTS = "-a codex -a claude-code -a gemini-cli -a antigravity";
const maybeGlobal = (isGlobal: boolean) => (isGlobal ? " -g" : "");

export const getSkillsInstallSnippet = (
  includeComment: boolean = true,
  isGlobal: boolean = true,
) =>
  includeComment
    ? `# 멀티 에이전트 설치 (권장)
# Codex + Claude Code + Gemini CLI + Antigravity
npx -y skills add ${SKILL_SOURCE_REPO} --skill ${SKILL_NAME} ${SKILL_AGENTS}${maybeGlobal(isGlobal)} -y`
    : `npx -y skills add ${SKILL_SOURCE_REPO} --skill ${SKILL_NAME} ${SKILL_AGENTS}${maybeGlobal(isGlobal)} -y`;

export const getSkillsPerAgentInstallSnippet = (
  includeComment: boolean = true,
  isGlobal: boolean = true,
) =>
  includeComment
    ? `# 에이전트별 설치
npx -y skills add ${SKILL_SOURCE_REPO} --skill ${SKILL_NAME} -a codex${maybeGlobal(isGlobal)} -y
npx -y skills add ${SKILL_SOURCE_REPO} --skill ${SKILL_NAME} -a claude-code${maybeGlobal(isGlobal)} -y
npx -y skills add ${SKILL_SOURCE_REPO} --skill ${SKILL_NAME} -a gemini-cli${maybeGlobal(isGlobal)} -y
npx -y skills add ${SKILL_SOURCE_REPO} --skill ${SKILL_NAME} -a antigravity${maybeGlobal(isGlobal)} -y`
    : `npx -y skills add ${SKILL_SOURCE_REPO} --skill ${SKILL_NAME} -a codex${maybeGlobal(isGlobal)} -y
npx -y skills add ${SKILL_SOURCE_REPO} --skill ${SKILL_NAME} -a claude-code${maybeGlobal(isGlobal)} -y
npx -y skills add ${SKILL_SOURCE_REPO} --skill ${SKILL_NAME} -a gemini-cli${maybeGlobal(isGlobal)} -y
npx -y skills add ${SKILL_SOURCE_REPO} --skill ${SKILL_NAME} -a antigravity${maybeGlobal(isGlobal)} -y`;

export const getSkillsVerifySnippet = (
  includeComment: boolean = true,
  isGlobal: boolean = true,
) =>
  includeComment
    ? `# 설치 확인
npx -y skills list${maybeGlobal(isGlobal)}`
    : `npx -y skills list${maybeGlobal(isGlobal)}`;

export const getSkillsMaintenanceSnippet = (
  includeComment: boolean = true,
  isGlobal: boolean = true,
) =>
  includeComment
    ? `# 업데이트 확인/적용
npx -y skills check
npx -y skills update

# 제거
npx -y skills remove ${SKILL_NAME} ${SKILL_AGENTS}${maybeGlobal(isGlobal)} -y`
    : `npx -y skills check
npx -y skills update
npx -y skills remove ${SKILL_NAME} ${SKILL_AGENTS}${maybeGlobal(isGlobal)} -y`;

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
# 기존 설정이 있다면 아래 MCP 블록만 추가하세요.

[mcp_servers.codebase-blog-mcp]
url = "https://mcp.codebase.blog/mcp"
bearer_token_env_var = "CODEBASE_MCP_TOKEN"
http_headers = { Accept = "application/json, text/event-stream" }`
    : `[mcp_servers.codebase-blog-mcp]
url = "https://mcp.codebase.blog/mcp"
bearer_token_env_var = "CODEBASE_MCP_TOKEN"
http_headers = { Accept = "application/json, text/event-stream" }`;
