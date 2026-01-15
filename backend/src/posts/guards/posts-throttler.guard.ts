import { Injectable, ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class PostsThrottlerGuard extends ThrottlerGuard {
  /**
   * 사용자별 Rate Limiting을 위한 키 생성
   * 로그인한 사용자는 user.id로, 비로그인은 IP로 구분
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // JWT 인증된 사용자의 경우 user.id 사용
    if (req.user && req.user.id) {
      return `user_${req.user.id}`;
    }

    // 비로그인 사용자는 IP 주소 사용
    const ip =
      req.ip ||
      req.connection?.remoteAddress ||
      req.headers["x-forwarded-for"] ||
      "unknown";

    return `ip_${ip}`;
  }

  /**
   * Rate limit 정보를 응답 헤더에 추가
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: any,
  ): Promise<void> {
    const response = context.switchToHttp().getResponse();
    const { totalHits, limit, timeToExpire } = throttlerLimitDetail;

    // Rate limit 정보를 헤더에 추가
    response.setHeader("X-RateLimit-Limit", limit);
    response.setHeader("X-RateLimit-Remaining", Math.max(0, limit - totalHits));
    response.setHeader(
      "X-RateLimit-Reset",
      new Date(Date.now() + timeToExpire).toISOString(),
    );

    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
