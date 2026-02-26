import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import {
  PopularPeriod,
  PopularScoreRow,
  PopularSourceType,
} from "../types/popular-post.types";

@Injectable()
export class PopularScoreQueryService {
  private readonly logger = new Logger(PopularScoreQueryService.name);

  constructor(private readonly dataSource: DataSource) {}

  private getPeriodInterval(period: PopularPeriod): string {
    switch (period) {
      case "daily":
        return "24 hours";
      case "weekly":
        return "7 days";
      case "monthly":
        return "30 days";
      default:
        return "7 days";
    }
  }

  private getMinScore(): number {
    const configured = Number.parseInt(process.env.POPULAR_MIN_SCORE ?? "1", 10);
    if (Number.isNaN(configured) || configured < 0) {
      return 1;
    }
    return configured;
  }

  async calculatePopularRows(
    source: PopularSourceType,
    period: PopularPeriod,
    limit: number,
  ): Promise<PopularScoreRow[]> {
    return source === "blog"
      ? this.calculateBlogPopularRows(period, limit)
      : this.calculateCommunityPopularRows(period, limit);
  }

  private async calculateBlogPopularRows(
    period: PopularPeriod,
    limit: number,
  ): Promise<PopularScoreRow[]> {
    const interval = this.getPeriodInterval(period);
    const minScore = this.getMinScore();

    const query = `
      SELECT
        p.id AS "postId",
        (COALESCE(ps."viewCount", 0) + COALESCE(ps."likeCount", 0) * 3 + COALESCE(ps."commentCount", 0) * 2)::int AS score,
        jsonb_build_object(
          'id', p.id,
          'title', p.title,
          'slug', p.slug,
          'excerpt', COALESCE(pm.excerpt, LEFT(COALESCE(p.content_markdown, p.content), 200)),
          'thumbnail', f.file_url,
          'author', jsonb_build_object(
            'id', u.id,
            'username', u.username,
            'profileImage', pr."profileImage"
          ),
          'blog', jsonb_build_object(
            'id', b.id,
            'slug', COALESCE(b.alias, b.slug),
            'alias', b.alias,
            'name', b.name
          ),
          'viewCount', COALESCE(ps."viewCount", 0),
          'likeCount', COALESCE(ps."likeCount", 0),
          'commentCount', COALESCE(ps."commentCount", 0),
          'createdAt', p."createdAt",
          'publishedAt', p."publishedAt"
        ) AS "metaJson"
      FROM posts p
      LEFT JOIN post_stats ps ON ps."postId" = p.id
      LEFT JOIN post_metadata pm ON pm."postId" = p.id
      LEFT JOIN blogs b ON b.id = p."blogId"
      LEFT JOIN users u ON u.id = p."authorId"
      LEFT JOIN profiles pr ON pr."userId" = u.id
      LEFT JOIN files f ON f.id = p."thumbnail_image_id"
      WHERE p."isPublished" = true
        AND p."isDeleted" = false
        AND p.status = 'published'
        -- rolling window로 범위를 제한해 전체 테이블 스캔을 피한다.
        AND COALESCE(p."publishedAt", p."createdAt") >= NOW() - INTERVAL '${interval}'
        AND (COALESCE(ps."viewCount", 0) + COALESCE(ps."likeCount", 0) * 3 + COALESCE(ps."commentCount", 0) * 2) >= $2
      ORDER BY score DESC, COALESCE(p."publishedAt", p."createdAt") DESC
      LIMIT $1
    `;

    const rows = await this.dataSource.query(query, [limit, minScore]);
    return rows as PopularScoreRow[];
  }

  private async calculateCommunityPopularRows(
    period: PopularPeriod,
    limit: number,
  ): Promise<PopularScoreRow[]> {
    const interval = this.getPeriodInterval(period);
    const minScore = this.getMinScore();

    const query = `
      SELECT
        cp.id AS "postId",
        (COALESCE(cp."viewCount", 0) + COALESCE(cp."upvoteCount", 0) * 3 + COALESCE(cp."commentCount", 0) * 2)::int AS score,
        jsonb_build_object(
          'id', cp.id,
          'title', cp.title,
          'slug', cp.slug,
          'sourceType', 'community',
          'author', jsonb_build_object(
            'id', u.id,
            'username', u.username,
            'profileImage', pr."profileImage"
          ),
          'community', jsonb_build_object(
            'id', c.id,
            'slug', c.slug,
            'name', c.name,
            'iconUrl', c."iconUrl"
          ),
          'viewCount', COALESCE(cp."viewCount", 0),
          'likeCount', COALESCE(cp."upvoteCount", 0),
          'upvoteCount', COALESCE(cp."upvoteCount", 0),
          'commentCount', COALESCE(cp."commentCount", 0),
          'createdAt', cp."createdAt",
          'updatedAt', cp."updatedAt"
        ) AS "metaJson"
      FROM community_posts cp
      INNER JOIN communities c
        ON c.id = cp."communityId"
        AND c."isPublic" = true
        AND c."isPostDiscoverable" = true
        AND c."joinPolicy" <> 'private'
        AND c."deletedAt" IS NULL
      LEFT JOIN users u ON u.id = cp."authorId"
      LEFT JOIN profiles pr ON pr."userId" = u.id
      WHERE cp.status = 'published'
        AND cp."deletedAt" IS NULL
        -- rolling window로 범위를 제한해 전체 테이블 스캔을 피한다.
        AND cp."createdAt" >= NOW() - INTERVAL '${interval}'
        AND (COALESCE(cp."viewCount", 0) + COALESCE(cp."upvoteCount", 0) * 3 + COALESCE(cp."commentCount", 0) * 2) >= $2
      ORDER BY score DESC, cp."createdAt" DESC
      LIMIT $1
    `;

    const rows = await this.dataSource.query(query, [limit, minScore]);
    return rows as PopularScoreRow[];
  }

  logQueryStart(source: PopularSourceType, period: PopularPeriod): void {
    this.logger.debug(
      `[Popular Query] calculating source=${source}, period=${period}`,
    );
  }
}
