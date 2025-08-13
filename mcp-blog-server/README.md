# 🚀 Blog MCP - 원클릭 블로그 포스팅 (FastMCP 기반)

Claude와 연동하여 마크다운으로 블로그 포스트를 작성할 수 있는 FastMCP 기반 서버입니다.

## ⚡ 빠른 설치 (30초)

```bash
# 1. 저장소 클론
git clone https://github.com/your-repo/blog-mcp.git
cd blog-mcp

# 2. 원클릭 설치
./install.sh
```

끝! 이제 Claude에서 `create_post` 도구를 사용할 수 있습니다.

## 🎯 주요 특징

### ✅ 간단함
- **FastMCP 기반**: 현대적 MCP 프레임워크 사용
- **원클릭 설치**: 스크립트 실행 한 번으로 완료
- **자동 설정**: Claude Desktop 설정도 자동으로 추가

### ✅ 빠름
- **즉시 사용**: 설치 후 바로 포스팅 가능
- **자동 인증**: 서버 시작 시 자동으로 로그인
- **마크다운 변환**: HTML 변환 자동 처리

### ✅ 안전함
- **보안 인증**: 이메일 + 비밀번호 + API 키 2단계 인증
- **환경 변수**: 민감 정보는 .env 파일로 보호
- **권한 설정**: .env 파일 600 권한으로 보호

## 🔧 사용법

### Claude에서 사용

```
Claude: "create_post 도구를 사용해서 오늘 개발한 내용을 블로그에 포스팅해줘"
```

### 지원하는 방법

1. **파일에서 포스팅**:
```
create_post({
    "file_path": "posts/my-post.md"
})
```

2. **직접 내용 입력**:
```
create_post({
    "title": "제목",
    "content": "# 마크다운 내용...",
    "tags": ["태그1", "태그2"]
})
```

## 📁 프로젝트 구조

```
mcp-blog-server/
├── src/
│   └── fastmcp_blog_server.py # FastMCP 기반 블로그 서버 (메인)
├── posts/                     # 마크다운 포스트 저장소
├── requirements.txt           # Python 의존성
├── run_server.sh             # 서버 실행 스크립트
└── .env                      # 환경 변수
```

## 🔒 보안 기능

- **2단계 인증**: 이메일/패스워드 + API 키
- **환경 변수 보호**: 민감한 정보는 .env 파일로 관리
- **안전한 마크다운 처리**: XSS 방지

## 📝 마크다운 지원

- 제목 (h1 ~ h6)
- 코드 블록 (언어별 하이라이팅)
- 인라인 코드
- 테이블
- 리스트 (순서 있음/없음)
- 링크와 이미지
- 굵은 글씨, 기울임, 취소선
- 인용문
- 수평선

## 📄 라이선스

MIT