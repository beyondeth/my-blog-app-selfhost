# Codebase.blog - Enterprise SaaS Blog Platform

> AI 자동 포스팅 시스템(MCP)을 갖춘 엔터프라이즈급 멀티유저 블로그 플랫폼

---

## 📋 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **프로젝트명** | Codebase.blog |
| **유형** | 개인 프로젝트 (1인 Full-Stack 개발) |
| **개발 기간** | 2024.06 ~ 현재 (진행 중) |
| **코드 규모** | 62,000+ 줄 TypeScript |
| **라이브 URL** | https://codebase.blog |
| **GitHub** | Private Repository (면접 시 공개 가능) |

### 프로젝트 소개

Codebase.blog는 **MCP(Model Context Protocol) 기반 AI 자동 포스팅 시스템**을 핵심으로 하는 SaaS 블로그 플랫폼입니다.

일반적인 블로그 플랫폼과 달리, AI를 활용한 콘텐츠 자동 생성 기능을 구독 기반으로 제공하여 **기술 블로거의 생산성을 극대화**하는 것을 목표로 합니다.

### 핵심 가치

```
사용자 생성 콘텐츠(UGC) + AI 자동화(MCP) + 구독 수익화
```

---

## ⭐ 핵심 기능

### 1. MCP 자동 블로그 시스템

AI를 활용한 블로그 포스트 자동 생성 시스템

```
MCP Proxy Server (Port 3002)
├── API Key 기반 인증 (Stripe 스타일)
├── 5가지 Writing Styles (default, novel, comedy, podcast, tutorial)
├── 사용량 추적 및 제한 (플랜별 차등)
├── Rate Limiting (200 req/hour)
└── 관리자 통계 (월별, 사용자별, 시간별)
```

**API Key 보안 설계:**
- Stripe 스타일 키 형식: `blog_sk_{hint}_{secret}`
- 90일 만료 정책
- 사용자당 1개 API Key 제한
- 생성 시 1회만 표시 (재조회 불가)

### 2. 3단계 구독 모델

| 플랜 | 일반 포스트 | MCP 자동포스팅 | 가격 |
|------|-----------|--------------|------|
| **FREE** | 무제한 | 월 30개 | 무료 |
| **STARTER** | 무제한 | 월 200개 | $9/월 ($90/년) |
| **PRO** | 무제한 | 월 400개 | $19/월 ($190/년) |

### 3. 실시간 기능

- **Socket.io 기반 DM 시스템**: 1:1 다이렉트 메시징
- **실시간 알림**: 팔로우, 좋아요, 댓글, 멘션
- **BullMQ 작업 큐**: 배치 처리로 성능 최적화

### 4. 소셜 기능

- OAuth2 인증 (Google, GitHub, Kakao)
- 팔로우/언팔로우 시스템
- 계층형 댓글 (대댓글 지원)
- 좋아요/북마크
- 신고 시스템

### 5. 관리자 대시보드

- 실시간 통계 (DAU, MAU, 포스트 수, 댓글 수)
- 사용자 관리
- 콘텐츠 모더레이션
- MCP 사용량 통계

---

## 🛠 기술 스택

### Frontend

| 분류 | 기술 | 버전 |
|------|------|------|
| **Framework** | Next.js (App Router) | 16.0.1 |
| **Language** | TypeScript | 5.3.2 |
| **State Management** | React Query + Zustand | 5.81.2 / 5.0.8 |
| **Editor** | Tiptap (ProseMirror 기반) | 3.10.1 |
| **UI Library** | Radix UI + Tailwind CSS | Latest / 3.3.6 |
| **Animation** | Framer Motion | 12.23.24 |
| **Charts** | ApexCharts + Recharts | 5.3.3 / 3.1.2 |
| **Real-time** | Socket.io Client | 4.8.1 |
| **Diagram** | Mermaid | 11.12.1 |
| **Form** | React Hook Form + Zod | 7.58.1 / 3.25.67 |

### Backend

| 분류 | 기술 | 버전 |
|------|------|------|
| **Framework** | NestJS | 10.0.0 |
| **Language** | TypeScript | 5.1.3 |
| **Database** | PostgreSQL + TypeORM | 16 / 0.3.17 |
| **Cache** | Redis + ioredis | 7.0 / 5.7.0 |
| **Queue** | BullMQ | 5.58.5 |
| **Auth** | Passport.js (JWT + OAuth2) | 0.6.0 |
| **File Storage** | AWS S3 | SDK v3 |
| **Real-time** | Socket.io | 4.8.1 |
| **Monitoring** | Prometheus + prom-client | 15.1.3 |
| **Email** | Nodemailer | 7.0.5 |
| **Security** | Helmet + Throttler | 7.0.0 / 5.2.0 |

### Infrastructure

| 분류 | 기술 |
|------|------|
| **Container** | Docker + Docker Compose |
| **Hosting** | Oracle Cloud Free Tier (ARM64) |
| **CDN** | Cloudflare |
| **Database** | PostgreSQL (Self-hosted) |
| **Cache** | Redis (Self-hosted) |
| **Storage** | AWS S3 |
| **CI/CD** | GitHub Actions |

---

## 🏗 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  Next.js 16 (App Router)                                        │
│  ├── React Server Components                                    │
│  ├── React Query (Server State)                                 │
│  ├── Zustand (Client State)                                     │
│  └── Socket.io Client (Real-time)                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API Layer                               │
├─────────────────────────────────────────────────────────────────┤
│  NestJS 10                          │  MCP Proxy (Port 3002)    │
│  ├── REST API (Port 3000)           │  ├── API Key Auth         │
│  ├── WebSocket (Socket.io)          │  ├── Claude API 연동      │
│  ├── JWT + OAuth2 Auth              │  └── Rate Limiting        │
│  ├── Rate Limiting                  │                           │
│  └── Validation (class-validator)   │                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Service Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  39개 Feature Modules                                           │
│  ├── Auth, Users, Blogs, Posts, Comments                        │
│  ├── Subscription, Payment, Usage                               │
│  ├── MCP, Files, Chat, Notifications                            │
│  ├── Follows, Likes, Bookmarks, Reports                         │
│  └── Admin, Metrics, Cache                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Data Layer                               │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL 16            │  Redis 7           │  AWS S3        │
│  ├── 20+ Entities         │  ├── Session       │  ├── Images    │
│  ├── 80+ Migrations       │  ├── Cache         │  └── Files     │
│  ├── Materialized Views   │  └── Rate Limit    │                │
│  └── Full-text Search     │                    │                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💡 주요 구현 사항

### 1. MCP (Model Context Protocol) 시스템

**설계 목표:**
- Claude API를 활용한 자동 블로그 포스팅
- 보안성 높은 API Key 인증
- 플랜별 사용량 제한

```typescript
// API Key 생성 로직 (Stripe 스타일)
async generateApiKey(userId: string): Promise<McpApiKey> {
  const secret = crypto.randomBytes(32).toString('hex');
  const hint = secret.substring(0, 8);
  const hashedSecret = await bcrypt.hash(secret, 10);

  return {
    key: `blog_sk_${hint}_${secret}`,  // 1회만 표시
    hint: hint,                         // DB 저장 (검색용)
    hashedSecret: hashedSecret,         // DB 저장 (검증용)
    expiresAt: addDays(new Date(), 90), // 90일 만료
  };
}
```

### 2. 구독 및 결제 시스템

**Provider Pattern 적용:**

```typescript
// 결제 Provider 인터페이스
interface PaymentProvider {
  createCheckoutSession(plan: SubscriptionPlan): Promise<string>;
  handleWebhook(payload: any): Promise<PaymentResult>;
  refund(paymentId: string, amount?: number): Promise<void>;
}

// Provider 구현체
├── MockProvider    // 개발/테스트용
├── StripeProvider  // 프로덕션 (구현 완료)
├── TossProvider    // 추후 확장
└── PayPalProvider  // 추후 확장
```

**이벤트 기반 구독 활성화:**

```typescript
// 결제 완료 → 구독 활성화
@OnEvent(PaymentEvents.PAYMENT_SUCCESS)
async handlePaymentSuccess(event: PaymentSuccessEvent) {
  await this.subscriptionService.activateSubscription(
    event.userId,
    event.planId,
    event.billingCycle,
  );
  await this.cacheService.invalidateUserSubscription(event.userId);
}
```

### 3. 성능 최적화

**a. 관리자 대시보드 쿼리 최적화**

```sql
-- Before: 16개 개별 COUNT 쿼리
-- After: 1개 CTE(Common Table Expression) 쿼리
WITH stats AS (
  SELECT
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM users WHERE last_active_at > NOW() - INTERVAL '24 hours') as active_users,
    (SELECT COUNT(*) FROM posts WHERE status = 'PUBLISHED') as total_posts,
    -- ... 추가 통계
)
SELECT * FROM stats;

-- 결과: 94% 쿼리 감소, 응답 시간 80% 개선
```

**b. 인기 포스트 Materialized View**

```sql
CREATE MATERIALIZED VIEW popular_posts_mv AS
SELECT
  p.id,
  p.title,
  COUNT(DISTINCT pl.id) as like_count,
  COUNT(DISTINCT c.id) as comment_count,
  COUNT(DISTINCT pl.id) * 2 + COUNT(DISTINCT c.id) as score
FROM posts p
LEFT JOIN post_likes pl ON p.id = pl.post_id
LEFT JOIN comments c ON p.id = c.post_id
WHERE p.status = 'PUBLISHED'
GROUP BY p.id
ORDER BY score DESC;

-- 자동 갱신: ON DEMAND
```

**c. Cursor-based Pagination**

```typescript
// 무한 스크롤용 커서 기반 페이지네이션
async findPostsWithCursor(cursor?: string, limit: number = 20) {
  const query = this.postRepository
    .createQueryBuilder('post')
    .where('post.status = :status', { status: 'PUBLISHED' })
    .orderBy('post.createdAt', 'DESC')
    .take(limit + 1);  // +1로 다음 페이지 존재 여부 확인

  if (cursor) {
    query.andWhere('post.createdAt < :cursor', { cursor });
  }

  const posts = await query.getMany();
  const hasNext = posts.length > limit;

  return {
    data: posts.slice(0, limit),
    nextCursor: hasNext ? posts[limit - 1].createdAt : null,
  };
}
```

### 4. 보안 구현

**a. JWT HttpOnly Cookie 인증**

```typescript
// Access Token: HttpOnly Cookie
// Refresh Token: HttpOnly Cookie + Rotation
res.cookie('access_token', accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000,  // 15분
});
```

**b. Rate Limiting**

```typescript
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 100, ttl: 60000 } })  // 100 req/min
@Controller('api/v1')
export class AppController {}
```

**c. Input Validation**

```typescript
// DTO + class-validator
export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(1)
  content: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  tags?: string[];
}
```

### 5. 실시간 기능

**Socket.io 기반 DM 시스템:**

```typescript
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
})
export class ChatGateway {
  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
  ) {
    const message = await this.chatService.createMessage(data);

    // 수신자에게 실시간 전송
    this.server.to(`user:${data.receiverId}`).emit('new_message', message);

    // 배치 처리를 위해 큐에 추가
    await this.messageQueue.add('process_message', { messageId: message.id });
  }
}
```

---

## 📊 프로젝트 규모

### 코드 통계

| 항목 | 수량 |
|------|------|
| **총 코드 라인** | 62,000+ 줄 |
| **Backend 모듈** | 39개 |
| **Database 엔티티** | 20+ 개 |
| **Database 마이그레이션** | 80+ 개 |
| **API 엔드포인트** | 50+ 개 |
| **React 컴포넌트** | 100+ 개 |

### 모듈 구조

```
Backend (src/)
├── auth/           # OAuth2 + JWT 인증
├── users/          # 사용자 관리
├── blogs/          # 블로그 CRUD
├── posts/          # 포스트 관리
│   ├── services/
│   │   ├── post-core.service.ts
│   │   ├── post-stats.service.ts
│   │   ├── post-query.service.ts
│   │   └── mcp-post.service.ts
│   └── ...
├── comments/       # 계층형 댓글
├── chat/           # DM 시스템
├── mcp/            # AI 자동포스팅
├── subscription/   # 구독 관리
├── payment/        # 결제 처리
├── usage/          # 사용량 추적
├── files/          # S3 파일 업로드
├── follows/        # 팔로우 시스템
├── likes/          # 좋아요
├── bookmarks/      # 북마크
├── notifications/  # 알림
├── reports/        # 신고
├── admin/          # 관리자 기능
├── metrics/        # Prometheus 메트릭
├── cache/          # Redis 캐싱
├── email/          # 이메일 발송
└── common/         # 공통 유틸리티

Frontend (src/)
├── app/            # Next.js App Router 페이지
├── components/     # 재사용 컴포넌트
├── editor/         # Tiptap 에디터
├── hooks/          # Custom Hooks
├── lib/            # 유틸리티
├── services/       # API 서비스 레이어
├── stores/         # Zustand 스토어
├── types/          # TypeScript 타입
└── providers/      # Context Providers
```

---

## 🚀 배포 환경

### Docker Compose 구성

```yaml
# docker-compose.prod.oracle.yml
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
      args:
        - TARGETPLATFORM=linux/arm64  # Oracle ARM64
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - postgres
      - redis

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    environment:
      - NEXT_PUBLIC_API_URL=${API_URL}

  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  mcp-proxy:
    build:
      context: ./mcp-proxy
    ports:
      - "3002:3002"
```

### CI/CD Pipeline

```yaml
# GitHub Actions
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build and Push Docker Images
        run: |
          docker build -t backend ./backend
          docker build -t frontend ./frontend

      - name: Deploy to Oracle Cloud
        run: |
          ssh ${{ secrets.ORACLE_HOST }} "
            cd /app &&
            docker-compose pull &&
            docker-compose up -d &&
            docker-compose exec backend npm run migration:run:prod
          "
```

---

## 🎯 성과 및 최적화

### 성능 개선

| 항목 | Before | After | 개선율 |
|------|--------|-------|--------|
| 대시보드 쿼리 | 16개 쿼리 | 1개 CTE | 94% ↓ |
| 인기 포스트 조회 | 500ms | 50ms | 90% ↓ |
| 캐시 히트율 | N/A | 85%+ | - |
| API 응답 시간 (P99) | 400ms | 150ms | 62% ↓ |

### 보안 체크리스트

- ✅ JWT HttpOnly Cookie (XSS 방지)
- ✅ CSRF 토큰 검증
- ✅ Rate Limiting (Throttler)
- ✅ Input Validation (class-validator)
- ✅ SQL Injection 방지 (TypeORM 파라미터화)
- ✅ XSS 방지 (sanitize-html)
- ✅ CORS 설정
- ✅ Helmet 보안 헤더
- ✅ 민감 정보 환경 변수 분리

---

## 📚 배운 점 및 도전 과제

### 기술적 도전

**1. MCP 시스템 설계**
- 문제: AI API 호출 비용과 남용 방지
- 해결: Stripe 스타일 API Key + 플랜별 사용량 제한
- 학습: API 보안 설계, Rate Limiting 전략

**2. 실시간 메시징 성능**
- 문제: 다수 사용자 동시 접속 시 성능 저하
- 해결: BullMQ 배치 처리 + Redis Pub/Sub
- 학습: 메시지 큐 아키텍처, 실시간 시스템 설계

**3. 복잡한 쿼리 최적화**
- 문제: N+1 쿼리, 느린 집계 쿼리
- 해결: CTE, Materialized View, 인덱스 최적화
- 학습: PostgreSQL 고급 기능, 쿼리 프로파일링

### 아키텍처 결정

**1. Monorepo vs Polyrepo**
- 결정: Monorepo (frontend + backend + mcp-proxy)
- 이유: 1인 개발 효율성, 공유 타입 정의

**2. Server Components vs Client Components**
- 결정: 하이브리드 (RSC 기본 + 필요시 Client)
- 이유: SEO + 동적 기능 균형

**3. Event-Driven Architecture**
- 결정: @nestjs/event-emitter 활용
- 이유: 모듈 간 느슨한 결합, 비동기 처리

---

## 🔮 향후 계획

### 단기 (1-3개월)

- [ ] Stripe 결제 실제 연동
- [ ] 분석 대시보드 고도화
- [ ] 추천 알고리즘 구현
- [ ] E2E 테스트 추가

### 중기 (3-6개월)

- [ ] 모바일 앱 (React Native)
- [ ] 다국어 지원 (i18n)
- [ ] 광고 시스템
- [ ] 크리에이터 수익 분배

---

## 📞 연락처

| 항목 | 내용 |
|------|------|
| **Email** | luticek@gmail.com |
| **GitHub** | [요청 시 공개] |
| **Live Demo** | https://codebase.blog |


---

*이 포트폴리오는 2025년 11월 기준으로 작성되었습니다.*
