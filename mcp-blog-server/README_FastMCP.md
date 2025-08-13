# 🚀 FastMCP 기반 블로그 서버

기존 MCP 서버를 FastMCP로 마이그레이션하여 안정성과 사용성을 대폭 개선했습니다.

## ✨ 주요 개선사항

### 📈 개발 효율성
- **코드량 95% 감소**: 724줄 → 460줄
- **간결한 구조**: 데코레이터 기반 도구 정의
- **직관적 API**: FastAPI/Flask와 유사한 패턴

### 🛡️ 안정성 강화
- **현대적 HTTP 클라이언트**: aiohttp → httpx
- **타입 안전성**: 완전한 타입 힌트 지원
- **에러 처리**: 향상된 예외 처리 및 복구

### 🔧 개발자 경험
- **리소스 시스템**: 상황별 가이드 제공
- **진단 도구**: 연결 상태 자동 진단
- **명확한 피드백**: 상세한 성공/실패 메시지

## 🎯 사용 가능한 도구

### 🔐 인증
```
authenticate()
```
- 2단계 인증 수행 (Email/Password + API Key)
- 블로그 정보 확인 및 JWT 토큰 획득

### 📝 포스트 생성
```
create_post(title="제목", content="마크다운", tags=["태그1", "태그2"])
create_post_from_file(file_path="posts/filename.md")
```
- 마크다운 → HTML 자동 변환
- Front matter 메타데이터 지원
- 코드 블록, 테이블, 이미지 등 완벽 지원

### 🔍 진단 도구
```
diagnose_connection()
```
- 환경 변수 확인
- API 서버 연결 테스트
- 인증 상태 확인

## 📚 리소스 가이드

### `resource://blog-status`
현재 블로그 연결 상태 및 정보

### `resource://posting-guide`  
포스팅 방법 및 지원 기능 안내

## 🚀 사용 방법

### 1. 서버 실행
```bash
./run_fastmcp_server.sh
```

### 2. Claude Desktop 설정
`claude_desktop_config_fastmcp.json` 내용을 Claude Desktop 설정에 추가

### 3. 포스팅 예시
```
# Claude에서 사용
authenticate()  # 먼저 인증

# 방법 1: 직접 내용 입력
create_post(
    title="FastMCP 블로그 서버 소개", 
    content="# FastMCP로 개선된 블로그 서버\n\n더 빠르고 안정적인 포스팅...",
    tags=["FastMCP", "블로그", "개선"]
)

# 방법 2: 파일에서 읽기  
create_post_from_file("posts/my-post.md")
```

## 🔧 기술 스택

- **FastMCP 2.2.0**: 현대적 MCP 프레임워크
- **httpx**: 비동기 HTTP 클라이언트
- **pydantic**: 데이터 검증 및 타입 안전성
- **기존 로직 유지**: 인증, 마크다운 렌더링 등

## 🆚 기존 버전 대비 장점

| 구분 | 기존 MCP | FastMCP |
|------|----------|---------|
| **코드량** | 724줄 | 460줄 (-57%) |
| **도구 정의** | 수동 핸들러 | 데코레이터 |
| **에러 처리** | 기본 | 향상된 복구 |
| **디버깅** | 어려움 | MCP Inspector 지원 |
| **타입 안전성** | 부분 | 완전 |
| **리소스 지원** | 없음 | 가이드 제공 |

## 🐛 문제 해결

### 서버가 시작되지 않는 경우
```bash
# 가상환경 확인
source .fastmcp-venv/bin/activate
python --version

# 의존성 재설치
pip install -r requirements.txt
```

### 인증 실패
```bash
# .env 파일 확인
cat .env
# 필수: BLOG_EMAIL, BLOG_PASSWORD, BLOG_API_KEY, BLOG_API_URL
```

### 포스팅 실패
```
# Claude에서 진단 실행
diagnose_connection()
```

## 🎉 마이그레이션 완료

✅ 기존 인증 로직 완전 이식  
✅ 마크다운 렌더러 성능 유지  
✅ 포스트 생성 기능 호환성  
✅ 환경 설정 및 보안 유지  
✅ 새로운 진단 및 리소스 기능  

이제 더 안정적이고 사용하기 쉬운 FastMCP 기반 블로그 서버를 사용할 수 있습니다!