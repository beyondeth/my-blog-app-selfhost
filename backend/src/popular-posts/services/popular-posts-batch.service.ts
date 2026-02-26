import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PopularCacheService } from "./popular-cache.service";
import { PopularScoreQueryService } from "./popular-score-query.service";
import { PopularSnapshotService } from "./popular-snapshot.service";
import {
  PopularPeriod,
  PopularSourceType,
} from "../types/popular-post.types";

const POPULAR_BATCH_CRON = process.env.POPULAR_BATCH_CRON ?? "0 4 * * *";
const POPULAR_BATCH_TIMEZONE =
  process.env.POPULAR_BATCH_TIMEZONE ?? "Asia/Seoul";

@Injectable()
export class PopularPostsBatchService {
  private readonly logger = new Logger(PopularPostsBatchService.name);
  private readonly sourceTypes: PopularSourceType[] = ["blog", "community"];
  private readonly periods: PopularPeriod[] = ["daily", "weekly", "monthly"];
  private readonly perBucketLimit = 200;
  private isRunning = false;

  constructor(
    private readonly popularScoreQueryService: PopularScoreQueryService,
    private readonly popularSnapshotService: PopularSnapshotService,
    private readonly popularCacheService: PopularCacheService,
  ) {}

  @Cron(POPULAR_BATCH_CRON, { timeZone: POPULAR_BATCH_TIMEZONE })
  async runDailyBatch(): Promise<void> {
    // 하루 1회 오프피크 배치만 허용하여 인기글 기능의 리소스 상한을 고정한다.
    await this.executeBatch("cron");
  }

  async executeBatch(trigger: "cron" | "manual"): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
        `[Popular Batch] skipped (${trigger}) - previous batch still running`,
      );
      return;
    }

    this.isRunning = true;
    const startedAt = Date.now();
    const snapshotAt = new Date();

    try {
      for (const source of this.sourceTypes) {
        for (const period of this.periods) {
          await this.processBucket(source, period, snapshotAt);
        }
      }

      this.logger.log(
        `[Popular Batch] completed (${trigger}) in ${Date.now() - startedAt}ms`,
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async processBucket(
    source: PopularSourceType,
    period: PopularPeriod,
    snapshotAt: Date,
  ): Promise<void> {
    try {
      this.popularScoreQueryService.logQueryStart(source, period);

      const rows = await this.popularScoreQueryService.calculatePopularRows(
        source,
        period,
        this.perBucketLimit,
      );

      await this.popularSnapshotService.replaceSnapshot(
        source,
        period,
        snapshotAt,
        rows,
      );

      this.popularSnapshotService.logSnapshotResult(source, period, rows.length);

      const items = rows.map((row) => row.metaJson);
      await this.popularCacheService.setAtomic(source, period, {
        generatedAt: snapshotAt.toISOString(),
        items,
      });
    } catch (error) {
      this.logger.error(
        `[Popular Batch] failed source=${source}, period=${period}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
