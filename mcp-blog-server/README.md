# Blog MCP Server

Claude Code와 통합되는 블로그 관리 MCP 서버입니다.

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
cd mcp-blog-server
pip install -r requirements.txt
```

### 2. 설정

```bash
python setup.py
```

블로그 API 정보를 입력하세요:
- API URL: http://localhost:3000
- Email: your-email@example.com
- Password: your-password

### 3. Claude Code 재시작

MCP 서버가 자동으로 로드됩니다.

## 📝 사용 방법

Claude Code에서 다음과 같이 사용하세요:

### 포스트 생성
```
"새 블로그 포스트를 작성해줘"
"README.md 파일을 블로그에 포스팅해줘"
```

### 포스트 목록 조회
```
"draft 포스트 목록을 보여줘"
"최근 포스트 10개를 보여줘"
```

### 포스트 발행
```
"포스트 ID 5를 발행해줘"
```

## 🛠️ MCP 도구

### create_post
마크다운 콘텐츠나 파일로부터 새 포스트 생성

**파라미터:**
- `title`: 포스트 제목
- `content`: 마크다운 콘텐츠
- `file_path`: 마크다운 파일 경로 (content 대신 사용)
- `category`: 카테고리 (기본: general)
- `tags`: 태그 배열
- `status`: draft 또는 published

### publish_post
draft 포스트를 발행

**파라미터:**
- `post_id`: 발행할 포스트 ID

### update_post
기존 포스트 수정

**파라미터:**
- `post_id`: 수정할 포스트 ID
- `title`: 새 제목
- `content`: 새 콘텐츠
- `category`: 새 카테고리
- `tags`: 새 태그들
- `status`: 새 상태

### list_posts
포스트 목록 조회

**파라미터:**
- `status`: draft, published, 또는 all (기본: all)
- `limit`: 조회할 포스트 수 (기본: 10)

### get_post
특정 포스트 조회

**파라미터:**
- `post_id`: 조회할 포스트 ID

### delete_post
포스트 삭제

**파라미터:**
- `post_id`: 삭제할 포스트 ID

### save_markdown
포스트를 마크다운 파일로 저장

**파라미터:**
- `post_id`: 저장할 포스트 ID
- `file_path`: 저장할 파일 경로

## 📁 파일 구조

```
mcp-blog-server/
├── src/
│   ├── mcp_server.py      # MCP 서버 메인
│   ├── blog_client.py      # 블로그 API 클라이언트
│   └── markdown_handler.py # 마크다운 처리
├── requirements.txt        # Python 의존성
├── setup.py               # 설정 스크립트
├── .env.example           # 환경변수 예시
└── README.md              # 이 파일
```

## 🔧 문제 해결

### MCP 서버가 인식되지 않음
1. Claude Code를 완전히 재시작하세요
2. `~/.claude/claude_desktop_config.json` 파일을 확인하세요
3. Python 경로가 올바른지 확인하세요

### 로그인 실패
1. `.blog-mcp/.env` 파일의 자격 증명을 확인하세요
2. 블로그 API 서버가 실행 중인지 확인하세요

### Python 모듈 오류
```bash
pip install --upgrade -r requirements.txt
```

## 📝 마크다운 Frontmatter 지원

마크다운 파일에 frontmatter를 추가할 수 있습니다:

```markdown
---
title: 포스트 제목
category: tech
tags: [python, mcp, blog]
status: draft
---

# 포스트 내용

여기에 내용을 작성하세요...
```

## 🔒 보안

- 자격 증명은 `~/.blog-mcp/.env` 파일에 저장됩니다
- 파일 권한은 600으로 설정됩니다 (소유자만 읽기/쓰기)
- 절대 자격 증명을 git에 커밋하지 마세요

## 📄 라이센스

MIT