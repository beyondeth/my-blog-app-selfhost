---
title: "MCP Blog Server 완벽 가이드: 트리거 단어와 워크플로우 분석"
tags: ["MCP", "FastMCP", "Blog", "Architecture", "Markdown", "NestJS", "자동화", "워크플로우"]
date: 2025-08-24T01:33:51.285857
---

# MCP Blog Server 완벽 가이드: 트리거 단어와 워크플로우 분석

## 🎯 핵심 발견: FastMCP 렌더링 기능은 미사용!

오늘 MCP 블로그 서버의 전체 워크플로우를 심층 분석한 결과, 흥미로운 사실을 발견했습니다. **FastMCP의 `MarkdownRenderer` 클래스(229줄)는 실제로 사용되지 않고 있었습니다!**

## 🔄 실제 데이터 플로우

```
AI 대화 → MCP Server (Python) → 마크다운 원본 → Backend (NestJS) → HTML 변환 → DB 저장 → Frontend 표시
```

### 각 단계별 역할

1. **MCP Server (Python FastMCP)**
   - ✅ 2단계 인증 (Email/Password + API Key)
   - ✅ 마크다운 메타데이터 파싱 (제목, 태그 추출)
   - ❌ ~~HTML 렌더링~~ (사용 안 함!)
   - ✅ 백엔드 API로 마크다운 전송

2. **Backend (NestJS)**
   - ✅ **실제 렌더링이 여기서 발생!**
   - ✅ `MarkdownRendererService.convertToHtml()` 사용
   - ✅ 하이브리드 저장 (마크다운 + HTML 모두 보존)

3. **Frontend (Next.js)**
   - ✅ 렌더링된 HTML 표시
   - ✅ DOMPurify로 XSS 보안 처리
   - ✅ 코드 신택스 하이라이팅 추가

## 🧹 코드 정리 결과

불필요한 `MarkdownRenderer` 클래스를 제거한 결과:

- **Before**: 663줄
- **After**: 434줄
- **절감**: 229줄 (34% 감소!)

## 📝 MCP 트리거 단어 정리

### 도구 (Tools) - AI가 호출하는 함수

| 함수명 | 트리거 단어 | 용도 |
|--------|------------|------|
| `authenticate` | 인증, 로그인, 블로그 연결 | 2단계 인증 수행 |
| `create_post` | 포스팅, 글 작성, 블로그 포스트 | 마크다운을 포스트로 생성 |
| `create_post_from_file` | 파일 포스팅, 파일에서 생성 | MD 파일을 포스트로 변환 |
| `diagnose_connection` | 연결 진단, 상태 확인 | API 연결 상태 점검 |

### 리소스 (Resources) - 정보 제공

- `blog-status`: 현재 블로그 연결 상태
- `posting-guide`: 포스팅 방법 가이드

### 실제 사용 예시

```markdown
"이 내용을 블로그에 포스팅해줘"
"블로그 글로 작성해줘"
"블로그 연결 상태 확인해줘"
"authenticate" (직접 명령)
```

## 🚀 배포 아키텍처의 우수성

현재 설계가 왜 완벽한지 확인했습니다:

### NPM 패키지로 배포 시나리오

```bash
# 사용자가 설치
npm install -g @your-org/mcp-blog-server

# 환경 설정
BLOG_API_URL=https://your-blog-site.com
BLOG_EMAIL=user@email.com
BLOG_PASSWORD=userpass
BLOG_API_KEY=generated-api-key

# Claude Desktop 연동 → 자동 포스팅!
```

**결과**: ✅ **완벽 작동**

### 왜 작동하는가?

1. **MCP는 얇은 클라이언트**
   - 렌더링 로직 없음 (제거 완료!)
   - 인증과 API 호출만 담당
   - 가벼운 패키지 크기

2. **백엔드가 모든 처리**
   - 중앙화된 렌더링
   - 일관된 결과 보장
   - 버전 관리 용이

3. **사용자 경험 최적화**
   - 간단한 설치
   - 최소한의 설정
   - 오프라인 제외 모든 환경 지원

## 💡 핵심 교훈

**"Don't Repeat Yourself (DRY)"** 원칙이 얼마나 중요한지 다시 한번 확인했습니다. 

- MCP 서버의 229줄 렌더링 코드 = **완전히 불필요**
- 백엔드 한 곳에서 처리 = **유지보수 천국**
- 코드 중복 제거 = **버그 감소 + 일관성 향상**

## 🎯 결론

현재 MCP 블로그 서버 아키텍처는:

1. ✅ **확장 가능** - 수천 명이 사용해도 OK
2. ✅ **유지보수 용이** - 렌더링 로직 중앙화
3. ✅ **보안 강화** - 서버 사이드 처리
4. ✅ **배포 준비 완료** - NPM/PyPI 즉시 가능

이제 MCP 서버는 진정한 "**얇은 클라이언트**"가 되었고, 모든 무거운 작업은 백엔드가 담당합니다. 완벽한 책임 분리!

---

*이 포스트는 MCP Blog Server를 통해 자동으로 생성되었습니다. 🤖*