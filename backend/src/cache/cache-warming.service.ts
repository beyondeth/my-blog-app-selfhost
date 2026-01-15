import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { CacheService, CacheKeys, CacheTTL } from "./cache.service";

/**
 * 캐시 워밍 서비스 (단순화 버전)
 *
 * 단순화된 캐시 워밍으로 메모리 사용량 최소화
 * 필수적인 데이터만 워밍
 */
@Injectable()
export class CacheWarmingService {
  private readonly logger = new Logger(CacheWarmingService.name);

  constructor(private readonly cacheService: CacheService) {}

  /**
   * 홈 피드만 워밍 (필수 트래픽)
   * 매 10분마다 실행
   */
  @Cron("0 */10 * * * *")
  async warmHomeFeed(): Promise<void> {
    try {
      this.logger.debug("🔥 [WARM] Warming home feed cache...");

      // 홈 피드 1페이지 미리 워밍
      const dummyHomeFeedData = {
        posts: [],
        total: 0,
        page: 1,
        totalPages: 0,
      };

      await this.cacheService.set(
        CacheKeys.FEED_HOME(1),
        dummyHomeFeedData,
        CacheTTL.HOME_FEED,
      );

      this.logger.debug("✅ [WARM] Home feed warmed");
    } catch (error) {
      this.logger.error("❌ [WARM] Home feed warming failed:", error);
    }
  }

  /**
   * 캐시 정리 작업
   * 매 30분마다 만료된 캐시 정리
   */
  @Cron("0 */30 * * * *")
  async cleanupExpiredCache(): Promise<void> {
    try {
      this.logger.debug("🧹 [CLEANUP] Cleaning up expired cache...");

      // 만료된 캐시는 Redis LRU 정책으로 자동 정리
      // 별도의 정리 작업 불필요

      this.logger.debug("✅ [CLEANUP] Cache cleanup completed");
    } catch (error) {
      this.logger.error("❌ [CLEANUP] Cache cleanup failed:", error);
    }
  }

  /**
   * 수동 워밍 (필요한 경우에만)
   */
  async manualWarm(key: string, data: any, ttl: number): Promise<void> {
    try {
      await this.cacheService.set(key, data, ttl);
      this.logger.debug(`🔥 [MANUAL] Warmed cache: ${key}`);
    } catch (error) {
      this.logger.error(`❌ [MANUAL] Manual warming failed for ${key}:`, error);
    }
  }
}
