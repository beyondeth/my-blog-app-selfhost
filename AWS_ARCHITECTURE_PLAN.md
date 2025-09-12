# 🚀 AWS 아키텍처 설계 - 월 5만원 예산 최적화

## 📊 현재 상황 분석

### 트래픽 예상 (회원 1,000명 기준)
- **일일 활성 사용자(DAU)**: 300명 (30%)
- **월간 페이지뷰**: 150,000 PV
- **피크 시간 동시 접속**: 50명
- **평균 응답 크기**: 50KB/request
- **월간 데이터 전송량**: ~7.5GB

### 캐싱 기회 분석 (코드베이스 분석 완료)
1. **고빈도 쿼리 (캐싱 필수)**
   - `posts.findAll()` - 포스트 목록 (전체 트래픽의 40%)
   - `blogs.findOneBySlug()` - 블로그 메타데이터 (30%)
   - `users.findByUsername()` - 프로필 조회 (20%)

2. **정적 데이터 (장기 캐싱)**
   - 블로그 설정 (TTL: 1시간)
   - 사용자 프로필 (TTL: 30분)
   - 태그 목록 (TTL: 1시간)

3. **동적 데이터 (단기 캐싱)**
   - 포스트 목록 (TTL: 5분)
   - 포스트 상세 (TTL: 10분)
   - 댓글 (TTL: 1분)

## 💰 비용 최적화 아키텍처

### 월간 예산: 50,000원 (~$38)

```
┌─────────────────────────────────────────────────┐
│              AWS Architecture                    │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │         EC2 t4g.micro (무료)              │   │
│  │  - 2 vCPU, 1GB RAM                       │   │
│  │  - Node.js (PM2 Cluster)                 │   │
│  │  - Nginx                                 │   │
│  │  - Redis (In-Memory Cache)               │   │
│  └──────────────────────────────────────────┘   │
│                      ↕                           │
│  ┌──────────────────────────────────────────┐   │
│  │      RDS t3.micro (무료)                  │   │
│  │  - PostgreSQL 13                         │   │
│  │  - 20GB SSD                              │   │
│  │  - 자동 백업                             │   │
│  └──────────────────────────────────────────┘   │
│                      ↕                           │
│  ┌──────────────────────────────────────────┐   │
│  │         S3 (무료 티어)                    │   │
│  │  - 5GB 저장소                            │   │
│  │  - 20,000 GET                            │   │
│  │  - 2,000 PUT                             │   │
│  └──────────────────────────────────────────┘   │
│                      ↕                           │
│  ┌──────────────────────────────────────────┐   │
│  │     CloudFront (무료 티어)                │   │
│  │  - 1TB 전송/월                           │   │
│  │  - 10,000,000 요청/월                    │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 상세 비용 분석

| 서비스 | 사양 | 월 비용 | 비고 |
|--------|------|---------|------|
| **EC2 t4g.micro** | 2 vCPU, 1GB RAM | **무료** | 12개월 무료 티어 |
| **RDS t3.micro** | 1 vCPU, 1GB RAM, 20GB | **무료** | 12개월 무료 티어 |
| **S3** | 5GB, 20K GET, 2K PUT | **무료** | 무료 티어 한도 내 |
| **CloudFront** | 1TB 전송 | **무료** | 무료 티어 |
| **Route 53** | 호스팅 존 1개 | **$0.50** | 약 650원 |
| **Elastic IP** | 1개 (사용 중) | **무료** | EC2에 연결 시 무료 |
| **데이터 전송** | 15GB/월 아웃바운드 | **무료** | 무료 티어 |
| | | | |
| **예비 비용** | 트래픽 초과, 백업 등 | **~30,000원** | 버퍼 |
| **총 월 비용** | | **~30,650원** | 여유 있는 예산 |

## 🔥 Redis 캐싱 전략

### 1. Redis 구성 (EC2 내장)
```yaml
# EC2 인스턴스 내 Redis 설정
maxmemory: 256mb  # 전체 1GB 중 256MB 할당
maxmemory-policy: allkeys-lru
save: ""  # 디스크 저장 비활성화 (메모리만 사용)
```

### 2. 캐싱 레이어 구현

#### 캐시 키 전략
```typescript
// 캐시 키 패턴
const CacheKeys = {
  // 블로그 관련
  BLOG_BY_SLUG: (slug: string) => `blog:slug:${slug}`,
  BLOG_BY_USER: (userId: string) => `blog:user:${userId}`,
  
  // 포스트 관련
  POST_LIST: (page: number, limit: number, blogSlug?: string) => 
    `posts:list:${page}:${limit}:${blogSlug || 'all'}`,
  POST_DETAIL: (id: string) => `post:${id}`,
  POST_BY_SLUG: (slug: string) => `post:slug:${slug}`,
  
  // 사용자 관련
  USER_PROFILE: (username: string) => `user:profile:${username}`,
  USER_BY_ID: (id: string) => `user:id:${id}`,
  
  // 통계
  BLOG_STATS: (blogId: string) => `stats:blog:${blogId}`,
  POST_VIEW_COUNT: (postId: string) => `views:post:${postId}`,
};

// TTL 설정 (초 단위)
const CacheTTL = {
  SHORT: 60,        // 1분 (댓글, 실시간 데이터)
  MEDIUM: 300,      // 5분 (포스트 목록)
  LONG: 600,        // 10분 (포스트 상세)
  EXTRA_LONG: 1800, // 30분 (프로필)
  STATIC: 3600,     // 1시간 (블로그 설정)
};
```

### 3. 캐싱 구현 예시

#### Posts Service 개선
```typescript
// backend/src/posts/posts.service.ts
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class PostsService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    // ... other dependencies
  ) {}

  async findAll(page: number, limit: number, search?: string, blogSlug?: string) {
    // 캐시 키 생성
    const cacheKey = CacheKeys.POST_LIST(page, limit, blogSlug);
    
    // 캐시 확인
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // DB 쿼리
    const result = await this.postsRepository.findAndCount({
      // ... query options
    });
    
    // 캐시 저장 (5분)
    await this.cacheManager.set(cacheKey, result, CacheTTL.MEDIUM);
    
    return result;
  }
  
  async findOne(id: string) {
    const cacheKey = CacheKeys.POST_DETAIL(id);
    
    // 캐시 확인
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // DB 쿼리
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author', 'blog', 'tags'],
    });
    
    // 캐시 저장 (10분)
    await this.cacheManager.set(cacheKey, post, CacheTTL.LONG);
    
    return post;
  }
  
  // 캐시 무효화
  async invalidatePostCache(postId: string, blogSlug?: string) {
    // 특정 포스트 캐시 삭제
    await this.cacheManager.del(CacheKeys.POST_DETAIL(postId));
    
    // 목록 캐시 패턴 삭제 (Redis SCAN 사용)
    const pattern = `posts:list:*:*:${blogSlug || '*'}`;
    await this.invalidatePattern(pattern);
  }
}
```

#### User Service 개선
```typescript
// backend/src/users/users.service.ts
@Injectable()
export class UsersService {
  async findByUsername(username: string) {
    const cacheKey = CacheKeys.USER_PROFILE(username);
    
    // 캐시 확인
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // DB 쿼리
    const user = await this.usersRepository.findOne({
      where: { username },
      select: ['id', 'username', 'email', 'bio', 'profileImage'],
    });
    
    // 캐시 저장 (30분)
    await this.cacheManager.set(cacheKey, user, CacheTTL.EXTRA_LONG);
    
    return user;
  }
}
```

## 🚀 EC2 최적화 설정

### 1. 시스템 구성
```bash
# EC2 t4g.micro (ARM 기반)
- OS: Amazon Linux 2023 (ARM64)
- Node.js: v20 LTS
- PM2: 클러스터 모드 (2 워커)
- Nginx: 리버스 프록시 + 정적 파일 서빙
- Redis: 6.2 (메모리 전용)
```

### 2. PM2 설정
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'blog-backend',
    script: './dist/main.js',
    instances: 2,  // CPU 코어 수만큼
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    max_memory_restart: '400M',  // 메모리 제한
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    time: true,
  }]
};
```

### 3. Nginx 설정
```nginx
# /etc/nginx/sites-available/myblog
upstream backend {
    least_conn;
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;  # PM2 클러스터
}

server {
    listen 80;
    server_name yourdomain.com;
    
    # 정적 파일 캐싱
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # API 프록시
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # 응답 캐싱
        proxy_cache api_cache;
        proxy_cache_valid 200 1m;
        proxy_cache_use_stale error timeout http_500 http_502 http_503 http_504;
    }
    
    # Gzip 압축
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;
    gzip_min_length 1000;
}
```

### 4. Redis 설정
```bash
# /etc/redis/redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
tcp-keepalive 60
timeout 300

# 성능 최적화
tcp-backlog 511
databases 1  # 단일 DB만 사용
save ""  # 디스크 저장 비활성화

# 보안
bind 127.0.0.1
protected-mode yes
requirepass your_redis_password_here
```

## 📈 성능 예상

### 응답 시간 개선
| 항목 | 캐시 전 | 캐시 후 | 개선율 |
|------|---------|---------|--------|
| 포스트 목록 | 200ms | 15ms | 92.5% |
| 포스트 상세 | 150ms | 10ms | 93.3% |
| 프로필 조회 | 100ms | 8ms | 92% |
| 블로그 메타 | 80ms | 5ms | 93.8% |

### 처리 능력
- **캐시 적중률**: 80-85% (예상)
- **동시 접속**: 200명 처리 가능
- **일일 요청**: 500,000 요청 처리 가능
- **데이터베이스 부하**: 85% 감소

## 🔧 구현 단계

### Phase 1: 기본 인프라 (Week 1)
1. EC2 인스턴스 생성 및 설정
2. RDS PostgreSQL 설정
3. S3 버킷 생성
4. 보안 그룹 구성

### Phase 2: Redis 통합 (Week 2)
1. Redis 설치 및 설정
2. NestJS Cache Manager 설정
3. 주요 서비스 캐싱 구현
4. 캐시 무효화 로직 구현

### Phase 3: 최적화 (Week 3)
1. PM2 클러스터 설정
2. Nginx 리버스 프록시 구성
3. CloudFront CDN 설정
4. 모니터링 설정

### Phase 4: 운영 준비 (Week 4)
1. 백업 전략 수립
2. 모니터링 대시보드 구성
3. 알림 설정
4. 부하 테스트

## 🎯 핵심 이점

1. **비용 효율성**: 월 3만원 내 운영 (예산의 60%)
2. **성능 향상**: 응답 시간 90% 개선
3. **확장성**: 트래픽 5배 증가까지 대응 가능
4. **안정성**: Redis 캐싱으로 DB 부하 분산
5. **무료 티어 활용**: 첫 12개월 대부분 무료

## 📊 모니터링 지표

### 필수 모니터링 항목
- CPU 사용률 (임계값: 80%)
- 메모리 사용률 (임계값: 85%)
- Redis 적중률 (목표: >80%)
- API 응답 시간 (목표: <100ms)
- 에러율 (목표: <0.1%)

### CloudWatch 알람 설정
```javascript
// 주요 알람
1. EC2 CPU > 80% for 5 minutes
2. RDS CPU > 75% for 5 minutes
3. Redis Memory > 90%
4. API Error Rate > 1%
5. Response Time > 500ms
```

## 🚨 비상 계획

### 트래픽 폭증 시
1. **즉시 조치**: CloudFront 캐시 TTL 증가
2. **단기 조치**: EC2 인스턴스 타입 업그레이드 (t4g.small)
3. **장기 조치**: Auto Scaling Group 구성

### 예산 초과 위험 시
1. CloudWatch 예산 알람 설정 (40,000원)
2. 불필요한 리소스 즉시 중단
3. Reserved Instance 검토

## 📝 다음 단계

1. **즉시 시작 가능한 작업**
   - AWS 계정 생성 및 무료 티어 활성화
   - EC2 인스턴스 생성 (t4g.micro)
   - RDS 인스턴스 생성

2. **코드 수정 필요**
   - Redis 캐싱 레이어 구현
   - 환경 변수 설정
   - 배포 스크립트 작성

3. **최적화 작업**
   - DB 쿼리 최적화
   - 이미지 최적화
   - 프론트엔드 번들 최적화

---

**작성일**: 2025년 9월
**예상 구현 기간**: 4주
**목표 트래픽**: 월 150,000 PV (회원 1,000명)