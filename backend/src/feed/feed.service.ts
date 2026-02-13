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
 * - Redis 캐싱 (첫 페이지 30초)
 */
@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

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

    // 캐시 키 (사용자 컨텍스트 없을 때만 캐싱)
    const cacheKey = !userId
      ? CacheKeys.FEED_UNIFIED(filter, sort, {
          limit,
          cursor: cursorRaw ?? null,
        })
      : null;

    if (cacheKey) {
      const cached =
        await this.cacheService.get<UnifiedFeedResponseDto>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    let items: UnifiedFeedItemDto[] = [];
    let fetchedFromRanking = false;

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
        userId,
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
        userId,
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

    // 첫 페이지 캐싱 (30초)
    if (cacheKey) {
      await this.cacheService.set(cacheKey, response, CacheTTL.HOME_FEED);
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

  private async fetchFeedItemsByIds(
    blogIds: string[],
    communityIds: string[],
    userId?: string,
  ): Promise<any[]> {
    const queryParts: string[] = [];
    const params: any[] = [userId ?? null];
    let paramIndex = 2;
    const userPlaceholder = "$1";

    if (blogIds.length > 0) {
      const blogPlaceholder = `$${paramIndex++}`;
      params.push(blogIds);
      queryParts.push(`
        SELECT
          p.id,
          p.title,
          p.slug,
          pm.excerpt,
          p.content as content_html,
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
          pl_user.type as user_vote,
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
        FROM posts p
        LEFT JOIN post_metadata pm ON pm."postId" = p.id
        LEFT JOIN post_stats ps ON ps."postId" = p.id
        LEFT JOIN post_likes pl_user
          ON pl_user."postId" = p.id AND pl_user."userId" = ${userPlaceholder}
        LEFT JOIN files f ON f.id = p."thumbnail_image_id"
        LEFT JOIN blogs b ON b.id = p."blogId"
        LEFT JOIN users u ON u.id = p."authorId"
        LEFT JOIN profiles pr ON pr."userId" = u.id
        WHERE p."isPublished" = true
          AND p."isDeleted" = false
          AND p.status = 'published'
          AND p.id = ANY(${blogPlaceholder}::uuid[])
      `);
    }

    if (communityIds.length > 0) {
      const communityPlaceholder = `$${paramIndex++}`;
      params.push(communityIds);
      queryParts.push(`
        SELECT
          cp.id,
          cp.title,
          cp.slug,
          LEFT(REGEXP_REPLACE(cp.content, '<[^>]*>', '', 'g'), 200) as excerpt,
          cp.content as content_html,
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
          cpl_user.type as user_vote,
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
        LEFT JOIN community_post_likes cpl_user
          ON cpl_user."postId" = cp.id AND cpl_user."userId" = ${userPlaceholder}
        WHERE cp.status = 'published'
          AND cp."deletedAt" IS NULL
          AND cp.id = ANY(${communityPlaceholder}::uuid[])
      `);
    }

    if (!queryParts.length) {
      return [];
    }

    const query = queryParts.join(" UNION ALL ");
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
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const userParamIndex = cursor ? 4 : 2;
      const userParamPlaceholder = `$${userParamIndex}`;
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
          p.excerpt,
          p.content as content_html,
          p.tags as tags,
          f.file_url as thumbnail,
          'blog'::text as source_type,
          p."blogId" as source_id,
          NULL::uuid as community_id,
          p."authorId" as author_id,
          COALESCE(p."like_count", 0) as like_count,
          COALESCE(p."like_count", 0) as upvote_count,
          0 as downvote_count,
          COALESCE(p."comment_count", 0) as comment_count,
          COALESCE(p."view_count", 0) as view_count,
          p."createdAt" as created_at,
          p."updatedAt" as updated_at,
          pl_user.type as user_vote,
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
        LEFT JOIN post_likes pl_user ON pl_user."postId" = p.id AND pl_user."userId" = ${userParamPlaceholder}
        LEFT JOIN files f ON f.id = p."thumbnail_image_id"
        LEFT JOIN blogs b ON b.id = p."blogId"
        LEFT JOIN users u ON u.id = p."authorId"
        LEFT JOIN profiles pr ON pr."userId" = u.id
        WHERE p."isPublished" = true
          AND p."isDeleted" = false
          AND p.status = 'published'
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
          LEFT(REGEXP_REPLACE(cp.content, '<[^>]*>', '', 'g'), 200) as excerpt,
          cp.content as content_html,
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
          cpl_user.type as user_vote,
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
        LEFT JOIN community_post_likes cpl_user
          ON cpl_user."postId" = cp.id AND cpl_user."userId" = ${userParamPlaceholder}
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

      params.push(userId ?? null);

      // 쿼리 실행
      const rawResults = await queryRunner.query(finalQuery, params);

      // 결과 매핑
      return rawResults.map((row: any) => this.mapToFeedItem(row));
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 원시 쿼리 결과를 DTO로 매핑
   */
  private mapToFeedItem(row: any): UnifiedFeedItemDto {
    const sourceType: FeedSourceType = row.source_type;
    const contentHtml =
      typeof row.content_html === "string" ? row.content_html : "";
    const preferredYouTubeId =
      this.extractPreferredYouTubeVideoIdFromContent(contentHtml);
    const youtubeVideoId =
      preferredYouTubeId || this.extractYouTubeVideoIdFromContent(contentHtml);

    const item: UnifiedFeedItemDto = {
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt || undefined,
      thumbnail: row.thumbnail || undefined,
      youtubeVideoId: youtubeVideoId || undefined,
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

    if (contentHtml) {
      if (!item.excerpt) {
        const excerpt = this.createExcerptFromHtml(contentHtml);
        if (excerpt) {
          item.excerpt = excerpt;
        }
      }

      if (contentHtml.includes("<img")) {
        const inlineImages = this.extractImageUrls(contentHtml);
        if (inlineImages.length > 0) {
          item.images = inlineImages;
          if (!item.thumbnail) {
            item.thumbnail = inlineImages[0];
          }
        }
      }
    }

    if (preferredYouTubeId) {
      item.thumbnail = this.buildYouTubeThumbnailUrl(preferredYouTubeId);
    } else if (!item.thumbnail && youtubeVideoId) {
      item.thumbnail = this.buildYouTubeThumbnailUrl(youtubeVideoId);
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

  private extractPreferredYouTubeVideoIdFromContent(
    content: string,
  ): string | null {
    if (!content) return null;

    const match = content.match(
      /<div[^>]*data-youtube-video[^>]*data-thumbnail=["']true["'][^>]*>[\s\S]*?<\/div>/i,
    );
    if (!match) return null;

    return this.extractYouTubeVideoIdFromContent(match[0]);
  }

  private extractYouTubeVideoIdFromContent(content: string): string | null {
    if (!content) return null;

    const iframeMatch = content.match(
      /https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/i,
    );
    if (iframeMatch?.[1]) {
      return iframeMatch[1];
    }

    const originalUrlMatch = content.match(
      /data-original-url=["']([^"']+)["']/i,
    );
    if (originalUrlMatch?.[1]) {
      const urlMatch = originalUrlMatch[1].match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
      );
      if (urlMatch?.[1]) return urlMatch[1];
    }

    const urlFallback = content.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    );
    return urlFallback?.[1] ?? null;
  }

  private buildYouTubeThumbnailUrl(videoId: string): string {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
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
  private extractImageUrls(html: string): string[] {
    const regex = /<img[^>]+src=["']([^"']+)["']/gi;
    const urls = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null) {
      const url = match[1]?.trim();
      if (url) {
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
}
