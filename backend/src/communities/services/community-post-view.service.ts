import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { CommunityPost } from "../entities/community-post.entity";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";
import { Cron, CronExpression } from "@nestjs/schedule";

interface BufferedEntry {
  postId: string;
  count: number;
}

@Injectable()
export class CommunityPostViewService {
  private readonly logger = new Logger(CommunityPostViewService.name);
  private readonly bufferPrefix = "community:view:buffer";
  private readonly bufferTtlSeconds = 300;
  private readonly rankingTtlSeconds = 600;

  constructor(
    @InjectRepository(CommunityPost)
    private readonly communityPostRepository: Repository<CommunityPost>,
    // Cache Redis: view buffers and rankings are evictable.
    @InjectRedis("cache") private readonly redis: Redis,
  ) {}

  async bufferView(postId: string): Promise<void> {
    const key = this.buildBufferKey(postId);
    try {
      const pipeline = this.redis.pipeline();
      pipeline.incrby(key, 1);
      pipeline.expire(key, this.bufferTtlSeconds, "NX");
      await pipeline.exec();
    } catch (error) {
      this.logger.warn(
        `Failed to buffer community view (postId=${postId})`,
        error as Error,
      );
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async flushBufferedViews(): Promise<void> {
    await this.flushViewCounts();
  }

  async onApplicationShutdown() {
    await this.flushViewCounts();
  }

  async getTopRankedPostIds(
    communityId: string,
    limit: number,
  ): Promise<string[]> {
    if (!communityId || limit <= 0) {
      return [];
    }
    const key = this.buildRankingKey(communityId);
    return this.redis.zrevrange(key, 0, limit - 1);
  }

  private async flushViewCounts(): Promise<void> {
    const entries = await this.drainBufferedEntries();
    if (!entries.length) {
      return;
    }

    const postIds = entries.map((entry) => entry.postId);
    const posts = await this.communityPostRepository.find({
      where: { id: In(postIds) },
      select: ["id", "communityId"],
    });
    const postCommunityMap = new Map(
      posts.map((post) => [post.id, post.communityId]),
    );

    const queryRunner =
      this.communityPostRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const { postId, count } of entries) {
        await queryRunner.manager
          .createQueryBuilder()
          .update(CommunityPost)
          .set({
            viewCount: () => `"viewCount" + ${count}`,
            updatedAt: () => "CURRENT_TIMESTAMP",
          })
          .where("id = :postId", { postId })
          .execute();
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        "Failed to flush community view counts",
        error as Error,
      );
      return;
    } finally {
      await queryRunner.release();
    }

    const pipeline = this.redis.pipeline();
    const touchedCommunities = new Set<string>();
    for (const { postId, count } of entries) {
      const communityId = postCommunityMap.get(postId);
      if (!communityId) {
        continue;
      }
      const rankingKey = this.buildRankingKey(communityId);
      pipeline.zincrby(rankingKey, count, postId);
      touchedCommunities.add(rankingKey);
    }
    touchedCommunities.forEach((key) =>
      pipeline.expire(key, this.rankingTtlSeconds),
    );

    await pipeline.exec();
  }

  private buildBufferKey(postId: string): string {
    return `${this.bufferPrefix}:${postId}`;
  }

  private buildRankingKey(communityId: string): string {
    return `community:ranking:top:${communityId}`;
  }

  private extractPostId(key: string): string {
    return key.replace(`${this.bufferPrefix}:`, "");
  }

  private async drainBufferedEntries(): Promise<BufferedEntry[]> {
    const entries: BufferedEntry[] = [];
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

      const pipeline = this.redis.pipeline();
      keys.forEach((key) => {
        pipeline.get(key);
        pipeline.del(key);
      });
      const results = await pipeline.exec();

      keys.forEach((key, index) => {
        const getIndex = index * 2;
        const count = Number(results[getIndex]?.[1]) || 0;
        if (count <= 0) {
          return;
        }
        entries.push({
          postId: this.extractPostId(key),
          count,
        });
      });
    } while (cursor !== "0");

    return entries;
  }
}
