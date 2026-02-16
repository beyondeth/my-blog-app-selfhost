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

export const getMcporterSetupSnippet = (apiKey: string, includeComment: boolean = true) =>
  includeComment
    ? `# PROD (일반 사용자)
npx -y mcporter config add codebase-blog-oauth --url https://mcp.codebase.blog/mcp-remote --auth oauth --oauth-redirect-url http://127.0.0.1:33333/callback --scope home

# DEV (테스트용)
npx -y mcporter config add codebase-blog-oauth-dev --url http://localhost:3002/mcp-remote --auth oauth --allow-http --oauth-redirect-url http://127.0.0.1:33334/callback --scope project

# 브라우저 OAuth 인증 (초기 1회)
npx -y mcporter auth codebase-blog-oauth`
    : `npx -y mcporter config add codebase-blog-oauth --url https://mcp.codebase.blog/mcp-remote --auth oauth --oauth-redirect-url http://127.0.0.1:33333/callback --scope home
npx -y mcporter config add codebase-blog-oauth-dev --url http://localhost:3002/mcp-remote --auth oauth --allow-http --oauth-redirect-url http://127.0.0.1:33334/callback --scope project
npx -y mcporter auth codebase-blog-oauth`;

export const getMcporterUsageSnippet = (includeComment: boolean = true) =>
  includeComment
    ? `# 0) 도구 스키마 확인 (5개 툴)
npx -y mcporter list codebase-blog-oauth --schema

# 1) 안전 게이트 (권장)
#    - check_auth 결과에 "error" 키가 있으면 발행 중단
AUTH_OUT=$(npx -y mcporter call codebase-blog-oauth.check_auth --output json 2>&1 || true)
echo "$AUTH_OUT"
if echo "$AUTH_OUT" | rg -q '"error"'; then
  echo "[STOP] OAuth verification failed. create_post not executed."
  exit 1
fi

# 2) 글쓰기 스타일 가이드 조회
npx -y mcporter call 'codebase-blog-oauth.get_writing_style_guide(style: "default")'

# 3) (선택) 이미지 업로드 1단계
npx -y mcporter call 'codebase-blog-oauth.get_image_upload_url(mimeType: "image/webp", fileSize: 245760)'

# 4) (선택) 응답 uploadUrl로 파일 PUT
curl -X PUT -H "Content-Type: image/webp" -T ./cover.webp "UPLOAD_URL_FROM_PREVIOUS_STEP"

# 5) (선택) 이미지 업로드 2단계
npx -y mcporter call 'codebase-blog-oauth.finalize_uploaded_image(fileKey: "uploads/...", mimeType: "image/webp", fileSize: 245760)'

# 6) 포스트 발행
npx -y mcporter call 'codebase-blog-oauth.create_post(title: "MCP 자동포스팅 예시", content_markdown: "# Hello\\n\\nmcporter로 발행한 글입니다.", category: "Tech", tags: ["mcp","automation"])'`
    : `npx -y mcporter list codebase-blog-oauth --schema
AUTH_OUT=$(npx -y mcporter call codebase-blog-oauth.check_auth --output json 2>&1 || true)
echo "$AUTH_OUT"
if echo "$AUTH_OUT" | rg -q '"error"'; then
  echo "[STOP] OAuth verification failed. create_post not executed."
  exit 1
fi
npx -y mcporter call 'codebase-blog-oauth.get_writing_style_guide(style: "default")'
npx -y mcporter call 'codebase-blog-oauth.get_image_upload_url(mimeType: "image/webp", fileSize: 245760)'
curl -X PUT -H "Content-Type: image/webp" -T ./cover.webp "UPLOAD_URL_FROM_PREVIOUS_STEP"
npx -y mcporter call 'codebase-blog-oauth.finalize_uploaded_image(fileKey: "uploads/...", mimeType: "image/webp", fileSize: 245760)'
npx -y mcporter call 'codebase-blog-oauth.create_post(title: "MCP 자동포스팅 예시", content_markdown: "# Hello\\n\\nmcporter로 발행한 글입니다.", category: "Tech", tags: ["mcp","automation"])'`;

export const getMcporterOAuthSnippet = (apiKey: string, includeComment: boolean = true) =>
  includeComment
    ? `# OAuth 로그인 화면이 안 뜨면
# - 이미 codebase.blog 세션이 살아있어서 자동 승인될 수 있습니다.
# - 강제 로그인 화면 확인이 필요하면 브라우저 시크릿 모드에서 아래 명령을 다시 실행하세요.
#   npx -y mcporter auth codebase-blog-oauth --reset

# OAuth 대신 API Key 모드를 쓰는 경우 (선택)
export CODEBASE_MCP_TOKEN="${apiKey}"
npx -y mcporter config add codebase-blog-mcp --url https://mcp.codebase.blog/mcp --header "Authorization=Bearer \${CODEBASE_MCP_TOKEN}" --header "Accept=application/json, text/event-stream" --scope home
npx -y mcporter call codebase-blog-mcp.check_auth`
    : `npx -y mcporter auth codebase-blog-oauth --reset
export CODEBASE_MCP_TOKEN="${apiKey}"
npx -y mcporter config add codebase-blog-mcp --url https://mcp.codebase.blog/mcp --header "Authorization=Bearer \${CODEBASE_MCP_TOKEN}" --header "Accept=application/json, text/event-stream" --scope home
npx -y mcporter call codebase-blog-mcp.check_auth`;

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
