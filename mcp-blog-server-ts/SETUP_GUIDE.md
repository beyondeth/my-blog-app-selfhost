# MCP Blog Server 설정 가이드

## 🚀 빠른 시작

### 1. 패키지 설치
```bash
# npm
npm install @codebase/mcp-blog-server

# pnpm
pnpm add @codebase/mcp-blog-server

# yarn
yarn add @codebase/mcp-blog-server
```

### 2. Claude Desktop 자동 설정
```bash
npm run setup
```

이 명령어는 다음을 자동으로 수행합니다:
- Claude Desktop 전역 설정 업데이트
- 프로젝트 `.claude` 폴더 생성
- MCP 서버 권한 설정
- 환경 변수 파일 생성

### 3. Claude Desktop 재시작
설정 완료 후 Claude Desktop을 완전히 종료하고 다시 시작하세요.

## 📁 설정 파일 구조

### `.claude/` 폴더
프로젝트 루트에 생성되는 Claude Desktop 프로젝트별 설정 폴더입니다.

```
.claude/
└── settings.local.json    # 프로젝트별 권한 및 MCP 서버 설정
```

#### `settings.local.json` 구조
```json
{
  "permissions": {
    "allow": [
      "mcp__codebase_blog__authenticate",
      "mcp__codebase_blog__create_post",
      "mcp__codebase_blog__create_post_from_file",
      "mcp__codebase_blog__diagnose_connection"
    ],
    "deny": [],
    "defaultMode": "acceptEdits"
  },
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": ["codebase_blog"]
}
```

### Claude Desktop 전역 설정
`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "codebase_blog": {
      "command": "node",
      "args": ["path/to/dist/index.js", "--transport", "stdio"],
      "cwd": "path/to/project",
      "env": {
        "BLOG_API_KEY_ID": "your_api_key_id",
        "BLOG_API_KEY_SECRET": "your_api_key_secret",
        "BLOG_API_URL": "http://localhost:3000/api/v1",
        "BLOG_POSTS_DIR": "path/to/project"
      }
    }
  }
}
```

## 🔧 수동 설정 (선택사항)

자동 설정이 실패하거나 수동으로 설정하려면:

### 1. API 키 생성
1. 블로그 관리 페이지에서 API 키 생성
2. Key ID와 Secret 복사

### 2. 환경 변수 설정
`.env` 파일 생성:
```env
BLOG_API_KEY_ID=akid_xxx
BLOG_API_KEY_SECRET=aks_xxx
BLOG_API_URL=http://localhost:3000/api/v1
BLOG_POSTS_DIR=/path/to/your/project
```

### 3. Claude Desktop 설정
1. Claude Desktop 설정 파일 열기
2. `mcpServers` 섹션에 서버 추가
3. 환경 변수 설정

### 4. 프로젝트 설정
`.claude/settings.local.json` 파일 생성 후 권한 설정

## 🐛 문제 해결

### MCP 서버가 연결되지 않음
1. Claude Desktop 완전 재시작
2. 환경 변수 확인
3. `npm run setup` 재실행

### API 인증 실패
1. API 키 유효성 확인
2. API 서버 실행 확인
3. 네트워크 연결 확인

### 설정 파일을 찾을 수 없음
- macOS: `~/Library/Application Support/Claude/`
- Windows: `%APPDATA%\Claude\`
- Linux: `~/.config/Claude/`

## 📝 주의사항

1. **API 키 보안**: `.env` 파일을 git에 커밋하지 마세요
2. **Claude Desktop 재시작**: 설정 변경 후 반드시 재시작
3. **권한 설정**: MCP 서버 도구 사용을 위해 권한 허용 필요

## 🔗 관련 문서
- [MCP 프로토콜 문서](https://modelcontextprotocol.io)
- [Claude Desktop 문서](https://claude.ai/docs)