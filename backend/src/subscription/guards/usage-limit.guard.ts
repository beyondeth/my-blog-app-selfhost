import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsageService } from '../../usage/usage.service';
import { ResourceType } from '../../common/enums/subscription.enum';
import { CHECK_USAGE_KEY } from '../decorators/check-usage.decorator';

@Injectable()
export class UsageLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private usageService: UsageService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 데코레이터에서 체크할 리소스 타입 가져오기
    const resourceType = this.reflector.getAllAndOverride<ResourceType>(
      CHECK_USAGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 리소스 타입이 지정되지 않았으면 통과
    if (!resourceType) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('인증이 필요합니다');
    }

    // 사용량 제한 확인
    const canUse = await this.usageService.checkUsageLimit(
      user.id,
      resourceType,
      1,
    );

    if (!canUse) {
      const stats = await this.usageService.getUsageStats(user.id);
      const currentUsage = stats.usage[resourceType] || 0;
      const limit = stats.limits[resourceType] || 0;

      throw new ForbiddenException(
        `${this.getResourceDisplayName(resourceType)} 제한에 도달했습니다. ` +
        `(${currentUsage}/${limit === -1 ? '무제한' : limit}) ` +
        `더 많은 사용량이 필요하시면 플랜을 업그레이드하세요.`
      );
    }

    // 사용량 추적은 실제 작업이 완료된 후에 수행하도록
    // 컨트롤러나 서비스 레벨에서 처리
    request.shouldTrackUsage = true;
    request.usageResourceType = resourceType;

    return true;
  }

  /**
   * 리소스 표시 이름
   */
  private getResourceDisplayName(resourceType: ResourceType): string {
    const names = {
      [ResourceType.POST]: '일반 포스트',
      [ResourceType.MCP_POST]: 'MCP 자동포스팅',
      [ResourceType.BLOG]: '블로그',
      [ResourceType.STORAGE]: '저장공간',
      [ResourceType.VIEWS]: '조회수',
      [ResourceType.API_CALLS]: 'API 호출',
      [ResourceType.AI_CREDITS]: 'AI 크레딧',
    };
    return names[resourceType] || resourceType;
  }
}