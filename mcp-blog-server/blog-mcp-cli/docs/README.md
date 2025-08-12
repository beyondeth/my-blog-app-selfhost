# blog-mcp-cli

Claude Code와 함께 사용하는 블로그 자동 포스팅 도구 / Blog auto-posting tool for Claude Code

[한국어](#한국어) | [English](#english)

---

## 한국어

### 🚀 소개

`blog-mcp-cli`는 Claude Code에서 블로그 포스트를 쉽게 작성하고 발행할 수 있게 해주는 도구입니다. 마크다운 파일을 작성하면 자동으로 블로그에 포스팅됩니다!

### 📦 설치

```bash
npm install -g blog-mcp-cli
```

### 🔧 설정

1. **초기 설정 실행**
   ```bash
   # 전역 설정 (기본값)
   blog-mcp init
   
   # 로컬 프로젝트 설정 (현재 폴더에 .blog-mcp 생성)
   blog-mcp init --local
   ```
   
   다음 정보를 입력하세요:
   - 블로그 API 주소 (예: http://localhost:3000)
   - 로그인 이메일
   - 로그인 비밀번호

2. **MCP 서버 시작**
   ```bash
   blog-mcp start
   ```

3. **Claude Code 재시작**
   - 설정이 자동으로 적용됩니다
   - Claude Code를 재시작하세요

### 💻 사용법

Claude Code에서 다음과 같이 사용하세요:

```
"마크다운 파일을 블로그에 포스팅해줘"
"새 블로그 포스트 작성해줘"
"draft 목록 보여줘"
```

### 📝 명령어

- `blog-mcp init` - 초기 설정
- `blog-mcp start` - 서버 시작 (백그라운드)
- `blog-mcp stop` - 서버 중지
- `blog-mcp status` - 서버 상태 확인
- `blog-mcp logs` - 로그 확인
- `blog-mcp logs -f` - 실시간 로그 확인

### ⚙️ 요구사항

- Node.js 16.0.0 이상
- Python 3.8 이상 (자동 설치됨)

### 🔍 문제 해결

**서버가 시작되지 않아요**
```bash
blog-mcp status  # 상태 확인
blog-mcp logs    # 에러 로그 확인
```

**설정을 다시 하고 싶어요**
```bash
blog-mcp init    # 다시 설정
```

---

## English

### 🚀 Introduction

`blog-mcp-cli` is a tool that makes it easy to write and publish blog posts from Claude Code. Write a markdown file and it automatically posts to your blog!

### 📦 Installation

```bash
npm install -g blog-mcp-cli
```

### 🔧 Setup

1. **Run initial setup**
   ```bash
   # Global configuration (default)
   blog-mcp init
   
   # Local project configuration (creates .blog-mcp in current folder)
   blog-mcp init --local
   ```
   
   Enter the following information:
   - Blog API URL (e.g., http://localhost:3000)
   - Login email
   - Login password

2. **Start MCP server**
   ```bash
   blog-mcp start
   ```

3. **Restart Claude Code**
   - Settings are applied automatically
   - Restart Claude Code

### 💻 Usage

Use in Claude Code like this:

```
"Post this markdown file to my blog"
"Create a new blog post"
"Show me draft list"
```

### 📝 Commands

- `blog-mcp init` - Initialize configuration
- `blog-mcp start` - Start server (background)
- `blog-mcp stop` - Stop server
- `blog-mcp status` - Check server status
- `blog-mcp logs` - View logs
- `blog-mcp logs -f` - Follow logs in real-time

### ⚙️ Requirements

- Node.js >= 16.0.0
- Python >= 3.8 (installed automatically)

### 🔍 Troubleshooting

**Server won't start**
```bash
blog-mcp status  # Check status
blog-mcp logs    # Check error logs
```

**Want to reconfigure**
```bash
blog-mcp init    # Reconfigure
```

---

## License

MIT

## Author

sihyung