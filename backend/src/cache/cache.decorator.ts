import { SetMetadata } from '@nestjs/common';

/**
 * 캐시 TTL 설정 데코레이터
 * 
 * @param ttl - Time To Live in seconds
 * 
 * 사용 예시:
 * @CacheTTL(600) // 10분
 * @Get()
 * findAll() { ... }
 */
export const CacheTTL = (ttl: number) => SetMetadata('cache:ttl', ttl);

/**
 * 캐시 비활성화 데코레이터
 * 
 * 사용 예시:
 * @NoCache()
 * @Get('sensitive')
 * getSensitiveData() { ... }
 */
export const NoCache = () => SetMetadata('cache:skip', true);

/**
 * 캐시 키 커스터마이징 데코레이터
 * 
 * @param keyPattern - 캐시 키 패턴
 * 
 * 사용 예시:
 * @CacheKey('custom:key:{{id}}')
 * @Get(':id')
 * findOne(@Param('id') id: string) { ... }
 */
export const CacheKey = (keyPattern: string) => SetMetadata('cache:key', keyPattern);