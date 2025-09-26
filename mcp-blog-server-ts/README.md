# Codebase Blog MCP Server (TypeScript)

A Model Context Protocol (MCP) server for codebase blog posting with OAuth2 authentication.

## 📂 Claude 설정 구조 이해하기

### `.claude/` 폴더란?
Claude Code는 프로젝트별 설정을 `.claude/` 폴더에 저장합니다:

```
프로젝트/
└── .claude/
    ├── settings.json       # 팀 공유 설정 (Git 커밋)
    └── settings.local.json # 개인 설정 (Git 무시)
```

- **settings.json**: MCP 서버 권한, 프로젝트 표준 설정 (팀원과 공유)
- **settings.local.json**: API 키, 로컬 경로 등 개인 설정 (Git에서 제외)

## 🚀 OAuth2 인증 설정 (새로운 방식)

### 1. OAuth 클라이언트 생성

블로그 백엔드에서 OAuth 클라이언트를 먼저 생성해야 합니다:

1. 블로그 웹사이트에 로그인
2. **설정 > OAuth 클라이언트 관리** 페이지로 이동
3. **"새 OAuth 클라이언트 생성"** 버튼 클릭
4. 다음 정보 입력:
   - **클라이언트 이름**: `MCP Blog Auto-poster` (예시)
   - **리다이렉트 URI**: `http://localhost:7777/callback`
   - **설명**: `MCP 서버를 통한 자동 포스팅용 클라이언트`
5. 생성 완료 후 **Client ID**와 **Client Secret** 복사 (Secret은 한 번만 표시됩니다!)

### 2. 환경 변수 설정

`.env` 파일 생성 (`.env.example` 파일 참고):

```env
# OAuth2 Configuration
API_URL=http://localhost:3000/api/v1

# 위에서 생성한 OAuth 클라이언트 정보
OAUTH_CLIENT_ID=your-oauth-client-id-here
OAUTH_CLIENT_SECRET=your-oauth-client-secret-here

# 리다이렉트 URI (변경하지 마세요)
OAUTH_REDIRECT_URI=http://localhost:7777/callback
LOCAL_SERVER_PORT=7777

LOG_LEVEL=info
```

### 3. 인증 플로우

MCP 서버가 처음 실행되거나 토큰이 만료되면:
1. 자동으로 브라우저가 열립니다
2. 블로그에 로그인합니다 (이미 로그인되어 있으면 스킵)
3. MCP 클라이언트의 권한 요청을 승인합니다
4. 자동으로 인증이 완료되고 토큰이 저장됩니다

### 토큰 저장 위치
- 토큰은 `~/.mcp-blog-auth.json` 파일에 암호화되어 저장됩니다
- 토큰이 만료되면 자동으로 갱신됩니다

## Installation

### 수동 설정 (선택사항)

자동 설정이 실패한 경우 수동으로 설정:

#### 1. Claude Desktop 전역 설정
`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codebase_blog": {
      "command": "npx",
      "args": ["@codebase/mcp-blog-server"],
      "env": {
        "API_URL": "http://localhost:3000/api/v1",
        "OAUTH_CLIENT_ID": "your-oauth-client-id",
        "OAUTH_CLIENT_SECRET": "your-oauth-client-secret",
        "OAUTH_REDIRECT_URI": "http://localhost:7777/callback",
        "LOCAL_SERVER_PORT": "7777"
      }
    }
  }
}
```

#### 2. 프로젝트 설정 파일 생성
`.claude/settings.json` (팀 공유):
```json
{
  "permissions": {
    "allow": [
      "mcp__codebase_blog__authenticate",
      "mcp__codebase_blog__create_post",
      "mcp__codebase_blog__create_post_from_file",
      "mcp__codebase_blog__diagnose_connection"
    ],
    "defaultMode": "acceptEdits"
  },
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": ["codebase_blog"]
}
```

### 3. Restart Claude Desktop

The MCP server will be available in Claude with these tools:
- `authenticate` - Verify API credentials
- `create_post` - Create a blog post from content
- `create_post_from_file` - Create a blog post from a markdown file
- `diagnose_connection` - Check connection status

## Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-blog-server-ts.git
cd mcp-blog-server-ts

# Install dependencies
pnpm install

# Build
pnpm build

# Run in stdio mode (for Claude Desktop)
pnpm start:stdio

# Run in HTTP mode (for testing)
pnpm start:http
```

## Features

- 🔐 Secure OAuth2 authentication with PKCE flow
- 🌐 Automatic browser-based authentication
- 🔄 Automatic token refresh
- 📝 Markdown to HTML conversion
- 🏷️ Tag support
- 📁 File-based post creation
- 🚀 Fast TypeScript implementation
- 🔄 Multiple transport support (stdio, HTTP, SSE)

## 🔧 Troubleshooting

### OAuth2 인증 문제

#### 문제: "Failed to authenticate" 에러
**해결방법:**
1. OAuth 클라이언트 ID와 Secret이 올바른지 확인
2. 리다이렉트 URI가 정확히 `http://localhost:7777/callback`인지 확인
3. 포트 7777이 다른 프로그램에서 사용 중이 아닌지 확인

#### 문제: 브라우저가 자동으로 열리지 않음
**해결방법:**
1. 수동으로 브라우저를 열고 터미널에 표시된 URL로 이동
2. 로그인 후 권한을 승인

#### 문제: 토큰이 만료되었다는 에러
**해결방법:**
- 토큰은 자동으로 갱신되어야 하지만, 문제가 있으면 `~/.mcp-blog-auth.json` 파일을 삭제하고 재인증

### 포트 충돌 문제

포트 7777이 이미 사용 중인 경우:
```bash
# 포트 사용 중인 프로세스 확인
lsof -i :7777

# 필요하면 프로세스 종료
kill -9 [PID]
```

### 디버그 모드

더 자세한 로그를 보려면 환경 변수에 다음을 추가:
```env
LOG_LEVEL=debug
```

## Requirements

- Node.js 18+
- Blog backend with OAuth2 support
- 웹 브라우저 (OAuth2 인증용)

## License

MIT