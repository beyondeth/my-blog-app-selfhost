# System Design Document (시스템 설계 문서)

## 목차
1. [시스템 개요](#시스템-개요)
2. [기능 요구사항](#기능-요구사항)
3. [비기능 요구사항](#비기능-요구사항)
4. [기술 선택 이유](#기술-선택-이유)
5. [데이터 모델 설계](#데이터-모델-설계)
6. [API 설계](#api-설계)
7. [보안 설계](#보안-설계)
8. [성능 및 확장성](#성능-및-확장성)
9. [모니터링 및 로깅](#모니터링-및-로깅)
10. [향후 개선 사항](#향후-개선-사항)

---

## 시스템 개요

### 프로젝트 목표

**My Blog App**은 개인 및 팀을 위한 현대적이고 확장 가능한 블로그 플랫폼을 제공합니다.

#### 핵심 목표
1. **사용자 친화적**: 직관적인 UI/UX로 누구나 쉽게 블로그를 운영
2. **풍부한 에디터**: Tiptap 기반 WYSIWYG 에디터로 다양한 콘텐츠 작성 지원
3. **소셜 기능**: 팔로우, 댓글, 좋아요, DM 등 사용자 간 소통 강화
4. **성능 최적화**: 빠른 로딩 속도와 원활한 사용자 경험
5. **확장성**: 트래픽 증가에 대응할 수 있는 아키텍처

### 시스템 특징

- **멀티 유저**: 각 사용자가 독립적인 블로그 운영
- **실시간 통신**: Socket.IO 기반 채팅 및 알림
- **풍부한 콘텐츠**: 텍스트, 이미지, 비디오, 코드 블록 등
- **전문 검색**: PostgreSQL Full-Text Search
- **OAuth2 인증**: Google, GitHub, Kakao 소셜 로그인
- **파일 관리**: AWS S3 기반 이미지 업로드 및 최적화

---

## 기능 요구사항

### 1. 사용자 관리 (Users)

#### 회원가입 및 인증
- 로컬 회원가입 (이메일 + 비밀번호)
- OAuth2 소셜 로그인 (Google, GitHub, Kakao)
- 이메일 인증
- 비밀번호 재설정

#### 프로필 관리
- 사용자 이름, 프로필 이미지, 소개글
- 프로필 공개/비공개 설정
- 계정 삭제 (소프트 삭제)

#### 권한 관리
- 일반 사용자 (USER)
- 관리자 (ADMIN)
- 역할 기반 접근 제어 (RBAC)

### 2. 블로그 관리 (Blogs)

#### 블로그 생성
- 사용자당 1개의 블로그
- 커스텀 URL 슬러그
- 블로그 이름, 설명, 썸네일

#### 블로그 설정
- 공개/비공개 설정
- 댓글 허용 여부
- 커스텀 테마 (향후 추가)

### 3. 포스트 관리 (Posts)

#### 포스트 작성
- Tiptap WYSIWYG 에디터
- 마크다운 지원
- 이미지, 비디오, 코드 블록, 링크
- 초안 저장 및 발행

#### 포스트 관리
- 카테고리 및 태그 지정
- SEO 최적화 (slug, excerpt)
- 조회수, 좋아요, 댓글 통계
- 포스트 수정 및 삭제

#### 포스트 검색 및 필터링
- 전문 검색 (Full-Text Search)
- 카테고리별 필터링
- 태그 기반 검색
- 정렬 (최신순, 인기순, 조회수순)

### 4. 댓글 시스템 (Comments)

- 포스트에 댓글 작성
- 중첩 댓글 (대댓글) 지원
- 댓글 좋아요
- 댓글 수정 및 삭제
- 댓글 알림

### 5. 소셜 기능

#### 팔로우 시스템
- 다른 사용자 팔로우/언팔로우
- 팔로워/팔로잉 목록
- 팔로우한 사용자의 새 포스트 피드

#### 좋아요
- 포스트 좋아요/좋아요 취소
- 댓글 좋아요

#### 북마크
- 포스트 북마크
- 북마크 목록 관리

#### 알림 (Notifications)
- 좋아요 알림
- 댓글 알림
- 팔로우 알림
- 실시간 알림 (Socket.IO)
- 이메일 알림

### 6. 직접 메시지 (DM)

- 1:1 대화 기능
- 실시간 메시지 전송 (Socket.IO)
- 메시지 읽음/안읽음 상태
- 대화 목록 및 검색

### 7. 파일 관리 (Files)

- 이미지 업로드 (AWS S3)
- 이미지 최적화 (리사이징, WebP 변환)
- 파일 프록시 (S3 URL 숨김)
- 업로드 파일 관리

### 8. 관리자 기능 (Admin)

- 사용자 관리
- 포스트 관리
- 에디터 픽 (추천 포스트)
- 신고 내역 처리
- 시스템 모니터링
- Redis 캐시 관리

### 9. 신고 시스템 (Reports)

- 부적절한 포스트/댓글 신고
- 신고 유형 (스팸, 욕설, 저작권 침해 등)
- 관리자 검토 및 조치

---

## 비기능 요구사항

### 1. 성능 (Performance)

| 항목 | 목표 | 현재 상태 |
|------|------|-----------|
| 페이지 로딩 속도 | < 2초 (3G 네트워크) | ✅ 달성 |
| API 응답 시간 | < 200ms (평균) | ✅ 달성 |
| 이미지 최적화 | WebP, 리사이징 | ✅ 구현 |
| 데이터베이스 쿼리 | < 100ms | ✅ 인덱싱 완료 |

### 2. 확장성 (Scalability)

- **수평적 확장**: 무상태(stateless) API 설계로 여러 인스턴스 실행 가능
- **데이터베이스 읽기 복제**: Read Replica 지원
- **캐시 클러스터**: Redis Cluster 지원
- **CDN**: CloudFront를 통한 정적 파일 전송

### 3. 보안 (Security)

- **인증**: JWT + HttpOnly 쿠키
- **비밀번호**: bcrypt 해싱 (salt rounds: 12)
- **XSS 방어**: DOMPurify, Content Security Policy
- **CSRF 방어**: SameSite 쿠키
- **SQL Injection**: TypeORM parameterized queries
- **Rate Limiting**: 다중 시간대 제한 (분당, 시간당, 하루)
- **HTTPS**: 프로덕션 필수

### 4. 가용성 (Availability)

- **목표 가동 시간**: 99.9% (연간 8.7시간 다운타임)
- **Health Check**: `/health` 엔드포인트
- **Auto Restart**: PM2 또는 K8s로 자동 재시작
- **데이터베이스 백업**: 일일 자동 백업
- **장애 복구 계획**: RTO < 1시간, RPO < 1시간

### 5. 유지보수성 (Maintainability)

- **코드 품질**: ESLint, Prettier, TypeScript strict 모드
- **테스트 커버리지**: 단위 테스트 > 70%, E2E 테스트 주요 기능
- **문서화**: API 문서 (Swagger), 코드 주석, README
- **모니터링**: Prometheus 메트릭, 로그 수집

### 6. 사용성 (Usability)

- **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원
- **접근성**: WCAG 2.1 AA 준수 목표
- **다국어 지원**: 한국어 (기본), 영어 (향후 추가)
- **직관적 UI**: Tailwind CSS + Radix UI

---

## 기술 선택 이유

### Frontend: Next.js 14

**선택 이유**:
1. **SSR/SSG**: SEO 최적화 및 빠른 초기 로딩
2. **App Router**: 최신 React 패턴 활용
3. **이미지 최적화**: next/image로 자동 최적화
4. **API Routes**: 간단한 서버 로직 구현 가능
5. **TypeScript**: 타입 안전성

**대안**:
- **Vite + React**: 빠른 개발 환경, 하지만 SSR 없음
- **Remix**: SSR 지원, 하지만 생태계 작음

### Backend: NestJS 10

**선택 이유**:
1. **엔터프라이즈급**: 대규모 애플리케이션에 적합
2. **TypeScript 네이티브**: 일급 지원
3. **모듈화**: 명확한 구조와 의존성 주입
4. **데코레이터**: Express 대비 간결한 코드
5. **풍부한 생태계**: Passport, TypeORM, Swagger 등

**대안**:
- **Express**: 유연하지만 구조 부족
- **Fastify**: 빠르지만 생태계 작음

### Database: PostgreSQL 14

**선택 이유**:
1. **강력한 기능**: JSON, Full-Text Search, 트랜잭션
2. **안정성**: 성숙한 RDBMS
3. **확장성**: Read Replica, Partitioning
4. **타입 안전성**: TypeORM과 잘 통합

**대안**:
- **MySQL**: 널리 사용되지만 기능 제한적
- **MongoDB**: NoSQL, 하지만 관계형 데이터에 부적합

### Cache: Redis 7

**선택 이유**:
1. **빠른 속도**: 인메모리 데이터 구조
2. **다양한 기능**: 캐싱, 세션, 큐 (BullMQ)
3. **Pub/Sub**: 실시간 기능 지원
4. **Persistence**: AOF/RDB 백업

### ORM: TypeORM

**선택 이유**:
1. **TypeScript 지원**: 타입 안전성
2. **마이그레이션**: 자동 생성 및 관리
3. **쿼리 빌더**: SQL과 유사한 API
4. **NestJS 통합**: @nestjs/typeorm

**대안**:
- **Prisma**: 강력한 타입 안전성, 하지만 마이그레이션 제한적
- **Sequelize**: 성숙한 ORM, 하지만 TypeScript 지원 약함

### Editor: Tiptap

**선택 이유**:
1. **확장성**: 플러그인 시스템
2. **현대적**: ProseMirror 기반
3. **React 지원**: @tiptap/react
4. **커스터마이징**: 완전한 제어 가능

**대안**:
- **Quill**: 사용 쉬움, 하지만 확장성 제한적
- **Draft.js**: React 공식, 하지만 복잡함

---

## 데이터 모델 설계

### 엔티티 관계 다이어그램 (ERD)

```
┌─────────────┐     1:1      ┌─────────────┐
│    User     │──────────────│    Blog     │
└─────────────┘              └─────────────┘
       │                            │
       │ 1:N                        │ 1:N
       │                            │
       ▼                            ▼
┌─────────────┐              ┌─────────────┐
│    Post     │◄─────────────│             │
└─────────────┘              └─────────────┘
       │
       │ 1:N
       │
       ▼
┌─────────────┐
│   Comment   │
└─────────────┘

User ←→ User (Follow) [M:N]
User ←→ Post (Like) [M:N]
User ←→ Post (Bookmark) [M:N]
User ←→ Comment (CommentLike) [M:N]
```

### 주요 엔티티 상세

#### User
```typescript
{
  id: UUID (PK)
  email: string (unique)
  password: string (nullable, bcrypt)
  username: string
  profileImage: string
  bio: text
  role: enum (USER, ADMIN)
  authProvider: enum (LOCAL, GOOGLE, GITHUB, KAKAO)
  isEmailVerified: boolean
  subscriptionTier: enum (FREE, BASIC, PRO)
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### Blog
```typescript
{
  id: UUID (PK)
  slug: string (unique)
  name: string
  description: text
  thumbnailUrl: string
  isPublic: boolean
  allowComments: boolean
  userId: UUID (FK → users.id)
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### Post
```typescript
{
  id: UUID (PK)
  title: string
  slug: string (unique)
  content: text (HTML)
  content_markdown: text
  excerpt: text (200자)
  thumbnail: string
  isPublished: boolean
  viewCount: integer
  likeCount: integer
  commentCount: integer
  qualityScore: integer
  tagList: jsonb (태그 배열)
  category: string
  authorId: UUID (FK → users.id)
  blogId: UUID (FK → blogs.id)
  isEditorPick: boolean
  searchVector: tsvector (전문 검색)
  createdAt: timestamp
  updatedAt: timestamp
  publishedAt: timestamp
}
```

### 데이터베이스 정규화

- **제1정규형**: 모든 속성은 원자값
- **제2정규형**: 부분 함수 종속 제거
- **제3정규형**: 이행적 함수 종속 제거

### 인덱스 전략

```sql
-- 성능 최적화를 위한 인덱스

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Posts
CREATE INDEX idx_posts_author_id ON posts("authorId");
CREATE INDEX idx_posts_blog_id ON posts("blogId");
CREATE INDEX idx_posts_is_published ON posts("isPublished");
CREATE INDEX idx_posts_category ON posts(category);

-- Full-Text Search (GIN Index)
CREATE INDEX idx_posts_search_vector ON posts USING GIN(search_vector);
CREATE INDEX idx_posts_tag_list ON posts USING GIN("tagList");

-- Comments
CREATE INDEX idx_comments_post_id ON comments("postId");
CREATE INDEX idx_comments_author_id ON comments("authorId");

-- Follows
CREATE INDEX idx_follows_follower_id ON follows("followerId");
CREATE INDEX idx_follows_following_id ON follows("followingId");
```

---

## API 설계

### RESTful API 설계 원칙

1. **리소스 중심**: URL은 리소스를 나타냄
2. **HTTP 메서드**: GET, POST, PUT/PATCH, DELETE
3. **상태 코드**: 적절한 HTTP 상태 코드 사용
4. **버전 관리**: `/api/v1` 프리픽스
5. **페이지네이션**: 목록 조회 시 페이지네이션
6. **필터링**: 쿼리 파라미터로 필터링
7. **정렬**: `sortBy`, `order` 파라미터

### API 엔드포인트 구조

```
/api/v1
├── /auth
│   ├── POST   /register
│   ├── POST   /login
│   ├── POST   /logout
│   ├── GET    /me
│   └── GET    /{provider}/callback
│
├── /users
│   ├── GET    /:id
│   ├── PATCH  /me
│   └── DELETE /me
│
├── /blogs
│   ├── GET    /my-blog
│   ├── GET    /:slug
│   ├── PUT    /
│   └── DELETE /:id
│
├── /posts
│   ├── GET    /
│   ├── GET    /:slug
│   ├── POST   /
│   ├── PATCH  /:id
│   ├── DELETE /:id
│   ├── POST   /:id/like
│   ├── DELETE /:id/like
│   └── GET    /search
│
├── /comments
│   ├── GET    /posts/:postId/comments
│   ├── POST   /posts/:postId/comments
│   ├── PATCH  /:id
│   ├── DELETE /:id
│   ├── POST   /:id/like
│   └── DELETE /:id/like
│
├── /files
│   ├── POST   /upload
│   ├── GET    /proxy/:key(*)
│   └── GET    /my-files
│
├── /chat
│   ├── GET    /conversations
│   ├── GET    /conversations/:userId
│   └── POST   /messages
│
├── /notifications
│   ├── GET    /
│   ├── PATCH  /:id/read
│   └── PATCH  /read-all
│
├── /follows
│   ├── POST   /:userId
│   ├── DELETE /:userId
│   ├── GET    /:userId/followers
│   └── GET    /:userId/following
│
└── /bookmarks
    ├── POST   /:postId
    ├── DELETE /:postId
    └── GET    /
```

### API 버전 관리

- **현재 버전**: v1
- **하위 호환성**: 기존 API 유지하며 새 버전 추가
- **폐기 정책**: 최소 6개월 사전 공지 후 폐기

---

## 보안 설계

### 인증 (Authentication)

#### JWT 토큰 구조
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user-uuid",
    "email": "user@example.com",
    "role": "USER",
    "iat": 1705132800,
    "exp": 1705133700
  }
}
```

#### 토큰 관리
- **Access Token**: 15분 (짧은 만료 시간)
- **Refresh Token**: 7일 (DB 저장, HttpOnly 쿠키)
- **Token Rotation**: Refresh Token 사용 시 새로운 Refresh Token 발급

### 인가 (Authorization)

#### 역할 기반 접근 제어 (RBAC)
```typescript
// Guards
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
async adminOnlyEndpoint() {
  // ...
}

// Decorators
export function Roles(...roles: Role[]) {
  return SetMetadata('roles', roles);
}
```

#### 리소스 소유권 확인
```typescript
// 포스트 소유자만 수정 가능
async updatePost(postId: string, userId: string) {
  const post = await this.findOne(postId);
  if (post.authorId !== userId) {
    throw new ForbiddenException('Not authorized');
  }
  // ...
}
```

### 데이터 보호

#### 비밀번호 보안
```typescript
// bcrypt 해싱 (salt rounds: 12)
@BeforeInsert()
@BeforeUpdate()
async hashPassword() {
  if (this.password && this.authProvider === AuthProvider.LOCAL) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
}
```

#### 민감한 데이터 제외
```typescript
// class-transformer Exclude 데코레이터
@Column()
@Exclude({ toPlainOnly: true })
password: string;

@Column()
@Exclude({ toPlainOnly: true })
refreshToken: string;
```

### XSS/CSRF 방어

#### XSS 방어
- HttpOnly 쿠키로 JWT 저장
- DOMPurify로 사용자 입력 sanitization
- Content Security Policy (Helmet)

#### CSRF 방어
- SameSite 쿠키: `strict`
- CORS 허용 origin 제한
- 세션 기반 CSRF 토큰

### Rate Limiting

```typescript
// 다중 시간대 Rate Limit
ThrottlerModule.forRoot({
  throttlers: [
    { name: 'minute', ttl: 60000, limit: 3 },   // 분당 3회
    { name: 'hour', ttl: 3600000, limit: 10 },  // 시간당 10회
    { name: 'day', ttl: 86400000, limit: 20 }   // 하루 20회
  ]
})
```

---

## 성능 및 확장성

### 캐싱 전략

#### 1. 애플리케이션 레벨 캐싱 (Redis)

```typescript
// 포스트 상세 캐싱
const cacheKey = `post:${postId}`;
const cached = await this.cacheManager.get(cacheKey);

if (cached) {
  return cached;
}

const post = await this.postsRepository.findOne({ where: { id: postId } });
await this.cacheManager.set(cacheKey, post, 3600); // 1시간 TTL

return post;
```

#### 2. 데이터베이스 레벨 최적화

**Connection Pooling**:
```typescript
TypeOrmModule.forRoot({
  extra: {
    max: 20,  // 최대 연결 수
    min: 5,   // 최소 연결 수
    idleTimeoutMillis: 30000,
  }
})
```

**Eager Loading** (N+1 문제 해결):
```typescript
// N+1 문제
const posts = await this.postsRepository.find();
for (const post of posts) {
  await post.author; // N번의 추가 쿼리
}

// Eager Loading으로 해결
const posts = await this.postsRepository.find({
  relations: ['author', 'blog']
});
```

#### 3. CDN 활용

- **정적 파일**: CloudFront로 서빙
- **이미지 최적화**: WebP, 리사이징
- **캐시 제어**: Cache-Control 헤더

### 확장성 설계

#### 수평적 확장 (Horizontal Scaling)

1. **무상태 API**: 세션을 Redis에 저장
2. **로드 밸런싱**: Nginx/ALB
3. **데이터베이스 읽기 복제**: Read Replica
4. **캐시 클러스터**: Redis Cluster

#### 수직적 확장 (Vertical Scaling)

1. **서버 스펙 업그레이드**: CPU, 메모리 증가
2. **데이터베이스 최적화**: 인덱스, 쿼리 튜닝

### 비동기 처리

#### BullMQ 큐
```typescript
// 포스트 검색 인덱싱 (비동기)
await this.postIndexingQueue.add('index-post', {
  postId: post.id
});

// 이메일 발송 (비동기)
await this.emailQueue.add('send-email', {
  to: user.email,
  subject: 'Welcome!',
  template: 'welcome'
});
```

---

## 모니터링 및 로깅

### 로깅 전략

#### 로그 레벨
- **ERROR**: 즉시 대응 필요한 오류
- **WARN**: 주의가 필요한 경고
- **LOG**: 일반 정보
- **DEBUG**: 디버깅 정보 (개발 환경)
- **VERBOSE**: 상세 정보 (개발 환경)

#### 로그 포맷
```typescript
{
  timestamp: '2025-01-13T10:00:00Z',
  level: 'ERROR',
  context: 'PostsService',
  message: 'Failed to create post',
  userId: 'uuid',
  error: {
    message: 'Database connection error',
    stack: '...'
  }
}
```

### Prometheus 메트릭

```typescript
// HTTP 요청 메트릭
http_requests_total{method="GET", endpoint="/posts", status="200"}

// 응답 시간
http_request_duration_seconds{method="GET", endpoint="/posts"}

// 데이터베이스 쿼리
database_queries_total{operation="SELECT", table="posts"}

// 캐시 히트율
cache_hits_total / cache_requests_total
```

### 알림 (Alerting)

- **다운타임**: 즉시 알림
- **높은 에러율**: > 5% 시 알림
- **느린 응답 시간**: > 500ms 시 알림
- **높은 메모리 사용**: > 80% 시 알림

---

## 향후 개선 사항

### 단기 (1-3개월)

1. **구독제 기능**: Stripe 연동, 유료 플랜
2. **Analytics**: 상세한 방문자 통계
3. **이메일 구독**: 뉴스레터 기능
4. **SEO 최적화**: OG 태그, 사이트맵
5. **다크 모드**: 테마 전환 기능

### 중기 (3-6개월)

1. **모바일 앱**: React Native 개발
2. **AI 추천**: 포스트 추천 알고리즘
3. **다국어 지원**: i18n 구현
4. **커스텀 도메인**: 사용자 도메인 연결
5. **고급 에디터**: 협업 편집, 버전 관리

### 장기 (6-12개월)

1. **마이크로서비스**: 서비스 분리 (Auth, Content, Social)
2. **GraphQL API**: REST API와 병행 제공
3. **실시간 협업**: 다중 사용자 동시 편집
4. **AI 글쓰기 도우미**: GPT 기반 작성 지원
5. **커뮤니티 기능**: 그룹, 이벤트, 포럼

### 기술 부채 관리

1. **테스트 커버리지 향상**: 단위 테스트 > 80%, E2E 테스트 확대
2. **코드 리팩토링**: 중복 코드 제거, 패턴 통일
3. **문서화 개선**: API 문서, 아키텍처 문서 업데이트
4. **의존성 업데이트**: 정기적인 라이브러리 업데이트
5. **성능 최적화**: 프로파일링 및 병목 지점 개선

---

## 결론

이 시스템 설계 문서는 My Blog App의 기술적 기반과 설계 결정을 상세히 설명합니다. 이 문서를 기반으로:

1. **확장 가능한 아키텍처**: 트래픽 증가에 대응 가능
2. **보안 중심 설계**: 다층 보안 체계로 사용자 보호
3. **성능 최적화**: 빠른 응답 시간과 사용자 경험
4. **유지보수 용이성**: 명확한 구조와 문서화
5. **향후 발전 가능성**: 기능 확장 및 개선 로드맵

향후 요구사항 변화에 따라 이 문서는 지속적으로 업데이트될 것입니다.

---

**마지막 업데이트**: 2025-01-13
**버전**: 1.0.0
