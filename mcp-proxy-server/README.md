# MCP Proxy Server

프로덕션 레벨의 MCP(Model Context Protocol) Proxy Server

## 📋 개요

MCP Client와 Backend API 사이에서 동작하는 프록시 서버로, OAuth2 인증, 세션 관리, 보안 처리를 담당합니다.

### 🏗 아키텍처
```
LLM → MCP Client → MCP Proxy Server → Backend API
```

## ✨ 핵심 기능

- **OAuth2 인증**: PKCE를 활용한 안전한 인증
- **세션 관리**: Redis 기반 분산 세션 저장소
- **보안 강화**: PKCE verifier 별도 저장, 환경 변수 검증
- **에러 처리**: 중앙 집중식 에러 핸들링
- **확장성**: PM2 클러스터 모드 지원
- **프로덕션 준비**: 환경별 설정, 로깅, 모니터링

## 🚀 시작하기

### 1. 설치

```bash
pnpm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
# .env 파일 수정하여 실제 값 입력
```

### 3. 빌드

```bash
pnpm build
```

### 4. 실행

#### 개발 모드
```bash
pnpm dev
```

#### 프로덕션 모드 (단일 프로세스)
```bash
pnpm start
```

#### PM2 클러스터 모드 (권장)
```bash
# PM2 설치 (글로벌)
npm install -g pm2

# 클러스터 모드로 시작
pm2 start ecosystem.config.js --env production

# 모니터링
pm2 monit

# 로그 확인
pm2 logs
```

## 📁 프로젝트 구조

```
mcp-proxy-server/
├── src/
│   ├── config/
│   │   └── env.validation.ts    # 환경 변수 검증 (Zod)
│   ├── middleware/
│   │   └── error-handler.ts     # 에러 처리 미들웨어
│   ├── routes/
│   │   ├── session.routes.ts    # 세션 관련 라우트
│   │   ├── mcp.routes.ts        # MCP 전용 라우트
│   │   └── proxy.routes.ts      # 프록시 라우트
│   ├── services/
│   │   └── SessionService.ts    # 세션 관리 서비스
│   ├── types/
│   │   └── index.ts             # TypeScript 타입 정의
│   └── index.ts                 # 서버 진입점
├── ecosystem.config.js           # PM2 설정
├── .env.example                 # 환경 변수 예제
└── README.md
```

## 🔒 보안 개선 사항

### 1. 환경 변수 검증
- Zod를 사용한 런타임 환경 변수 검증
- 서버 시작 전 필수 환경 변수 체크
- 타입 안정성 보장

### 2. PKCE Verifier 별도 저장
- Redis에 별도 키로 안전하게 저장
- 일회용 사용 후 즉시 삭제
- 10분 TTL 설정

### 3. 에러 처리
- 민감한 정보 노출 방지
- 표준화된 에러 응답 포맷
- 환경별 에러 상세 정보 제어

## 🔧 환경 변수

| 변수명 | 설명 | 필수 | 기본값 |
|--------|------|------|--------|
| `PORT` | 서버 포트 | ❌ | 8080 |
| `NODE_ENV` | 실행 환경 | ❌ | development |
| `REDIS_HOST` | Redis 호스트 | ❌ | localhost |
| `REDIS_PORT` | Redis 포트 | ❌ | 6379 |
| `OAUTH_CLIENT_ID` | OAuth 클라이언트 ID | ✅ | - |
| `OAUTH_CLIENT_SECRET` | OAuth 클라이언트 시크릿 | ✅ | - |
| `OAUTH_REDIRECT_URI` | OAuth 리다이렉트 URI | ✅ | - |
| `BACKEND_BASE_URL` | Backend 서버 URL | ✅ | - |
| `BACKEND_API_URL` | Backend API URL | ✅ | - |

전체 환경 변수 목록은 `.env.example` 파일 참고

## 📊 성능 최적화

### PM2 클러스터 모드
- CPU 코어 수만큼 워커 프로세스 실행
- Zero-downtime reload
- 자동 재시작 및 메모리 관리

### Redis 세션 저장소
- 분산 세션 관리
- 서버 재시작 시에도 세션 유지
- 수평 확장 가능

## 🛠 개발 명령어

```bash
# 개발 서버 실행
pnpm dev

# 빌드
pnpm build

# 프로덕션 실행
pnpm start

# 코드 정리
pnpm clean

# 타입 체크
tsc --noEmit
```

## 🚦 헬스 체크

```bash
# 헬스 체크 엔드포인트
curl http://localhost:8080/health
```

## 🔍 트러블슈팅

### Redis 연결 실패
```bash
# Redis 실행 확인
redis-cli ping

# Redis 시작 (macOS)
brew services start redis

# Redis 시작 (Linux)
sudo systemctl start redis
```

### 포트 충돌
```bash
# 포트 사용 확인
lsof -i :8080

# 환경 변수로 포트 변경
PORT=3002 pnpm start
```

## 📈 개선 로드맵

- [ ] Pino 로거 도입
- [ ] Rate Limiting 구현
- [ ] 타입 안정성 개선
- [ ] APM 도입 (Datadog/New Relic)
- [ ] 메트릭스 수집 (Prometheus)
- [ ] Docker 컨테이너화

## 📄 라이선스

MIT

## 👥 기여

이슈 및 PR 환영합니다!