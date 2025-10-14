# 포스팅 시스템 최적화 설계

## 📋 목차
1. [현재 상황 분석](#현재-상황-분석)
2. [병목 지점 식별](#병목-지점-식별)
3. [최적화 전략](#최적화-전략)
4. [아키텍처 설계](#아키텍처-설계)
5. [구현 계획](#구현-계획)
6. [성능 목표](#성능-목표)

---

## 현재 상황 분석

### 포스팅 플로우

```
LLM (Claude)
  → MCP Proxy Server (자동포스팅 요청)
    → Backend API (/api/v1/mcp/posts)
      → PostsService.create()
        1. 마크다운 → HTML 변환 (markdownRenderer)
        2. 콘텐츠 처리 파이프라인 (contentProcessing) ⚠️ 무거움
           - HTML 살균 (XSS 방지)
           - 코드 블록 처리 및 하이라이팅
           - 이미지 처리
           - YouTube iframe 표준화
        3. Excerpt 생성 (HTML 태그 제거)
        4. DB 저장 (Post 엔티티)
        5. 첨부 파일 처리 (optional)
        6. 콘텐츠 이미지 링크 (linkFilesFromContent) ⚠️ 무거움
           - S3 URL에서 키 추출
           - DB 쿼리 (파일 조회)
           - FileContext 업데이트
      ← 200 OK 응답
    ← MCP 서버가 응답 대기 (30초 타임아웃)
  ← LLM이 응답 완료
```

### 문제점

**1. 동기 블로킹 처리**
- 모든 작업이 순차적으로 실행됨
- 콘텐츠 처리가 완료될 때까지 응답 지연
- LLM이 백엔드 응답을 기다리는 동안 차단됨

**2. 무거운 콘텐츠 처리**
- HTML 살균: DOMPurify/sanitize-html 사용 (CPU 집약적)
- 코드 하이라이팅: Prism.js/highlight.js (CPU 집약적)
- 이미지 처리: URL 파싱, 메타데이터 추출
- 예상 처리 시간: **500ms ~ 2초** (콘텐츠 크기에 따라)

**3. 파일 링크 처리**
- 이미지 URL 추출 (정규식)
- S3 키 추출 및 DB 쿼리
- FileContext 업데이트 (트랜잭션)
- 예상 처리 시간: **200ms ~ 1초** (이미지 개수에 따라)

**4. 토큰 낭비**
- LLM이 백엔드 응답을 기다리는 동안 토큰 소비
- 사용자 대기 시간 증가
- 여러 사용자가 동시에 요청 시 병목 발생

**5. 동시성 제한**
- 현재 아키텍처는 동기 처리 기반
- Node.js 싱글 스레드 특성상 CPU 집약적 작업이 다른 요청 차단
- 예상 처리량: **약 2-5 req/sec** (콘텐츠 크기에 따라)

---

## 병목 지점 식별

### Critical Path Analysis

| 단계 | 작업 | 예상 시간 | 병목 여부 |
|------|------|-----------|----------|
| 1 | 마크다운 → HTML 변환 | 50-100ms | ❌ |
| 2 | **콘텐츠 처리 파이프라인** | **500-2000ms** | ✅ **Critical** |
| 3 | Excerpt 생성 | 10-30ms | ❌ |
| 4 | DB 저장 (Post) | 20-50ms | ❌ |
| 5 | **파일 링크 처리** | **200-1000ms** | ✅ **Major** |
| **총합** | | **~0.8-3.2초** | |

### 병목 지점 상세 분석

**1. 콘텐츠 처리 파이프라인 (500-2000ms)**
```typescript
// backend/src/content-processing/services/content-processing.service.ts
async process(html: string, options: ContentProcessingOptions) {
  // 1. HTML 살균 (200-800ms) - DOMParser, 정규식
  if (sanitize) {
    processedHtml = this.htmlSanitizer.sanitize(processedHtml, {...});
  }

  // 2. 코드 블록 처리 (100-500ms) - Prism.js/highlight.js
  if (processCode) {
    processedHtml = this.codeHighlight.processCodeBlocks(processedHtml);
  }

  // 3. 이미지 처리 (100-400ms) - URL 파싱, 메타데이터 추출
  if (processImages) {
    processedHtml = this.imageProcessor.processImages(processedHtml, baseUrl);
  }

  // 4. YouTube iframe 표준화 (50-150ms) - 정규식
  processedHtml = this.standardizeYouTubeSize(processedHtml);
}
```

**2. 파일 링크 처리 (200-1000ms)**
```typescript
// backend/src/posts/posts.service.ts:1183
private async linkFilesFromContent(post: Post, userId?: string) {
  // 1. 이미지 URL 추출 (50-100ms) - 정규식
  const imageUrls = this.extractImageUrlsFromContent(post.content);

  // 2. S3 키 추출 (30-60ms per URL)
  const s3Keys = imageUrls.map(url => this.extractS3KeyFromUrl(url));

  // 3. DB 쿼리 (50-200ms) - 파일 조회
  const files = await this.filesRepository.find({
    where: { fileKey: In(s3Keys), userId: authorUserId }
  });

  // 4. FileContext 업데이트 (50-200ms per file) - 트랜잭션
  for (const file of newFiles) {
    // context 조회 및 업데이트
  }
}
```

---

## 최적화 전략

### 전략 1: Two-Phase Post Creation (Fast Path + Background Processing)

**개념:**
- **Phase 1 (Fast Path):** 최소한의 처리만 수행하고 즉시 202 Accepted 응답
- **Phase 2 (Background):** 무거운 작업을 Queue Worker에서 비동기 처리

**장점:**
- LLM이 빠르게 응답 받고 완료 가능 (토큰 절약)
- 사용자 대기 시간 최소화
- 백엔드 부하 분산

**단점:**
- 즉시 완성된 포스트가 아닌 "처리 중" 상태
- 프론트엔드에서 상태 폴링 또는 WebSocket 필요

### 전략 2: Selective Processing (LLM 신뢰 기반 최적화)

**개념:**
- LLM이 생성한 콘텐츠는 기본적으로 안전하다고 가정
- HTML 살균 및 일부 처리를 생략하거나 간소화

**장점:**
- 처리 시간 50-70% 단축
- 구현 간단

**단점:**
- LLM 출력 신뢰 가정 (리스크 존재)
- 일반 사용자 포스팅과 구분 필요

### 전략 3: Content Processing Cache

**개념:**
- 동일하거나 유사한 콘텐츠 패턴을 Redis에 캐싱
- 코드 블록 하이라이팅 결과를 캐싱

**장점:**
- 반복 요청 시 빠른 응답
- DB 부하 감소

**단점:**
- 메모리 사용량 증가
- 캐시 무효화 로직 필요
- 효과는 제한적 (콘텐츠가 대부분 유니크함)

### 전략 4: Parallel Processing (병렬 처리)

**개념:**
- 독립적인 작업들을 병렬로 실행
- 예: 코드 하이라이팅과 이미지 처리를 동시 실행

**장점:**
- 전체 처리 시간 단축 (30-40%)
- 구현 비교적 간단

**단점:**
- CPU 코어가 충분해야 효과적
- Node.js 싱글 스레드 특성상 제한적

---

## 아키텍처 설계

### 권장 아키텍처: Hybrid Approach

**Fast Path (Synchronous) + Background Processing (Asynchronous) + Selective Optimization**

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP Proxy Server                         │
│  (자동포스팅 요청 - LLM이 마크다운 생성)                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │ POST /api/v1/mcp/posts
                            │ { title, content_markdown, tags }
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Backend API Gateway                        │
│                    (NestJS Controller)                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostsService.createFast()                   │
│                       ⚡ FAST PATH (~200ms)                       │
├─────────────────────────────────────────────────────────────────┤
│  1. 마크다운 → HTML 변환 (기본)                       [50ms]      │
│  2. 간소화된 콘텐츠 처리 (LLM 신뢰)                   [100ms]     │
│     ✓ XSS 방어 (기본만)                                          │
│     ✗ 코드 하이라이팅 SKIP → Queue                               │
│     ✗ 이미지 메타 처리 SKIP → Queue                              │
│  3. DB 저장 (status: 'processing')                   [30ms]      │
│  4. Queue에 후처리 Job 등록                           [10ms]      │
│  5. 202 Accepted 응답 + jobId                        [10ms]      │
└───────────────────────────┬─────────────────────────────────────┘
                            │ jobId: "abc123"
                            ▼
                    ┌───────────────┐
                    │ 202 Accepted  │ ← LLM이 빠르게 완료 ✅
                    │ jobId: abc123 │
                    └───────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      BullMQ Queue Worker                         │
│                   🔄 BACKGROUND (~1-3초)                          │
├─────────────────────────────────────────────────────────────────┤
│  Job: { postId: "xyz", type: "post-processing" }                │
│                                                                  │
│  1. Post 조회 (DB)                                    [20ms]     │
│  2. 전체 콘텐츠 처리 파이프라인                                    │
│     ✓ 코드 블록 하이라이팅 (Prism.js)               [500ms]     │
│     ✓ 이미지 최적화 및 메타 추출                     [300ms]     │
│     ✓ 파일 링크 처리                                 [500ms]     │
│  3. DB 업데이트 (status: 'published')                [30ms]      │
│  4. 캐시 무효화 (Redis)                              [10ms]      │
│  5. WebSocket 알림 (선택적)                         [10ms]      │
└─────────────────────────────────────────────────────────────────┘
```

### 데이터베이스 스키마 변경

```typescript
// Post 엔티티에 status 필드 추가
enum PostStatus {
  DRAFT = 'draft',           // 임시 저장
  PROCESSING = 'processing', // 백그라운드 처리 중
  PUBLISHED = 'published',   // 발행 완료
  FAILED = 'failed',         // 처리 실패
}

@Entity('posts')
export class Post {
  // ... 기존 필드들

  @Column({
    type: 'enum',
    enum: PostStatus,
    default: PostStatus.PROCESSING, // MCP 자동포스팅은 PROCESSING으로 시작
  })
  status: PostStatus;

  @Column({ type: 'text', nullable: true })
  processingError?: string; // 실패 시 에러 메시지

  @Column({ type: 'timestamp', nullable: true })
  processingCompletedAt?: Date; // 처리 완료 시간
}
```

### BullMQ Queue 설정

```typescript
// backend/src/posts/queues/post-processing.queue.ts
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export const POST_PROCESSING_QUEUE = 'post-processing';

export interface PostProcessingJobData {
  postId: string;
  type: 'full-processing' | 'reprocess';
  options?: {
    skipCodeHighlight?: boolean;
    skipImageProcessing?: boolean;
  };
}

// Queue 생성
@Injectable()
export class PostProcessingQueue {
  constructor(
    @InjectQueue(POST_PROCESSING_QUEUE)
    private postProcessingQueue: Queue<PostProcessingJobData>,
  ) {}

  async addProcessingJob(data: PostProcessingJobData) {
    return this.postProcessingQueue.add(data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      timeout: 30000, // 30초 타임아웃
    });
  }
}
```

### Worker 구현

```typescript
// backend/src/posts/processors/post-processing.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

@Processor(POST_PROCESSING_QUEUE)
export class PostProcessingProcessor {
  constructor(
    private postsRepository: Repository<Post>,
    private contentProcessing: ContentProcessingService,
    private filesService: FilesService,
    private logger: Logger,
  ) {}

  @Process()
  async processPost(job: Job<PostProcessingJobData>) {
    const { postId, type, options } = job.data;

    try {
      // 1. Post 조회
      const post = await this.postsRepository.findOne({
        where: { id: postId },
        relations: ['author', 'blog'],
      });

      if (!post) {
        throw new Error(`Post ${postId} not found`);
      }

      // 2. 전체 콘텐츠 처리 파이프라인
      const processed = await this.contentProcessing.processMarkdownHtml(
        post.content, // Fast path에서 저장된 기본 HTML
        {
          sanitize: true,
          processCode: !options?.skipCodeHighlight,
          processImages: !options?.skipImageProcessing,
          preserveMermaid: true,
        }
      );

      post.content = processed.html;

      // 3. 파일 링크 처리
      await this.linkFilesFromContent(post, post.authorId);

      // 4. 상태 업데이트
      post.status = PostStatus.PUBLISHED;
      post.processingCompletedAt = new Date();
      await this.postsRepository.save(post);

      // 5. 캐시 무효화
      await this.cacheService.del(`post:${postId}`);

      this.logger.log(`✅ Post ${postId} processing completed`);
      return { success: true };
    } catch (error) {
      this.logger.error(`❌ Post ${postId} processing failed:`, error);

      // 실패 상태 업데이트
      await this.postsRepository.update(postId, {
        status: PostStatus.FAILED,
        processingError: error.message,
      });

      throw error; // Bull이 재시도 처리
    }
  }

  private async linkFilesFromContent(post: Post, userId: string) {
    // 기존 로직 그대로 (posts.service.ts에서 이동)
    // ...
  }
}
```

### Fast Path 구현

```typescript
// backend/src/posts/posts.service.ts
async createFast(createPostDto: CreatePostDto, user: User): Promise<any> {
  const blog = await this.blogsRepository.findOne({
    where: { userId: user.id },
  });

  if (!blog) {
    throw new BadRequestException('블로그를 먼저 생성해주세요.');
  }

  // 1. 마크다운 → HTML 변환 (기본)
  let htmlContent = this.markdownRenderer.convertToHtml(
    createPostDto.content_markdown
  );

  // 첫 H1 제거
  htmlContent = htmlContent.replace(/<h1[^>]*>.*?<\/h1>\s*/i, '').trim();

  // 2. 간소화된 콘텐츠 처리 (LLM 신뢰 - XSS 방어만)
  // 코드 하이라이팅, 이미지 최적화는 SKIP → Queue에서 처리
  const processed = await this.contentProcessing.process(htmlContent, {
    sanitize: true,        // XSS 방어만 수행
    processCode: false,    // SKIP → Queue
    processImages: false,  // SKIP → Queue
  });

  // 3. Excerpt 생성
  const textContent = processed.html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const excerpt = textContent.substring(0, 200);

  // 4. Post 생성 (status: PROCESSING)
  const post = this.postsRepository.create({
    title: createPostDto.title,
    content: processed.html, // 기본 HTML만 저장
    content_markdown: createPostDto.content_markdown,
    excerpt: excerpt,
    content_type: 'markdown',
    content_rendered_at: new Date(),
    status: PostStatus.PROCESSING, // 처리 중 상태
    author: user,
    blog: blog,
    blogId: blog.id,
    isPublished: true,
    publishedAt: new Date(),
    tagList: createPostDto.tags || [],
  });

  await this.postsRepository.save(post);

  // 5. Queue에 후처리 Job 등록
  const job = await this.postProcessingQueue.addProcessingJob({
    postId: post.id,
    type: 'full-processing',
  });

  // 6. 202 Accepted 응답 (jobId 포함)
  return {
    status: 'accepted',
    message: '포스트가 생성되었으며 백그라운드에서 처리 중입니다.',
    postId: post.id,
    jobId: job.id,
    estimatedTime: '2-5초', // 예상 처리 시간
    post: this.toPostDto(post, { user, blog }),
  };
}
```

### 상태 조회 API

```typescript
// backend/src/posts/posts.controller.ts
@Get('status/:postId')
async getPostStatus(@Param('postId') postId: string) {
  const post = await this.postsService.findOne(postId);

  return {
    postId: post.id,
    status: post.status,
    isReady: post.status === PostStatus.PUBLISHED,
    processingCompletedAt: post.processingCompletedAt,
    error: post.processingError,
  };
}
```

---

## 동시성 및 Rate Limiting

### 동시 요청 처리 능력

**현재 아키텍처 (동기 처리):**
- 처리 시간: 0.8-3.2초/요청
- 예상 처리량: **2-5 req/sec**
- 10명 동시 요청 시: 마지막 사용자는 **최대 32초 대기**

**최적화 후 (Fast Path + Queue):**
- Fast Path 처리 시간: 150-200ms/요청
- 예상 처리량: **50-70 req/sec** (Fast Path)
- Queue Worker: **10-20 req/sec** (백그라운드)
- 10명 동시 요청 시: 모든 사용자 **200ms 내 응답** ✅

### Rate Limiting 전략

```typescript
// backend/src/common/guards/rate-limit.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { RedisService } from '../services/redis.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private rateLimiter: RateLimiterRedis;

  constructor(
    private reflector: Reflector,
    private redisService: RedisService,
  ) {
    this.rateLimiter = new RateLimiterRedis({
      storeClient: this.redisService.getClient(),
      points: 10, // 10 요청
      duration: 60, // 1분당
      blockDuration: 60, // 초과 시 1분 차단
      keyPrefix: 'rate_limit_post',
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.ip;

    try {
      await this.rateLimiter.consume(userId);
      return true;
    } catch (rejRes) {
      throw new TooManyRequestsException(
        `포스팅 제한을 초과했습니다. ${Math.round(rejRes.msBeforeNext / 1000)}초 후 다시 시도해주세요.`
      );
    }
  }
}

// 적용
@Post('mcp/posts')
@UseGuards(RateLimitGuard)
async createPost(@Body() createPostDto: CreatePostDto, @User() user: User) {
  return this.postsService.createFast(createPostDto, user);
}
```

### Queue Concurrency 설정

```typescript
// backend/src/posts/posts.module.ts
BullModule.registerQueue({
  name: POST_PROCESSING_QUEUE,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
  settings: {
    maxStalledCount: 3,
    stalledInterval: 30000,
  },
  limiter: {
    max: 20, // 최대 20개 작업 동시 처리
    duration: 1000, // 1초당
  },
}),
```

---

## 구현 계획

### Phase 1: 기본 인프라 (우선순위: 높음)

**1.1 BullMQ 설정**
- [ ] `@nestjs/bull` 패키지 설치
- [ ] Redis 연결 설정 (기존 Redis 활용)
- [ ] Queue 모듈 생성 (`PostProcessingQueue`)
- [ ] 예상 작업 시간: **2시간**

**1.2 Post 엔티티 확장**
- [ ] `status` 필드 추가 (enum: draft, processing, published, failed)
- [ ] `processingError` 필드 추가 (nullable text)
- [ ] `processingCompletedAt` 필드 추가 (nullable timestamp)
- [ ] Migration 생성 및 실행
- [ ] 예상 작업 시간: **1시간**

**1.3 Fast Path 구현**
- [ ] `PostsService.createFast()` 메서드 생성
- [ ] 간소화된 콘텐츠 처리 (sanitize만)
- [ ] Queue Job 등록 로직
- [ ] 202 Accepted 응답 처리
- [ ] 예상 작업 시간: **3시간**

### Phase 2: Background Worker (우선순위: 높음)

**2.1 Worker Processor 구현**
- [ ] `PostProcessingProcessor` 클래스 생성
- [ ] 전체 콘텐츠 처리 파이프라인
- [ ] 파일 링크 처리 로직 이동
- [ ] 에러 핸들링 및 재시도 로직
- [ ] 예상 작업 시간: **4시간**

**2.2 상태 조회 API**
- [ ] `GET /api/v1/posts/status/:postId` 엔드포인트
- [ ] Job 상태 조회 (BullMQ)
- [ ] Post 상태 조회
- [ ] 예상 작업 시간: **1시간**

### Phase 3: Rate Limiting (우선순위: 중간)

**3.1 Rate Limiter 구현**
- [ ] `RateLimitGuard` 구현 (rate-limiter-flexible)
- [ ] Redis 기반 분산 Rate Limiting
- [ ] 사용자별/IP별 제한 설정
- [ ] 예상 작업 시간: **2시간**

**3.2 Queue Concurrency 설정**
- [ ] Worker concurrency 설정 (10-20)
- [ ] Queue limiter 설정 (20 jobs/sec)
- [ ] Stalled job 처리
- [ ] 예상 작업 시간: **1시간**

### Phase 4: 모니터링 및 최적화 (우선순위: 중간)

**4.1 Metrics 수집**
- [ ] Fast Path 응답 시간 (Prometheus)
- [ ] Queue 처리 시간
- [ ] 성공/실패 비율
- [ ] 예상 작업 시간: **2시간**

**4.2 Bull Board 대시보드**
- [ ] `@bull-board/express` 설치
- [ ] Admin 전용 Queue 모니터링 UI
- [ ] Job 상태 조회 및 재시도
- [ ] 예상 작업 시간: **2시간**

### Phase 5: 프론트엔드 통합 (우선순위: 낮음)

**5.1 상태 폴링 (선택적)**
- [ ] Post 상태 조회 API 호출
- [ ] "처리 중..." UI 표시
- [ ] 완료 시 자동 리로드
- [ ] 예상 작업 시간: **3시간**

**5.2 WebSocket 알림 (선택적)**
- [ ] Socket.IO 이벤트 발송 (Worker에서)
- [ ] 프론트엔드에서 실시간 수신
- [ ] Toast 알림 표시
- [ ] 예상 작업 시간: **4시간**

---

## 성능 목표

### 응답 시간 목표

| 메트릭 | 현재 | 목표 | 개선율 |
|--------|------|------|--------|
| Fast Path 응답 시간 | 0.8-3.2초 | **150-200ms** | **75-93% 개선** |
| LLM 대기 시간 | 0.8-3.2초 | **150-200ms** | **75-93% 단축** |
| Queue 처리 시간 | N/A | 1-3초 | - |
| 전체 완료 시간 | 0.8-3.2초 | 1.2-3.5초 | 약간 증가 (허용) |

### 처리량 목표

| 메트릭 | 현재 | 목표 | 개선율 |
|--------|------|------|--------|
| Fast Path 처리량 | 2-5 req/sec | **50-70 req/sec** | **10-14배 개선** |
| Queue Worker 처리량 | N/A | 10-20 req/sec | - |
| 동시 사용자 처리 | 2-5명 (차단) | **50-70명 (비차단)** | **10-14배 개선** |

### 사용자 경험 개선

| 지표 | 현재 | 목표 | 개선 |
|------|------|------|------|
| LLM 토큰 낭비 | 높음 (대기 중 소비) | **낮음 (빠른 응답)** | ✅ |
| 사용자 대기 시간 | 0.8-3.2초 | **150-200ms** | ✅ |
| 10명 동시 요청 시 | 최대 32초 대기 | **모두 200ms 내** | ✅ |
| 포스트 완성도 | 즉시 완성 | 2-5초 후 완성 | 허용 가능 |

### 리소스 사용량

**예상 리소스 증가:**
- Redis 메모리: +10-20MB (Queue 데이터)
- CPU: +10-20% (Worker 프로세스)
- 응답 지연: -75-93% (Fast Path)

**비용 대비 효과:**
- ✅ 대폭적인 응답 시간 단축
- ✅ LLM 토큰 낭비 최소화
- ✅ 사용자 경험 대폭 개선
- ⚠️ 약간의 리소스 증가 (허용 가능)

---

## 구현 우선순위

### 즉시 구현 (Critical Path)

1. **BullMQ 인프라 설정** (2시간)
2. **Post 엔티티 확장** (1시간)
3. **Fast Path 구현** (3시간)
4. **Background Worker** (4시간)
5. **상태 조회 API** (1시간)

**총 예상 시간: 11시간** (1-2일 작업)

### 단계적 구현 (Phase 2)

6. **Rate Limiting** (3시간)
7. **Metrics 수집** (2시간)
8. **Bull Board 대시보드** (2시간)

**총 예상 시간: 7시간** (1일 작업)

### 선택적 구현 (Optional)

9. **프론트엔드 상태 폴링** (3시간)
10. **WebSocket 실시간 알림** (4시간)

**총 예상 시간: 7시간** (1일 작업)

---

## 추가 최적화 고려사항

### 1. Selective Processing (LLM 신뢰 기반)

**현재 Fast Path:**
```typescript
const processed = await this.contentProcessing.process(htmlContent, {
  sanitize: true,        // XSS 방어만 수행
  processCode: false,    // SKIP → Queue
  processImages: false,  // SKIP → Queue
});
```

**더 공격적 최적화 (선택적):**
```typescript
const processed = await this.contentProcessing.process(htmlContent, {
  sanitize: false,       // LLM 출력 신뢰 (리스크!)
  processCode: false,
  processImages: false,
});
```

**장점:**
- 처리 시간 **100ms → 50ms** (50% 추가 단축)

**단점:**
- XSS 리스크 증가 (LLM jailbreak 공격 가능성)
- 권장하지 않음 (보안 우선)

### 2. Content Processing Cache

**Redis 캐싱 전략:**
```typescript
// 코드 블록 하이라이팅 결과 캐싱
const cacheKey = `code_highlight:${codeHash}`;
const cached = await this.cacheService.get(cacheKey);
if (cached) return cached;

const highlighted = await this.highlightCode(code);
await this.cacheService.set(cacheKey, highlighted, 3600); // 1시간
return highlighted;
```

**효과:**
- 반복 요청 시 **500ms → 50ms** (90% 단축)
- 실제로는 콘텐츠가 대부분 유니크하므로 효과 제한적

### 3. Worker 스케일링

**수평 확장:**
```yaml
# docker-compose.yml
services:
  backend:
    replicas: 3  # 3개 인스턴스

  worker:
    replicas: 5  # 5개 Worker
    environment:
      - QUEUE_CONCURRENCY=4  # Worker당 4개 동시 처리
```

**효과:**
- Queue 처리량: **10-20 req/sec → 50-100 req/sec**
- 대규모 트래픽 대응 가능

### 4. Database Connection Pooling

**PostgreSQL 연결 최적화:**
```typescript
// ormconfig.ts
{
  type: 'postgres',
  extra: {
    max: 20,              // 최대 20개 연결
    min: 5,               // 최소 5개 유지
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
}
```

**효과:**
- DB 쿼리 대기 시간 감소
- 동시 요청 처리 능력 향상

---

## 결론 및 권장사항

### 핵심 해결 방안

**문제: "MCP → 백엔드 → LLM 응답 완료까지 너무 느림"**

**해결: Two-Phase Post Creation**
1. ✅ Fast Path: **150-200ms 내 202 Accepted** 응답 (LLM이 즉시 완료)
2. ✅ Background: 무거운 작업을 Queue Worker에서 비동기 처리
3. ✅ Rate Limiting: 사용자별/IP별 제한으로 서버 보호
4. ✅ Monitoring: Metrics 및 Bull Board로 상태 모니터링

### 예상 개선 효과

| 지표 | 개선율 |
|------|--------|
| 응답 시간 | **75-93% 단축** |
| LLM 토큰 낭비 | **대폭 감소** |
| 동시 처리 능력 | **10-14배 향상** |
| 사용자 만족도 | **대폭 향상** |

### 구현 로드맵

**1주차 (Critical):**
- BullMQ 인프라 + Fast Path + Background Worker
- 예상 시간: 11시간 (1-2일)

**2주차 (Important):**
- Rate Limiting + Metrics + Bull Board
- 예상 시간: 7시간 (1일)

**3주차 (Optional):**
- 프론트엔드 통합 (상태 폴링/WebSocket)
- 예상 시간: 7시간 (1일)

### 리스크 및 대응

| 리스크 | 확률 | 대응 방안 |
|--------|------|-----------|
| Queue Worker 장애 | 중간 | Health check + 자동 재시도 + 모니터링 |
| Redis 장애 | 낮음 | Fallback to 동기 처리 (degraded mode) |
| 처리 실패 증가 | 중간 | 에러 핸들링 강화 + Admin 대시보드 |
| 사용자 혼란 | 낮음 | "처리 중" UI + 알림 시스템 |

### 최종 권장사항

✅ **즉시 구현 권장** (Phase 1)
- Fast Path + Background Worker
- 가장 큰 효과를 가장 빠르게 달성

✅ **단계적 구현 권장** (Phase 2)
- Rate Limiting + Monitoring
- 서버 안정성 및 관리 효율성 향상

⚠️ **선택적 구현** (Phase 3)
- 프론트엔드 통합 (폴링/WebSocket)
- 사용자 경험 향상 (nice-to-have)

---

**작성일:** 2025-01-14
**작성자:** Backend Architect Agent
**버전:** 1.0
**상태:** Design Complete - Ready for Implementation
