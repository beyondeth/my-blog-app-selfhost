# 📝 멀티테넌트 SaaS 플랫폼 - Phase 3 구현 계획

## 🎯 Phase 3: 성능 최적화 및 보안 강화 (Day 5-6)

### 1️⃣ Redis 캐싱 레이어 구축

#### A. Redis Configuration
**파일**: `backend/src/infrastructure/cache/redis.config.ts`
```typescript
import { CacheModuleOptions, CacheStore } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

export const redisConfig: CacheModuleOptions = {
  store: redisStore as unknown as CacheStore,
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  ttl: 300, // 기본 5분
  max: 100, // 최대 캐시 항목 수
};

// 캐시 키 네임스페이스
export const CACHE_KEYS = {
  ORGANIZATION: {
    BY_SLUG: (slug: string) => `org:slug:${slug}`,
    BY_ID: (id: string) => `org:id:${id}`,
    MEMBERS: (orgId: string) => `org:${orgId}:members`,
  },
  USER: {
    PROFILE: (userId: string) => `user:${userId}:profile`,
    PERMISSIONS: (userId: string, orgId: string) => `user:${userId}:org:${orgId}:perms`,
    ACTIVE_ORG: (userId: string) => `user:${userId}:active-org`,
  },
  USAGE: {
    COUNTER: (subId: string, resource: string) => `usage:${subId}:${resource}`,
    LIMITS: (subId: string) => `usage:${subId}:limits`,
  },
  BLOG: {
    LIST: (orgId: string, page: number) => `blog:org:${orgId}:page:${page}`,
    DETAIL: (blogId: string) => `blog:${blogId}`,
    POSTS: (blogId: string, page: number) => `blog:${blogId}:posts:${page}`,
  },
  RATE_LIMIT: {
    API: (ip: string, endpoint: string) => `rate:${ip}:${endpoint}`,
    USER: (userId: string) => `rate:user:${userId}`,
  }
} as const;
```

#### B. Cache Service
**파일**: `backend/src/infrastructure/cache/cache.service.ts`
```typescript
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private metricsService: MetricsService
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    // Redis 연결 이벤트
    this.redis.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis error:', err);
    });
  }

  // 캐시 가져오기 (타입 안전)
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    try {
      const cached = await this.cacheManager.get<T>(key);

      if (cached) {
        this.metricsService.recordCacheHit(key, Date.now() - startTime);
        return cached;
      }

      this.metricsService.recordCacheMiss(key, Date.now() - startTime);
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  // 캐시 설정
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
      this.logger.debug(`Cached key: ${key}, TTL: ${ttl}s`);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  // 패턴으로 캐시 무효화
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
      this.logger.log(`Invalidated ${keys.length} keys matching pattern: ${pattern}`);
    }
  }

  // 원자적 증가
  async increment(key: string, value: number = 1): Promise<number> {
    return await this.redis.incrby(key, value);
  }

  // 분산 락
  async acquireLock(key: string, ttl: number = 30): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const result = await this.redis.set(lockKey, '1', 'EX', ttl, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.redis.del(`lock:${key}`);
  }

  // 캐시 워밍
  async warmCache(data: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const item of data) {
      const serialized = JSON.stringify(item.value);
      if (item.ttl) {
        pipeline.setex(item.key, item.ttl, serialized);
      } else {
        pipeline.set(item.key, serialized);
      }
    }

    await pipeline.exec();
    this.logger.log(`Warmed ${data.length} cache entries`);
  }
}
```

#### C. Cache Interceptor
**파일**: `backend/src/infrastructure/cache/cache.interceptor.ts`
```typescript
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(
    private cacheService: CacheService,
    private reflector: Reflector
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // GET 요청만 캐시
    if (request.method !== 'GET') {
      return next.handle();
    }

    // 캐시 키 생성
    const cacheKey = this.generateCacheKey(request);

    // 캐시 TTL 메타데이터 확인
    const cacheTTL = this.reflector.get<number>('cache-ttl', context.getHandler());

    // 캐시에서 확인
    const cachedResponse = await this.cacheService.get(cacheKey);

    if (cachedResponse) {
      response.setHeader('X-Cache', 'HIT');
      return of(cachedResponse);
    }

    // 캐시 미스 - 실행 후 캐싱
    return next.handle().pipe(
      tap(async (data) => {
        response.setHeader('X-Cache', 'MISS');
        await this.cacheService.set(cacheKey, data, cacheTTL || 60);
      })
    );
  }

  private generateCacheKey(request: Request): string {
    const { url, query } = request;
    const queryString = JSON.stringify(query || {});
    return `http:${url}:${queryString}`;
  }
}

// 데코레이터
export const CacheTTL = (seconds: number) => SetMetadata('cache-ttl', seconds);
```

### 2️⃣ Circuit Breaker Pattern 구현

#### A. Circuit Breaker Decorator
**파일**: `backend/src/infrastructure/resilience/circuit-breaker.decorator.ts`
```typescript
import CircuitBreaker from 'opossum';

interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
  fallback?: (...args: any[]) => any;
}

const breakers = new Map<string, CircuitBreaker>();

export function CircuitBreakerDecorator(options: CircuitBreakerOptions = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const breakerKey = `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      let breaker = breakers.get(breakerKey);

      if (!breaker) {
        const breakerOptions = {
          timeout: options.timeout || 3000,
          errorThresholdPercentage: options.errorThresholdPercentage || 50,
          resetTimeout: options.resetTimeout || 30000,
          volumeThreshold: options.volumeThreshold || 10,
        };

        breaker = new CircuitBreaker(
          originalMethod.bind(this),
          breakerOptions
        );

        // 이벤트 핸들러
        breaker.on('open', () => {
          console.error(`Circuit breaker opened for ${breakerKey}`);
        });

        breaker.on('halfOpen', () => {
          console.log(`Circuit breaker half-open for ${breakerKey}`);
        });

        breaker.on('close', () => {
          console.log(`Circuit breaker closed for ${breakerKey}`);
        });

        // Fallback 설정
        if (options.fallback) {
          breaker.fallback(options.fallback);
        }

        breakers.set(breakerKey, breaker);
      }

      try {
        return await breaker.fire(...args);
      } catch (error) {
        if (error.code === 'EOPENBREAKER') {
          throw new ServiceUnavailableException(
            'Service temporarily unavailable. Please try again later.'
          );
        }
        throw error;
      }
    };

    return descriptor;
  };
}
```

#### B. Retry Decorator
**파일**: `backend/src/infrastructure/resilience/retry.decorator.ts`
```typescript
interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: 'linear' | 'exponential';
  retryCondition?: (error: any) => boolean;
}

export function Retry(options: RetryOptions = {}) {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 'exponential',
    retryCondition = () => true,
  } = options;

  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: any;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;

          // 재시도 조건 확인
          if (!retryCondition(error) || attempt === maxAttempts) {
            throw error;
          }

          // 대기 시간 계산
          const waitTime = backoff === 'exponential'
            ? delay * Math.pow(2, attempt - 1)
            : delay * attempt;

          console.log(`Retry attempt ${attempt}/${maxAttempts} after ${waitTime}ms`);

          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      throw lastError;
    };

    return descriptor;
  };
}
```

### 3️⃣ Row-Level Security (RLS) 구현

#### A. Tenant Context Service
**파일**: `backend/src/infrastructure/security/tenant-context.service.ts`
```typescript
@Injectable()
export class TenantContextService {
  private readonly logger = new Logger(TenantContextService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly cls: ClsService // Continuation-Local Storage
  ) {}

  // 테넌트 컨텍스트 설정
  setTenantContext(organizationId: string): void {
    this.cls.set('organizationId', organizationId);
  }

  // 현재 테넌트 ID 가져오기
  getCurrentTenantId(): string | undefined {
    return this.cls.get('organizationId');
  }

  // 테넌트 필터 적용된 쿼리 빌더
  createTenantQueryBuilder<T>(
    entity: EntityTarget<T>,
    alias?: string
  ): SelectQueryBuilder<T> {
    const organizationId = this.getCurrentTenantId();

    if (!organizationId) {
      throw new UnauthorizedException('No tenant context set');
    }

    const qb = this.dataSource
      .getRepository(entity)
      .createQueryBuilder(alias);

    // 자동으로 organizationId 필터 추가
    qb.andWhere(`${alias}.organizationId = :organizationId`, { organizationId });

    return qb;
  }

  // 테넌트 검증
  async validateTenantAccess(
    userId: string,
    organizationId: string
  ): Promise<boolean> {
    const membership = await this.dataSource
      .getRepository(OrganizationMembershipEntity)
      .findOne({
        where: {
          userId,
          organizationId,
        },
      });

    return !!membership;
  }
}
```

#### B. Tenant Guard
**파일**: `backend/src/infrastructure/security/tenant.guard.ts`
```typescript
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // @SkipTenant() 데코레이터 체크
    const skipTenant = this.reflector.get<boolean>(
      'skip-tenant',
      context.getHandler()
    );

    if (skipTenant) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // 헤더 또는 파라미터에서 organizationId 추출
    const organizationId =
      request.headers['x-organization-id'] ||
      request.params.organizationId ||
      request.query.organizationId ||
      user.activeOrganizationId;

    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }

    // 테넌트 접근 권한 검증
    const hasAccess = await this.tenantContext.validateTenantAccess(
      user.id,
      organizationId
    );

    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this organization');
    }

    // 테넌트 컨텍스트 설정
    this.tenantContext.setTenantContext(organizationId);

    // Request에 organizationId 추가
    request.organizationId = organizationId;

    return true;
  }
}

// 데코레이터
export const SkipTenant = () => SetMetadata('skip-tenant', true);
export const RequireTenant = () => UseGuards(TenantGuard);
```

### 4️⃣ API Rate Limiting

#### A. Rate Limit Configuration
**파일**: `backend/src/infrastructure/security/rate-limit.config.ts`
```typescript
import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const rateLimitConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      name: 'default',
      ttl: 60000, // 1분
      limit: 100, // 100 requests per minute
    },
    {
      name: 'auth',
      ttl: 900000, // 15분
      limit: 5, // 5 로그인 시도
    },
    {
      name: 'api',
      ttl: 3600000, // 1시간
      limit: 1000, // API 호출 제한
    },
  ],
};

// 플랜별 Rate Limit
export const PLAN_RATE_LIMITS = {
  SUBSCRIPTION_FREE: {
    perMinute: 20,
    perHour: 500,
    perDay: 5000,
  },
  SUBSCRIPTION_BASIC: {
    perMinute: 60,
    perHour: 2000,
    perDay: 20000,
  },
  SUBSCRIPTION_PRO: {
    perMinute: 200,
    perHour: 10000,
    perDay: 100000,
  },
  SUBSCRIPTION_BUSINESS: {
    perMinute: 500,
    perHour: 50000,
    perDay: 500000,
  },
  SUBSCRIPTION_ENTERPRISE: {
    perMinute: -1, // 무제한
    perHour: -1,
    perDay: -1,
  },
} as const;
```

#### B. Custom Rate Limit Guard
**파일**: `backend/src/infrastructure/security/custom-rate-limit.guard.ts`
```typescript
@Injectable()
export class CustomRateLimitGuard extends ThrottlerGuard {
  constructor(
    private cacheService: CacheService,
    private subscriptionService: SubscriptionsService
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return super.canActivate(context);
    }

    // 사용자의 구독 플랜 확인
    const subscription = await this.subscriptionService.getUserSubscription(user.id);
    const planCode = subscription?.planRole?.code || 'SUBSCRIPTION_FREE';

    const limits = PLAN_RATE_LIMITS[planCode];

    if (limits.perMinute === -1) {
      return true; // 무제한
    }

    // Redis에서 현재 사용량 확인
    const key = CACHE_KEYS.RATE_LIMIT.USER(user.id);
    const current = await this.cacheService.increment(key);

    if (current === 1) {
      // 첫 요청 - TTL 설정
      await this.cacheService.expire(key, 60);
    }

    if (current > limits.perMinute) {
      throw new TooManyRequestsException(
        `Rate limit exceeded. Your plan allows ${limits.perMinute} requests per minute.`
      );
    }

    return true;
  }

  protected async getTracker(req: Request): Promise<string> {
    return req.ip;
  }
}
```

### 5️⃣ 보안 헤더 및 CORS

#### A. Security Headers Middleware
**파일**: `backend/src/infrastructure/security/security-headers.middleware.ts`
```typescript
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // 보안 헤더 설정
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // CSP (Content Security Policy)
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://js.stripe.com; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://api.stripe.com; " +
      "frame-src https://js.stripe.com;"
    );

    // HSTS (HTTP Strict Transport Security)
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    }

    next();
  }
}
```

#### B. CORS Configuration
**파일**: `backend/src/infrastructure/security/cors.config.ts`
```typescript
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export const corsConfig: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3001',
      'https://yourdomain.com',
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    // 개발 환경에서는 모든 origin 허용
    if (process.env.NODE_ENV === 'development') {
      callback(null, true);
      return;
    }

    // origin이 없는 경우 (같은 origin)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Whitelist 확인
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Organization-Id',
    'X-Request-Id',
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Cache',
    'X-Rate-Limit-Remaining',
  ],
  maxAge: 86400, // 24 hours
};
```

### 6️⃣ 모니터링 및 로깅

#### A. Application Metrics Service
**파일**: `backend/src/infrastructure/monitoring/metrics.service.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly httpRequestTotal: Counter<string>;
  private readonly activeConnections: Gauge<string>;
  private readonly cacheHits: Counter<string>;
  private readonly cacheMisses: Counter<string>;
  private readonly dbQueryDuration: Histogram<string>;

  constructor() {
    this.registry = new Registry();

    // HTTP 메트릭
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [this.registry],
    });

    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    // 캐시 메트릭
    this.cacheHits = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_key'],
      registers: [this.registry],
    });

    this.cacheMisses = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_key'],
      registers: [this.registry],
    });

    // DB 메트릭
    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    // 활성 연결 수
    this.activeConnections = new Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
      labelNames: ['type'],
      registers: [this.registry],
    });
  }

  recordHttpRequest(
    method: string,
    route: string,
    status: number,
    duration: number
  ): void {
    this.httpRequestTotal.labels(method, route, status.toString()).inc();
    this.httpRequestDuration
      .labels(method, route, status.toString())
      .observe(duration / 1000);
  }

  recordCacheHit(key: string, duration: number): void {
    this.cacheHits.labels(key).inc();
  }

  recordCacheMiss(key: string, duration: number): void {
    this.cacheMisses.labels(key).inc();
  }

  recordDbQuery(operation: string, table: string, duration: number): void {
    this.dbQueryDuration
      .labels(operation, table)
      .observe(duration / 1000);
  }

  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }
}
```

#### B. Logging Configuration
**파일**: `backend/src/infrastructure/monitoring/winston.config.ts`
```typescript
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, context, trace }) => {
    return JSON.stringify({
      timestamp,
      level,
      context,
      message,
      trace,
      organizationId: global.organizationId, // 테넌트 컨텍스트
    });
  })
);

export const winstonConfig = WinstonModule.createLogger({
  transports: [
    // 콘솔 출력
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),

    // 에러 로그 파일
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '14d',
    }),

    // 전체 로그 파일
    new winston.transports.DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '7d',
    }),
  ],
});
```

### 7️⃣ 데이터베이스 최적화

#### A. Query Performance Logger
**파일**: `backend/src/infrastructure/database/query-logger.ts`
```typescript
import { Logger } from 'typeorm';

export class QueryLogger implements Logger {
  private readonly slowQueryThreshold = 1000; // 1초

  logQuery(query: string, parameters?: any[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('Query:', query);
      if (parameters?.length) {
        console.log('Parameters:', parameters);
      }
    }
  }

  logQueryError(error: string, query: string, parameters?: any[]): void {
    console.error('Query Failed:', error);
    console.error('Query:', query);
    if (parameters?.length) {
      console.error('Parameters:', parameters);
    }
  }

  logQuerySlow(time: number, query: string, parameters?: any[]): void {
    if (time > this.slowQueryThreshold) {
      console.warn(`Slow Query (${time}ms):`, query);
      if (parameters?.length) {
        console.warn('Parameters:', parameters);
      }

      // 슬로우 쿼리 메트릭 기록
      metricsService.recordSlowQuery(query, time);
    }
  }

  logSchemaBuild(message: string): void {
    console.log('Schema Build:', message);
  }

  logMigration(message: string): void {
    console.log('Migration:', message);
  }

  log(level: 'log' | 'info' | 'warn', message: any): void {
    console[level](message);
  }
}
```

#### B. Database Connection Pool
**파일**: `backend/src/infrastructure/database/database.config.ts`
```typescript
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { QueryLogger } from './query-logger';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // Connection Pool 설정
  extra: {
    max: 20, // 최대 연결 수
    min: 5, // 최소 연결 수
    idleTimeoutMillis: 30000, // 30초
    connectionTimeoutMillis: 2000, // 2초
    statement_timeout: 10000, // 10초 쿼리 타임아웃
  },

  // 성능 최적화
  cache: {
    type: 'redis',
    options: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
    },
    duration: 30000, // 30초 쿼리 캐시
  },

  // 로깅
  logging: process.env.NODE_ENV !== 'production',
  logger: new QueryLogger(),

  // 기타 설정
  synchronize: false, // Production에서는 false
  migrationsRun: true,
  entities: [__dirname + '/../../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/../migrations/*.{ts,js}'],
};
```

### 8️⃣ 테스트 시나리오

#### A. 성능 테스트
```typescript
describe('Performance Tests', () => {
  it('should handle 1000 concurrent requests', async () => {
    // Artillery or K6 사용
  });

  it('should maintain <100ms response time with cache', async () => {
    // 캐시 성능 테스트
  });

  it('should recover from circuit breaker open state', async () => {
    // Circuit breaker 복원 테스트
  });
});
```

#### B. 보안 테스트
```typescript
describe('Security Tests', () => {
  it('should enforce rate limits per plan', async () => {
    // Rate limiting 테스트
  });

  it('should prevent cross-tenant data access', async () => {
    // RLS 테스트
  });

  it('should handle SQL injection attempts', async () => {
    // SQL 인젝션 방어 테스트
  });
});
```

## 📊 예상 결과

### 성능 개선:
- ✅ Redis 캐싱으로 응답 속도 70% 개선
- ✅ Circuit Breaker로 서비스 안정성 향상
- ✅ Rate Limiting으로 API 남용 방지
- ✅ 쿼리 최적화로 DB 부하 50% 감소

### 보안 강화:
- ✅ Row-Level Security로 테넌트 격리
- ✅ 보안 헤더로 XSS/CSRF 방어
- ✅ Rate Limiting으로 DDoS 방어
- ✅ 모니터링으로 이상 징후 조기 탐지

## ⚠️ 주의사항

1. **캐시 무효화**: 데이터 변경 시 관련 캐시 즉시 무효화
2. **Circuit Breaker 튜닝**: 서비스별 적절한 임계값 설정
3. **Rate Limit 조정**: 실제 사용 패턴 분석 후 조정
4. **로그 관리**: 민감 정보 로깅 금지, 로그 로테이션 설정