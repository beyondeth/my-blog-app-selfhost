# My Blog App

개인 블로그 웹 애플리케이션 - Next.js + NestJS + S3 이미지 업로드

## 🚀 주요 기능

- **포스트 관리**: 블로그 글 작성, 수정, 삭제
- **이미지 업로드**: AWS S3를 활용한 이미지 업로드 및 관리
- **이미지 프록시**: S3 이미지를 안전하게 서빙하는 프록시 시스템
- **사용자 인증**: JWT 기반 인증 시스템
- **이메일 인증**: 회원가입 시 이메일 인증 코드 발송 및 검증
- **반응형 디자인**: 모바일 친화적인 UI/UX
- **TanStack Query**: 효율적인 데이터 페칭 및 캐싱

## 🛠 기술 스택

### Frontend
- **Next.js 14** - React 프레임워크
- **TypeScript** - 타입 안전성
- **Tailwind CSS** - 스타일링
- **TanStack Query** - 서버 상태 관리
- **React Hook Form** - 폼 관리

### Backend
- **NestJS** - Node.js 프레임워크
- **TypeScript** - 타입 안전성
- **TypeORM** - ORM
- **PostgreSQL** - 데이터베이스
- **AWS S3** - 파일 저장소
- **JWT** - 인증

## 📁 프로젝트 구조

```
my-blog-app/
├── frontend/          # Next.js 프론트엔드
│   ├── src/
│   │   ├── app/       # App Router 페이지
│   │   ├── components/ # 재사용 가능한 컴포넌트
│   │   ├── hooks/     # 커스텀 훅
│   │   ├── lib/       # 유틸리티 및 설정
│   │   ├── types/     # TypeScript 타입 정의
│   │   └── utils/     # 헬퍼 함수
│   └── public/        # 정적 파일
├── backend/           # NestJS 백엔드
│   └── src/
│       ├── auth/      # 인증 모듈
│       ├── users/     # 사용자 관리
│       ├── posts/     # 포스트 관리
│       ├── files/     # 파일 업로드 관리
│       └── common/    # 공통 모듈
└── README.md
```

## 🚦 시작하기

### 필수 요구사항

- Node.js 18+
- pnpm
- PostgreSQL
- AWS S3 계정
- Gmail 계정 (이메일 인증용)


### 설치 및 실행

1. **저장소 클론**
```bash
git clone <repository-url>
cd my-blog-app
```

2. **Backend 설정**
```bash
cd backend
pnpm install

# .env 파일 생성 및 설정
cp .env.example .env
# .env 파일을 열어 필요한 값들 설정

pnpm run start:dev
```

3. **Frontend 설정**
```bash
cd frontend
pnpm install
pnpm run dev
```

4. **Gmail SMTP 설정 (이메일 인증용)**
   
   Gmail 계정에서 앱 비밀번호 생성:
   1. Google 계정 설정 접속
   2. 보안 → 2단계 인증 활성화
   3. 앱 비밀번호 생성 (메일 선택)
   4. 생성된 16자리 비밀번호를 `.env` 파일의 `SMTP_PASS`에 입력
   
   ```env
   # .env 파일
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=xxxx-xxxx-xxxx-xxxx  # 16자리 앱 비밀번호
   SMTP_FROM=your-email@gmail.com
   ```

5. **접속**
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000

## 🔧 주요 해결 과제

### 1. 이미지 업로드 및 프록시 시스템
- **문제**: S3 직접 접근 시 CORS 및 보안 이슈
- **해결**: 백엔드 프록시 엔드포인트를 통한 이미지 서빙
- **구현**: `/api/v1/files/proxy/:fileKey` 엔드포인트

### 2. 한글 파일명 처리
- **문제**: 한글 파일명의 URL 인코딩/디코딩 불일치
- **해결**: 백엔드에서 이중 디코딩 로직 구현
- **구현**: `decodeURIComponent`를 활용한 안전한 파일명 처리

### 3. URL 중복 문제
- **문제**: 프록시 URL 생성 시 `/api/v1` 경로 중복
- **해결**: 환경 변수 정규화 및 URL 빌딩 로직 개선

### 4. 이미지 로딩 최적화
- **문제**: 과도한 콘솔 로깅 및 비효율적인 DOM 조작
- **해결**: TanStack Query 기반 이미지 상태 관리 구현

## 📝 API 엔드포인트

### 인증
- `POST /auth/login` - 로그인
- `POST /auth/register` - 회원가입
- `GET /auth/profile` - 프로필 조회
- `POST /auth/email/send-code` - 이메일 인증 코드 발송
- `POST /auth/email/verify-code` - 이메일 인증 코드 검증
- `POST /auth/email/resend-code` - 이메일 인증 코드 재발송

### 포스트
- `GET /posts` - 포스트 목록
- `GET /posts/:slug` - 포스트 상세
- `POST /posts` - 포스트 생성
- `PUT /posts/:id` - 포스트 수정
- `DELETE /posts/:id` - 포스트 삭제

### 파일
- `POST /files/upload-url` - 업로드 URL 생성
- `POST /files/upload-complete` - 업로드 완료 처리
- `GET /files/proxy/:fileKey` - 이미지 프록시

## 🎨 컴포넌트

### 주요 컴포넌트
- `ImageProxy` - S3 이미지 프록시 처리
- `ContentRenderer` - HTML 콘텐츠 내 이미지 URL 자동 변환
- `RichTextEditor` - 리치 텍스트 에디터 (파일 업로드 포함)
- `OptimizedImage` - TanStack Query 기반 이미지 컴포넌트

## 🔍 디버깅

### 디버그 엔드포인트
- `GET /posts/debug/thumbnails` - 포스트 썸네일 상태 확인
- `GET /posts/debug/content/:id` - 포스트 콘텐츠 분석
- `GET /files/test/s3-files` - S3 파일 목록
- `GET /files/test/db-files` - 데이터베이스 파일 목록

## 📄 라이선스

MIT License

## 🤝 기여

이슈 및 풀 리퀘스트를 환영합니다!

---

**개발자**: sihyungpark  
**개발 기간**: 2025년 6월  
**최종 업데이트**: 2025년 6월 19일 