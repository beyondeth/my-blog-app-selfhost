# Codebase Blog MCP Server (TypeScript)

A Model Context Protocol (MCP) server for codebase blog posting with HMAC authentication.

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

## Installation

### 자동 설정 (권장)

```bash
# 1. 패키지 설치
npm install @codebase/mcp-blog-server

# 2. 자동 설정 실행
npm run setup
```

자동 설정이 수행하는 작업:
- ✅ Claude Desktop 전역 설정 업데이트
- ✅ `.claude/` 폴더 및 설정 파일 생성
- ✅ API 키 환경 변수 설정
- ✅ MCP 서버 권한 구성

## Quick Start

### 1. Set up environment variables

Create a `.env` file:

```env
BLOG_API_KEY_ID=your_api_key_id
BLOG_API_KEY_SECRET=your_api_key_secret
BLOG_API_URL=http://localhost:3000/api/v1
```

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
        "BLOG_API_KEY_ID": "your_api_key_id",
        "BLOG_API_KEY_SECRET": "your_api_key_secret",
        "BLOG_API_URL": "http://localhost:3000/api/v1"
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

## API Key Setup

Get your API keys from your blog dashboard:
1. Log in to your blog
2. Go to Settings → API Keys
3. Create a new API key
4. Copy the Key ID and Secret

## Features

- 🔐 Secure HMAC-SHA256 authentication
- 📝 Markdown to HTML conversion
- 🏷️ Tag support
- 📁 File-based post creation
- 🚀 Fast TypeScript implementation
- 🔄 Multiple transport support (stdio, HTTP, SSE)

## Requirements

- Node.js 18+
- Blog backend with API key support

## License

MIT