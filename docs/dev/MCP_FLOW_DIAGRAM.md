# Codebase MCP 시스템 플로우 다이어그램

## 📋 개요

이 문서는 Codebase.blog의 MCP(Model Context Protocol) 자동 포스팅 시스템의 전체 작동 플로우를 시각화한 다이어그램입니다.

**현재 인증 방식**: API Key 기반 (Stripe 스타일: `blog_sk_{hint}_{secret}`)

---

## 🏗️ 시스템 아키텍처

```mermaid
graph TB
    subgraph "Client Layer"
        Claude[Claude Desktop<br/>MCP Client]
    end

    subgraph "Proxy Layer - Port 3002"
        ProxyServer[MCP Proxy Server<br/>Express + MCP SDK]
        ProxyAPI[/mcp API]
        ProxyMetrics[Prometheus Metrics]
    end

    subgraph "Cache Layer"
        Redis[(Redis<br/>API Key Cache<br/>TTL: 5min)]
    end

    subgraph "Backend Layer - Port 3000"
        Backend[NestJS Backend]
        McpModule[MCP Module]
        McpController[MCP Controller<br/>API Key 관리]
        McpProxyController[MCP Proxy Controller<br/>포스트 생성]
        PostsService[Posts Service<br/>Fast Path]
        UsageService[Usage Service<br/>제한 확인]
        CacheService[Cache Service<br/>캐시 무효화]
    end

    subgraph "Data Layer"
        PostgreSQL[(PostgreSQL<br/>Users, Blogs, Posts<br/>MCP API Keys)]
        S3[AWS S3<br/>이미지 저장]
    end

    subgraph "Monitoring"
        Grafana[Grafana<br/>대시보드]
        Prometheus[Prometheus<br/>메트릭 수집]
    end

    %% Client to Proxy
    Claude -->|POST /mcp<br/>Bearer: blog_sk_...<br/>tools/call| ProxyAPI

    %% Proxy Internal
    ProxyAPI --> ProxyServer
    ProxyServer -->|검증 캐시 확인| Redis
    ProxyServer -->|메트릭 기록| ProxyMetrics

    %% Proxy to Backend
    ProxyServer -->|POST /api/v1/mcp/validate-key<br/>캐시 미스 시| Backend
    ProxyServer -->|POST /api/v1/mcp/posts<br/>X-API-Key| McpProxyController

    %% Backend Internal Flow
    Backend --> McpModule
    McpModule --> McpController
    McpModule --> McpProxyController

    McpProxyController -->|1. 사용량 제한 확인| UsageService
    McpProxyController -->|2. 포스트 생성 Fast Path| PostsService
    McpProxyController -->|3. 사용량 추적| UsageService

    PostsService -->|이벤트 발행<br/>post.created| CacheService
    CacheService -->|캐시 무효화| Redis

    %% Database Connections
    Backend -->|ORM 쿼리| PostgreSQL
    PostsService -->|이미지 업로드| S3
    UsageService -->|사용량 기록| PostgreSQL

    %% Monitoring
    ProxyMetrics -->|스크랩| Prometheus
    Backend -->|메트릭 노출| Prometheus
    Prometheus --> Grafana

    %% Styling
    classDef clientStyle fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef proxyStyle fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef cacheStyle fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef backendStyle fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef dataStyle fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    classDef monitorStyle fill:#fff9c4,stroke:#f57f17,stroke-width:2px

    class Claude clientStyle
    class ProxyServer,ProxyAPI,ProxyMetrics proxyStyle
    class Redis cacheStyle
    class Backend,McpModule,McpController,McpProxyController,PostsService,UsageService,CacheService backendStyle
    class PostgreSQL,S3 dataStyle
    class Grafana,Prometheus monitorStyle
```

---

## 🔐 1. API Key 생성 플로우

```mermaid
sequenceDiagram
    participant User as 사용자<br/>(프론트엔드)
    participant Backend as Backend API<br/>(NestJS)
    participant DB as PostgreSQL
    participant Redis as Redis Cache

    User->>Backend: POST /api/v1/mcp/keys<br/>(JWT 인증)

    Backend->>Backend: 1. 기존 키 삭제<br/>(사용자당 1개 정책)
    Backend->>Backend: 2. hint 생성 (8자)<br/>nanoid(a-z0-9)
    Backend->>Backend: 3. secret 생성 (32자)<br/>nanoid(A-Za-z0-9)
    Backend->>Backend: 4. API Key 조합<br/>blog_sk_{hint}_{secret}
    Backend->>Backend: 5. bcrypt 해시<br/>(cost factor: 8)
    Backend->>Backend: 6. 만료일 설정<br/>(90일 후)

    Backend->>DB: INSERT mcp_api_key<br/>(keyHint, keyHash, expiresAt)
    DB-->>Backend: ✅ 저장 완료

    Backend-->>User: 200 OK<br/>{<br/>  apiKey: "blog_sk_xxx_yyy",<br/>  keyHint: "xxx",<br/>  expiresAt: "2025-04-15"<br/>}<br/><br/>⚠️ apiKey는 1회만 표시됨

    Note over User: 사용자가 API Key를<br/>안전한 곳에 저장<br/>(Claude Desktop 설정)
```

---

## 🔍 2. API Key 검증 플로우 (Redis 캐싱)

```mermaid
sequenceDiagram
    participant Proxy as MCP Proxy Server
    participant Redis as Redis Cache<br/>(TTL: 5분)
    participant Backend as Backend API
    participant DB as PostgreSQL

    Proxy->>Proxy: 1. API Key에서<br/>hint 추출<br/>(blog_sk_abc123_xyz → abc123)

    Proxy->>Redis: 2. GET mcp:apikey:valid:{hint}

    alt 캐시 히트 (1-3ms)
        Redis-->>Proxy: ✅ {userId, blogId, user, blog}
        Note over Proxy: 메트릭: cache_hit++<br/>검증 시간: 1-3ms
    else 캐시 미스 (85-165ms)
        Redis-->>Proxy: ❌ null
        Proxy->>Backend: POST /api/v1/mcp/validate-key<br/>{apiKey: "blog_sk_..."}

        Backend->>Backend: hint 추출
        Backend->>DB: SELECT * FROM mcp_api_key<br/>WHERE keyHint = '{hint}'
        DB-->>Backend: McpApiKey 엔티티

        Backend->>Backend: bcrypt.compare()<br/>(전체 키 비교)
        Backend->>Backend: 활성 상태 확인<br/>(isActive = true)
        Backend->>Backend: 만료 확인<br/>(expiresAt > now)

        alt 검증 성공
            Backend->>DB: UPDATE lastUsedAt<br/>requestCount++
            Backend-->>Proxy: 200 OK<br/>{valid: true, data: {...}}

            Proxy->>Redis: SET mcp:apikey:valid:{hint}<br/>EXPIRE 300 (5분)
            Note over Proxy: 메트릭: cache_miss++<br/>검증 시간: 85-165ms
        else 검증 실패
            Backend-->>Proxy: 401 Unauthorized
            Note over Proxy: 메트릭: validation_failed++
        end
    end
```

---

## 📝 3. 포스트 생성 플로우 (Fast Path)

```mermaid
sequenceDiagram
    participant Claude as Claude Desktop<br/>(MCP Client)
    participant Proxy as MCP Proxy Server
    participant Redis as Redis Cache
    participant Backend as Backend API
    participant Queue as BullMQ Queue
    participant DB as PostgreSQL
    participant S3 as AWS S3

    %% 1. 인증
    Claude->>Proxy: POST /mcp<br/>Authorization: Bearer blog_sk_...<br/>{"method": "tools/call",<br/> "params": {"name": "create_post", ...}}

    Proxy->>Proxy: Bearer 토큰에서<br/>API Key 추출
    Proxy->>Redis: API Key 검증<br/>(캐싱된 사용자 정보)
    Redis-->>Proxy: ✅ {userId, blogId, user, blog}

    %% 2. MCP 서버 생성
    Note over Proxy: MCP 서버 생성<br/>(요청마다 stateless)
    Proxy->>Proxy: registerAllTools()<br/>(check_auth,<br/>get_writing_style_guide,<br/>create_post)

    %% 3. create_post 도구 실행
    Proxy->>Backend: POST /api/v1/mcp/posts<br/>X-API-Key: blog_sk_...<br/>{<br/>  title: "제목",<br/>  content_markdown: "# 본문",<br/>  tags: ["tag1", "tag2"],<br/>  category: "tech"<br/>}

    %% 4. Backend 처리
    Backend->>Backend: 1. 포스트 크기 검증<br/>(200,000자, 1MB 제한)
    Backend->>Backend: 2. UsageService.checkMcpPostLimit()<br/>(월간 제한 확인)

    Backend->>DB: SELECT * FROM usage_tracking<br/>WHERE userId = ... AND period = ...
    DB-->>Backend: 현재 사용량 / 제한

    alt 제한 초과
        Backend-->>Proxy: 403 Forbidden<br/>{reason: "월간 제한 초과"}
        Proxy-->>Claude: ❌ 에러 메시지
    else 제한 OK
        Backend->>DB: 3. PostsService.createFast()<br/>(Fast Path 시작)

        %% Fast Path 처리
        Note over Backend,DB: Fast Path (150-200ms)<br/>즉시 응답, 백그라운드 처리

        Backend->>DB: BEGIN TRANSACTION
        Backend->>DB: INSERT INTO posts<br/>(title, content_markdown_base64, ...)
        DB-->>Backend: Post 엔티티 (ID 생성)

        Backend->>Queue: 큐에 작업 등록<br/>{<br/>  postId,<br/>  tasks: [<br/>    'html-conversion',<br/>    'image-upload',<br/>    'search-index'<br/>  ]<br/>}

        Backend->>DB: COMMIT TRANSACTION

        %% 사용량 추적
        Backend->>DB: 4. UsageService.trackMcpPost()<br/>INSERT/UPDATE usage_tracking

        %% 캐시 무효화 이벤트
        Backend->>Backend: EventEmitter.emit('post.created')
        Backend->>Redis: 캐시 무효화<br/>SCAN + DEL 패턴<br/>- posts:all:*<br/>- posts:blog:{blogId}:*<br/>- home:posts:*

        %% 즉시 응답 (Fast Path)
        Backend-->>Proxy: 202 Accepted<br/>{<br/>  id: "...",<br/>  slug: "...",<br/>  title: "...",<br/>  url: "/blog-slug/post-slug",<br/>  _meta: {<br/>    processingTime: "150ms",<br/>    status: "processing"<br/>  }<br/>}

        Proxy->>Proxy: 메트릭 기록<br/>(request_success,<br/>tool: create_post)
        Proxy-->>Claude: ✅ 포스트 생성 완료!<br/>URL: https://codebase.blog/...

        %% 백그라운드 처리
        Note over Queue,S3: 백그라운드 처리 (비동기)

        Queue->>Queue: Worker 1:<br/>HTML 변환<br/>(Markdown → HTML)
        Queue->>S3: Worker 2:<br/>이미지 업로드<br/>(base64 → S3 URL)
        Queue->>DB: Worker 3:<br/>검색 인덱스 생성<br/>(Full-text search)

        Queue->>DB: UPDATE posts<br/>SET content_html = ...,<br/>    imageUrls = [...]

        Queue->>Redis: 캐시 무효화<br/>(최종 완료 후)
    end
```

---

## 🛠️ 4. MCP 도구 상세 플로우

### 4.1 check_auth 도구

```mermaid
sequenceDiagram
    participant Claude as Claude Desktop
    participant Proxy as MCP Proxy
    participant Backend as Backend

    Claude->>Proxy: tools/call: check_auth
    Note over Proxy: API Key는 이미<br/>검증된 상태<br/>(연결 시점에 완료)

    Proxy->>Proxy: context.userData 조회<br/>{userId, blogId, user, blog}

    Proxy-->>Claude: ✅ 인증 완료<br/>사용자: {username}<br/>블로그: https://codebase.blog/{slug}
```

### 4.2 get_writing_style_guide 도구

```mermaid
sequenceDiagram
    participant Claude as Claude Desktop
    participant Proxy as MCP Proxy
    participant StyleService as Writing Style Service

    Claude->>Proxy: tools/call: get_writing_style_guide<br/>{<br/>  style: "default",<br/>  customMarkdown: null<br/>}

    alt 커스텀 마크다운 제공
        Proxy->>StyleService: parseRawMarkdown(customMarkdown)
        Note over StyleService: 사용자 제공 스타일<br/>(최우선)
    else 프리셋 스타일
        Proxy->>StyleService: loadAndParseStyle(style)<br/>(default/novel/podcast/<br/>vibe/research/pm)
        Note over StyleService: 프리셋 스타일 파일<br/>읽기 및 파싱
    end

    StyleService->>StyleService: 메타데이터 추출<br/>- styleName<br/>- minLength<br/>- targetLength<br/>- language<br/>- aiTagRequired

    StyleService->>StyleService: 지침 파싱<br/>- 글쓰기 가이드<br/>- 검증 규칙<br/>- 예시

    StyleService-->>Proxy: ParsedStyle 객체

    Proxy-->>Claude: 📖 스타일 가이드<br/><br/>**요구사항**: 5,000자+<br/>**언어**: 한국어<br/>**AI 태그**: 필수<br/><br/>[상세 지침...]
```

---

## 📊 5. 메트릭 & 모니터링 플로우

```mermaid
graph LR
    subgraph "MCP Proxy Server"
        ProxyMetrics[Prometheus Metrics]
        Counter1[API Key Cache Hits]
        Counter2[API Key Cache Misses]
        Counter3[Request Count]
        Histogram1[Validation Duration]
        Histogram2[Request Duration]
        Gauge1[Redis Connection Status]
    end

    subgraph "Backend"
        BackendMetrics[Prometheus Metrics]
        Counter4[MCP Post Created]
        Counter5[MCP Post Errors]
        Histogram3[Post Creation Duration]
        Gauge2[Usage Tracking]
    end

    subgraph "Prometheus"
        PromServer[Prometheus Server<br/>Port 9090]
        Scraper[Scraper<br/>15초마다]
    end

    subgraph "Grafana"
        Dashboard1[MCP 자동포스팅 API]
        Dashboard2[캐시 성능]
        Dashboard3[사용량 통계]
    end

    ProxyMetrics --> Counter1
    ProxyMetrics --> Counter2
    ProxyMetrics --> Counter3
    ProxyMetrics --> Histogram1
    ProxyMetrics --> Histogram2
    ProxyMetrics --> Gauge1

    BackendMetrics --> Counter4
    BackendMetrics --> Counter5
    BackendMetrics --> Histogram3
    BackendMetrics --> Gauge2

    Scraper -->|GET /metrics| ProxyMetrics
    Scraper -->|GET /api/v1/metrics| BackendMetrics
    PromServer --> Scraper

    PromServer --> Dashboard1
    PromServer --> Dashboard2
    PromServer --> Dashboard3

    classDef metricsStyle fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef promStyle fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef grafanaStyle fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px

    class ProxyMetrics,BackendMetrics,Counter1,Counter2,Counter3,Counter4,Counter5,Histogram1,Histogram2,Histogram3,Gauge1,Gauge2 metricsStyle
    class PromServer,Scraper promStyle
    class Dashboard1,Dashboard2,Dashboard3 grafanaStyle
```

---

## 🚨 6. 에러 처리 플로우

```mermaid
graph TB
    Start[MCP 요청 시작]

    Start --> ValidateAPIKey{API Key 검증}

    ValidateAPIKey -->|형식 오류| Error1[400 Bad Request<br/>Invalid API key format]
    ValidateAPIKey -->|검증 실패| Error2[401 Unauthorized<br/>Invalid or expired API key]
    ValidateAPIKey -->|캐시 오류| CacheFallback[Redis 캐시 실패<br/>Backend 직접 호출로 폴백]
    ValidateAPIKey -->|성공| CheckLimit{사용량 제한 확인}

    CacheFallback --> CheckLimit

    CheckLimit -->|초과| Error3[403 Forbidden<br/>월간 제한 초과]
    CheckLimit -->|OK| ValidateContent{콘텐츠 검증}

    ValidateContent -->|크기 초과| Error4[400 Bad Request<br/>포스트 크기 제한 초과<br/>200,000자 또는 1MB]
    ValidateContent -->|OK| CreatePost[포스트 생성<br/>Fast Path]

    CreatePost --> Success[202 Accepted<br/>백그라운드 처리]
    CreatePost --> BackgroundError{백그라운드<br/>처리 실패?}

    BackgroundError -->|HTML 변환 실패| Retry1[재시도 3회<br/>exponential backoff]
    BackgroundError -->|이미지 업로드 실패| Retry2[재시도 3회<br/>S3 연결 확인]
    BackgroundError -->|검색 인덱스 실패| Retry3[재시도 3회<br/>로그 기록]

    Retry1 -->|최종 실패| Alert1[알람 발송<br/>관리자 알림]
    Retry2 -->|최종 실패| Alert2[알람 발송<br/>S3 상태 확인]
    Retry3 -->|최종 실패| Alert3[알람 발송<br/>검색 서비스 확인]

    Error1 --> Metrics[메트릭 기록<br/>mcp_errors_total++]
    Error2 --> Metrics
    Error3 --> Metrics
    Error4 --> Metrics
    Alert1 --> Metrics
    Alert2 --> Metrics
    Alert3 --> Metrics

    Metrics --> End[종료]
    Success --> End

    classDef errorStyle fill:#ffebee,stroke:#c62828,stroke-width:2px
    classDef successStyle fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    classDef retryStyle fill:#fff3e0,stroke:#ef6c00,stroke-width:2px

    class Error1,Error2,Error3,Error4,Alert1,Alert2,Alert3 errorStyle
    class Success,CreatePost successStyle
    class Retry1,Retry2,Retry3,CacheFallback retryStyle
```

---

## 🔄 7. 캐시 무효화 플로우

```mermaid
sequenceDiagram
    participant Backend as Backend API
    participant EventEmitter as Event Emitter
    participant Listener as Cache Invalidation<br/>Listener
    participant Redis as Redis Cache
    participant CacheService as Cache Service

    Note over Backend: 포스트 생성/수정/삭제 시

    Backend->>EventEmitter: emit('post.created', post)<br/>또는<br/>emit('post.updated', post)<br/>emit('post.deleted', post)

    EventEmitter->>Listener: onPostCreated(post)<br/>onPostUpdated(post)<br/>onPostDeleted(post)

    Listener->>Listener: 무효화할 캐시 키<br/>패턴 결정

    loop 캐시 패턴별 무효화
        Listener->>Redis: SCAN 0 MATCH posts:all:*
        Redis-->>Listener: [키 목록]

        loop 각 키마다
            Listener->>CacheService: del(key)
            CacheService->>Redis: DEL {key}
        end
    end

    loop 블로그별 캐시 무효화
        Listener->>Redis: SCAN 0 MATCH posts:blog:{blogId}:*
        Redis-->>Listener: [키 목록]

        loop 각 키마다
            Listener->>CacheService: del(key)
            CacheService->>Redis: DEL {key}
        end
    end

    loop 홈 피드 캐시 무효화
        Listener->>Redis: SCAN 0 MATCH home:posts:*
        Redis-->>Listener: [키 목록]

        loop 각 키마다
            Listener->>CacheService: del(key)
            CacheService->>Redis: DEL {key}
        end
    end

    Note over Redis: 다음 요청 시<br/>캐시 미스 발생<br/>→ DB 조회<br/>→ 새 캐시 생성
```

---

## 📈 8. 성능 최적화 전략

### 8.1 캐싱 전략

```mermaid
graph LR
    subgraph "L1: Application Cache"
        AppCache[Node.js Memory<br/>TTL: 30초<br/>가장 빠름]
    end

    subgraph "L2: Redis Cache"
        RedisCache[Redis<br/>TTL: 5분<br/>공유 캐시]
    end

    subgraph "L3: Database"
        DB[(PostgreSQL<br/>영구 저장소)]
    end

    Request[API 요청] --> AppCache
    AppCache -->|캐시 미스| RedisCache
    RedisCache -->|캐시 미스| DB

    DB -->|결과 저장| RedisCache
    RedisCache -->|결과 저장| AppCache
    AppCache -->|응답| Response[API 응답]

    classDef l1Style fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    classDef l2Style fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef l3Style fill:#fce4ec,stroke:#880e4f,stroke-width:2px

    class AppCache l1Style
    class RedisCache l2Style
    class DB l3Style
```

### 8.2 Fast Path 처리

```mermaid
graph TB
    Request[포스트 생성 요청]

    Request --> Validate[1. 입력 검증<br/>즉시 처리<br/>10-20ms]
    Validate --> CheckLimit[2. 제한 확인<br/>Redis 조회<br/>5-10ms]
    CheckLimit --> InsertDB[3. DB 삽입<br/>기본 정보만<br/>50-100ms]
    InsertDB --> QueueJob[4. 큐 등록<br/>비동기 작업<br/>10-20ms]
    QueueJob --> Response[202 Accepted<br/>총 시간: 150-200ms]

    QueueJob -.->|비동기| Worker1[Worker 1<br/>HTML 변환<br/>500-1000ms]
    QueueJob -.->|비동기| Worker2[Worker 2<br/>이미지 업로드<br/>1000-3000ms]
    QueueJob -.->|비동기| Worker3[Worker 3<br/>검색 인덱스<br/>200-500ms]

    Worker1 --> Complete[백그라운드 완료<br/>총 시간: 1-5초]
    Worker2 --> Complete
    Worker3 --> Complete

    classDef fastStyle fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    classDef slowStyle fill:#e3f2fd,stroke:#1565c0,stroke-width:2px

    class Validate,CheckLimit,InsertDB,QueueJob,Response fastStyle
    class Worker1,Worker2,Worker3,Complete slowStyle
```

---

## 🔒 9. 보안 정책

### 9.1 Rate Limiting

```mermaid
graph TB
    Request[API 요청]

    Request --> RateLimiter{Rate Limiter<br/>ThrottlerGuard}

    RateLimiter -->|분당 3회 초과| Block1[429 Too Many Requests<br/>1분 대기]
    RateLimiter -->|시간당 10회 초과| Block2[429 Too Many Requests<br/>1시간 대기]
    RateLimiter -->|하루 20회 초과| Block3[429 Too Many Requests<br/>24시간 대기]
    RateLimiter -->|제한 OK| Process[요청 처리]

    Process --> Success[200/202 응답]

    classDef blockStyle fill:#ffebee,stroke:#c62828,stroke-width:2px
    classDef successStyle fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px

    class Block1,Block2,Block3 blockStyle
    class Process,Success successStyle
```

### 9.2 API Key 보안

```mermaid
graph TB
    subgraph "API Key 생성"
        Gen1[1. 고유 hint 생성<br/>8자, a-z0-9]
        Gen2[2. secret 생성<br/>32자, A-Za-z0-9]
        Gen3[3. 전체 키 조합<br/>blog_sk_{hint}_{secret}]
        Gen4[4. bcrypt 해시<br/>cost factor: 8]
        Gen5[5. DB 저장<br/>hint + hash만 저장]

        Gen1 --> Gen2 --> Gen3 --> Gen4 --> Gen5
    end

    subgraph "API Key 검증"
        Val1[1. hint 추출<br/>O 1 조회]
        Val2[2. bcrypt 비교<br/>전체 키]
        Val3[3. 만료 확인<br/>90일 제한]
        Val4[4. 활성 상태<br/>isActive = true]

        Val1 --> Val2 --> Val3 --> Val4
    end

    subgraph "보안 정책"
        Pol1[사용자당 1개<br/>기존 키 자동 삭제]
        Pol2[90일 자동 만료<br/>갱신 필요]
        Pol3[전체 키는 1회만 표시<br/>재조회 불가]
        Pol4[Redis 캐싱<br/>5분 TTL]
    end

    classDef genStyle fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    classDef valStyle fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef polStyle fill:#fff3e0,stroke:#ef6c00,stroke-width:2px

    class Gen1,Gen2,Gen3,Gen4,Gen5 genStyle
    class Val1,Val2,Val3,Val4 valStyle
    class Pol1,Pol2,Pol3,Pol4 polStyle
```

---

## 📝 10. 전체 시스템 요약

### 주요 특징

1. **Stateless 아키텍처**
   - 요청마다 새로운 MCP 서버 생성 (Context7 스타일)
   - 세션 관리 불필요, 단순한 구조

2. **고성능 캐싱**
   - Redis를 통한 API Key 검증 캐싱 (5분 TTL)
   - 캐시 히트: 1-3ms, 캐시 미스: 85-165ms
   - 99% 응답 시간 단축

3. **Fast Path 처리**
   - 포스트 생성 즉시 응답 (150-200ms)
   - 백그라운드 비동기 처리 (HTML 변환, 이미지 업로드, 검색 인덱스)
   - 사용자 경험 대폭 개선

4. **강력한 보안**
   - Stripe 스타일 API Key (blog_sk_{hint}_{secret})
   - bcrypt 해시 (cost factor: 8)
   - Rate Limiting (분당 3회, 시간당 10회, 하루 20회)
   - 90일 자동 만료 정책

5. **자동 캐시 무효화**
   - 이벤트 기반 캐시 무효화
   - 포스트 생성/수정/삭제 시 관련 캐시 자동 삭제
   - SCAN 패턴 매칭으로 정확한 무효화

6. **종합 모니터링**
   - Prometheus 메트릭 수집
   - Grafana 대시보드 시각화
   - 실시간 성능 및 에러 추적

### 성능 지표

| 지표 | 값 | 설명 |
|------|-----|------|
| **API Key 검증 (캐시 히트)** | 1-3ms | Redis 캐시 조회 |
| **API Key 검증 (캐시 미스)** | 85-165ms | Backend bcrypt 검증 |
| **포스트 생성 (Fast Path)** | 150-200ms | 즉시 응답 |
| **백그라운드 처리** | 1-5초 | HTML 변환 + 이미지 업로드 |
| **캐시 히트율** | >95% | Redis 캐싱 효과 |
| **Rate Limit** | 3/분, 10/시간, 20/일 | ThrottlerGuard |

### 데이터 흐름

```
Claude Desktop (MCP Client)
    ↓ POST /mcp (Bearer: blog_sk_...)
MCP Proxy Server (Port 3002)
    ↓ Redis 캐시 확인 (1-3ms)
    ↓ 캐시 미스 시 Backend 검증 (85-165ms)
Backend API (Port 3000)
    ↓ API Key 검증 (bcrypt)
    ↓ 사용량 제한 확인 (Redis)
    ↓ 포스트 생성 (Fast Path, 150-200ms)
    ↓ 큐에 작업 등록 (비동기)
PostgreSQL (데이터 저장)
    ↓ 백그라운드 작업 (1-5초)
BullMQ Workers
    ↓ HTML 변환, 이미지 S3 업로드, 검색 인덱스
Redis (캐시 무효화)
    ↓ 이벤트 기반 무효화
Grafana (모니터링)
    ↓ Prometheus 메트릭 수집
```

---

## 🎯 결론

Codebase MCP 시스템은 **API Key 기반 인증**, **Fast Path 처리**, **Redis 캐싱**, **이벤트 기반 캐시 무효화**를 통해 고성능 자동 포스팅 플랫폼을 구현했습니다.

### 핵심 성과

- ✅ **99% 응답 속도 개선** (Redis 캐싱)
- ✅ **150-200ms 포스트 생성** (Fast Path)
- ✅ **강력한 보안** (bcrypt + Rate Limiting)
- ✅ **자동 캐시 무효화** (이벤트 기반)
- ✅ **종합 모니터링** (Prometheus + Grafana)

### 향후 개선 방향

1. **고가용성**: MCP Proxy Server 이중화
2. **스케일링**: 수평 확장 자동화
3. **성능**: HTTP/2 또는 gRPC 도입
4. **보안**: IP 바인딩, 세션 보안 강화
5. **모니터링**: 실시간 알람 시스템 구축

---

*문서 작성일: 2025-10-22*
*시스템 버전: MCP Proxy 8.0.0, Backend API 1.0.0*
*인증 방식: API Key (Stripe Style)*
