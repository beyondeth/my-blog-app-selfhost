# 🚀 MCP Blog Auto-Poster

**Claude Desktop에서 블로그 포스트를 자동으로 생성하는 MCP(Model Context Protocol) 서버**

다양한 글쓰기 스타일(소설체, 코미디, 팟캐스트, 튜토리얼 등)로 블로그 포스트를 자동 작성하고, Proxy Server를 통해 안전하게 인증 및 포스팅을 수행합니다.

---

## 📖 목차

- [자동 포스팅 작동 원리](#-자동-포스팅-작동-원리)
- [설치 방법](#-설치-방법)
- [Claude Desktop 설정](#-claude-desktop-설정)
- [환경변수 설정](#-환경변수-설정)
- [Writing Styles 커스터마이징](#-writing-styles-커스터마이징)
- [사용 방법](#-사용-방법)
- [트러블슈팅](#-트러블슈팅)
- [개발자 가이드](#-개발자-가이드)

---

## 🎯 자동 포스팅 작동 원리

### 아키텍처 개요

```
┌──────────────────┐
│ Claude Desktop   │  사용자가 "블로그 포스트 작성해줘" 요청
│   (사용자)        │
└────────┬─────────┘
         │
         │ MCP Protocol (stdio)
         ↓
┌──────────────────┐
│  MCP Blog Server │  Writing Style 적용, 포스트 생성
│  (이 패키지)      │
└────────┬─────────┘
         │
         │ HTTP API
         ↓
┌──────────────────┐
│  Proxy Server    │  OAuth2 인증, 세션 관리
│  (port 3002)     │
└────────┬─────────┘
         │
         │ HTTP API
         ↓
┌──────────────────┐
│  Blog Backend    │  실제 블로그 데이터베이스
│  (port 3000)     │
└──────────────────┘
```

### 핵심 특징

1. **Proxy Server 패턴**: 보안 로직은 모두 Proxy Server에서 처리
2. **세션 영속성**: `~/.mcp-session` 파일에 세션 저장 (재시작해도 로그인 유지)
3. **다양한 글쓰기 스타일**: novel, default, comedy, podcast, tutorial
4. **환경변수 기반 설정**: Claude Desktop 설정 파일에서 스타일 변경 가능

---

## 📦 설치 방법

### 방법 1: 전역 설치 (권장)

빠른 실행 속도, 명령어 간단

```bash
npm install -g @codebase/mcp-blog-client
```

**장점**:
- ✅ 실행 속도 빠름
- ✅ 명령어 간단 (`mcp-blog-server`)
- ✅ 한 번만 설치

**단점**:
- ❌ 수동 설치 필요
- ❌ 업데이트 시 재설치 필요

### 방법 2: npx 방식 (설치 불필요)

설치 없이 바로 사용, 항상 최신 버전

```bash
# 설치 불필요! npx가 자동으로 다운로드/실행
npx -y @codebase/mcp-blog-client
```

**장점**:
- ✅ 설치 불필요
- ✅ 항상 최신 버전 자동 사용
- ✅ 여러 프로젝트에서 독립적 버전 관리

**단점**:
- ❌ 첫 실행 느림 (다운로드)
- ❌ 캐시에 패키지 쌓임

---

## ⚙️ Claude Desktop 설정

### 설정 파일 위치

**Mac**:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows**:
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux**:
```
~/.config/Claude/claude_desktop_config.json
```

### 설정 예시

#### 방법 1: 전역 설치 사용

```json
{
  "mcpServers": {
    "blog-auto-poster": {
      "command": "mcp-blog-server",
      "env": {
        "PROXY_SERVER_URL": "http://localhost:3002",
        "WRITING_STYLE": "novel"
      }
    }
  }
}
```

#### 방법 2: npx 사용

```json
{
  "mcpServers": {
    "blog-auto-poster": {
      "command": "npx",
      "args": ["-y", "@codebase/mcp-blog-client"],
      "env": {
        "PROXY_SERVER_URL": "http://localhost:3002",
        "WRITING_STYLE": "novel",
        "BLOG_POSTS_DIR": "/Users/username/Documents/blog-posts"
      }
    }
  }
}
```

### 설정 후 재시작

```bash
# Claude Desktop 완전 종료 후 재시작
# Mac: Cmd+Q로 종료
# Windows: 작업 관리자에서 종료
```

---

## 🔧 환경변수 설정

Claude Desktop 설정 파일의 `"env"` 섹션에서 환경변수를 설정합니다.

### 필수 환경변수

| 변수 | 설명 | 기본값 | 예시 |
|------|------|--------|------|
| `PROXY_SERVER_URL` | Proxy Server 주소 | `http://localhost:3002` | `http://localhost:3002` |

### 선택 환경변수

| 변수 | 설명 | 기본값 | 가능한 값 |
|------|------|--------|-----------|
| `WRITING_STYLE` | 글쓰기 스타일 | `default` | `novel`, `default`, `comedy`, `podcast`, `tutorial` |
| `BLOG_POSTS_DIR` | 로컬 저장 경로 | `~/Documents/codebase-mcp-posts` | `/Users/username/Documents/blog-posts` |

### 예시: 코미디 스타일로 변경

```json
{
  "mcpServers": {
    "blog-auto-poster": {
      "command": "mcp-blog-server",
      "env": {
        "PROXY_SERVER_URL": "http://localhost:3002",
        "WRITING_STYLE": "comedy"  // ← novel → comedy로 변경
      }
    }
  }
}
```

**변경 후 Claude Desktop 재시작 필수!**

---

## 🎨 Writing Styles 커스터마이징

### 사용 가능한 스타일

| 스타일 | 설명 | 특징 |
|--------|------|------|
| `novel` | 소설체, 서사적 글쓰기 | 감성적, 스토리텔링 중심, 개발자의 여정 |
| `default` | 기본 기술 블로그 스타일 | 명확하고 구조적인 설명 |
| `comedy` | 코미디, 유머러스한 글쓰기 | 재치있는 표현, 밈 활용 |
| `podcast` | 팟캐스트 대화체 | 친근한 대화 형식, 질문-답변 구조 |
| `tutorial` | 튜토리얼, 단계별 가이드 | 실습 중심, 단계별 설명 |

### 스타일 파일 구조

```
writing-styles/
├── novel.md       # 소설체 스타일
├── default.md     # 기본 스타일
├── comedy.md      # 코미디 스타일
├── podcast.md     # 팟캐스트 스타일
└── tutorial.md    # 튜토리얼 스타일
```

### 스타일 파일 구조 상세

각 스타일 파일(`.md`)은 다음 섹션으로 구성됩니다:

```markdown
---
style_name: "소설체 블로그 글쓰기"
language: "korean"
min_length: 2500
target_length: "4000-6000"
code_block_ratio: 0.05
ai_tag_required: true
auto_enhance: true
---

# === MCP SERVER INSTRUCTIONS ===
MCP 서버 전체 동작 지침...

# === CREATE_POST TOOL DESCRIPTION ===
create_post 도구의 설명...

# === QUALITY GUIDELINES PROMPT ===
품질 가이드라인...

# === BLOG POST TEMPLATE PROMPT ===
블로그 포스트 템플릿...

# === IMPROVE MARKDOWN PROMPT ===
마크다운 개선 지침...
```

### ✅ 수정 가능한 부분

#### 1. 메타데이터 (Front Matter)

```yaml
---
style_name: "내가 만든 커스텀 스타일"  # ✅ 수정 가능
language: "korean"                     # ✅ 수정 가능 (korean, english)
min_length: 3000                       # ✅ 수정 가능 (최소 글자 수)
target_length: "5000-7000"             # ✅ 수정 가능 (목표 글자 수 범위)
code_block_ratio: 0.1                  # ✅ 수정 가능 (코드 블록 비율)
ai_tag_required: true                  # ✅ 수정 가능 (AI 태그 필수 여부)
auto_enhance: true                     # ✅ 수정 가능 (자동 품질 개선)
---
```

#### 2. 섹션 내용

각 `# === SECTION NAME ===` 아래 내용은 **자유롭게 수정 가능**합니다:

```markdown
# === QUALITY GUIDELINES PROMPT ===

✅ 이 부분 전체를 원하는 대로 수정할 수 있습니다!

- 글쓰기 톤 조정
- 문장 스타일 변경
- 예시 추가/삭제
- 강조 사항 변경
```

**수정 예시**:
```markdown
# === QUALITY GUIDELINES PROMPT ===

## 나만의 글쓰기 규칙

### 톤 앤 매너
- 항상 존댓말 사용
- 기술 용어는 한글로 풀어서 설명
- 예시 코드는 반드시 Python 사용

### 구조
1. 문제 정의 (1문단)
2. 해결 방법 (3-5문단)
3. 코드 예시 (반드시 포함)
4. 결론 (1문단)

### 금지 사항
❌ 영어 기술 용어 그대로 사용 금지
❌ 코드 설명 없이 코드만 나열 금지
```

### ❌ 수정하면 안 되는 부분

#### 1. 섹션 구분자 (절대 변경 금지!)

```markdown
# === MCP SERVER INSTRUCTIONS ===        ❌ 변경 금지!
# === CREATE_POST TOOL DESCRIPTION ===   ❌ 변경 금지!
# === QUALITY GUIDELINES PROMPT ===      ❌ 변경 금지!
# === BLOG POST TEMPLATE PROMPT ===      ❌ 변경 금지!
# === IMPROVE MARKDOWN PROMPT ===        ❌ 변경 금지!
```

**이유**: 코드가 이 정확한 문자열을 찾아서 섹션을 파싱합니다.

#### 2. Front Matter 키 이름

```yaml
---
style_name: "..."      ❌ 키 이름 변경 금지 (값은 변경 가능)
language: "..."        ❌ 키 이름 변경 금지
min_length: 2500       ❌ 키 이름 변경 금지
target_length: "..."   ❌ 키 이름 변경 금지
code_block_ratio: 0.05 ❌ 키 이름 변경 금지
ai_tag_required: true  ❌ 키 이름 변경 금지
auto_enhance: true     ❌ 키 이름 변경 금지
---
```

**이유**: `style-loader.ts`가 이 키 이름들을 참조합니다.

### 🆕 새 스타일 추가 방법

#### 1단계: 기존 스타일 복사

```bash
cd writing-styles
cp novel.md mystyle.md
```

#### 2단계: 메타데이터 수정

```yaml
---
style_name: "나만의 글쓰기 스타일"
language: "korean"
min_length: 2000
target_length: "3000-5000"
code_block_ratio: 0.15
ai_tag_required: true
auto_enhance: true
---
```

#### 3단계: 각 섹션 내용 커스터마이징

```markdown
# === MCP SERVER INSTRUCTIONS ===

TypeScript MCP server for blog post creation.

🔴 나만의 규칙:
1. 항상 친근한 반말체 사용
2. 이모지 적극 활용
3. 코드 예시는 TypeScript만 사용

...
```

#### 4단계: 환경변수 설정

```json
{
  "mcpServers": {
    "blog-auto-poster": {
      "command": "mcp-blog-server",
      "env": {
        "PROXY_SERVER_URL": "http://localhost:3002",
        "WRITING_STYLE": "mystyle"  // ← 새 파일 이름 (확장자 제외)
      }
    }
  }
}
```

#### 5단계: Claude Desktop 재시작

```bash
# Claude Desktop 완전 종료 후 재실행
```

### 📝 스타일 테스트

새 스타일 추가 후:

1. Claude Desktop에서 "테스트 포스트 작성해줘" 요청
2. 생성된 포스트의 톤, 구조 확인
3. 원하는 스타일이 아니면 `.md` 파일 수정 후 재시작

### 🚨 주의사항

```markdown
# 올바른 예시 ✅
# === QUALITY GUIDELINES PROMPT ===
내용...

# 잘못된 예시 ❌ (띄어쓰기 틀림)
# === QUALITY GUIDELINES  PROMPT ===
내용...

# 잘못된 예시 ❌ (등호 개수 틀림)
# === QUALITY GUIDELINES PROMPT ==
내용...
```

**섹션 구분자는 정확히 일치해야 합니다!**

---

## 🎬 사용 방법

### 1. Proxy Server 실행 (필수!)

MCP 서버를 사용하기 전에 Proxy Server가 실행 중이어야 합니다:

```bash
cd /path/to/blog-backend
npm run start:dev
# 또는
pnpm start:dev

# Proxy Server는 port 3002에서 실행되어야 함
```

### 2. Claude Desktop에서 사용

#### 첫 실행: 인증

```
사용자: "블로그에 포스트 작성해줘"

Claude: authenticate 도구를 먼저 호출합니다...
        → 브라우저가 자동으로 열립니다
        → OAuth2 로그인 진행
        → 인증 완료!

        이제 포스트를 작성하겠습니다...
```

**인증은 한 번만 필요합니다!**
- 세션은 `~/.mcp-session` 파일에 저장됨
- Claude Desktop 재시작해도 로그인 유지
- 세션 만료 시에만 재인증 필요

#### 포스트 생성

```
사용자: "Next.js 14의 Server Actions에 대한 블로그 포스트 작성해줘"

Claude: create_post 도구를 사용하여 포스트를 생성합니다...

        ✅ 포스트 생성 완료!
        🔗 URL: /posts/nextjs-14-server-actions
        📁 로컬 파일: ~/blog-posts/nextjs-14-server-actions.md
```

#### 파일에서 포스트 생성

```
사용자: "/path/to/my-post.md 파일로 포스트 작성해줘"

Claude: create_post 도구를 사용합니다...
        (file_path: "/path/to/my-post.md")

        ✅ 포스트 생성 완료!
```

#### 연결 상태 확인

```
사용자: "블로그 서버 연결 상태 확인해줘"

Claude: diagnose_connection 도구를 사용합니다...

        📊 MCP Proxy Server 상태
        ━━━━━━━━━━━━━━━━━━━━
        서비스: mcp-proxy-server
        상태: ✅ 정상

        세션: ✅
        토큰: ✅

        Backend: ✅

        포스트 생성 가능: ✅
```

### 3. 사용 가능한 도구

| 도구 | 설명 | 사용 시점 |
|------|------|-----------|
| `authenticate` | 인증 및 세션 확인 | 첫 실행, 세션 만료 시 |
| `create_post` | 블로그 포스트 생성 | 포스트 작성 요청 시 |
| `diagnose_connection` | 연결 상태 확인 | 연결 문제 발생 시 |

---

## 📁 로컬 저장 설정

생성된 블로그 포스트는 자동으로 로컬에도 저장됩니다.

### 기본 저장 위치

설정 없이 사용하면 **`~/Documents/codebase-mcp-posts/`**에 자동 저장됩니다.

```bash
# 저장 위치 확인
ls ~/Documents/codebase-mcp-posts/
```

**파일명 형식**: `YYYYMMDD_제목.md`

예시:
```
~/Documents/codebase-mcp-posts/
├── 20250111_nextjs-14-server-actions.md
├── 20250111_react-query-tips.md
└── 20250112_typescript-best-practices.md
```

### 커스텀 경로 설정

원하는 위치에 저장하려면 `BLOG_POSTS_DIR` 환경변수를 추가하세요:

```json
{
  "mcpServers": {
    "blog-auto-poster": {
      "command": "npx",
      "args": ["-y", "@codebase/mcp-blog-client"],
      "env": {
        "PROXY_SERVER_URL": "http://localhost:3002",
        "WRITING_STYLE": "novel",
        "BLOG_POSTS_DIR": "/Users/username/my-custom-path/posts"
      }
    }
  }
}
```

**변경 후 Claude Desktop 재시작 필수!**

---

## 🔍 트러블슈팅

### 1. Proxy Server 연결 실패

**증상**:
```
❌ Proxy Server 연결 실패: connect ECONNREFUSED
```

**해결 방법**:

```bash
# 1. Proxy Server 실행 확인
lsof -i :3002

# 2. 실행 중이 아니면 시작
cd /path/to/blog-backend
pnpm start:dev

# 3. Proxy Server가 정상 실행될 때까지 대기 (보통 10-30초)

# 4. Claude Desktop 재시작
```

### 2. 세션 만료

**증상**:
```
❌ 세션이 만료되었습니다. authenticate 도구를 실행하여 재인증하세요.
```

**해결 방법**:

```
사용자: "다시 인증해줘"

Claude: authenticate 도구를 실행합니다...
        (브라우저 열림 → 로그인)
```

또는 수동으로 세션 파일 삭제:

```bash
rm ~/.mcp-session
# Claude Desktop에서 다시 인증 요청
```

### 3. Writing Style 로딩 실패

**증상**:
```
⚠️ Failed to load style: ENOENT: no such file or directory
📝 Using fallback style
```

**원인**:
- `writing-styles/{스타일명}.md` 파일이 없음
- 환경변수 `WRITING_STYLE`에 잘못된 이름 지정

**해결 방법**:

```bash
# 1. 사용 가능한 스타일 확인
ls writing-styles/
# novel.md, default.md, comedy.md, podcast.md, tutorial.md

# 2. Claude Desktop 설정 수정
{
  "env": {
    "WRITING_STYLE": "novel"  // 확장자 없이 파일 이름만
  }
}

# 3. Claude Desktop 재시작
```

### 4. 포스트 생성 실패

**증상**:
```
❌ 포스트 생성 실패: title이 필수입니다
```

**원인**:
- Front matter가 content_markdown에 포함됨
- title 파라미터가 누락됨

**해결 방법**:

내용에 front matter가 포함되지 않도록 확인:

```markdown
❌ 잘못된 예시:
---
title: "제목"
tags: ["tag1"]
---

## 내용 시작

✅ 올바른 예시:
## 내용 시작
```

### 5. 로그 확인

더 자세한 디버그 정보가 필요하면:

```json
{
  "mcpServers": {
    "blog-auto-poster": {
      "command": "mcp-blog-server",
      "env": {
        "PROXY_SERVER_URL": "http://localhost:3002",
        "WRITING_STYLE": "novel",
        "LOG_LEVEL": "debug"  // ← 추가
      }
    }
  }
}
```

Claude Desktop 재시작 후 `~/Library/Logs/Claude/` 폴더에서 로그 확인

---

## 👨‍💻 개발자 가이드

### 로컬 개발 환경 설정

```bash
# 1. 저장소 클론
git clone https://github.com/yourusername/mcp-blog-server-ts.git
cd mcp-blog-server-ts

# 2. 의존성 설치
pnpm install

# 3. 빌드
pnpm build

# 4. 전역 링크 생성 (npm 사용)
npm link

# 5. Claude Desktop 설정 (claude_desktop_config.json)
{
  "mcpServers": {
    "codebase_blog": {
      "command": "npx",
      "args": ["-y", "@codebase/mcp-blog-client"],
      "env": {
        "PROXY_SERVER_URL": "http://localhost:3002",
        "WRITING_STYLE": "default"
      }
    }
  }
}

# 6. Claude Desktop 재시작
# Mac: Cmd+Q로 완전 종료 후 재실행
```

**개발 워크플로우**:
```bash
# 코드 수정
vim src/index.ts

# 빌드
pnpm build

# Claude Desktop 재시작 (변경사항 반영)
```

### 프로젝트 구조

```
mcp-blog-server-ts/
├── src/
│   ├── index.ts              # MCP 서버 진입점
│   └── lib/
│       ├── auth-proxy.ts     # Proxy Server 클라이언트
│       ├── style-loader.ts   # Writing Style 로더
│       ├── markdown.ts       # Markdown 파싱
│       └── filesystem.ts     # 로컬 파일 저장
├── writing-styles/
│   ├── novel.md              # 소설체 스타일
│   ├── default.md            # 기본 스타일
│   ├── comedy.md             # 코미디 스타일
│   ├── podcast.md            # 팟캐스트 스타일
│   └── tutorial.md           # 튜토리얼 스타일
├── dist/                     # 빌드 출력 (TypeScript → JavaScript)
├── package.json              # npm 패키지 정의
├── tsconfig.json             # TypeScript 설정
└── README.md                 # 이 문서
```

### 빌드 및 테스트

```bash
# TypeScript 컴파일
pnpm build

# 타입 체크
pnpm typecheck

# Lint
pnpm lint

# 테스트 (작성 예정)
pnpm test
```

### npm 배포

```bash
# 1. 버전 업데이트
npm version patch  # 또는 minor, major

# 2. 빌드 및 테스트
pnpm build
pnpm test

# 3. npm 배포
npm publish

# prepublishOnly 스크립트가 자동으로 실행됨:
# - pnpm run build
# - pnpm run test
```

### 코드 수정 시 주의사항

#### ⚠️ 절대 수정하면 안 되는 부분

1. **`src/lib/style-loader.ts`의 섹션 파싱 로직**
```typescript
// 이 정규표현식과 섹션 이름들은 절대 변경 금지!
const sectionRegex = /^# === (.+?) ===$/gm;

sections['MCP SERVER INSTRUCTIONS']
sections['CREATE_POST TOOL DESCRIPTION']
sections['QUALITY GUIDELINES PROMPT']
sections['BLOG POST TEMPLATE PROMPT']
sections['IMPROVE MARKDOWN PROMPT']
```

2. **Front Matter 키 이름**
```typescript
// style-loader.ts의 이 키 이름들도 변경 금지!
metadata.style_name
metadata.language
metadata.min_length
metadata.target_length
metadata.code_block_ratio
metadata.ai_tag_required
metadata.auto_enhance
```

3. **세션 파일 경로**
```typescript
// auth-proxy.ts
this.sessionFile = path.join(os.homedir(), '.mcp-session');
// 변경 시 기존 사용자 세션이 깨짐!
```

#### ✅ 자유롭게 수정 가능한 부분

1. **Writing Styles 내용** (`writing-styles/*.md`)
2. **환경변수 기본값** (`src/index.ts`)
3. **로그 메시지** (모든 `console.error()`)
4. **에러 처리 로직**
5. **도구 설명** (`server.registerTool()` 내 description)

### 새 기능 추가 예시

#### 새 도구 추가

```typescript
// src/index.ts

server.registerTool(
  "my_new_tool",
  {
    title: "내 새로운 도구",
    description: "이 도구의 설명...",
    inputSchema: {
      myParam: z.string().describe("파라미터 설명")
    }
  },
  async (args) => {
    // 도구 로직 구현
    return {
      content: [{
        type: "text",
        text: "결과 메시지"
      }]
    };
  }
);
```

---

## 📄 라이선스

MIT License

---

## 🤝 기여

이슈 리포트, Pull Request 환영합니다!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📞 문의

- GitHub Issues: [https://github.com/yourusername/mcp-blog-server-ts/issues](https://github.com/yourusername/mcp-blog-server-ts/issues)
- Email: your.email@example.com

---

**Made with ❤️ for Claude Desktop users**
