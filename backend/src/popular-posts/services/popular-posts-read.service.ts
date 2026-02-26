import { Injectable, Logger } from "@nestjs/common";
import { PopularCacheService } from "./popular-cache.service";
import { PopularSnapshotService } from "./popular-snapshot.service";
import { PopularScoreQueryService } from "./popular-score-query.service";
import {
  PopularCommunityResponse,
  PopularPeriod,
  PopularPostsResponse,
  PopularSourceType,
} from "../types/popular-post.types";

@Injectable()
export class PopularPostsReadService {
  private readonly logger = new Logger(PopularPostsReadService.name);
  private readonly maxLimit = 20;
  private readonly preloadLimit = 200;

  constructor(
    private readonly popularCacheService: PopularCacheService,
    private readonly popularSnapshotService: PopularSnapshotService,
    private readonly popularScoreQueryService: PopularScoreQueryService,
  ) {}

  normalizePeriod(input?: string): PopularPeriod {
    if (input === "daily" || input === "weekly" || input === "monthly") {
      return input;
    }
    return "weekly";
  }

  normalizeLimit(input?: string | number, fallback = 5): number {
    const parsed =
      typeof input === "number" ? input : Number.parseInt(input ?? "", 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.min(parsed, this.maxLimit);
  }

  async getBlogPopularPosts(
    periodInput?: string,
    limitInput?: string | number,
  ): Promise<PopularPostsResponse> {
    const period = this.normalizePeriod(periodInput);
    const limit = this.normalizeLimit(limitInput, 5);

    const items = await this.getPopularItems("blog", period, limit);
    return {
      posts: items,
      total: items.length,
    };
  }

  async getCommunityPopularPosts(
    periodInput?: string,
    limitInput?: string | number,
  ): Promise<PopularCommunityResponse> {
    const period = this.normalizePeriod(periodInput);
    const limit = this.normalizeLimit(limitInput, 5);

    const items = await this.getPopularItems("community", period, limit);
    return {
      items,
      total: items.length,
    };
  }

  private async getPopularItems(
    source: PopularSourceType,
    period: PopularPeriod,
    limit: number,
  ): Promise<Record<string, unknown>[]> {
    // 기본 경로는 캐시/스냅샷 read-only다.
    // 단, 신규 배포 직후처럼 데이터가 완전히 비어 있으면 1회 계산으로 seed를 만든다.
    const cached = await this.popularCacheService.get(source, period);
    if (cached?.items?.length) {
      return cached.items.slice(0, limit);
    }

    const snapshots = await this.popularSnapshotService.getTop(
      source,
      period,
      this.preloadLimit,
    );

    const items = snapshots.map((snapshot) => snapshot.metaJson);
    if (!items.length) {
      return this.seedFromLiveQuery(source, period, limit);
    }

    const generatedAt =
      snapshots[0]?.snapshotAt?.toISOString() ?? new Date().toISOString();

    try {
      await this.popularCacheService.setAtomic(source, period, {
        generatedAt,
        items,
      });
    } catch (error) {
      this.logger.warn(
        `[Popular Read] cache refill failed for ${source}:${period} - serving snapshot data`,
      );
    }

    return items.slice(0, limit);
  }

  private async seedFromLiveQuery(
    source: PopularSourceType,
    period: PopularPeriod,
    limit: number,
  ): Promise<Record<string, unknown>[]> {
    const snapshotAt = new Date();
    try {
      const rows = await this.popularScoreQueryService.calculatePopularRows(
        source,
        period,
        this.preloadLimit,
      );

      if (!rows.length) {
        return [];
      }

      const items = rows.map((row) => row.metaJson);

      // 다음 요청부터는 배치 스냅샷 경로를 그대로 재사용하도록 seed를 남긴다.
      await this.popularSnapshotService.replaceSnapshot(
        source,
        period,
        snapshotAt,
        rows,
      );
      await this.popularCacheService.setAtomic(source, period, {
        generatedAt: snapshotAt.toISOString(),
        items,
      });

      this.logger.warn(
        `[Popular Read] seeded ${source}:${period} from live query due to empty snapshot/cache`,
      );

      return items.slice(0, limit);
    } catch (error) {
      this.logger.error(
        `[Popular Read] live seed failed for ${source}:${period}`,
        error instanceof Error ? error.stack : String(error),
      );
      return [];
    }
  }
}
