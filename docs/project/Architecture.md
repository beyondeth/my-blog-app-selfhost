# 아키텍처 문서 (Architecture Document)

## 목차
1. [시스템 개요](#시스템-개요)
2. [아키텍처 다이어그램](#아키텍처-다이어그램)
3. [기술 스택](#기술-스택)
4. [모듈 구조](#모듈-구조)
5. [데이터베이스 설계](#데이터베이스-설계)
6. [통신 구조](#통신-구조)
7. [보안 아키텍처](#보안-아키텍처)
8. [캐싱 전략](#캐싱-전략)
9. [파일 저장소 아키텍처](#파일-저장소-아키텍처)

---

## 시스템 개요

### 아키텍처 패턴
- **전체 패턴**: 클라이언트-서버 아키텍처
- **프론트엔드**: SPA (Single Page Application) with SSR (Server-Side Rendering)
- **백엔드**: Layered Architecture (Controller → Service → Repository)
- **통신**: RESTful API + WebSocket (실시간 기능)
- **데이터**: Relational Database (PostgreSQL) + In-Memory Cache (Redis)

### 핵심 설계 원칙
1. **관심사의 분리 (Separation of Concerns)**
   - 프론트엔드와 백엔드 명확한 분리
   - 각 모듈은 단일 책임을 가짐

2. **확장성 (Scalability)**
   - 수평적 확장이 가능한 무상태(stateless) API
   - Redis를 통한 세션 공유
   - S3를 통한 파일 저장소 분리

3. **보안 (Security)**
   - JWT 기반 인증
   - HttpOnly 쿠키로 XSS 방어
   - Helmet.js로 HTTP 헤더 보안
   - bcrypt 암호화
   - DTO 기반 입력 검증

4. **성능 최적화 (Performance)**
   - Redis 캐싱
   - PostgreSQL 인덱싱
   - 이미지 최적화
   - CDN 활용 (S3 + CloudFront)

---

## 아키텍처 다이어그램

### 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Next.js 14 (App Router) - Port 3001                │   │
│  │  - React 18 + TypeScript                            │   │
│  │  - React Query (데이터 캐싱)                         │   │
│  │  - Zustand (전역 상태)                               │   │
│  │  - Tiptap Editor                                     │   │
│  │  - Socket.IO Client (실시간 통신)                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/HTTPS (REST API)
                            │ WebSocket (Socket.IO)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  NestJS 10 - Port 3000                              │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │  Controllers (API 엔드포인트)                   │ │   │
│  │  │  - AuthController, UsersController             │ │   │
│  │  │  - PostsController, BlogsController            │ │   │
│  │  │  - CommentsController, ChatGateway             │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │  Services (비즈니스 로직)                       │ │   │
│  │  │  - AuthService, UsersService                   │ │   │
│  │  │  - PostsService, BlogsService                  │ │   │
│  │  │  - ChatService, EmailService                   │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │  Middleware & Guards                           │ │   │
│  │  │  - JwtAuthGuard, RolesGuard                    │ │   │
│  │  │  - ValidationPipe, ThrottlerGuard              │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────┐ │
│  │  PostgreSQL 14   │  │    Redis 7       │  │  AWS S3   │ │
│  │  (Port 5432)     │  │  (Port 6379)     │  │           │ │
│  │                  │  │                  │  │           │ │
│  │  - Users         │  │  - Sessions      │  │  - Images │ │
│  │  - Blogs         │  │  - Cache         │  │  - Files  │ │
│  │  - Posts         │  │  - Queue (BullMQ)│  │           │ │
│  │  - Comments      │  │  - PubSub        │  │           │ │
│  │  - Files         │  │                  │  │           │ │
│  └──────────────────┘  └──────────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 요청 흐름 (Request Flow)

#### 1. 일반 HTTP 요청
```
Client (Browser)
    │
    │ 1. HTTP Request (with JWT Cookie)
    ▼
Next.js (SSR/CSR)
    │
    │ 2. API Call
    ▼
NestJS API Gateway
    │
    │ 3. JWT 검증 (JwtAuthGuard)
    ▼
Controller
    │
    │ 4. DTO 검증 (ValidationPipe)
    ▼
Service (Business Logic)
    │
    ├─── 5a. Cache 확인 (Redis)
    │         │
    │         ├── Cache Hit → Return
    │         └── Cache Miss ↓
    │
    └─── 5b. Database 조회 (TypeORM)
              │
              ├── PostgreSQL Query
              │
              └── 6. Cache 저장 (Redis)
    ▼
Response (JSON)
```

#### 2. WebSocket 통신 (실시간 DM)
```
Client Socket.IO
    │
    │ 1. Socket Connection (with JWT)
    ▼
NestJS Gateway
    │
    │ 2. JWT 검증 & Connection 관리
    ▼
Chat Service
    │
    ├─── 3a. Message 저장 (PostgreSQL)
    │
    └─── 3b. Pub/Sub (Redis)
              │
              └── 4. Emit to Rooms/Users
    ▼
Client Receives Message
```

---

## 기술 스택

### Frontend Stack

| 카테고리 | 기술 | 버전 | 용도 |
|---------|------|------|------|
| **프레임워크** | Next.js | 14.0.3 | SSR/SSG, App Router |
| **UI 라이브러리** | React | 18.2.0 | 컴포넌트 기반 UI |
| **언어** | TypeScript | 5.3.2 | 타입 안전성 |
| **상태 관리** | React Query | 5.81.2 | 서버 상태 관리 |
| **상태 관리** | Zustand | 5.0.8 | 클라이언트 상태 관리 |
| **에디터** | Tiptap | 2.14.0 | WYSIWYG 에디터 |
| **스타일링** | Tailwind CSS | 3.3.6 | Utility-first CSS |
| **UI 컴포넌트** | Radix UI | 2.x | Headless UI 컴포넌트 |
| **폼 관리** | React Hook Form | 7.58.1 | 폼 상태 및 검증 |
| **검증** | Zod | 3.25.67 | 스키마 검증 |
| **실시간** | Socket.IO Client | 4.8.1 | WebSocket 통신 |
| **차트** | ApexCharts | 5.3.3 | 데이터 시각화 |
| **아이콘** | Lucide React | 0.522.0 | 아이콘 라이브러리 |

### Backend Stack

| 카테고리 | 기술 | 버전 | 용도 |
|---------|------|------|------|
| **프레임워크** | NestJS | 10.0.0 | 엔터프라이즈급 Node.js 프레임워크 |
| **언어** | TypeScript | 5.1.3 | 타입 안전성 |
| **ORM** | TypeORM | 0.3.17 | Database ORM |
| **데이터베이스** | PostgreSQL | 14 | 메인 데이터베이스 |
| **캐시** | Redis | 7 | 캐싱 및 세션 저장소 |
| **큐** | BullMQ | 5.58.5 | 작업 큐 (Redis 기반) |
| **인증** | Passport | 0.6.0 | 인증 미들웨어 |
| **JWT** | @nestjs/jwt | 10.1.0 | JWT 토큰 관리 |
| **암호화** | bcrypt | 6.0.0 | 비밀번호 해싱 |
| **검증** | class-validator | 0.14.0 | DTO 검증 |
| **파일 저장소** | AWS SDK S3 | 3.832.0 | 파일 업로드/다운로드 |
| **실시간** | Socket.IO | 4.8.1 | WebSocket 서버 |
| **이메일** | Nodemailer | 7.0.5 | 이메일 발송 |
| **보안** | Helmet | 7.0.0 | HTTP 헤더 보안 |
| **압축** | Compression | 1.7.4 | HTTP 응답 압축 |
| **문서화** | Swagger | 7.1.0 | API 문서 자동 생성 |

### Infrastructure

| 카테고리 | 기술 | 버전 | 용도 |
|---------|------|------|------|
| **컨테이너** | Docker | Latest | 컨테이너화 |
| **오케스트레이션** | Docker Compose | Latest | 로컬 개발 환경 |
| **DB** | PostgreSQL | 14 | 관계형 데이터베이스 |
| **캐시** | Redis | 7 | 인메모리 캐시 |
| **스토리지** | AWS S3 | - | 객체 스토리지 |
| **CDN** | CloudFront | - | 콘텐츠 전송 |
| **모니터링** | Prometheus | - | 메트릭 수집 (선택적) |

---

## 모듈 구조

### Frontend 모듈

```
frontend/src/
├── app/                    # Next.js App Router
│   ├── (routes)/           # 라우트 페이지
│   ├── api/                # API Routes (선택적)
│   ├── layout.tsx          # 전역 레이아웃
│   └── page.tsx            # 홈페이지
│
├── components/             # 재사용 가능한 컴포넌트
│   ├── ui/                 # 기본 UI 컴포넌트
│   ├── layout/             # 레이아웃 컴포넌트
│   ├── post/               # 포스트 관련 컴포넌트
│   ├── blog/               # 블로그 관련 컴포넌트
│   └── auth/               # 인증 관련 컴포넌트
│
├── editor/                 # Tiptap 에디터
│   ├── extensions/         # 커스텀 확장
│   ├── components/         # 에디터 UI
│   └── utils/              # 에디터 유틸리티
│
├── hooks/                  # 커스텀 React Hooks
│   ├── useAuth.ts          # 인증 훅
│   ├── usePosts.ts         # 포스트 데이터 훅
│   └── useSocket.ts        # Socket.IO 훅
│
├── lib/                    # 유틸리티 및 헬퍼
│   ├── api.ts              # API 클라이언트
│   ├── auth.ts             # 인증 헬퍼
│   └── utils.ts            # 일반 유틸리티
│
├── services/               # API 서비스 레이어
│   ├── auth.service.ts     # 인증 API
│   ├── posts.service.ts    # 포스트 API
│   └── chat.service.ts     # 채팅 API
│
├── stores/                 # Zustand 상태 저장소
│   ├── authStore.ts        # 인증 상태
│   ├── chatStore.ts        # 채팅 상태
│   └── editorStore.ts      # 에디터 상태
│
└── types/                  # TypeScript 타입 정의
    ├── api.types.ts        # API 타입
    ├── post.types.ts       # 포스트 타입
    └── user.types.ts       # 사용자 타입
```

### Backend 모듈

```
backend/src/
├── auth/                   # 인증 모듈
│   ├── auth.controller.ts  # 인증 API 엔드포인트
│   ├── auth.service.ts     # 인증 비즈니스 로직
│   ├── auth.module.ts      # 인증 모듈 정의
│   ├── strategies/         # Passport 전략
│   │   ├── jwt.strategy.ts
│   │   ├── google.strategy.ts
│   │   ├── github.strategy.ts
│   │   └── kakao.strategy.ts
│   └── dto/                # 데이터 전송 객체
│
├── users/                  # 사용자 모듈
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.module.ts
│   └── entities/
│       ├── user.entity.ts
│       └── user-identity.entity.ts
│
├── blogs/                  # 블로그 모듈
│   ├── blogs.controller.ts
│   ├── blogs.service.ts
│   ├── blogs.module.ts
│   └── entities/
│       └── blog.entity.ts
│
├── posts/                  # 포스트 모듈
│   ├── posts.controller.ts
│   ├── posts.service.ts
│   ├── posts.module.ts
│   ├── services/           # 추가 서비스
│   │   ├── post-indexing.service.ts  # 검색 인덱싱
│   │   ├── post-rendering.service.ts # 렌더링
│   │   └── post-validation.service.ts
│   ├── workers/            # BullMQ 워커
│   │   └── post-indexing.worker.ts
│   └── entities/
│       └── post.entity.ts
│
├── comments/               # 댓글 모듈
│   ├── comments.controller.ts
│   ├── comments.service.ts
│   ├── comments.module.ts
│   └── entities/
│       ├── comment.entity.ts
│       └── comment-like.entity.ts
│
├── chat/                   # 채팅 모듈
│   ├── gateways/
│   │   └── chat.gateway.ts      # Socket.IO 게이트웨이
│   ├── services/
│   │   └── chat.service.ts
│   ├── controllers/
│   │   └── chat.controller.ts
│   ├── repositories/
│   │   └── message.repository.ts
│   └── entities/
│       ├── conversation.entity.ts
│       ├── message.entity.ts
│       └── user-block.entity.ts
│
├── files/                  # 파일 관리 모듈
│   ├── files.controller.ts
│   ├── files.service.ts
│   ├── files.module.ts
│   └── entities/
│       ├── file.entity.ts
│       └── file-context.entity.ts
│
├── cache/                  # 캐시 모듈
│   ├── cache.module.ts
│   └── cache.service.ts
│
├── redis/                  # Redis 모듈
│   ├── redis.module.ts
│   └── redis.service.ts
│
├── email/                  # 이메일 모듈
│   ├── email.service.ts
│   ├── email.module.ts
│   └── templates/          # 이메일 템플릿
│
├── notifications/          # 알림 모듈
│   ├── notifications.controller.ts
│   ├── notifications.service.ts
│   └── entities/
│       └── notification.entity.ts
│
├── follows/                # 팔로우 모듈
│   ├── follows.controller.ts
│   ├── follows.service.ts
│   └── entities/
│       └── follow.entity.ts
│
├── bookmarks/              # 북마크 모듈
│   ├── bookmarks.controller.ts
│   ├── bookmarks.service.ts
│   └── entities/
│       └── bookmark.entity.ts
│
├── reports/                # 신고 모듈
│   ├── reports.controller.ts
│   ├── reports.service.ts
│   └── entities/
│       └── report.entity.ts
│
├── admin/                  # 관리자 모듈
│   ├── admin.controller.ts
│   ├── admin.service.ts
│   └── admin.module.ts
│
├── common/                 # 공통 모듈
│   ├── guards/             # Guards
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── optional-jwt-auth.guard.ts
│   ├── decorators/         # 커스텀 데코레이터
│   ├── enums/              # Enum 정의
│   ├── filters/            # 예외 필터
│   ├── interceptors/       # 인터셉터
│   └── pipes/              # 파이프
│
├── config/                 # 설정 파일
│   ├── database.config.ts
│   ├── jwt.config.ts
│   └── s3.config.ts
│
├── migrations/             # TypeORM 마이그레이션
├── app.module.ts           # 루트 모듈
└── main.ts                 # 애플리케이션 진입점
```

---

## 데이터베이스 설계

### 주요 엔티티 (Entities)

#### 1. User (사용자)
```typescript
- id: UUID (PK)
- email: string (unique)
- password: string (nullable, 소셜 로그인용)
- username: string
- profileImage: string
- bio: text
- role: enum (USER, ADMIN)
- authProvider: enum (LOCAL, GOOGLE, GITHUB, KAKAO)
- isEmailVerified: boolean
- subscriptionTier: enum (FREE, BASIC, PRO)
- createdAt: timestamp
- updatedAt: timestamp
```

#### 2. Blog (블로그)
```typescript
- id: UUID (PK)
- slug: string (unique)
- name: string
- description: text
- thumbnailUrl: string
- isPublic: boolean
- allowComments: boolean
- userId: UUID (FK → users.id)
- createdAt: timestamp
- updatedAt: timestamp
```

#### 3. Post (포스트)
```typescript
- id: UUID (PK)
- title: string
- slug: string (unique)
- content: text (HTML)
- content_markdown: text
- excerpt: text (200자 요약)
- thumbnail: string
- isPublished: boolean
- viewCount: integer
- likeCount: integer
- commentCount: integer
- qualityScore: integer
- tagList: jsonb (태그 배열)
- category: string
- authorId: UUID (FK → users.id)
- blogId: UUID (FK → blogs.id)
- isEditorPick: boolean
- searchVector: tsvector (전문 검색용)
- createdAt: timestamp
- updatedAt: timestamp
- publishedAt: timestamp
```

#### 4. Comment (댓글)
```typescript
- id: UUID (PK)
- content: text
- postId: UUID (FK → posts.id)
- authorId: UUID (FK → users.id)
- parentId: UUID (FK → comments.id, nullable)
- isDeleted: boolean
- likeCount: integer
- createdAt: timestamp
- updatedAt: timestamp
```

#### 5. File (파일)
```typescript
- id: UUID (PK)
- originalName: string
- filename: string (S3 키)
- mimeType: string
- size: integer
- s3Key: string
- s3Url: string
- uploaderId: UUID (FK → users.id)
- createdAt: timestamp
```

### 주요 관계 (Relationships)

```
User (1) ←→ (1) Blog
User (1) ←→ (N) Post (author)
User (1) ←→ (N) Comment (author)
User (1) ←→ (N) File (uploader)
User (M) ←→ (N) Post (likes) [post_likes]
User (M) ←→ (N) User (follows) [follows]
User (M) ←→ (N) Post (bookmarks) [bookmarks]

Blog (1) ←→ (N) Post
Post (1) ←→ (N) Comment
Post (M) ←→ (N) File (attachedFiles) [post_files]

Comment (1) ←→ (N) Comment (replies)
```

### 인덱스 전략

```sql
-- 성능 최적화를 위한 주요 인덱스

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- Posts
CREATE INDEX idx_posts_author_id ON posts("authorId");
CREATE INDEX idx_posts_blog_id ON posts("blogId");
CREATE INDEX idx_posts_is_published ON posts("isPublished");
CREATE INDEX idx_posts_category ON posts(category);
CREATE INDEX idx_posts_editor_pick ON posts("isEditorPick", "editorPickedAt");

-- 전문 검색 인덱스 (GIN)
CREATE INDEX idx_posts_search_vector ON posts USING GIN(search_vector);
CREATE INDEX idx_posts_tag_list ON posts USING GIN("tagList");

-- Comments
CREATE INDEX idx_comments_post_id ON comments("postId");
CREATE INDEX idx_comments_author_id ON comments("authorId");
CREATE INDEX idx_comments_parent_id ON comments("parentId");

-- Follows
CREATE INDEX idx_follows_follower_id ON follows("followerId");
CREATE INDEX idx_follows_following_id ON follows("followingId");
```

---

## 통신 구조

### 1. RESTful API 통신

#### 요청/응답 형식
```typescript
// 요청 (Request)
{
  method: 'POST',
  url: '/api/v1/posts',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <jwt-token>' // 또는 HttpOnly Cookie
  },
  body: {
    title: '포스트 제목',
    content: '<p>포스트 내용</p>',
    isPublished: true
  }
}

// 성공 응답 (Success Response)
{
  statusCode: 200,
  data: {
    id: 'uuid',
    title: '포스트 제목',
    slug: 'post-title-abc123',
    createdAt: '2025-01-13T10:00:00Z'
  }
}

// 에러 응답 (Error Response)
{
  statusCode: 400,
  message: 'Validation failed',
  errors: [
    {
      field: 'title',
      message: 'Title is required'
    }
  ]
}
```

#### HTTP 상태 코드
- `200 OK`: 성공
- `201 Created`: 생성 성공
- `204 No Content`: 삭제 성공
- `400 Bad Request`: 잘못된 요청
- `401 Unauthorized`: 인증 실패
- `403 Forbidden`: 권한 없음
- `404 Not Found`: 리소스 없음
- `422 Unprocessable Entity`: 검증 실패
- `500 Internal Server Error`: 서버 오류

### 2. WebSocket 통신 (Socket.IO)

#### 연결 흐름
```
1. Client → Server: Connection Request (with JWT)
2. Server: JWT 검증
3. Server → Client: Connection Established
4. Client ↔ Server: Event 송수신
5. Client/Server: Disconnect
```

#### 주요 이벤트

**채팅 (Chat)**
```typescript
// Client → Server
socket.emit('sendMessage', {
  conversationId: 'uuid',
  content: 'Hello!',
  recipientId: 'uuid'
});

// Server → Client
socket.on('newMessage', (message) => {
  // 새 메시지 수신
});

// 읽음 상태
socket.emit('markAsRead', {
  conversationId: 'uuid'
});
```

**알림 (Notifications)**
```typescript
// Server → Client
socket.on('notification', (notification) => {
  // type: 'like', 'comment', 'follow', etc.
  // message: '홍길동님이 회원님의 포스트에 좋아요를 눌렀습니다.'
});
```

### 3. 인증 흐름

#### JWT 기반 인증
```
1. 사용자 로그인
2. 서버: JWT 토큰 생성
3. 서버 → 클라이언트: HttpOnly 쿠키에 JWT 저장
4. 이후 요청: 자동으로 쿠키 포함
5. 서버: JWT 검증 (JwtAuthGuard)
6. 검증 성공 → 요청 처리
```

#### OAuth2 흐름
```
1. 사용자: "Google로 로그인" 클릭
2. 서버 → OAuth Provider: 인증 요청
3. OAuth Provider → 사용자: 인증 페이지
4. 사용자 → OAuth Provider: 권한 승인
5. OAuth Provider → 서버: Authorization Code
6. 서버 → OAuth Provider: Access Token 요청
7. OAuth Provider → 서버: Access Token + Profile
8. 서버: 사용자 정보 저장/업데이트
9. 서버 → 클라이언트: JWT 토큰 (쿠키)
```

---

## 보안 아키텍처

### 1. 인증 및 권한

#### JWT 토큰 관리
- **Access Token**: 15분 (짧은 만료 시간)
- **Refresh Token**: 7일 (DB 저장, HttpOnly 쿠키)
- **Token Rotation**: Refresh Token 사용 시 새로운 Refresh Token 발급

#### 비밀번호 보안
- **해싱**: bcrypt (salt rounds: 12)
- **정책**: 최소 8자, 영문/숫자/특수문자 조합
- **재설정**: 이메일 기반, 1회용 토큰 (1시간 유효)

### 2. XSS/CSRF 방어

#### XSS 방어
- HttpOnly 쿠키로 JWT 저장 (JavaScript 접근 불가)
- 사용자 입력 sanitization (DOMPurify)
- Content Security Policy (Helmet)

#### CSRF 방어
- SameSite Cookie 설정: `strict`
- CORS 설정: 허용된 origin만 접근
- 세션 기반 CSRF 토큰 (폼 제출용)

### 3. 입력 검증

```typescript
// DTO 기반 검증 (class-validator)
export class CreatePostDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}
```

### 4. Rate Limiting

```typescript
// 다중 시간대 Rate Limit
throttlers: [
  { name: 'minute', ttl: 60000, limit: 3 },   // 분당 3회
  { name: 'hour', ttl: 3600000, limit: 10 },  // 시간당 10회
  { name: 'day', ttl: 86400000, limit: 20 }   // 하루 20회
]
```

### 5. 보안 헤더 (Helmet)

```typescript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "*.s3.amazonaws.com"],
      connectSrc: ["'self'", "https:"]
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
})
```

---

## 캐싱 전략

### Redis 캐싱 레이어

#### 1. 데이터 캐싱
```typescript
// 포스트 상세 캐싱
Key: `post:${postId}`
TTL: 1시간
Strategy: Cache-Aside (Lazy Loading)

// 사용자 프로필 캐싱
Key: `user:${userId}`
TTL: 30분
Strategy: Write-Through

// 인기 포스트 캐싱
Key: `posts:popular`
TTL: 10분
Strategy: Cache-Aside with Background Refresh
```

#### 2. 세션 캐싱
```typescript
// Socket.IO 세션
Key: `socket:${socketId}`
TTL: 24시간

// JWT Refresh Token
Key: `refresh:${userId}`
TTL: 7일
```

#### 3. 큐 (BullMQ)
```typescript
// 포스트 검색 인덱싱
Queue: 'post-indexing'
Priority: High
Retry: 3회

// 이메일 발송
Queue: 'email'
Priority: Medium
Retry: 5회
```

#### 4. 캐시 무효화 (Cache Invalidation)
```typescript
// 포스트 수정 시
await cache.del(`post:${postId}`);
await cache.del(`posts:popular`);
await cache.del(`blog:${blogId}:posts`);

// 패턴 기반 무효화
await cache.keys('post:*').then(keys => cache.del(...keys));
```

---

## 파일 저장소 아키텍처

### AWS S3 구조

```
s3-bucket/
├── uploads/
│   ├── images/
│   │   ├── {userId}/
│   │   │   └── {filename}.{ext}
│   │   └── thumbnails/
│   │       └── {filename}-thumb.{ext}
│   ├── avatars/
│   │   └── {userId}.{ext}
│   └── documents/
│       └── {userId}/
│           └── {filename}.{ext}
```

### 파일 업로드 흐름

```
1. Client: 파일 선택
2. Client → Server: Multipart Upload
3. Server: 파일 검증 (크기, 타입, 악성코드)
4. Server: 이미지 최적화 (Sharp)
   - 리사이징
   - 포맷 변환 (WebP)
   - 압축
5. Server → S3: 업로드
6. S3 → Server: S3 URL
7. Server: DB에 파일 메타데이터 저장
8. Server → Client: 파일 정보 반환
```

### CDN 통합 (CloudFront)

```
S3 Bucket → CloudFront Distribution → Client

장점:
- 전 세계 엣지 로케이션에서 빠른 전송
- S3 직접 접근 비용 절감
- 자동 HTTPS 적용
- 캐싱으로 성능 향상
```

### 파일 접근 제어

```typescript
// Public 파일 (블로그 이미지)
- ACL: public-read
- URL: https://cdn.example.com/uploads/images/...

// Private 파일 (프로필 이미지)
- ACL: private
- Presigned URL 생성 (1시간 유효)
- URL: https://s3.amazonaws.com/bucket/...?X-Amz-Signature=...
```

---

## 확장성 고려사항

### 수평적 확장 (Horizontal Scaling)

1. **무상태 API**: 세션을 Redis에 저장하여 여러 서버 인스턴스 실행 가능
2. **로드 밸런싱**: Nginx/ALB를 통한 트래픽 분산
3. **데이터베이스 읽기 복제**: Read Replica로 읽기 부하 분산
4. **캐시 클러스터**: Redis Cluster로 캐시 확장

### 성능 최적화

1. **Database Indexing**: 자주 조회되는 컬럼에 인덱스
2. **Query Optimization**: N+1 문제 해결 (Eager Loading)
3. **Connection Pooling**: 데이터베이스 연결 풀
4. **Response Compression**: Gzip/Brotli 압축
5. **Image Optimization**: WebP 포맷, Lazy Loading
6. **Code Splitting**: Next.js Dynamic Import

---

## 모니터링 및 로깅

### 로깅 전략

```typescript
// 로그 레벨
- ERROR: 오류 발생 (즉시 대응 필요)
- WARN: 경고 (모니터링 필요)
- LOG: 일반 정보
- DEBUG: 디버깅 정보 (개발 환경만)
- VERBOSE: 상세 정보 (개발 환경만)
```

### 메트릭 수집 (Prometheus)

```yaml
# 주요 메트릭
- http_requests_total: HTTP 요청 수
- http_request_duration_seconds: 응답 시간
- database_queries_total: DB 쿼리 수
- cache_hits_total: 캐시 히트율
- active_connections: 활성 연결 수
```

### Health Check

```typescript
// /health 엔드포인트
{
  status: 'ok',
  timestamp: '2025-01-13T10:00:00Z',
  uptime: 86400,
  services: {
    database: 'healthy',
    redis: 'healthy',
    s3: 'healthy'
  }
}
```

---

## 결론

이 아키텍처는 다음과 같은 목표를 달성하기 위해 설계되었습니다:

1. **확장성**: 트래픽 증가에 대응할 수 있는 구조
2. **성능**: 빠른 응답 시간과 효율적인 리소스 사용
3. **보안**: 다층 보안 체계로 사용자 데이터 보호
4. **유지보수성**: 명확한 모듈 분리와 표준화된 패턴
5. **개발 생산성**: 현대적인 도구와 프레임워크 활용

향후 트래픽과 기능 요구사항에 따라 마이크로서비스 아키텍처로의 전환을 고려할 수 있습니다.
