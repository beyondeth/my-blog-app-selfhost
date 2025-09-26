import { SetMetadata } from '@nestjs/common';

/**
 * OAuth2 스코프 요구사항 지정 데코레이터
 * @param scopes 필요한 스코프 목록
 */
export const RequireScopes = (...scopes: string[]) => SetMetadata('scopes', scopes);