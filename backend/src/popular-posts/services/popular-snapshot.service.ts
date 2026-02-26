import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { PopularPostSnapshot } from "../entities/popular-post-snapshot.entity";
import {
  PopularPeriod,
  PopularScoreRow,
  PopularSourceType,
} from "../types/popular-post.types";

@Injectable()
export class PopularSnapshotService {
  private readonly logger = new Logger(PopularSnapshotService.name);

  constructor(
    @InjectRepository(PopularPostSnapshot)
    private readonly snapshotRepository: Repository<PopularPostSnapshot>,
    private readonly dataSource: DataSource,
  ) {}

  async replaceSnapshot(
    source: PopularSourceType,
    period: PopularPeriod,
    snapshotAt: Date,
    rows: PopularScoreRow[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(PopularPostSnapshot, {
        sourceType: source,
        period,
      });

      if (!rows.length) {
        return;
      }

      const entities = rows.map((row, index) =>
        manager.create(PopularPostSnapshot, {
          snapshotAt,
          sourceType: source,
          period,
          postId: row.postId,
          score: row.score,
          rank: index + 1,
          metaJson: row.metaJson,
        }),
      );

      await manager.save(PopularPostSnapshot, entities, { chunk: 100 });
    });
  }

  async getTop(
    source: PopularSourceType,
    period: PopularPeriod,
    limit: number,
  ): Promise<PopularPostSnapshot[]> {
    return this.snapshotRepository.find({
      where: { sourceType: source, period },
      order: { rank: "ASC" },
      take: limit,
    });
  }

  async getLatestSnapshotAt(
    source: PopularSourceType,
    period: PopularPeriod,
  ): Promise<Date | null> {
    const latest = await this.snapshotRepository.findOne({
      where: { sourceType: source, period },
      order: { snapshotAt: "DESC" },
      select: ["snapshotAt"],
    });

    return latest?.snapshotAt ?? null;
  }

  logSnapshotResult(
    source: PopularSourceType,
    period: PopularPeriod,
    count: number,
  ): void {
    this.logger.log(
      `[Popular Snapshot] source=${source}, period=${period}, rows=${count}`,
    );
  }
}
