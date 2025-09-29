import { SetMetadata } from '@nestjs/common';
import { ResourceType } from '../../common/enums/subscription.enum';

export const CHECK_USAGE_KEY = 'checkUsage';

/**
 * 특정 리소스의 사용량을 체크하는 데코레이터
 *
 * @example
 * ```typescript
 * @CheckUsage(ResourceType.POSTS)
 * @Post()
 * async createPost() {
 *   // 포스트 생성 전에 사용량 제한 확인
 * }
 * ```
 */
export const CheckUsage = (resourceType: ResourceType) =>
  SetMetadata(CHECK_USAGE_KEY, resourceType);