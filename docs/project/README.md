# My Blog App - 프로젝트 개요

## 📌 프로젝트 소개

**My Blog App**은 멀티 유저를 지원하는 현대적인 블로그 플랫폼입니다. 사용자는 자신만의 블로그를 만들고, 풍부한 기능의 에디터를 사용하여 포스트를 작성하며, 다른 사용자들과 소통할 수 있습니다.

### 주요 특징

- 🎨 **풍부한 에디터**: Tiptap 기반의 WYSIWYG 에디터로 텍스트, 이미지, 코드 블록, YouTube 비디오 등 다양한 콘텐츠 작성
- 🔐 **다양한 인증 방식**: 로컬 인증 + OAuth2 (Google, GitHub, Kakao)
- 💬 **실시간 소통**: Socket.IO 기반 DM(Direct Message) 시스템
- 📊 **Analytics**: 포스트 조회수, 좋아요, 댓글 통계
- 🔍 **전문 검색**: PostgreSQL Full-Text Search로 빠른 검색
- 📦 **파일 관리**: AWS S3를 활용한 이미지 업로드 및 최적화
- 🎯 **에디터 픽**: 관리자가 추천하는 우수 포스트 큐레이션
- 🔔 **알림 시스템**: 실시간 알림 및 이메일 알림
- 👥 **팔로우 시스템**: 다른 사용자 팔로우 및 팔로워 관리
- 🔖 **북마크**: 관심있는 포스트 북마크
- 🚫 **신고 시스템**: 부적절한 콘텐츠 신고 및 관리자 처리

## 🛠 기술 스택

### Frontend
- **프레임워크**: Next.js 14 (App Router)
- **언어**: TypeScript
- **상태 관리**: React Query (@tanstack/react-query) + Zustand
- **에디터**: Tiptap (ProseMirror 기반)
- **스타일링**: Tailwind CSS + Radix UI
- **실시간 통신**: Socket.IO Client
- **폼 관리**: React Hook Form + Zod
- **차트**: ApexCharts, Recharts

### Backend
- **프레임워크**: NestJS 10
- **언어**: TypeScript
- **데이터베이스**: PostgreSQL 14
- **ORM**: TypeORM
- **캐시**: Redis + ioredis
- **큐**: BullMQ
- **파일 저장소**: AWS S3
- **인증**: JWT + Passport (OAuth2)
- **실시간 통신**: Socket.IO
- **이메일**: Nodemailer
- **보안**: Helmet, bcrypt, class-validator

### Infrastructure
- **컨테이너**: Docker, Docker Compose
- **데이터베이스**: PostgreSQL 14
- **캐시**: Redis 7
- **모니터링**: Prometheus (선택적)

## 🚀 빠른 시작

### 사전 요구사항

- Node.js 18+ (권장: 20.x)
- pnpm 9.0.0+
- Docker & Docker Compose
- PostgreSQL 14 (Docker로 실행 가능)
- Redis 7 (Docker로 실행 가능)

### 설치 및 실행

#### 1. 저장소 클론

```bash
git clone <repository-url>
cd my-blog-app
```

#### 2. Docker 서비스 시작 (PostgreSQL + Redis)

```bash
docker-compose up -d
```

이 명령어는 다음 서비스를 시작합니다:
- PostgreSQL (포트 5432)
- Redis (포트 6379)

#### 3. 의존성 설치

```bash
# 백엔드 의존성
cd backend
pnpm install

# 프론트엔드 의존성
cd ../frontend
pnpm install
```

#### 4. 환경 변수 설정

**백엔드 (.env)**
```bash
cd backend
cp .env.example .env  # .env.example이 없다면 아래 내용 참고

# 주요 환경 변수:
DATABASE_URL=postgresql://postgres:password@localhost:5432/blog-db
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-jwt-secret-key
AWS_S3_BUCKET=your-s3-bucket
# OAuth 설정 (선택사항)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

**프론트엔드 (.env.local)**
```bash
cd frontend
# .env.local 파일 생성
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

#### 5. 데이터베이스 마이그레이션

```bash
cd backend
pnpm migration:run
```

#### 6. 서버 실행

**터미널 1 - 백엔드 (포트 3000)**
```bash
cd backend
pnpm start:dev
```

**터미널 2 - 프론트엔드 (포트 3001)**
```bash
cd frontend
pnpm dev
```

#### 7. 애플리케이션 접속

- **프론트엔드**: http://localhost:3001
- **백엔드 API**: http://localhost:3000/api/v1
- **API 문서**: http://localhost:3000/api-docs (개발 모드만)
- **Health Check**: http://localhost:3000/health

## 📖 문서

- [아키텍처 문서](./Architecture.md) - 시스템 구조와 기술 스택
- [API 레퍼런스](./API-Reference.md) - API 엔드포인트 상세 명세
- [배포 가이드](./Deployment-Guide.md) - Docker 및 배포 설정
- [개발자 가이드](./Developer-Guide.md) - 로컬 개발 환경 및 규칙
- [시스템 설계 문서](./System-Design.md) - 기술적 설계 상세

## 🏗 프로젝트 구조

```
my-blog-app/
├── frontend/              # Next.js 프론트엔드
│   ├── src/
│   │   ├── app/          # Next.js App Router 페이지
│   │   ├── components/   # 재사용 가능한 UI 컴포넌트
│   │   ├── editor/       # Tiptap 에디터 컴포넌트
│   │   ├── hooks/        # 커스텀 React Hooks
│   │   ├── lib/          # 유틸리티 및 헬퍼
│   │   ├── services/     # API 서비스 레이어
│   │   ├── stores/       # Zustand 전역 상태
│   │   └── types/        # TypeScript 타입 정의
│   └── package.json
│
├── backend/               # NestJS 백엔드
│   ├── src/
│   │   ├── auth/         # 인증 모듈 (JWT, OAuth2)
│   │   ├── users/        # 사용자 관리
│   │   ├── blogs/        # 블로그 CRUD
│   │   ├── posts/        # 포스트 관리
│   │   ├── comments/     # 댓글 시스템
│   │   ├── chat/         # DM 시스템
│   │   ├── files/        # S3 파일 업로드
│   │   ├── notifications/# 알림 시스템
│   │   ├── follows/      # 팔로우 관계
│   │   ├── bookmarks/    # 북마크
│   │   ├── reports/      # 신고 시스템
│   │   ├── admin/        # 관리자 기능
│   │   ├── cache/        # Redis 캐싱
│   │   ├── email/        # 이메일 서비스
│   │   └── common/       # 공통 유틸리티
│   └── package.json
│
├── docker-compose.yml     # Docker 서비스 정의
├── docs/                  # 프로젝트 문서
└── README.md             # 이 파일
```

## 🔑 주요 기능

### 1. 인증 및 사용자 관리
- 로컬 회원가입/로그인 (bcrypt 해싱)
- OAuth2 소셜 로그인 (Google, GitHub, Kakao)
- JWT 기반 인증 (HttpOnly 쿠키)
- 이메일 인증
- 비밀번호 재설정

### 2. 블로그 관리
- 사용자당 1개의 블로그
- 커스텀 URL 슬러그
- 공개/비공개 설정
- 블로그 썸네일 및 설명

### 3. 포스트 작성 및 관리
- Tiptap WYSIWYG 에디터
- 마크다운 지원
- 이미지 업로드 (S3)
- YouTube 비디오 임베딩
- 코드 하이라이팅
- 초안 저장
- 카테고리 및 태그
- SEO 최적화 (slug, excerpt)

### 4. 소셜 기능
- 댓글 시스템 (중첩 댓글 지원)
- 좋아요 (포스트, 댓글)
- 팔로우/팔로워
- 북마크
- 실시간 DM (Socket.IO)
- 실시간 알림

### 5. 검색 및 필터링
- PostgreSQL Full-Text Search
- 카테고리별 필터링
- 태그 기반 검색
- 인기 포스트 정렬
- 최신 포스트 정렬

### 6. 관리자 기능
- 사용자 관리
- 포스트 관리
- 에디터 픽 선정
- 신고 내역 처리
- 시스템 모니터링
- Redis 캐시 관리

## 🧪 테스트

```bash
# 백엔드 테스트
cd backend
pnpm test              # 단위 테스트
pnpm test:e2e          # E2E 테스트
pnpm test:cov          # 커버리지

# 프론트엔드 테스트
cd frontend
pnpm test
```

## 📝 개발 규칙

### 코딩 스타일
- TypeScript strict 모드 사용
- ESLint + Prettier 적용
- 명확한 한글 주석 (복잡한 로직)
- 함수형 컴포넌트 (React Hooks)

### 커밋 컨벤션
```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 코드
chore: 빌드 업무 수정
```

### API 규칙
- RESTful 설계 원칙
- `/api/v1` 프리픽스 사용
- 일관된 에러 응답 형식
- DTO 기반 입력 검증

## 🐛 문제 해결

### 포트 충돌
```bash
# 포트 사용 확인
lsof -i :3000  # 백엔드
lsof -i :3001  # 프론트엔드
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis

# 프로세스 종료
kill -9 <PID>
```

### Docker 서비스 재시작
```bash
docker-compose down
docker-compose up -d
```

### 데이터베이스 리셋
```bash
cd backend
pnpm migration:revert  # 마지막 마이그레이션 되돌리기
pnpm migration:run     # 마이그레이션 재실행
```

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 UNLICENSED 라이선스를 따릅니다.

## 📧 문의

프로젝트 관련 문의사항이 있으시면 이슈를 등록해주세요.

---

**마지막 업데이트**: 2025-01-13
