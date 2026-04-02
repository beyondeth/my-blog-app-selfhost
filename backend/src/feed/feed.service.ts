import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Post } from "../posts/entities/post.entity";
import { CommunityPost } from "../communities/entities/community-post.entity";
import { CacheService, CacheTTL, CacheKeys } from "../cache/cache.service";
import {
  GetUnifiedFeedDto,
  FeedFilterType,
  FeedSortType,
  FeedPeriodType,
  UnifiedFeedItemDto,
  UnifiedFeedResponseDto,
  FeedSourceType,
} from "./dto";
import { FeedRankingService, RankedEntry } from "./feed-ranking.service";

type UserVoteType = "upvote" | "downvote";

/**
 * 커서 데이터 인터페이스
 */
interface CursorData {
  createdAt: string;
  id: string;
}

/**
 * 통합 피드 서비스
 *
 * @description 블로그 포스트와 커뮤니티 포스트를 통합하여 홈피드 제공
 *
 * **설계 원칙:**
 * - UNION ALL 쿼리로 두 테이블 통합
 * - 커서 기반 페이지네이션 (대용량 데이터 지원)
 * - Redis 캐싱 + 워밍 기반 응답 최적화
 */
@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);
  private readonly periodHotTopTtlSeconds =
    this.resolvePeriodHotTopTtlSeconds();

  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(CommunityPost)
    private readonly communityPostRepository: Repository<CommunityPost>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    private readonly feedRankingService: FeedRankingService,
  ) {}

  /**
   * 통합 피드 조회
   */
  async getUnifiedFeed(
    dto: GetUnifiedFeedDto,
    userId?: string,
  ): Promise<UnifiedFeedResponseDto> {
    const normalizedUserId = this.normalizeUserId(userId);

    const {
      cursor: cursorRaw,
      limit = 20,
      filter = FeedFilterType.ALL,
      sort = FeedSortType.RECENT,
      period = FeedPeriodType.ALL,
    } = dto;

    // 커서 파싱
    let cursorData: CursorData | null = null;
    if (cursorRaw) {
      try {
        const decoded = Buffer.from(cursorRaw, "base64").toString("utf-8");
        cursorData = JSON.parse(decoded);
      } catch {
        this.logger.warn(`유효하지 않은 커서: ${cursorRaw}`);
      }
    }

    // 통합 피드는 사용자 여부와 관계없이 공용 payload를 캐시한다.
    // 사용자별 차이는 userVote/liked만 후처리로 덧입혀 DB 부하를 줄인다.
    const cacheKey = CacheKeys.FEED_UNIFIED(filter, sort, period, {
      limit,
      cursor: cursorRaw ?? null,
    });

    const cached =
      await this.cacheService.get<UnifiedFeedResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(
        `[Feed] cache hit filter=${filter}, sort=${sort}, period=${period}, user=${normalizedUserId ? "yes" : "no"}`,
      );
      if (normalizedUserId) {
        try {
          return await this.attachUserVotesToResponse(cached, normalizedUserId);
        } catch (error) {
          this.logger.warn(
            `[Feed] failed to attach user votes on cache hit: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          return cached;
        }
      }
      return cached;
    }
    this.logger.debug(
      `[Feed] cache miss filter=${filter}, sort=${sort}, period=${period}, user=${normalizedUserId ? "yes" : "no"}`,
    );

    let items: UnifiedFeedItemDto[] = [];
    let fetchedFromRanking = false;

    // [중요] 이 분기는 "통합 피드(/feed)" 전용이다.
    // 사이드바 인기글 API(/posts/popular, /communities/popular)와는 별도 경로로 동작한다.
    // period가 ALL이 아닌 경우 랭킹 사용 안 함 (기간 필터링 필요)
    const useRanking =
      !cursorData &&
      period === FeedPeriodType.ALL &&
      (sort === FeedSortType.HOT || sort === FeedSortType.TOP);

    if (useRanking) {
      const rankedItems = await this.getRankedFeedItems(
        filter,
        sort,
        limit + 1,
        undefined,
      );
      if (rankedItems.length > 0) {
        items = rankedItems;
        fetchedFromRanking = true;
      }
    }

    if (!fetchedFromRanking) {
      items = await this.executeUnifiedQuery(
        filter,
        sort,
        limit + 1,
        cursorData,
        undefined,
        period,
      );
    }

    // hasMore 계산
    const hasMore = items.length > limit;
    if (hasMore) {
      items.pop(); // 초과 아이템 제거
    }

    // 다음 커서 생성
    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      const cursorObj: CursorData = {
        createdAt: lastItem.createdAt,
        id: lastItem.id,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString("base64");
    }

    const response: UnifiedFeedResponseDto = {
      items,
      nextCursor,
      hasMore,
      count: items.length,
    };

    const cacheTtl = this.getFeedCacheTtl(sort, period);
    await this.cacheService.set(cacheKey, response, cacheTtl);

    if (normalizedUserId) {
      try {
        return await this.attachUserVotesToResponse(response, normalizedUserId);
      } catch (error) {
        this.logger.warn(
          `[Feed] failed to attach user votes after query: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return response;
      }
    }

    return response;
  }

  private async getRankedFeedItems(
    filter: FeedFilterType,
    sort: FeedSortType,
    limit: number,
    userId?: string,
  ): Promise<UnifiedFeedItemDto[]> {
    const rankingEntries = await this.feedRankingService.getRankedEntries(
      filter,
      sort,
      limit,
    );

    if (!rankingEntries.length) {
      return [];
    }

    const { blogIds, communityIds } = this.splitRankedEntries(rankingEntries);
    const rawRows = await this.fetchFeedItemsByIds(
      blogIds,
      communityIds,
      userId,
    );

    if (!rawRows.length) {
      return [];
    }

    const rowMap = new Map<string, UnifiedFeedItemDto>();
    rawRows.forEach((row) => {
      const item = this.mapToFeedItem(row);
      const key = `${item.sourceType}:${item.id}`;
      rowMap.set(key, item);
    });

    const orderedItems: UnifiedFeedItemDto[] = [];
    for (const entry of rankingEntries) {
      const key = `${entry.sourceType}:${entry.id}`;
      const item = rowMap.get(key);
      if (item) {
        orderedItems.push(item);
      }
    }

    return orderedItems;
  }

  private splitRankedEntries(entries: RankedEntry[]) {
    const blogIds: string[] = [];
    const communityIds: string[] = [];

    for (const entry of entries) {
      if (entry.sourceType === "blog") {
        blogIds.push(entry.id);
      } else if (entry.sourceType === "community") {
        communityIds.push(entry.id);
      }
    }

    return { blogIds, communityIds };
  }

  /**
   * [통합 피드(/feed) 전용]
   * 기간별 HOT/TOP은 쿼리 비용이 높아 캐시 TTL을 더 길게 적용한다.
   * 이를 통해 period 조합의 cold miss 빈도를 줄인다.
   *
   * 주의:
   * - 이 TTL 정책은 "사이드바 인기글" API에 영향을 주지 않는다.
   * - 사이드바는 /posts/popular, /communities/popular 전용 캐시/조회 경로를 사용한다.
   */
  private getFeedCacheTtl(sort: FeedSortType, period: FeedPeriodType): number {
    const isPeriodHotTop =
      (sort === FeedSortType.HOT || sort === FeedSortType.TOP) &&
      period !== FeedPeriodType.ALL;
    if (isPeriodHotTop) {
      return this.periodHotTopTtlSeconds;
    }
    return CacheTTL.SHORT;
  }

  private resolvePeriodHotTopTtlSeconds(): number {
    const raw = process.env.FEED_HOT_PERIOD_TTL_SECONDS;
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isNaN(parsed) || parsed <= 0) {
      return 600;
    }
    return parsed;
  }

  /**
   * 공용 피드 payload에 사용자 투표 상태만 덧입힌다.
   * - 본문/정렬/페이징은 공용 캐시를 재사용
   * - 사용자별 차이는 post_like / community_post_like만 조회
   */
  private async attachUserVotesToResponse(
    response: UnifiedFeedResponseDto,
    userId: string,
  ): Promise<UnifiedFeedResponseDto> {
    if (!response.items.length) {
      return response;
    }

    const blogIds: string[] = [];
    const communityIds: string[] = [];

    for (const item of response.items) {
      if (item.sourceType === "blog") {
        blogIds.push(item.id);
      } else if (item.sourceType === "community") {
        communityIds.push(item.id);
      }
    }

    const [blogVoteMap, communityVoteMap] = await Promise.all([
      this.getBlogVoteMap(blogIds, userId),
      this.getCommunityVoteMap(communityIds, userId),
    ]);

    const items = response.items.map((item) => {
      const vote =
        item.sourceType === "blog"
          ? blogVoteMap.get(item.id)
          : communityVoteMap.get(item.id);
      return this.applyUserVote(item, vote);
    });

    return { ...response, items };
  }

  private applyUserVote(
    item: UnifiedFeedItemDto,
    vote?: UserVoteType,
  ): UnifiedFeedItemDto {
    if (!vote) {
      return item;
    }
    return {
      ...item,
      userVote: vote,
      liked: vote === "upvote",
    };
  }

  private async getBlogVoteMap(
    postIds: string[],
    userId: string,
  ): Promise<Map<string, UserVoteType>> {
    if (!postIds.length) {
      return new Map();
    }

    const rows = await this.dataSource.query(
      `
      SELECT pl."postId" AS "postId", pl.type::text AS type
      FROM post_likes pl
      WHERE pl."userId" = $1
        AND pl."postId" = ANY($2::uuid[])
      `,
      [userId, postIds],
    );

    return this.toVoteMap(rows);
  }

  private async getCommunityVoteMap(
    postIds: string[],
    userId: string,
  ): Promise<Map<string, UserVoteType>> {
    if (!postIds.length) {
      return new Map();
    }

    const rows = await this.dataSource.query(
      `
      SELECT cpl."postId" AS "postId", cpl.type::text AS type
      FROM community_post_likes cpl
      WHERE cpl."userId" = $1
        AND cpl."postId" = ANY($2::uuid[])
      `,
      [userId, postIds],
    );

    return this.toVoteMap(rows);
  }

  private toVoteMap(rows: any[]): Map<string, UserVoteType> {
    const voteMap = new Map<string, UserVoteType>();
    for (const row of rows) {
      const vote = row?.type;
      const postId = row?.postId;
      if (
        postId &&
        (vote === "upvote" || vote === "downvote") &&
        !voteMap.has(postId)
      ) {
        voteMap.set(postId, vote);
      }
    }
    return voteMap;
  }

  private async fetchFeedItemsByIds(
    blogIds: string[],
    communityIds: string[],
    userId?: string,
  ): Promise<any[]> {
    const normalizedUserId = this.normalizeUserId(userId);
    const [blogRows, communityRows] = await Promise.all([
      blogIds.length > 0
        ? this.fetchBlogFeedItemsByIds(blogIds, normalizedUserId)
        : Promise.resolve([]),
      communityIds.length > 0
        ? this.fetchCommunityFeedItemsByIds(communityIds, normalizedUserId)
        : Promise.resolve([]),
    ]);

    return [...blogRows, ...communityRows];
  }

  private async fetchBlogFeedItemsByIds(
    blogIds: string[],
    userId?: string,
  ): Promise<any[]> {
    if (!blogIds.length) {
      return [];
    }

    const includeUserVote = !!userId;
    const query = `
      WITH target_ids AS (
        SELECT DISTINCT UNNEST($1::uuid[]) AS id
      )
      SELECT
        p.id,
        p.title,
        p.slug,
        COALESCE(pm.excerpt, LEFT(COALESCE(p.content_markdown, p.content), 200)) as excerpt,
        CASE
          WHEN f.file_url IS NULL THEN LEFT(COALESCE(p.content, p.content_markdown), 8000)
          ELSE NULL::text
        END as content_html,
        pm.tags as tags,
        f.file_url as thumbnail,
        'blog'::text as source_type,
        p."blogId" as source_id,
        NULL::uuid as community_id,
        p."authorId" as author_id,
        COALESCE(ps."likeCount", 0) as like_count,
        COALESCE(ps."upvoteCount", 0) as upvote_count,
        COALESCE(ps."downvoteCount", 0) as downvote_count,
        COALESCE(ps."commentCount", 0) as comment_count,
        COALESCE(ps."viewCount", 0) as view_count,
        p."createdAt" as created_at,
        p."updatedAt" as updated_at,
        ${includeUserVote ? "pl_user.user_vote" : "NULL::text"} as user_vote,
        FALSE as is_nsfw,
        FALSE as is_spoiler,
        FALSE as is_pinned,
        b.id as blog_id,
        COALESCE(b.alias, b.slug) as blog_slug,
        b.alias as blog_alias,
        b.name as blog_name,
        NULL::uuid as comm_id,
        NULL::text as comm_slug,
        NULL::text as comm_name,
        NULL::text as comm_icon,
        NULL::text as comm_icon_fit,
        u.id as user_id,
        u.username,
        pr."profileImage"
      FROM target_ids t
      INNER JOIN posts p ON p.id = t.id
      LEFT JOIN (
        SELECT
          meta."postId",
          meta.excerpt,
          meta.tags
        FROM post_metadata meta
        WHERE meta."postId" = ANY($1::uuid[])
      ) pm ON pm."postId" = p.id
      LEFT JOIN (
        SELECT
          stats."postId",
          stats."likeCount",
          stats."upvoteCount",
          stats."downvoteCount",
          stats."commentCount",
          stats."viewCount"
        FROM post_stats stats
        WHERE stats."postId" = ANY($1::uuid[])
      ) ps ON ps."postId" = p.id
      ${
        includeUserVote
          ? `LEFT JOIN (
              SELECT pl."postId", pl.type::text as user_vote
              FROM post_likes pl
              WHERE pl."userId" = $2
                AND pl."postId" = ANY($1::uuid[])
            ) pl_user ON pl_user."postId" = p.id`
          : ""
      }
      LEFT JOIN files f ON f.id = p."thumbnail_image_id"
      INNER JOIN blogs b ON b.id = p."blogId" AND b."isPublic" = true
      LEFT JOIN users u ON u.id = p."authorId"
      LEFT JOIN profiles pr ON pr."userId" = u.id
      WHERE p."isPublished" = true
        AND p."isDeleted" = false
        AND COALESCE(p."postType", 'blog') = 'blog'
        AND p.status = 'published'
        AND p.visibility = 'public'
    `;

    const params = includeUserVote ? [blogIds, userId as string] : [blogIds];
    return this.dataSource.query(query, params);
  }

  private async fetchCommunityFeedItemsByIds(
    communityIds: string[],
    userId?: string,
  ): Promise<any[]> {
    if (!communityIds.length) {
      return [];
    }

    const includeUserVote = !!userId;
    const query = `
      WITH target_ids AS (
        SELECT DISTINCT UNNEST($1::uuid[]) AS id
      )
      SELECT
        cp.id,
        cp.title,
        cp.slug,
        LEFT(COALESCE(cp.content_markdown, cp.content), 200) as excerpt,
        CASE
          WHEN f.file_url IS NULL THEN LEFT(COALESCE(cp.content, cp.content_markdown), 8000)
          ELSE NULL::text
        END as content_html,
        cp.tags as tags,
        f.file_url as thumbnail,
        'community'::text as source_type,
        NULL::uuid as source_id,
        cp."communityId" as community_id,
        cp."authorId" as author_id,
        cp."likeCount" as like_count,
        cp."upvoteCount" as upvote_count,
        cp."downvoteCount" as downvote_count,
        cp."commentCount" as comment_count,
        cp."viewCount" as view_count,
        cp."createdAt" as created_at,
        cp."updatedAt" as updated_at,
        ${includeUserVote ? "cpl_user.user_vote" : "NULL::text"} as user_vote,
        cp."isNsfw" as is_nsfw,
        cp."isSpoiler" as is_spoiler,
        cp."isPinned" as is_pinned,
        NULL::uuid as blog_id,
        NULL::text as blog_slug,
        NULL::text as blog_alias,
        NULL::text as blog_name,
        c.id as comm_id,
        c.slug as comm_slug,
        c.name as comm_name,
        c."iconUrl" as comm_icon,
        c."iconImageFit" as comm_icon_fit,
        u.id as user_id,
        u.username,
        pr."profileImage"
      FROM target_ids t
      INNER JOIN community_posts cp
        ON cp.id = t.id
      LEFT JOIN files f ON f.id = cp."thumbnailImageId"
      INNER JOIN communities c
        ON c.id = cp."communityId"
        AND c."isPublic" = true
        AND c."isPostDiscoverable" = true
        AND c."joinPolicy" <> 'private'
        AND c."deletedAt" IS NULL
      LEFT JOIN users u ON u.id = cp."authorId"
      LEFT JOIN profiles pr ON pr."userId" = u.id
      ${
        includeUserVote
          ? `LEFT JOIN (
              SELECT cpl."postId", cpl.type::text as user_vote
              FROM community_post_likes cpl
              WHERE cpl."userId" = $2
                AND cpl."postId" = ANY($1::uuid[])
            ) cpl_user ON cpl_user."postId" = cp.id`
          : ""
      }
      WHERE cp.status = 'published'
        AND cp."deletedAt" IS NULL
    `;

    const params = includeUserVote
      ? [communityIds, userId as string]
      : [communityIds];
    return this.dataSource.query(query, params);
  }

  /**
   * 통합 쿼리 실행
   *
   * @description UNION ALL을 사용하여 두 테이블 데이터를 통합
   */
  private async executeUnifiedQuery(
    filter: FeedFilterType,
    sort: FeedSortType,
    limit: number,
    cursor: CursorData | null,
    userId?: string,
    period: FeedPeriodType = FeedPeriodType.ALL,
  ): Promise<UnifiedFeedItemDto[]> {
    const normalizedUserId = this.normalizeUserId(userId);

    if (sort === FeedSortType.RECENT && filter === FeedFilterType.ALL) {
      return this.executeRecentUnifiedQueryOptimized(
        limit,
        cursor,
        normalizedUserId,
        period,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const includeUserVote = !!normalizedUserId;
      const userParamPlaceholder = includeUserVote
        ? `$${cursor ? 4 : 2}`
        : null;
      const communityVisibilityWhere = `AND c."joinPolicy" <> 'private'`;

      // 기간 필터 조건 생성
      const periodCondition = this.getPeriodCondition(period);

      // 블로그 포스트 서브쿼리
      const blogPostQuery =
        filter !== FeedFilterType.COMMUNITY
          ? `
        SELECT
          p.id,
          p.title,
          p.slug,
          COALESCE(pm.excerpt, LEFT(COALESCE(p.content_markdown, p.content), 200)) as excerpt,
          CASE
            WHEN f.file_url IS NULL THEN LEFT(COALESCE(p.content, p.content_markdown), 8000)
            ELSE NULL::text
          END as content_html,
          pm.tags as tags,
          f.file_url as thumbnail,
          'blog'::text as source_type,
          p."blogId" as source_id,
          NULL::uuid as community_id,
          p."authorId" as author_id,
          COALESCE(ps."likeCount", 0) as like_count,
          COALESCE(ps."upvoteCount", 0) as upvote_count,
          COALESCE(ps."downvoteCount", 0) as downvote_count,
          COALESCE(ps."commentCount", 0) as comment_count,
          COALESCE(ps."viewCount", 0) as view_count,
          p."createdAt" as created_at,
          p."updatedAt" as updated_at,
          ${includeUserVote ? "pl_user.type" : "NULL::text"} as user_vote,
          FALSE as is_nsfw,
          FALSE as is_spoiler,
          FALSE as is_pinned,
          -- 블로그 정보
          b.id as blog_id,
          COALESCE(b.alias, b.slug) as blog_slug,
          b.alias as blog_alias,
          b.name as blog_name,
          -- 커뮤니티 정보 (NULL)
          NULL::uuid as comm_id,
          NULL::text as comm_slug,
          NULL::text as comm_name,
          NULL::text as comm_icon,
          NULL::text as comm_icon_fit,
          -- 작성자 정보
          u.id as user_id,
          u.username,
          pr."profileImage"
        FROM posts p
        LEFT JOIN post_metadata pm ON pm."postId" = p.id
        LEFT JOIN post_stats ps ON ps."postId" = p.id
        ${
          includeUserVote && userParamPlaceholder
            ? `LEFT JOIN post_likes pl_user ON pl_user."postId" = p.id AND pl_user."userId" = ${userParamPlaceholder}`
            : ""
        }
        LEFT JOIN files f ON f.id = p."thumbnail_image_id"
        INNER JOIN blogs b ON b.id = p."blogId" AND b."isPublic" = true
        LEFT JOIN users u ON u.id = p."authorId"
        LEFT JOIN profiles pr ON pr."userId" = u.id
        WHERE p."isPublished" = true
          AND p."isDeleted" = false
          AND COALESCE(p."postType", 'blog') = 'blog'
          AND p.status = 'published'
          AND p.visibility = 'public'
          ${periodCondition ? `AND p."createdAt" >= ${periodCondition}` : ""}
          ${cursor ? `AND (p."createdAt", p.id) < ($1, $2)` : ""}
      `
          : "";

      // 커뮤니티 포스트 서브쿼리
      const communityPostQuery =
        filter !== FeedFilterType.BLOG
          ? `
        SELECT
          cp.id,
          cp.title,
          cp.slug,
          LEFT(COALESCE(cp.content_markdown, cp.content), 200) as excerpt,
          CASE
            WHEN f.file_url IS NULL THEN LEFT(COALESCE(cp.content, cp.content_markdown), 8000)
            ELSE NULL::text
          END as content_html,
          cp.tags as tags,
          f.file_url as thumbnail,
          'community'::text as source_type,
          NULL::uuid as source_id,
          cp."communityId" as community_id,
          cp."authorId" as author_id,
          cp."likeCount" as like_count,
          cp."upvoteCount" as upvote_count,
          cp."downvoteCount" as downvote_count,
          cp."commentCount" as comment_count,
          cp."viewCount" as view_count,
          cp."createdAt" as created_at,
          cp."updatedAt" as updated_at,
          ${includeUserVote ? "cpl_user.type" : "NULL::text"} as user_vote,
          cp."isNsfw" as is_nsfw,
          cp."isSpoiler" as is_spoiler,
          cp."isPinned" as is_pinned,
          -- 블로그 정보 (NULL)
          NULL::uuid as blog_id,
          NULL::text as blog_slug,
          NULL::text as blog_alias,
          NULL::text as blog_name,
          -- 커뮤니티 정보
          c.id as comm_id,
          c.slug as comm_slug,
          c.name as comm_name,
          c."iconUrl" as comm_icon,
          c."iconImageFit" as comm_icon_fit,
          -- 작성자 정보
          u.id as user_id,
          u.username,
          pr."profileImage"
        FROM community_posts cp
        LEFT JOIN files f ON f.id = cp."thumbnailImageId"
        INNER JOIN communities c
          ON c.id = cp."communityId"
          AND c."isPublic" = true
          AND c."isPostDiscoverable" = true
          AND c."joinPolicy" <> 'private'
          AND c."deletedAt" IS NULL
        LEFT JOIN users u ON u.id = cp."authorId"
        LEFT JOIN profiles pr ON pr."userId" = u.id
        ${
          includeUserVote && userParamPlaceholder
            ? `LEFT JOIN community_post_likes cpl_user
          ON cpl_user."postId" = cp.id AND cpl_user."userId" = ${userParamPlaceholder}`
            : ""
        }
        WHERE cp.status = 'published'
          AND cp."deletedAt" IS NULL
          ${communityVisibilityWhere}
          ${periodCondition ? `AND cp."createdAt" >= ${periodCondition}` : ""}
          ${cursor ? `AND (cp."createdAt", cp.id) < ($1, $2)` : ""}
      `
          : "";

      // UNION ALL 쿼리 조합
      let unionQuery = "";
      if (blogPostQuery && communityPostQuery) {
        unionQuery = `(${blogPostQuery}) UNION ALL (${communityPostQuery})`;
      } else if (blogPostQuery) {
        unionQuery = blogPostQuery;
      } else {
        unionQuery = communityPostQuery;
      }

      // 정렬 및 페이지네이션
      const orderBy = (() => {
        switch (sort) {
          case FeedSortType.HOT:
            return "ORDER BY (like_count + comment_count) DESC, created_at DESC";
          case FeedSortType.TOP:
            return "ORDER BY like_count DESC, comment_count DESC, created_at DESC";
          default:
            return "ORDER BY created_at DESC, id DESC";
        }
      })();

      const finalQuery = `
        SELECT * FROM (${unionQuery}) AS unified_feed
        ${orderBy}
        LIMIT $${cursor ? 3 : 1}
      `;

      // 파라미터 설정
      const params: any[] = cursor
        ? [cursor.createdAt, cursor.id, limit]
        : [limit];
      if (includeUserVote) {
        params.push(normalizedUserId as string);
      }

      // 쿼리 실행
      const rawResults = await queryRunner.query(finalQuery, params);

      // 결과 매핑
      return rawResults.map((row: any) => this.mapToFeedItem(row));
    } finally {
      await queryRunner.release();
    }
  }

  private async executeRecentUnifiedQueryOptimized(
    limit: number,
    cursor: CursorData | null,
    userId?: string,
    period: FeedPeriodType = FeedPeriodType.ALL,
  ): Promise<UnifiedFeedItemDto[]> {
    const normalizedUserId = this.normalizeUserId(userId);
    const includeUserVote = !!normalizedUserId;
    const periodCondition = this.getPeriodCondition(period);
    const candidateLimit = Math.max(limit * 2, 40);

    const query = `
      WITH blog_candidates AS (
        SELECT
          p.id,
          p."createdAt" as created_at
        FROM posts p
        INNER JOIN blogs b ON b.id = p."blogId" AND b."isPublic" = true
        WHERE p."isPublished" = true
          AND p."isDeleted" = false
          AND COALESCE(p."postType", 'blog') = 'blog'
          AND p.status = 'published'
          AND p.visibility = 'public'
          ${periodCondition ? `AND p."createdAt" >= ${periodCondition}` : ""}
          AND ($1::timestamptz IS NULL OR (p."createdAt", p.id) < ($1::timestamptz, $2::uuid))
        ORDER BY p."createdAt" DESC, p.id DESC
        LIMIT $3
      ),
      community_candidates AS (
        SELECT
          cp.id,
          cp."createdAt" as created_at
        FROM community_posts cp
        INNER JOIN communities c
          ON c.id = cp."communityId"
          AND c."isPublic" = true
          AND c."isPostDiscoverable" = true
          AND c."joinPolicy" <> 'private'
          AND c."deletedAt" IS NULL
        WHERE cp.status = 'published'
          AND cp."deletedAt" IS NULL
          ${periodCondition ? `AND cp."createdAt" >= ${periodCondition}` : ""}
          AND ($1::timestamptz IS NULL OR (cp."createdAt", cp.id) < ($1::timestamptz, $2::uuid))
        ORDER BY cp."createdAt" DESC, cp.id DESC
        LIMIT $3
      ),
      unified_candidates AS (
        SELECT id, created_at, 'blog'::text as source_type
        FROM blog_candidates
        UNION ALL
        SELECT id, created_at, 'community'::text as source_type
        FROM community_candidates
      ),
      limited_candidates AS (
        SELECT *
        FROM unified_candidates
        ORDER BY created_at DESC, id DESC
        LIMIT $4
      )
      SELECT * FROM (
        SELECT
          p.id,
          p.title,
          p.slug,
          COALESCE(pm.excerpt, LEFT(COALESCE(p.content_markdown, p.content), 200)) as excerpt,
          CASE
            WHEN f.file_url IS NULL THEN LEFT(COALESCE(p.content, p.content_markdown), 8000)
            ELSE NULL::text
          END as content_html,
          pm.tags as tags,
          f.file_url as thumbnail,
          'blog'::text as source_type,
          p."blogId" as source_id,
          NULL::uuid as community_id,
          p."authorId" as author_id,
          COALESCE(ps."likeCount", 0) as like_count,
          COALESCE(ps."upvoteCount", 0) as upvote_count,
          COALESCE(ps."downvoteCount", 0) as downvote_count,
          COALESCE(ps."commentCount", 0) as comment_count,
          COALESCE(ps."viewCount", 0) as view_count,
          lc.created_at as created_at,
          p."updatedAt" as updated_at,
          ${includeUserVote ? "pl_user.type" : "NULL::text"} as user_vote,
          FALSE as is_nsfw,
          FALSE as is_spoiler,
          FALSE as is_pinned,
          b.id as blog_id,
          COALESCE(b.alias, b.slug) as blog_slug,
          b.alias as blog_alias,
          b.name as blog_name,
          NULL::uuid as comm_id,
          NULL::text as comm_slug,
          NULL::text as comm_name,
          NULL::text as comm_icon,
          NULL::text as comm_icon_fit,
          u.id as user_id,
          u.username,
          pr."profileImage"
        FROM limited_candidates lc
        INNER JOIN posts p
          ON p.id = lc.id
          AND lc.source_type = 'blog'
          AND p.visibility = 'public'
        LEFT JOIN post_metadata pm ON pm."postId" = p.id
        LEFT JOIN post_stats ps ON ps."postId" = p.id
        ${
          includeUserVote
            ? `LEFT JOIN post_likes pl_user
              ON pl_user."postId" = p.id AND pl_user."userId" = $5`
            : ""
        }
        LEFT JOIN files f ON f.id = p."thumbnail_image_id"
        INNER JOIN blogs b ON b.id = p."blogId" AND b."isPublic" = true
        LEFT JOIN users u ON u.id = p."authorId"
        LEFT JOIN profiles pr ON pr."userId" = u.id

        UNION ALL

        SELECT
          cp.id,
          cp.title,
          cp.slug,
          LEFT(COALESCE(cp.content_markdown, cp.content), 200) as excerpt,
          CASE
            WHEN f.file_url IS NULL THEN LEFT(COALESCE(cp.content, cp.content_markdown), 8000)
            ELSE NULL::text
          END as content_html,
          cp.tags as tags,
          f.file_url as thumbnail,
          'community'::text as source_type,
          NULL::uuid as source_id,
          cp."communityId" as community_id,
          cp."authorId" as author_id,
          cp."likeCount" as like_count,
          cp."upvoteCount" as upvote_count,
          cp."downvoteCount" as downvote_count,
          cp."commentCount" as comment_count,
          cp."viewCount" as view_count,
          lc.created_at as created_at,
          cp."updatedAt" as updated_at,
          ${includeUserVote ? "cpl_user.type" : "NULL::text"} as user_vote,
          cp."isNsfw" as is_nsfw,
          cp."isSpoiler" as is_spoiler,
          cp."isPinned" as is_pinned,
          NULL::uuid as blog_id,
          NULL::text as blog_slug,
          NULL::text as blog_alias,
          NULL::text as blog_name,
          c.id as comm_id,
          c.slug as comm_slug,
          c.name as comm_name,
          c."iconUrl" as comm_icon,
          c."iconImageFit" as comm_icon_fit,
          u.id as user_id,
          u.username,
          pr."profileImage"
        FROM limited_candidates lc
        INNER JOIN community_posts cp
          ON cp.id = lc.id
          AND lc.source_type = 'community'
        INNER JOIN communities c
          ON c.id = cp."communityId"
          AND c."isPublic" = true
          AND c."isPostDiscoverable" = true
          AND c."joinPolicy" <> 'private'
          AND c."deletedAt" IS NULL
        LEFT JOIN users u ON u.id = cp."authorId"
        LEFT JOIN profiles pr ON pr."userId" = u.id
        ${
          includeUserVote
            ? `LEFT JOIN community_post_likes cpl_user
              ON cpl_user."postId" = cp.id AND cpl_user."userId" = $5`
            : ""
        }
        LEFT JOIN files f ON f.id = cp."thumbnailImageId"
      ) AS optimized_unified_feed
      ORDER BY created_at DESC, id DESC
    `;

    const params: any[] = [
      cursor?.createdAt ?? null,
      cursor?.id ?? null,
      candidateLimit,
      limit,
    ];

    if (includeUserVote) {
      params.push(normalizedUserId as string);
    }

    const rawResults = await this.dataSource.query(query, params);
    return rawResults.map((row: any) => this.mapToFeedItem(row));
  }

  /**
   * 원시 쿼리 결과를 DTO로 매핑
   */
  private mapToFeedItem(row: any): UnifiedFeedItemDto {
    const sourceType: FeedSourceType = row.source_type;

    const item: UnifiedFeedItemDto = {
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt || undefined,
      thumbnail: row.thumbnail || undefined,
      sourceType,
      author: {
        id: row.user_id,
        username: row.username,
        profileImage: row.profileImage || undefined,
      },
      likeCount: parseInt(row.like_count, 10) || 0,
      commentCount: parseInt(row.comment_count, 10) || 0,
      viewCount: parseInt(row.view_count, 10) || 0,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : row.created_at,
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : row.updated_at,
    };

    const upvoteCount =
      row.upvote_count !== undefined
        ? parseInt(row.upvote_count, 10) || 0
        : parseInt(row.like_count, 10) || 0;
    const downvoteCount =
      row.downvote_count !== undefined
        ? parseInt(row.downvote_count, 10) || 0
        : 0;

    item.upvoteCount = upvoteCount;
    item.downvoteCount = downvoteCount;
    item.score = upvoteCount - downvoteCount;

    const tags = row.tags;
    if (tags) {
      if (Array.isArray(tags)) {
        item.tags = tags.filter(
          (tag: any): tag is string => typeof tag === "string" && !!tag.trim(),
        );
      } else if (typeof tags === "string") {
        try {
          const parsed = JSON.parse(tags);
          if (Array.isArray(parsed)) {
            item.tags = parsed.filter(
              (tag: any): tag is string =>
                typeof tag === "string" && !!tag.trim(),
            );
          }
        } catch {
          item.tags = [tags];
        }
      }
    }

    const contentForMediaFallback =
      typeof row.content_html === "string" ? row.content_html : null;
    if (contentForMediaFallback) {
      if (!item.excerpt) {
        const excerpt = this.createExcerptFromHtml(contentForMediaFallback);
        if (excerpt) {
          item.excerpt = excerpt;
        }
      }

      const inlineImages = this.extractImageUrlsFromContent(
        contentForMediaFallback,
      );
      if (inlineImages.length > 0) {
        item.images = inlineImages;
        if (!item.thumbnail) {
          item.thumbnail = inlineImages[0];
        }
      }
    }

    const userVote = row.user_vote ?? null;
    if (userVote === "upvote" || userVote === "downvote") {
      item.userVote = userVote;
      if (userVote === "upvote") {
        item.liked = true;
      } else if (userVote === "downvote") {
        item.liked = false;
      }
    }

    // 블로그 정보 (블로그 포스트인 경우)
    if (sourceType === "blog" && row.blog_id) {
      item.blog = {
        id: row.blog_id,
        slug: row.blog_slug,
        alias: row.blog_alias || undefined,
        name: row.blog_name || "",
      };
    }

    // 커뮤니티 정보 (커뮤니티 포스트인 경우)
    if (sourceType === "community" && row.comm_id) {
      item.community = {
        id: row.comm_id,
        slug: row.comm_slug,
        name: row.comm_name || "",
        iconUrl: row.comm_icon || undefined,
        iconImageFit: row.comm_icon_fit || undefined,
      };
      item.isNsfw = row.is_nsfw || false;
      item.isSpoiler = row.is_spoiler || false;
      item.isPinned = row.is_pinned || false;
    }

    return item;
  }

  /**
   * 피드 캐시 무효화
   */
  async invalidateFeedCache(): Promise<void> {
    await this.cacheService.deletePattern("feed:unified:*");
  }

  /**
   * HTML 문자열에서 이미지 URL 추출
   */
  private extractImageUrlsFromContent(content: string): string[] {
    const urls = new Set<string>();
    let match: RegExpExecArray | null;

    const htmlRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    while ((match = htmlRegex.exec(content)) !== null) {
      const url = match[1]?.trim();
      if (url && !url.startsWith("data:") && !url.startsWith("javascript:")) {
        urls.add(url);
      }
    }

    const markdownRegex = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/gi;
    while ((match = markdownRegex.exec(content)) !== null) {
      const rawUrl = match[1]?.trim();
      const url = rawUrl?.replace(/^<|>$/g, "");
      if (url && !url.startsWith("data:") && !url.startsWith("javascript:")) {
        urls.add(url);
      }
    }

    const plainImageUrlRegex =
      /https?:\/\/[^\s)"']+\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?[^\s)"']*)?/gi;
    while ((match = plainImageUrlRegex.exec(content)) !== null) {
      const url = match[0]?.trim();
      if (url && !url.startsWith("javascript:")) {
        urls.add(url);
      }
    }

    return Array.from(urls);
  }

  /**
   * HTML 문자열에서 텍스트 요약 추출
   */
  private createExcerptFromHtml(html: string, maxLength = 200): string {
    const text = this.stripHtmlTags(html);
    if (!text) {
      return "";
    }
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength)}...`;
  }

  /**
   * HTML 태그 제거
   */
  private stripHtmlTags(html: string): string {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * 기간 필터에 따른 SQL 조건 생성
   * @returns NOW() - INTERVAL 'X days' 형식의 SQL 문자열 또는 null
   */
  private getPeriodCondition(period: FeedPeriodType): string | null {
    switch (period) {
      case FeedPeriodType.DAILY:
        return "NOW() - INTERVAL '1 day'";
      case FeedPeriodType.WEEKLY:
        return "NOW() - INTERVAL '7 days'";
      case FeedPeriodType.MONTHLY:
        return "NOW() - INTERVAL '30 days'";
      default:
        return null;
    }
  }

  private normalizeUserId(userId?: string | null): string | undefined {
    if (!userId) {
      return undefined;
    }

    const trimmed = userId.trim();
    if (
      !trimmed ||
      trimmed.toLowerCase() === "null" ||
      trimmed.toLowerCase() === "undefined"
    ) {
      return undefined;
    }

    return trimmed;
  }
}
