import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { PopularCacheService } from "./popular-cache.service";
import { PopularScoreQueryService } from "./popular-score-query.service";
import { PopularSnapshotService } from "./popular-snapshot.service";
import {
  PopularPeriod,
  PopularSourceType,
} from "../types/popular-post.types";

@Injectable()
export class PopularPostsBatchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PopularPostsBatchService.name);
  private readonly sourceTypes: PopularSourceType[] = ["blog", "community"];
  private readonly periods: PopularPeriod[] = ["daily", "weekly", "monthly"];
  private readonly perBucketLimit = 200;
  private readonly cronJobName = "popular-posts-batch";
  private isRunning = false;

  constructor(
    private readonly popularScoreQueryService: PopularScoreQueryService,
    private readonly popularSnapshotService: PopularSnapshotService,
    private readonly popularCacheService: PopularCacheService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    this.registerCronJob();
  }

  onModuleDestroy(): void {
    this.unregisterCronJob();
  }

  private registerCronJob(): void {
    // ConfigModule 로딩 이후 값을 읽어 runtime config가 실제 스케줄에 반영되도록 한다.
    const cronExpression =
      this.configService.get<string>("POPULAR_BATCH_CRON") ?? "0 4 * * *";
    const timeZone =
      this.configService.get<string>("POPULAR_BATCH_TIMEZONE") ?? "Asia/Seoul";

    this.unregisterCronJob();

    // `cron` 패키지 타입 의존 없이 런타임 생성한다.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { CronJob } = require("cron");
    const cronJob = new CronJob(
      cronExpression,
      () => {
        void this.executeBatch("cron");
      },
      null,
      false,
      timeZone,
    );
    cronJob.start();

    this.schedulerRegistry.addCronJob(this.cronJobName, cronJob);
    this.logger.log(
      `[Popular Batch] registered cron schedule ${cronExpression} (${timeZone})`,
    );
  }

  private unregisterCronJob(): void {
    try {
      this.schedulerRegistry.getCronJob(this.cronJobName).stop();
      this.schedulerRegistry.deleteCronJob(this.cronJobName);
    } catch {
      // no-op: cron job does not exist yet
    }
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
