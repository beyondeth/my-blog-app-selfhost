const MCP_BASE_URL = (
  process.env.NEXT_PUBLIC_MCP_BASE_URL || 'http://localhost:3002'
)
  .trim()
  .replace(/\/+$/, '');
const MCP_URL = `${MCP_BASE_URL}/mcp`;
const MCP_REMOTE_URL = `${MCP_BASE_URL}/mcp-remote`;
const MCP_USES_HTTP = MCP_BASE_URL.toLowerCase().startsWith('http://');
const MCPORTER_SCOPE = MCP_USES_HTTP ? 'project' : 'home';
const MCPORTER_ALLOW_HTTP = MCP_USES_HTTP ? ' --allow-http' : '';
const MCPORTER_REDIRECT_URL = `http://127.0.0.1:${MCP_USES_HTTP ? '33334' : '33333'}/callback`;
const MCP_ENVIRONMENT_LABEL = MCP_USES_HTTP ? '로컬 HTTP' : 'HTTPS';
const MCPORTER = 'npx -y mcporter@0.13.7';

export const getMcpJsonConfig = (apiKey: string) => `{
  "mcpServers": {
    "aigory-blog-mcp": {
      "type": "http",
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`;

export const getAntigravityConfig = (
  apiKey: string,
  includeComment: boolean = true,
) =>
  includeComment
    ? `// Antigravity mcp_config.json
{
  "mcpServers": {
    "aigory-blog-mcp": {
      "serverUrl": "https://mcp.aigory.com/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}`
    : `{
  "mcpServers": {
    "aigory-blog-mcp": {
      "serverUrl": "https://mcp.aigory.com/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}`;

const SKILL_SOURCE_REPO = 'beyondeth/codebase-skills';
const SKILL_NAME = 'codebase-skill';
const SKILL_AGENTS = '-a codex -a claude-code -a gemini-cli -a antigravity';
const maybeGlobal = (isGlobal: boolean) => (isGlobal ? ' -g' : '');

export const getSkillsInstallSnippet = (
  includeComment: boolean = true,
  isGlobal: boolean = true,
) => {
  const command = `npx -y skills add ${SKILL_SOURCE_REPO} --skill ${SKILL_NAME} ${SKILL_AGENTS}${maybeGlobal(isGlobal)} -y`;
  return includeComment ? `# 멀티 에이전트 설치\n${command}` : command;
};

export const getSkillsPerAgentInstallSnippet = (
  includeComment: boolean = true,
  isGlobal: boolean = true,
) => {
  const command = [
    'codex',
    'claude-code',
    'gemini-cli',
    'antigravity',
  ]
    .map(
      (agent) =>
        `npx -y skills add ${SKILL_SOURCE_REPO} --skill ${SKILL_NAME} -a ${agent}${maybeGlobal(isGlobal)} -y`,
    )
    .join('\n');
  return includeComment ? `# 에이전트별 설치\n${command}` : command;
};

export const getSkillsMaintenanceSnippet = (
  includeComment: boolean = true,
  isGlobal: boolean = true,
) => {
  const command = `npx -y skills check\nnpx -y skills update\nnpx -y skills remove ${SKILL_NAME} ${SKILL_AGENTS}${maybeGlobal(isGlobal)} -y`;
  return includeComment ? `# 업데이트/제거\n${command}` : command;
};

export const getCursorConfig = (
  apiKey: string,
  includeComment: boolean = true,
) =>
  includeComment
    ? `// 설정 위치: ~/.cursor/mcp.json
{
  "mcpServers": {
    "aigory-blog-mcp": {
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`
    : `{
  "mcpServers": {
    "aigory-blog-mcp": {
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`;

export const getClaudeCodeConfig = (
  apiKey: string,
  includeComment: boolean = true,
) =>
  includeComment
    ? `# 터미널에서 실행
claude mcp add aigory-blog-mcp --url ${MCP_URL} --header "Authorization: Bearer ${apiKey}"`
    : `claude mcp add aigory-blog-mcp --url ${MCP_URL} --header "Authorization: Bearer ${apiKey}"`;

export const getWindsurfConfig = (
  apiKey: string,
  includeComment: boolean = true,
) =>
  includeComment
    ? `// 설정 위치: ~/.windsurf/mcp.json
{
  "mcpServers": {
    "aigory-blog-mcp": {
      "serverUrl": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`
    : `{
  "mcpServers": {
    "aigory-blog-mcp": {
      "serverUrl": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`;

export const getVSCodeConfig = (
  apiKey: string,
  includeComment: boolean = true,
) =>
  includeComment
    ? `// 설정 위치: 프로젝트 루트/.mcp.json
{
  "mcpServers": {
    "aigory-blog-mcp": {
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`
    : `{
  "mcpServers": {
    "aigory-blog-mcp": {
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`;

export const getGeminiConfig = (
  apiKey: string,
  includeComment: boolean = true,
) =>
  includeComment
    ? `// 설정 위치: ~/.gemini/mcp.json
{
  "mcpServers": {
    "aigory-blog-mcp": {
      "httpUrl": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${apiKey}",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}`
    : `{
  "mcpServers": {
    "aigory-blog-mcp": {
      "httpUrl": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${apiKey}",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}`;

export const getQwenConfig = (
  apiKey: string,
  includeComment: boolean = true,
) =>
  includeComment
    ? `// 설정 위치: ~/.qwen/mcp.json
{
  "mcpServers": {
    "aigory-blog-mcp": {
      "httpUrl": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${apiKey}",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}`
    : `{
  "mcpServers": {
    "aigory-blog-mcp": {
      "httpUrl": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${apiKey}",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}`;

export const getMcporterSetupSnippet = (
  apiKey: string,
  includeComment: boolean = true,
) => {
  const configCommand = `${MCPORTER} config add aigory-blog-oauth --url ${MCP_REMOTE_URL} --auth oauth${MCPORTER_ALLOW_HTTP} --oauth-redirect-url ${MCPORTER_REDIRECT_URL} --scope ${MCPORTER_SCOPE}`;
  const authCommand = `${MCPORTER} auth aigory-blog-oauth`;

  return includeComment
    ? `# 현재 MCP 환경: ${MCP_ENVIRONMENT_LABEL}
${configCommand}

# 브라우저 OAuth 인증 (초기 1회)
${authCommand}`
    : `${configCommand}
${authCommand}`;
};

export const getMcporterUsageSnippet = (includeComment: boolean = true) =>
  includeComment
    ? `# 0) 도구 스키마 확인 (5개 툴)
${MCPORTER} list aigory-blog-oauth --schema

# 1) 안전 게이트 (권장)
#    - check_auth 결과에 "error" 키가 있으면 발행 중단
AUTH_OUT=$(${MCPORTER} call aigory-blog-oauth.check_auth --output json 2>&1 || true)
echo "$AUTH_OUT"
if echo "$AUTH_OUT" | grep -q '"error"' || ! echo "$AUTH_OUT" | grep -q '인증 방식 : OAuth 2.1'; then
  echo "[STOP] OAuth verification failed. create_post not executed."
  exit 1
fi

# 2) 글쓰기 스타일 가이드 조회
${MCPORTER} call 'aigory-blog-oauth.get_writing_style_guide(style: "default")'

# 3) (선택) 이미지 업로드 1단계
${MCPORTER} call 'aigory-blog-oauth.get_image_upload_url(mimeType: "image/webp", fileSize: 245760)'

# 4) (선택) 응답 uploadUrl로 파일 PUT
curl -X PUT -H "Content-Type: image/webp" -T ./cover.webp "UPLOAD_URL_FROM_PREVIOUS_STEP"

# 5) (선택) 이미지 업로드 2단계
${MCPORTER} call 'aigory-blog-oauth.finalize_uploaded_image(tempId: "SIGNED_INTENT", fileKey: "uploads/...", fileName: "generated.webp", mimeType: "image/webp", fileSize: 245760)'

# 6) 포스트 발행
${MCPORTER} call 'aigory-blog-oauth.create_post(title: "MCP 자동포스팅 예시", content_markdown: "## Hello\\n\\nmcporter로 발행한 글입니다.", category: "Tech", tags: ["mcp","automation"], attachedFileIds: ["FILE_ID"], thumbnailImageId: "FILE_ID")'`
    : `${MCPORTER} list aigory-blog-oauth --schema
AUTH_OUT=$(${MCPORTER} call aigory-blog-oauth.check_auth --output json 2>&1 || true)
echo "$AUTH_OUT"
if echo "$AUTH_OUT" | grep -q '"error"' || ! echo "$AUTH_OUT" | grep -q '인증 방식 : OAuth 2.1'; then
  echo "[STOP] OAuth verification failed. create_post not executed."
  exit 1
fi
${MCPORTER} call 'aigory-blog-oauth.get_writing_style_guide(style: "default")'
${MCPORTER} call 'aigory-blog-oauth.get_image_upload_url(mimeType: "image/webp", fileSize: 245760)'
curl -X PUT -H "Content-Type: image/webp" -T ./cover.webp "UPLOAD_URL_FROM_PREVIOUS_STEP"
${MCPORTER} call 'aigory-blog-oauth.finalize_uploaded_image(tempId: "SIGNED_INTENT", fileKey: "uploads/...", fileName: "generated.webp", mimeType: "image/webp", fileSize: 245760)'
${MCPORTER} call 'aigory-blog-oauth.create_post(title: "MCP 자동포스팅 예시", content_markdown: "## Hello\\n\\nmcporter로 발행한 글입니다.", category: "Tech", tags: ["mcp","automation"], attachedFileIds: ["FILE_ID"], thumbnailImageId: "FILE_ID")'`;

export const getMcporterOAuthSnippet = (
  apiKey: string,
  includeComment: boolean = true,
) =>
  includeComment
    ? `# OAuth 로그인 화면이 안 뜨면
# - 이미 aigory.com 세션이 살아있어서 자동 승인될 수 있습니다.
# - 강제 로그인 화면 확인이 필요하면 브라우저 시크릿 모드에서 아래 명령을 다시 실행하세요.
#   ${MCPORTER} auth aigory-blog-oauth --reset

# OAuth 대신 API Key 모드를 쓰는 경우 (선택)
export AIGORY_MCP_TOKEN="${apiKey}"
${MCPORTER} config add aigory-blog-mcp --url ${MCP_URL}${MCPORTER_ALLOW_HTTP} --header "Authorization=Bearer \${AIGORY_MCP_TOKEN}" --header "Accept=application/json, text/event-stream" --scope ${MCPORTER_SCOPE}
${MCPORTER} call aigory-blog-mcp.check_auth`
    : `${MCPORTER} auth aigory-blog-oauth --reset
export AIGORY_MCP_TOKEN="${apiKey}"
${MCPORTER} config add aigory-blog-mcp --url ${MCP_URL}${MCPORTER_ALLOW_HTTP} --header "Authorization=Bearer \${AIGORY_MCP_TOKEN}" --header "Accept=application/json, text/event-stream" --scope ${MCPORTER_SCOPE}
${MCPORTER} call aigory-blog-mcp.check_auth`;

export const getCodexEnvSnippet = (
  apiKey: string,
  includeComment: boolean = true,
) =>
  includeComment
    ? `# macOS / Linux: ~/.zshrc 또는 ~/.bashrc
export AIGORY_MCP_TOKEN="${apiKey}"`
    : `export AIGORY_MCP_TOKEN="${apiKey}"`;

export const getCodexWindowsEnvSnippet = (
  apiKey: string,
  includeComment: boolean = true,
) =>
  includeComment
    ? `# 현재 PowerShell 세션에서 즉시 반영
$Env:AIGORY_MCP_TOKEN = "${apiKey}"`
    : `$Env:AIGORY_MCP_TOKEN = "${apiKey}"`;

export const getCodexWindowsPersistentSnippet = (
  apiKey: string,
  includeComment: boolean = true,
) =>
  includeComment
    ? `# 새 PowerShell을 열 때마다 유지 (실행 후 새 터미널을 열어야 적용)
setx AIGORY_MCP_TOKEN "${apiKey}"`
    : `setx AIGORY_MCP_TOKEN "${apiKey}"`;

export const getCodexConfig = (
  apiKey: string,
  includeComment: boolean = true,
) =>
  includeComment
    ? `# 설정 위치: ~/.codex/config.toml
# 프로젝트에만 적용하려면 신뢰된 프로젝트의 .codex/config.toml에 추가하세요.

[mcp_servers.aigory-blog-mcp]
url = "${MCP_URL}"
bearer_token_env_var = "AIGORY_MCP_TOKEN"
http_headers = { Accept = "application/json, text/event-stream" }`
    : `[mcp_servers.aigory-blog-mcp]
url = "${MCP_URL}"
bearer_token_env_var = "AIGORY_MCP_TOKEN"
http_headers = { Accept = "application/json, text/event-stream" }`;
