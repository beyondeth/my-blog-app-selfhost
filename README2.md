

## 프로젝트 개요

백퓨더맥 블로그(https://macnews.tistory.com/)를 모티브로 한 개인 블로그 프로젝트입니다.

## 기술 스택

### Frontend
- **Next.js 15.3.3** - React 기반 풀스택 프레임워크
- **TypeScript 5.8.3** - 타입 안정성
- **Tailwind CSS 4.1.10** - 유틸리티 기반 CSS 프레임워크
- **React Query (@tanstack/react-query)** - 서버 상태 관리
- **React Hook Form** - 폼 관리
- **Zod** - 스키마 검증
- **React Markdown** - 마크다운 렌더링
- **React Syntax Highlighter** - 코드 하이라이팅
- **Framer Motion** - 애니메이션
- **React Icons** - 아이콘 라이브러리

### Backend
- **NestJS 11.1.3** - Node.js 기반 백엔드 프레임워크
- **TypeScript 5.8.3** - 타입 안정성
- **TypeORM 0.3.24** - ORM
- **MySQL2 3.14.1** - 데이터베이스
- **Passport.js** - 인증 미들웨어
- **JWT** - 토큰 기반 인증
- **bcryptjs** - 비밀번호 해싱
- **Swagger** - API 문서화

### Infrastructure
- **AWS RDS** - MySQL 데이터베이스
- **AWS EC2 t2.micro** - 서버 호스팅
- **AWS S3** - 파일 업로드

## 프로젝트 구조

```
my-blog-app/
├── frontend/                 # Next.js 프론트엔드
│   ├── src/
│   │   ├── app/             # App Router
│   │   │   ├── login/       # 로그인 페이지
│   │   │   ├── layout.tsx   # 루트 레이아웃
│   │   │   └── page.tsx     # 홈페이지
│   │   ├── components/      # 재사용 가능한 컴포넌트
│   │   │   ├── layout/      # 레이아웃 컴포넌트
│   │   │   ├── ui/          # UI 컴포넌트
│   │   │   ├── auth/        # 인증 관련 컴포넌트
│   │   │   ├── posts/       # 게시글 관련 컴포넌트
│   │   │   ├── comments/    # 댓글 관련 컴포넌트
│   │   │   └── admin/       # 관리자 컴포넌트
│   │   ├── hooks/           # 커스텀 훅
│   │   ├── lib/             # 유틸리티 라이브러리
│   │   ├── types/           # TypeScript 타입 정의
│   │   └── styles/          # 스타일 파일
│   └── package.json
├── backend/                  # NestJS 백엔드
│   ├── src/
│   │   ├── auth/            # 인증 모듈
│   │   │   ├── guards/      # 인증 가드
│   │   │   ├── strategies/  # Passport 전략
│   │   │   └── decorators/  # 커스텀 데코레이터
│   │   ├── users/           # 사용자 모듈
│   │   ├── posts/           # 게시글 모듈
│   │   ├── comments/        # 댓글 모듈
│   │   ├── common/          # 공통 모듈
│   │   └── config/          # 설정 파일
│   └── package.json
└── README2.md
```

## 설치된 패키지

### Frontend 패키지
```bash
# 핵심 패키지
pnpm add react react-dom next
pnpm add typescript @types/node @types/react @types/react-dom

# 스타일링
pnpm add tailwindcss @tailwindcss/postcss

# 상태 관리 및 데이터 페칭
pnpm add @tanstack/react-query react-query axios

# 폼 관리
pnpm add react-hook-form @hookform/resolvers zod

# 마크다운 및 코드 하이라이팅
pnpm add react-markdown rehype-highlight remark-gfm
pnpm add react-syntax-highlighter @types/react-syntax-highlighter

# UI/UX
pnpm add react-icons framer-motion react-intersection-observer

# AWS
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Backend 패키지
```bash
# NestJS 핵심
pnpm add @nestjs/core @nestjs/common @nestjs/platform-express
pnpm add @nestjs/typeorm @nestjs/config @nestjs/jwt @nestjs/passport
pnpm add @nestjs/swagger

# 데이터베이스
pnpm add typeorm mysql2

# 인증
pnpm add passport passport-jwt passport-google-oauth20 passport-kakao
pnpm add bcryptjs

# 유틸리티
pnpm add class-validator class-transformer reflect-metadata rxjs

# 개발 도구
pnpm add -D @nestjs/cli @nestjs/testing jest @types/jest ts-jest
pnpm add -D @types/node @types/express @types/passport-jwt
pnpm add -D @types/passport-google-oauth20 @types/passport-kakao
pnpm add -D typescript ts-node nodemon
```

## 주요 기능

### 1. 인증 시스템
- **로컬 로그인**: 이메일/비밀번호 기반 로그인
- **OAuth 로그인**: Google, Kakao 소셜 로그인
- **JWT 토큰**: 보안 토큰 기반 인증
- **역할 기반 권한**: Admin/User 역할 구분

### 2. 게시글 관리
- **CRUD 작업**: 게시글 작성, 수정, 삭제, 조회
- **마크다운 지원**: 코드 블록, 구문 강조
- **카테고리 분류**: 게시글 카테고리 관리
- **태그 시스템**: 게시글 태그 기능
- **검색 기능**: 제목, 내용, 태그 기반 검색

### 3. 댓글 시스템
- **댓글 작성**: 로그인 사용자만 댓글 작성 가능
- **대댓글 지원**: 계층형 댓글 구조
- **댓글 관리**: 수정, 삭제 기능

### 4. 사용자 인터랙션
- **좋아요 기능**: 게시글 좋아요/취소
- **조회수 추적**: 게시글 조회수 카운팅
- **방명록**: 모든 댓글을 한 곳에서 확인

### 5. 관리자 기능
- **대시보드**: 통계 및 현황 모니터링
- **사용자 관리**: 사용자 목록 및 권한 관리
- **게시글 관리**: 게시글 수정, 삭제, 승인

### 6. UI/UX 기능
- **다크모드**: 라이트/다크 테마 전환
- **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원
- **인피니트 스크롤**: 페이지네이션 대신 무한 스크롤
- **로딩 상태**: 사용자 경험 개선

## 데이터베이스 설계

### Users 테이블
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255),
  username VARCHAR(255) NOT NULL,
  profileImage VARCHAR(255),
  role ENUM('admin', 'user') DEFAULT 'user',
  authProvider ENUM('local', 'google', 'kakao') DEFAULT 'local',
  providerId VARCHAR(255),
  isEmailVerified BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Posts 테이블
```sql
CREATE TABLE posts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  thumbnail VARCHAR(255),
  isPublished BOOLEAN DEFAULT FALSE,
  viewCount INT DEFAULT 0,
  likeCount INT DEFAULT 0,
  tags JSON,
  category VARCHAR(255),
  authorId INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  publishedAt TIMESTAMP NULL,
  FOREIGN KEY (authorId) REFERENCES users(id)
);
```

### Comments 테이블
```sql
CREATE TABLE comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  content TEXT NOT NULL,
  isDeleted BOOLEAN DEFAULT FALSE,
  authorId INT,
  postId INT,
  parentCommentId INT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (authorId) REFERENCES users(id),
  FOREIGN KEY (postId) REFERENCES posts(id),
  FOREIGN KEY (parentCommentId) REFERENCES comments(id)
);
```

### Post_Likes 테이블 (Many-to-Many)
```sql
CREATE TABLE post_likes (
  postId INT,
  userId INT,
  PRIMARY KEY (postId, userId),
  FOREIGN KEY (postId) REFERENCES posts(id),
  FOREIGN KEY (userId) REFERENCES users(id)
);
```

## API 엔드포인트

### 인증 API
- `POST /auth/login` - 로그인
- `POST /auth/register` - 회원가입
- `GET /auth/google` - Google OAuth
- `GET /auth/kakao` - Kakao OAuth

### 사용자 API
- `GET /users/profile` - 내 프로필 조회
- `PUT /users/profile` - 프로필 수정
- `GET /users` - 모든 사용자 조회 (관리자)
- `DELETE /users/:id` - 사용자 삭제 (관리자)

### 게시글 API
- `GET /posts` - 게시글 목록 조회
- `GET /posts/:id` - 게시글 상세 조회
- `POST /posts` - 게시글 작성 (관리자)
- `PUT /posts/:id` - 게시글 수정
- `DELETE /posts/:id` - 게시글 삭제
- `POST /posts/:id/like` - 좋아요 토글
- `GET /posts/categories` - 카테고리 목록
- `GET /posts/category/:category` - 카테고리별 게시글

### 댓글 API
- `GET /comments/post/:postId` - 게시글별 댓글 조회
- `GET /comments/all` - 모든 댓글 조회 (방명록)
- `POST /comments` - 댓글 작성
- `PUT /comments/:id` - 댓글 수정
- `DELETE /comments/:id` - 댓글 삭제

## 환경 변수 설정

### 개발 환경
```bash
# Backend 실행
cd backend
pnpm install
pnpm start:dev

# Frontend 실행
cd frontend
pnpm install
pnpm dev
```

### 프로덕션 환경
```bash
# Backend 빌드 및 실행
cd backend
pnpm build
pnpm start:prod

# Frontend 빌드 및 실행
cd frontend
pnpm build
pnpm start
```

## 보안 고려사항

1. **JWT 토큰**: 7일 만료, 자동 갱신
2. **비밀번호 해싱**: bcryptjs 사용
3. **CORS 설정**: 프론트엔드 도메인만 허용
4. **입력 검증**: class-validator 사용
5. **SQL 인젝션 방지**: TypeORM 사용
6. **XSS 방지**: React의 기본 이스케이핑

## 성능 최적화

1. **이미지 최적화**: Next.js Image 컴포넌트 사용
2. **코드 스플리팅**: Next.js 자동 코드 스플리팅
3. **캐싱**: React Query 캐싱 전략
4. **인피니트 스크롤**: 성능 최적화된 페이지네이션
5. **지연 로딩**: Intersection Observer API 사용

## 배포 가이드

### AWS EC2 배포
1. EC2 인스턴스 생성 (t2.micro)
2. Node.js, PM2 설치
3. Git에서 코드 클론
4. 환경 변수 설정
5. PM2로 애플리케이션 실행

### AWS RDS 설정
1. MySQL RDS 인스턴스 생성
2. 보안 그룹 설정
3. 데이터베이스 생성
4. 사용자 권한 설정

### AWS S3 설정
1. S3 버킷 생성
2. CORS 설정
3. IAM 사용자 생성 및 권한 부여
4. 환경 변수에 액세스 키 설정

## 향후 개선 사항

1. **RSS 피드**: 게시글 RSS 피드 제공
2. **SEO 최적화**: 메타 태그, 사이트맵
3. **이메일 알림**: 댓글 알림 기능
4. **파일 업로드**: 이미지 업로드 기능
5. **통계 대시보드**: 상세한 분석 기능
6. **백업 시스템**: 자동 백업 기능

## 문제 해결

### 일반적인 문제들
1. **포트 충돌**: 3000, 3001 포트 확인
2. **데이터베이스 연결**: MySQL 서비스 상태 확인
3. **CORS 오류**: 백엔드 CORS 설정 확인
4. **JWT 토큰**: 토큰 만료 시간 확인

### 디버깅 팁
1. 브라우저 개발자 도구 활용
2. 백엔드 로그 확인
3. 데이터베이스 쿼리 로그 확인
4. 네트워크 탭에서 API 요청 확인 

cd frontend && pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link @tiptap/extension-text-style @tiptap/extension-color @tiptap/extension-placeholder

임시 파일 저장 로직