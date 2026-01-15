import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Post } from "./entities/post.entity";
import { PostStats } from "./entities/post-stats.entity";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRedis } from "@nestjs-modules/ioredis";
import type Redis from "ioredis";

interface BufferedViewEntry {
  postId: string;
  count: number;
}

@Injectable()
export class ViewCountService {
  private readonly logger = new Logger(ViewCountService.name);
  private readonly bufferPrefix = "post:view:buffer";
  private readonly bufferTtlSeconds = 300;

  constructor(
    @InjectRepository(Post)
    private postsRepository: Repository<Post>,
    @InjectRepository(PostStats)
    private postStatsRepository: Repository<PostStats>,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 조회수 증가 (Redis 버퍼에 임시 저장)
   */
  async incrementViewCount(postId: string): Promise<void> {
    const key = this.buildBufferKey(postId);
    try {
      const pipeline = this.redis.multi();
      pipeline.incrby(key, 1);
      pipeline.expire(key, this.bufferTtlSeconds, "NX");
      await pipeline.exec();
    } catch (error) {
      this.logger.error(
        `Failed to buffer view count for post ${postId}`,
        error,
      );
    }
  }

  /**
   * 모든 조회수를 DB에 반영
   */
  async flushAllViewCounts(): Promise<void> {
    const entries = await this.drainBufferedEntries();
    if (entries.length === 0) {
      return;
    }

    this.logger.log(`Flushing ${entries.length} posts with view count updates`);

    const queryRunner =
      this.postsRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const { postId, count } of entries) {
        await queryRunner.manager
          .createQueryBuilder()
          .update(PostStats)
          .set({
            viewCount: () => `"viewCount" + ${count}`,
            updatedAt: () => "CURRENT_TIMESTAMP",
          })
          .where("postId = :postId", { postId })
          .execute();

        // Post (denormalized) 업데이트
        await queryRunner.manager
          .createQueryBuilder()
          .update(Post)
          .set({
            viewCount: () => `"view_count" + ${count}`,
          })
          .where("id = :postId", { postId })
          .execute();
      }

      await queryRunner.commitTransaction();

      const totalViews = entries.reduce((sum, entry) => sum + entry.count, 0);
      this.logger.log(
        `Successfully flushed ${totalViews} total views across ${entries.length} posts`,
      );

      entries.forEach(({ postId }) =>
        this.eventEmitter.emit("post.popularity.updated", { postId }),
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error("Failed to flush view counts:", error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 매 1분마다 조회수 배치 업데이트
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    await this.flushAllViewCounts();
  }

  /**
   * 애플리케이션 종료 시 남은 조회수 플러시
   */
  async onApplicationShutdown() {
    this.logger.log(
      "Application shutting down, flushing remaining view counts...",
    );
    await this.flushAllViewCounts();
  }

  /**
   * 현재 버퍼 상태 조회 (관리자/디버깅용)
   */
  async getViewCountStats() {
    const entries = await this.drainBufferedEntries(undefined, true);
    const totalPendingViews = entries.reduce(
      (sum, entry) => sum + entry.count,
      0,
    );
    return {
      postsWithPendingViews: entries.length,
      totalPendingViews,
      topPosts: entries
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(({ postId, count }) => ({ postId, pendingViews: count })),
    };
  }

  private buildBufferKey(postId: string) {
    return `${this.bufferPrefix}:${postId}`;
  }

  private extractPostId(key: string) {
    return key.replace(`${this.bufferPrefix}:`, "");
  }

  private async drainBufferedEntries(
    filter?: (postId: string) => boolean,
    previewOnly: boolean = false,
  ): Promise<BufferedViewEntry[]> {
    const results: BufferedViewEntry[] = [];
    const pattern = `${this.bufferPrefix}:*`;
    let cursor = "0";

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        200,
      );
      cursor = nextCursor;

      if (!keys || keys.length === 0) {
        continue;
      }

      if (previewOnly) {
        const pipeline = this.redis.multi();
        keys.forEach((key) => pipeline.get(key));
        const execResults = await pipeline.exec();
        keys.forEach((key, index) => {
          const count = Number(execResults[index]?.[1]) || 0;
          if (count <= 0) return;
          const postId = this.extractPostId(key);
          if (filter && !filter(postId)) return;
          results.push({ postId, count });
        });
        continue;
      }

      const pipeline = this.redis.multi();
      keys.forEach((key) => {
        pipeline.get(key);
        pipeline.del(key);
      });
      const execResults = await pipeline.exec();

      keys.forEach((key, index) => {
        const getIndex = index * 2;
        const count = Number(execResults[getIndex]?.[1]) || 0;
        if (count <= 0) {
          return;
        }
        const postId = this.extractPostId(key);
        if (filter && !filter(postId)) {
          return;
        }
        results.push({ postId, count });
      });
    } while (cursor !== "0");

    return results;
  }
}
