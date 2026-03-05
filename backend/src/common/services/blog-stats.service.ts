import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Post } from "../../posts/entities/post.entity";
import { PostStats } from "../../posts/entities/post-stats.entity";
import { Blog } from "../../blogs/entities/blog.entity";
import { BlogStats } from "../../blogs/entities/blog-stats.entity";
import { StatsSnapshot } from "../entities/stats-snapshot.entity";
import { CacheService, CacheTTL } from "../../cache/cache.service";

/**
 * 블로그 통계 서비스
 *
 * 블로그 관련 통계 계산 로직을 별도 서비스로 분리하여
 * 순환 의존성을 피하고 재사용성을 높임
 */
@Injectable()
export class BlogStatsService {
  private readonly logger = new Logger(BlogStatsService.name);

  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Blog)
    private readonly blogRepository: Repository<Blog>,
    @InjectRepository(BlogStats)
    private readonly blogStatsRepository: Repository<BlogStats>,
    @InjectRepository(StatsSnapshot)
    private readonly snapshotRepository: Repository<StatsSnapshot>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 블로그의 카테고리별 포스트 개수 조회
   * @param slug 블로그 slug (하위 호환성을 위해 유지)
   * @returns 카테고리별 포스트 개수 배열
   */
  async getBlogCategoriesWithCount(
    slug: string,
  ): Promise<Array<{ category: string; count: number }>> {
    // 내부적으로 getBlogCategoriesWithCountById 호출
    const blog = await this.blogRepository.findOne({
      where: { slug },
      select: ["id"],
    });

    if (!blog) {
      return [];
    }

    return this.getBlogCategoriesWithCountById(blog.id);
  }

  /**
   * 블로그의 카테고리별 포스트 개수 조회 (blogId 기반)
   * @param blogId 블로그 ID
   * @returns 카테고리별 포스트 개수 배열
   */
  async getBlogCategoriesWithCountById(
    blogId: string,
    options?: { includePrivate?: boolean },
  ): Promise<Array<{ category: string; count: number }>> {
    const includePrivate = options?.includePrivate === true;
    const scope = includePrivate ? "all" : "public";
    const cacheKey = `blog:stats:categories:id:${blogId}:${scope}`;

    // 캐시 확인
    const cached =
      await this.cacheService.get<Array<{ category: string; count: number }>>(
        cacheKey,
      );
    if (cached) {
      this.logger.debug(`Cache HIT for blog categories by ID: ${blogId}`);
      return cached;
    }

    this.logger.debug(`Cache MISS for blog categories by ID: ${blogId}`);

    // 카테고리별 포스트 개수 집계
    const result = await this.postRepository
      .createQueryBuilder("post")
      .select("post.category", "category")
      .addSelect("COUNT(post.id)", "count")
      .where("post.blogId = :blogId", { blogId })
      .andWhere("post.isDeleted = :isDeleted", { isDeleted: false })
      .andWhere("post.isPublished = :isPublished", { isPublished: true }) // 발행된 포스트만
      .andWhere("post.status = :publishedStatus", {
        publishedStatus: "published",
      })
      .andWhere(
        includePrivate ? "1=1" : "post.visibility = :publicVisibility",
        includePrivate ? {} : { publicVisibility: "public" },
      )
      .groupBy("post.category")
      .orderBy("count", "DESC")
      .getRawMany();

    // 결과 변환
    const categories = result.map((row) => ({
      category: row.category || "미분류",
      count: parseInt(row.count, 10),
    }));

    // 캐싱 (5분)
    await this.cacheService.set(cacheKey, categories, CacheTTL.MEDIUM);

    return categories;
  }

  /**
   * 블로그의 전체 포스트 개수 조회
   * @param blogId 블로그 ID
   * @returns 포스트 개수
   */
  async getBlogPostCount(blogId: string): Promise<number> {
    const cacheKey = `blog:stats:posts:${blogId}`;

    const cached = await this.cacheService.get<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const count = await this.postRepository.count({
      where: {
        blogId,
        isDeleted: false,
      },
    });

    // 캐싱 (10분)
    await this.cacheService.set(cacheKey, count, CacheTTL.LONG);

    return count;
  }

  /**
   * 블로그의 최근 활동 통계
   * @param blogId 블로그 ID
   * @param days 기간 (일)
   * @returns 활동 통계
   */
  async getBlogActivityStats(
    blogId: string,
    days: number = 30,
  ): Promise<{
    totalPosts: number;
    totalViews: number;
    totalLikes: number;
    averageViewsPerPost: number;
  }> {
    const cacheKey = `blog:stats:activity:${blogId}:${days}`;

    const cached = await this.cacheService.get<{
      totalPosts: number;
      totalViews: number;
      totalLikes: number;
      averageViewsPerPost: number;
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const queryBuilder = this.postRepository
      .createQueryBuilder("post")
      .leftJoin("post.stats", "stats")
      .where("post.blogId = :blogId", { blogId })
      .andWhere("post.isDeleted = :isDeleted", { isDeleted: false })
      .andWhere("post.createdAt >= :startDate", { startDate });

    const result = (await queryBuilder
      .select("COUNT(DISTINCT post.id)", "totalPosts")
      .addSelect("COALESCE(SUM(stats.viewCount), 0)", "totalViews")
      .addSelect("COALESCE(SUM(stats.likeCount), 0)", "totalLikes")
      .getRawOne()) as {
      totalPosts: string;
      totalViews: string;
      totalLikes: string;
    };

    const stats = {
      totalPosts: parseInt(result.totalPosts, 10) || 0,
      totalViews: parseInt(result.totalViews, 10) || 0,
      totalLikes: parseInt(result.totalLikes, 10) || 0,
      averageViewsPerPost: 0,
    };

    if (stats.totalPosts > 0) {
      stats.averageViewsPerPost = Math.round(
        stats.totalViews / stats.totalPosts,
      );
    }

    // 캐싱 (1시간)
    await this.cacheService.set(cacheKey, stats, CacheTTL.STATIC);

    return stats;
  }

  /**
   * 블로그 인기 포스트 TOP N
   * @param blogId 블로그 ID
   * @param limit 개수 제한
   * @returns 인기 포스트 목록
   */
  async getBlogPopularPosts(
    blogId: string,
    limit: number = 5,
  ): Promise<
    Array<{
      id: string;
      title: string;
      slug: string;
      viewCount: number;
      likesCount: number;
      createdAt: Date;
    }>
  > {
    const cacheKey = `blog:stats:popular:${blogId}:${limit}`;

    const cached = await this.cacheService.get<
      Array<{
        id: string;
        title: string;
        slug: string;
        viewCount: number;
        likesCount: number;
        createdAt: Date;
      }>
    >(cacheKey);
    if (cached) {
      return cached;
    }

    const posts = await this.postRepository
      .createQueryBuilder("post")
      .leftJoin("post.stats", "stats")
      .select([
        "post.id",
        "post.title",
        "post.slug",
        "stats.viewCount",
        "stats.likesCount",
        "post.createdAt",
      ])
      .where("post.blogId = :blogId", { blogId })
      .andWhere("post.isDeleted = :isDeleted", { isDeleted: false })
      .orderBy("(stats.viewCount + stats.likeCount * 2)", "DESC")
      .limit(limit)
      .getMany();

    const result = posts.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      viewCount: post.stats?.viewCount || 0,
      likesCount: post.stats?.likeCount || 0,
      createdAt: post.createdAt,
    }));

    // 캐싱 (15분)
    await this.cacheService.set(cacheKey, result, CacheTTL.LONG);

    return result;
  }

  /**
   * 블로그 통계 캐시 무효화
   * @param blogId 블로그 ID
   * @param slug 블로그 slug
   */
  async invalidateBlogStatsCache(blogId: string, slug?: string): Promise<void> {
    const keys = [
      `blog:stats:categories:id:${blogId}`,
      `blog:stats:posts:${blogId}`,
      `blog:stats:activity:${blogId}:30`,
      `blog:stats:popular:${blogId}:5`,
    ];

    if (slug) {
      keys.push(`blog:stats:categories:${slug}`);
    }

    // 간단히 Redis 패턴 삭제는 복잡하므로, 키들을 직접 관리
    // 실제 프로덕션에서는 Redis SCAN을 사용하거나 별도 캐시 관리 전략 필요
    for (const key of keys) {
      await this.cacheService.delete(key);
    }

    this.logger.debug(`Invalidated blog stats cache: ${blogId}, slug: ${slug}`);
  }

  /**
   * 블로그 포스트 수 증가
   * @param blogId 블로그 ID
   */
  async incrementPostCount(blogId: string): Promise<void> {
    // postCount 컬럼이 없으므로 캐시 무효화만 처리
    // 실제 포스트 수는 동적으로 계산됨
    await this.invalidateBlogStatsCache(blogId);

    this.logger.debug(`Invalidated blog stats cache for blog: ${blogId}`);
  }

  /**
   * 블로그 포스트 수 감소
   * @param blogId 블로그 ID
   */
  async decrementPostCount(blogId: string): Promise<void> {
    // postCount 컬럼이 없으므로 캐시 무효화만 처리
    // 실제 포스트 수는 동적으로 계산됨
    await this.invalidateBlogStatsCache(blogId);

    this.logger.debug(`Invalidated blog stats cache for blog: ${blogId}`);
  }

  // =========================================================================
  // 대시보드용 통계 API (보안: 블로그 소유자만 접근 가능)
  // =========================================================================

  /**
   * 블로그 종합 통계 조회 (대시보드용)
   * @param blogId 블로그 ID
   * @returns 종합 통계 객체
   */
  async getAggregateStats(blogId: string): Promise<{
    blogId: string;
    totalPosts: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    followerCount: number;
    avgEngagementRate: number;
    weeklyViews: number;
    weeklyLikes: number;
    lastCalculatedAt: Date;
  }> {
    const cacheKey = `blog:aggregate-stats:${blogId}`;

    // 캐시 확인
    const cached = await this.cacheService.get<{
      blogId: string;
      totalPosts: number;
      totalViews: number;
      totalLikes: number;
      totalComments: number;
      followerCount: number;
      avgEngagementRate: number;
      weeklyViews: number;
      weeklyLikes: number;
      lastCalculatedAt: Date;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    // BlogStats 테이블에서 조회
    let stats = await this.blogStatsRepository.findOne({
      where: { blogId },
    });

    // 없으면 계산하여 생성
    if (!stats) {
      stats = await this.calculateAndSaveBlogStats(blogId);
    }

    const result = stats
      ? {
          blogId: stats.blogId,
          totalPosts: stats.totalPosts,
          totalViews: Number(stats.totalViews),
          totalLikes: stats.totalLikes,
          totalComments: stats.totalComments,
          followerCount: stats.followerCount,
          avgEngagementRate: Number(stats.avgEngagementRate),
          weeklyViews: stats.weeklyViews,
          weeklyLikes: stats.weeklyLikes,
          lastCalculatedAt: stats.lastCalculatedAt,
        }
      : {
          blogId,
          totalPosts: 0,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          followerCount: 0,
          avgEngagementRate: 0,
          weeklyViews: 0,
          weeklyLikes: 0,
          lastCalculatedAt: new Date(),
        };

    // 캐싱 (5분)
    await this.cacheService.set(cacheKey, result, CacheTTL.MEDIUM);

    return result;
  }

  /**
   * 블로그 통계 계산 및 저장
   * @param blogId 블로그 ID
   */
  async calculateAndSaveBlogStats(blogId: string): Promise<BlogStats | null> {
    const blog = await this.blogRepository.findOne({
      where: { id: blogId },
      select: ["id"],
    });

    if (!blog) {
      return null;
    }

    // 전체 통계 집계
    const totalStats = await this.postRepository
      .createQueryBuilder("post")
      .leftJoin("post.stats", "stats")
      .where("post.blogId = :blogId", { blogId })
      .andWhere("post.isDeleted = :isDeleted", { isDeleted: false })
      .andWhere("post.isPublished = :isPublished", { isPublished: true })
      .select("COUNT(DISTINCT post.id)", "totalPosts")
      .addSelect("COALESCE(SUM(stats.viewCount), 0)", "totalViews")
      .addSelect("COALESCE(SUM(stats.likeCount), 0)", "totalLikes")
      .addSelect("COALESCE(SUM(stats.commentCount), 0)", "totalComments")
      .getRawOne();

    // 주간 통계 집계 (최근 7일)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyStats = await this.postRepository
      .createQueryBuilder("post")
      .leftJoin("post.stats", "stats")
      .where("post.blogId = :blogId", { blogId })
      .andWhere("post.isDeleted = :isDeleted", { isDeleted: false })
      .andWhere("post.createdAt >= :weekAgo", { weekAgo })
      .select("COALESCE(SUM(stats.viewCount), 0)", "weeklyViews")
      .addSelect("COALESCE(SUM(stats.likeCount), 0)", "weeklyLikes")
      .getRawOne();

    const totalPosts = parseInt(totalStats?.totalPosts || "0", 10);
    const totalViews = parseInt(totalStats?.totalViews || "0", 10);
    const totalLikes = parseInt(totalStats?.totalLikes || "0", 10);
    const totalComments = parseInt(totalStats?.totalComments || "0", 10);

    // 참여율 계산
    const avgEngagementRate =
      totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;

    // Upsert (ON CONFLICT DO UPDATE)
    await this.blogStatsRepository
      .createQueryBuilder()
      .insert()
      .into(BlogStats)
      .values({
        blogId,
        totalPosts,
        totalViews,
        totalLikes,
        totalComments,
        avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
        weeklyViews: parseInt(weeklyStats?.weeklyViews || "0", 10),
        weeklyLikes: parseInt(weeklyStats?.weeklyLikes || "0", 10),
        lastCalculatedAt: new Date(),
      })
      .orUpdate(
        [
          "total_posts",
          "total_views",
          "total_likes",
          "total_comments",
          "avg_engagement_rate",
          "weekly_views",
          "weekly_likes",
          "last_calculated_at",
          "updated_at",
        ],
        ["blog_id"],
      )
      .execute();

    return this.blogStatsRepository.findOne({ where: { blogId } });
  }

  /**
   * 트렌드 데이터 조회 (시계열)
   * @param blogId 블로그 ID
   * @param period 기간 타입
   * @param range 범위 (일 수)
   */
  async getTrends(
    blogId: string,
    period: "daily" | "weekly" | "monthly" = "daily",
    range: number = 7,
  ): Promise<{
    trends: Array<{
      date: string;
      views: number;
      likes: number;
      comments: number;
    }>;
  }> {
    const cacheKey = `blog:trends:${blogId}:${period}:${range}`;

    const cached = await this.cacheService.get<{
      trends: Array<{
        date: string;
        views: number;
        likes: number;
        comments: number;
      }>;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    // 스냅샷에서 조회
    const snapshots = await this.snapshotRepository.find({
      where: {
        targetType: "blog",
        targetId: blogId,
        period,
      },
      order: { periodStart: "DESC" },
      take: range,
    });

    const trends = snapshots.reverse().map((s) => ({
      date: new Date(s.periodStart).toISOString().split("T")[0],
      views: s.getMetric("views"),
      likes: s.getMetric("likes"),
      comments: s.getMetric("comments"),
    }));

    const result = { trends };
    await this.cacheService.set(cacheKey, result, CacheTTL.MEDIUM);

    return result;
  }

  /**
   * 인기 게시물 조회 (대시보드용)
   * @param blogId 블로그 ID
   * @param sortBy 정렬 기준
   * @param limit 개수
   */
  async getTopPosts(
    blogId: string,
    sortBy: "views" | "likes" | "comments" = "views",
    limit: number = 5,
  ): Promise<{
    posts: Array<{
      id: string;
      title: string;
      viewCount: number;
      likeCount: number;
      commentCount: number;
      createdAt: Date;
    }>;
  }> {
    const cacheKey = `blog:top-posts:${blogId}:${sortBy}:${limit}`;

    const cached = await this.cacheService.get<{
      posts: Array<{
        id: string;
        title: string;
        viewCount: number;
        likeCount: number;
        commentCount: number;
        createdAt: Date;
      }>;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    const orderColumn =
      sortBy === "views"
        ? "stats.viewCount"
        : sortBy === "likes"
          ? "stats.likeCount"
          : "stats.commentCount";

    const posts = await this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.stats", "stats")
      .where("post.blogId = :blogId", { blogId })
      .andWhere("post.isDeleted = :isDeleted", { isDeleted: false })
      .andWhere("post.isPublished = :isPublished", { isPublished: true })
      .orderBy(orderColumn, "DESC")
      .limit(limit)
      .getMany();

    const result = {
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        viewCount: p.stats?.viewCount || 0,
        likeCount: p.stats?.likeCount || 0,
        commentCount: p.stats?.commentCount || 0,
        createdAt: p.createdAt,
      })),
    };

    // 15분 캐시 (정렬 쿼리 비용 절감)
    await this.cacheService.set(cacheKey, result, CacheTTL.LONG);

    return result;
  }

  /**
   * 매일 자정에 전체 블로그 통계 재계산 (Cron Job)
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async recalculateAllBlogStats(): Promise<void> {
    this.logger.log("Starting daily blog stats recalculation...");

    const blogs = await this.blogRepository.find({
      select: ["id"],
    });

    let successCount = 0;
    let errorCount = 0;

    for (const blog of blogs) {
      try {
        await this.calculateAndSaveBlogStats(blog.id);

        // 일별 스냅샷 생성 (어제 날짜 기준)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        await this.saveDailySnapshot(blog.id, yesterday);

        successCount++;
      } catch (error) {
        this.logger.error(
          `Failed to calculate stats for blog ${blog.id}`,
          error,
        );
        errorCount++;
      }
    }

    this.logger.log(
      `Blog stats recalculation complete. Success: ${successCount}, Errors: ${errorCount}`,
    );
  }

  /**
   * 일별 통계 스냅샷 저장
   * @param blogId 블로그 ID
   * @param date 기준 날짜
   */
  async saveDailySnapshot(blogId: string, date: Date): Promise<void> {
    date.setHours(0, 0, 0, 0); // Start of day

    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);

    // 해당 일자 게시물 수 (공개된 것만)
    const postsCount = await this.postRepository
      .createQueryBuilder("post")
      .where("post.blogId = :blogId", { blogId })
      .andWhere("post.isDeleted = :isDeleted", { isDeleted: false })
      .andWhere("post.isPublished = :isPublished", { isPublished: true })
      .andWhere("post.createdAt >= :date", { date })
      .andWhere("post.createdAt < :nextDate", { nextDate })
      .getCount();

    // 해당 일자 게시물의 조회수 합계 (단순화: 생성일 기준)
    const { views } = await this.postRepository
      .createQueryBuilder("post")
      .leftJoin("post.stats", "stats")
      .where("post.blogId = :blogId", { blogId })
      .andWhere("post.createdAt >= :date", { date })
      .andWhere("post.createdAt < :nextDate", { nextDate })
      .select("COALESCE(SUM(stats.viewCount), 0)", "views")
      .getRawOne();

    // 해당 일자 게시물의 좋아요 합계 (단순화: 생성일 기준)
    const { likes } = await this.postRepository
      .createQueryBuilder("post")
      .leftJoin("post.stats", "stats")
      .where("post.blogId = :blogId", { blogId })
      .andWhere("post.createdAt >= :date", { date })
      .andWhere("post.createdAt < :nextDate", { nextDate })
      .select("COALESCE(SUM(stats.likeCount), 0)", "likes")
      .getRawOne();

    // 해당 일자 게시물의 댓글 합계 (단순화: 생성일 기준)
    const { comments } = await this.postRepository
      .createQueryBuilder("post")
      .leftJoin("post.stats", "stats")
      .where("post.blogId = :blogId", { blogId })
      .andWhere("post.createdAt >= :date", { date })
      .andWhere("post.createdAt < :nextDate", { nextDate })
      .select("COALESCE(SUM(stats.commentCount), 0)", "comments")
      .getRawOne();

    const metrics = {
      posts: postsCount,
      views: parseInt(views, 10),
      likes: parseInt(likes, 10),
      comments: parseInt(comments, 10),
      members: 0, // 블로그는 멤버 개념이 없음 (팔로워는 별도 집계 필요하나 단순화)
    };

    // 스냅샷 저장 (기존 데이터 있으면 업데이트)
    const existing = await this.snapshotRepository.findOne({
      where: {
        targetType: "blog",
        targetId: blogId,
        period: "daily",
        periodStart: date,
      },
    });

    if (existing) {
      existing.metrics = metrics;
      await this.snapshotRepository.save(existing);
    } else {
      await this.snapshotRepository.save({
        targetType: "blog",
        targetId: blogId,
        period: "daily",
        periodStart: date,
        metrics,
      });
    }

    this.logger.debug(
      `Saved daily snapshot for blog ${blogId} on ${date.toISOString().split("T")[0]}`,
    );
  }
}
