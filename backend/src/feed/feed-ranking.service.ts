import { Injectable, Logger } from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DataSource } from "typeorm";
import { FeedFilterType, FeedSortType, FeedSourceType } from "./dto";

interface RankedRow {
  id: string;
  source_type: FeedSourceType;
  hot_score: number;
  top_score: number;
}

export interface RankedEntry {
  id: string;
  sourceType: FeedSourceType;
}

@Injectable()
export class FeedRankingService {
  private readonly logger = new Logger(FeedRankingService.name);
  private readonly HOT_LIMIT = 300;
  private readonly TOP_LIMIT = 300;
  private readonly RANKING_TTL_SECONDS = 180;

  constructor(
    private readonly dataSource: DataSource,
    // Cache Redis: ranking data is periodic and evictable.
    @InjectRedis("cache") private readonly redis: Redis,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async refreshRankings(): Promise<void> {
    await Promise.all([
      this.refreshRanking(FeedSortType.HOT, this.HOT_LIMIT),
      this.refreshRanking(FeedSortType.TOP, this.TOP_LIMIT),
    ]);
  }

  async getRankedEntries(
    filter: FeedFilterType,
    sort: FeedSortType,
    limit: number,
  ): Promise<RankedEntry[]> {
    if (!this.isRankingSupported(sort) || limit <= 0) {
      return [];
    }

    const key = this.getRankingKey(filter, sort);
    const members = await this.redis.zrevrange(key, 0, limit - 1);
    if (!members.length) {
      return [];
    }

    return members
      .map((member) => {
        const [sourceType, id] = member.split(":");
        if (
          (sourceType === "blog" || sourceType === "community") &&
          typeof id === "string" &&
          id.length > 0
        ) {
          return {
            id,
            sourceType: sourceType as FeedSourceType,
          };
        }
        return null;
      })
      .filter((entry): entry is RankedEntry => entry !== null);
  }

  private async refreshRanking(sort: FeedSortType, limit: number) {
    if (!this.isRankingSupported(sort)) {
      return;
    }

    try {
      const rows = await this.fetchRankingRows(sort, limit);
      await this.storeRanking(sort, rows);
    } catch (error) {
      this.logger.error(`Failed to refresh ${sort} ranking`, error as Error);
    }
  }

  private async fetchRankingRows(
    sort: FeedSortType,
    limit: number,
  ): Promise<RankedRow[]> {
    const orderColumn = sort === FeedSortType.HOT ? "hot_score" : "top_score";

    const query = `
      WITH unified_posts AS (
        SELECT p.id,
               'blog'::text AS source_type,
               p."createdAt" AS created_at,
               COALESCE(ps."likeCount", 0) AS like_count,
               COALESCE(ps."commentCount", 0) AS comment_count,
               COALESCE(ps."viewCount", 0) AS view_count
        FROM posts p
        LEFT JOIN post_stats ps ON ps."postId" = p.id
        INNER JOIN blogs b ON b.id = p."blogId" AND b."isPublic" = true
        WHERE p."isPublished" = true
          AND p."isDeleted" = false
          AND p.status = 'published'
          AND p.visibility = 'public'
        UNION ALL
        SELECT cp.id,
               'community'::text AS source_type,
               cp."createdAt" AS created_at,
               COALESCE(cp."upvoteCount", 0) AS like_count,
               COALESCE(cp."commentCount", 0) AS comment_count,
               COALESCE(cp."viewCount", 0) AS view_count
        FROM community_posts cp
        INNER JOIN communities c
          ON c.id = cp."communityId"
          AND c."isPublic" = true
          AND c."isPostDiscoverable" = true
          AND c."joinPolicy" <> 'private'
          AND c."deletedAt" IS NULL
        WHERE cp.status = 'published'
          AND cp."deletedAt" IS NULL
      ), scored_posts AS (
        SELECT id,
               source_type,
               created_at,
               like_count,
               comment_count,
               view_count,
               (
                 LN(1 + like_count) * 0.6 +
                 LN(1 + comment_count) * 0.3 +
                 LN(1 + GREATEST(view_count, 0)) * 0.1 -
                 (EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600) * 0.02
               ) AS hot_score,
               (like_count * 3 + comment_count * 2 + view_count) AS top_score
        FROM unified_posts
      )
      SELECT id, source_type, hot_score, top_score
      FROM scored_posts
      ORDER BY ${orderColumn} DESC
      LIMIT $1
    `;

    const rows = (await this.dataSource.query(query, [limit])) as RankedRow[];
    return rows;
  }

  private async storeRanking(sort: FeedSortType, rows: RankedRow[]) {
    const keys = [
      this.getRankingKey(FeedFilterType.ALL, sort),
      this.getRankingKey(FeedFilterType.BLOG, sort),
      this.getRankingKey(FeedFilterType.COMMUNITY, sort),
    ];

    const pipeline = this.redis.pipeline();
    keys.forEach((key) => pipeline.del(key));

    for (const row of rows) {
      const member = `${row.source_type}:${row.id}`;
      const score = Number(
        sort === FeedSortType.HOT ? row.hot_score : row.top_score,
      );
      if (Number.isNaN(score)) {
        continue;
      }

      pipeline.zadd(
        this.getRankingKey(FeedFilterType.ALL, sort),
        score,
        member,
      );
      if (row.source_type === FeedFilterType.BLOG) {
        pipeline.zadd(
          this.getRankingKey(FeedFilterType.BLOG, sort),
          score,
          member,
        );
      } else if (row.source_type === FeedFilterType.COMMUNITY) {
        pipeline.zadd(
          this.getRankingKey(FeedFilterType.COMMUNITY, sort),
          score,
          member,
        );
      }
    }

    keys.forEach((key) => pipeline.expire(key, this.RANKING_TTL_SECONDS));

    await pipeline.exec();
  }

  private getRankingKey(filter: FeedFilterType, sort: FeedSortType): string {
    return `feed:ranking:${filter}:${sort}`;
  }

  private isRankingSupported(sort: FeedSortType): boolean {
    return sort === FeedSortType.HOT || sort === FeedSortType.TOP;
  }
}
