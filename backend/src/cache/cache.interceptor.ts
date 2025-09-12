import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from './cache.service';

/**
 * 자동 캐싱 인터셉터
 * GET 요청에 대해 자동으로 캐싱을 적용
 * 
 * 사용법:
 * @UseInterceptors(CacheInterceptor)
 * @CacheTTL(300) // 선택적 TTL 설정
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(private cacheService: CacheService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    
    // GET 요청만 캐싱
    if (request.method !== 'GET') {
      return next.handle();
    }

    // 캐시 키 생성 (URL + 쿼리 파라미터 + 사용자 ID)
    const cacheKey = this.generateCacheKey(request);
    
    // 캐시 확인
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache HIT for ${request.url}`);
      return of(cached);
    }

    // 캐시 미스 - 핸들러 실행 후 캐싱
    const ttl = this.getTTL(context);
    
    return next.handle().pipe(
      tap(async (response) => {
        // 성공 응답만 캐싱
        if (response && !response.error) {
          await this.cacheService.set(cacheKey, response, ttl);
          this.logger.debug(`Cached response for ${request.url} (TTL: ${ttl}s)`);
        }
      }),
    );
  }

  /**
   * 캐시 키 생성
   */
  private generateCacheKey(request: any): string {
    const { url, query, user } = request;
    
    // URL 기반 기본 키
    let key = `http:${url}`;
    
    // 쿼리 파라미터 추가
    if (query && Object.keys(query).length > 0) {
      const queryString = Object.keys(query)
        .sort()
        .map(k => `${k}=${query[k]}`)
        .join('&');
      key += `:${queryString}`;
    }
    
    // 사용자별 캐싱이 필요한 경우 (선택적)
    // 주의: 사용자별 캐싱은 캐시 효율을 떨어뜨릴 수 있음
    if (user && this.requiresUserSpecificCache(url)) {
      key += `:user:${user.id}`;
    }
    
    return key;
  }

  /**
   * TTL 가져오기 (컨트롤러 메타데이터에서)
   */
  private getTTL(context: ExecutionContext): number {
    const handler = context.getHandler();
    const controller = context.getClass();
    
    // 핸들러 레벨 TTL
    const handlerTTL = Reflect.getMetadata('cache:ttl', handler);
    if (handlerTTL) return handlerTTL;
    
    // 컨트롤러 레벨 TTL
    const controllerTTL = Reflect.getMetadata('cache:ttl', controller);
    if (controllerTTL) return controllerTTL;
    
    // 기본 TTL (5분)
    return 300;
  }

  /**
   * 사용자별 캐싱이 필요한 URL 패턴
   */
  private requiresUserSpecificCache(url: string): boolean {
    const userSpecificPatterns = [
      /\/api\/v1\/users\/me/,
      /\/api\/v1\/posts\/my-posts/,
      /\/api\/v1\/blogs\/my-blog/,
    ];
    
    return userSpecificPatterns.some(pattern => pattern.test(url));
  }
}