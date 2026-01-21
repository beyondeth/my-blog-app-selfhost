import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CommunityPost } from "../entities/community-post.entity";
import { Community } from "../entities/community.entity";
import { CommunityMember } from "../entities/community-member.entity";
import { CommunityStats } from "../entities/community-stats.entity";
import { StatsSnapshot } from "../../common/entities/stats-snapshot.entity";
import { CacheService, CacheTTL } from "../../cache/cache.service";

/**
 * 커뮤니티 통계 서비스
 *
 * 커뮤니티 통계 계산 및 API 제공
 * 보안: 모더레이터 이상만 접근 가능
 */
@Injectable()
export class CommunityStatsService {
  private readonly logger = new Logger(CommunityStatsService.name);

  constructor(
    @InjectRepository(CommunityPost)
    private readonly postRepository: Repository<CommunityPost>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityMember)
    private readonly memberRepository: Repository<CommunityMember>,
    @InjectRepository(CommunityStats)
    private readonly communityStatsRepository: Repository<CommunityStats>,
    @InjectRepository(StatsSnapshot)
    private readonly snapshotRepository: Repository<StatsSnapshot>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 커뮤니티 종합 통계 조회
   * @param communityId 커뮤니티 ID
   */
  async getAggregateStats(communityId: string): Promise<{
    communityId: string;
    totalPosts: number;
    totalViews: number;
    totalUpvotes: number;
    totalDownvotes: number;
    netScore: number;
    totalComments: number;
    activeMemberCount: number;
    avgHotScore: number;
    weeklyPosts: number;
    weeklyMembers: number;
    lastCalculatedAt: Date;
  }> {
    const cacheKey = `community:aggregate-stats:${communityId}`;

    const cached = await this.cacheService.get<{
      communityId: string;
      totalPosts: number;
      totalViews: number;
      totalUpvotes: number;
      totalDownvotes: number;
      netScore: number;
      totalComments: number;
      activeMemberCount: number;
      avgHotScore: number;
      weeklyPosts: number;
      weeklyMembers: number;
      lastCalculatedAt: Date;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    // CommunityStats 테이블에서 조회
    let stats = await this.communityStatsRepository.findOne({
      where: { communityId },
    });

    // 없으면 계산하여 생성
    if (!stats) {
      stats = await this.calculateAndSaveCommunityStats(communityId);
    }

    const result = stats
      ? {
          communityId: stats.communityId,
          totalPosts: stats.totalPosts,
          totalViews: Number(stats.totalViews),
          totalUpvotes: stats.totalUpvotes,
          totalDownvotes: stats.totalDownvotes,
          netScore: stats.totalUpvotes - stats.totalDownvotes,
          totalComments: stats.totalComments,
          activeMemberCount: stats.activeMemberCount,
          avgHotScore: Number(stats.avgHotScore),
          weeklyPosts: stats.weeklyPosts,
          weeklyMembers: stats.weeklyMembers,
          lastCalculatedAt: stats.lastCalculatedAt,
        }
      : {
          communityId,
          totalPosts: 0,
          totalViews: 0,
          totalUpvotes: 0,
          totalDownvotes: 0,
          netScore: 0,
          totalComments: 0,
          activeMemberCount: 0,
          avgHotScore: 0,
          weeklyPosts: 0,
          weeklyMembers: 0,
          lastCalculatedAt: new Date(),
        };

    await this.cacheService.set(cacheKey, result, CacheTTL.MEDIUM);
    return result;
  }

  /**
   * 커뮤니티 통계 계산 및 저장
   */
  async calculateAndSaveCommunityStats(
    communityId: string,
  ): Promise<CommunityStats | null> {
    const community = await this.communityRepository.findOne({
      where: { id: communityId },
      select: ["id"],
    });

    if (!community) {
      return null;
    }

    // 전체 통계 집계
    const totalStats = await this.postRepository
      .createQueryBuilder("post")
      .where("post.communityId = :communityId", { communityId })
      .andWhere("post.deletedAt IS NULL")
      .select("COUNT(DISTINCT post.id)", "totalPosts")
      .addSelect("COALESCE(SUM(post.viewCount), 0)", "totalViews")
      .addSelect("COALESCE(SUM(post.upvoteCount), 0)", "totalUpvotes")
      .addSelect("COALESCE(SUM(post.downvoteCount), 0)", "totalDownvotes")
      .addSelect("COALESCE(SUM(post.commentCount), 0)", "totalComments")
      .addSelect("COALESCE(AVG(post.hotScore), 0)", "avgHotScore")
      .getRawOne();

    // 주간 통계
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // 주간 게시물 수 (최근 7일 - 버그 수정: weekAgo 조건 추가)
    const weeklyPosts = await this.postRepository
      .createQueryBuilder("post")
      .where("post.communityId = :communityId", { communityId })
      .andWhere("post.deletedAt IS NULL")
      .andWhere("post.createdAt >= :weekAgo", { weekAgo })
      .getCount();

    // 활성 멤버 (최근 30일)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeMemberCount = await this.memberRepository
      .createQueryBuilder("member")
      .where("member.communityId = :communityId", { communityId })
      .andWhere("member.status = :status", { status: "active" })
      .andWhere("member.lastActivityAt >= :thirtyDaysAgo", { thirtyDaysAgo })
      .getCount();

    // 주간 신규 멤버
    const weeklyMembers = await this.memberRepository
      .createQueryBuilder("member")
      .where("member.communityId = :communityId", { communityId })
      .andWhere("member.status = :status", { status: "active" })
      .andWhere("member.joinedAt >= :weekAgo", { weekAgo })
      .getCount();

    const totalPosts = parseInt(totalStats?.totalPosts || "0", 10);
    const totalViews = parseInt(totalStats?.totalViews || "0", 10);
    const totalUpvotes = parseInt(totalStats?.totalUpvotes || "0", 10);
    const totalDownvotes = parseInt(totalStats?.totalDownvotes || "0", 10);
    const totalComments = parseInt(totalStats?.totalComments || "0", 10);
    const avgHotScore = parseFloat(totalStats?.avgHotScore || "0");

    // Upsert
    await this.communityStatsRepository
      .createQueryBuilder()
      .insert()
      .into(CommunityStats)
      .values({
        communityId,
        totalPosts,
        totalViews,
        totalUpvotes,
        totalDownvotes,
        totalComments,
        activeMemberCount,
        avgHotScore: Math.round(avgHotScore * 100) / 100,
        weeklyPosts,
        weeklyMembers,
        lastCalculatedAt: new Date(),
      })
      .orUpdate(
        [
          "total_posts",
          "total_views",
          "total_upvotes",
          "total_downvotes",
          "total_comments",
          "active_member_count",
          "avg_hot_score",
          "weekly_posts",
          "weekly_members",
          "last_calculated_at",
          "updated_at",
        ],
        ["community_id"],
      )
      .execute();

    return this.communityStatsRepository.findOne({ where: { communityId } });
  }

  /**
   * 트렌드 데이터 조회 (시계열)
   */
  async getTrends(
    communityId: string,
    period: "daily" | "weekly" | "monthly" = "daily",
    range: number = 7,
  ): Promise<{
    trends: Array<{
      date: string;
      posts: number;
      upvotes: number;
      comments: number;
      members: number;
    }>;
  }> {
    const cacheKey = `community:trends:${communityId}:${period}:${range}`;

    const cached = await this.cacheService.get<{
      trends: Array<{
        date: string;
        posts: number;
        upvotes: number;
        comments: number;
        members: number;
      }>;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    const snapshots = await this.snapshotRepository.find({
      where: {
        targetType: "community",
        targetId: communityId,
        period,
      },
      order: { periodStart: "DESC" },
      take: range,
    });

    const trends = snapshots.reverse().map((s) => ({
      date: new Date(s.periodStart).toISOString().split("T")[0],
      posts: s.getMetric("posts"),
      upvotes: s.getMetric("upvotes"),
      comments: s.getMetric("comments"),
      members: s.getMetric("members"),
    }));

    const result = { trends };
    await this.cacheService.set(cacheKey, result, CacheTTL.MEDIUM);
    return result;
  }

  /**
   * 인기 게시물 조회
   */
  async getTopPosts(
    communityId: string,
    sortBy: "hotScore" | "upvotes" | "views" = "hotScore",
    limit: number = 5,
  ): Promise<{
    posts: Array<{
      id: string;
      title: string;
      viewCount: number;
      upvoteCount: number;
      downvoteCount: number;
      hotScore: number;
      authorUsername: string;
    }>;
  }> {
    const cacheKey = `community:top-posts:${communityId}:${sortBy}:${limit}`;

    const cached = await this.cacheService.get<{
      posts: Array<{
        id: string;
        title: string;
        viewCount: number;
        upvoteCount: number;
        downvoteCount: number;
        hotScore: number;
        authorUsername: string;
      }>;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    const orderColumn =
      sortBy === "hotScore"
        ? "post.hotScore"
        : sortBy === "upvotes"
          ? "post.upvoteCount"
          : "post.viewCount";

    const posts = await this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.author", "author")
      .where("post.communityId = :communityId", { communityId })
      .andWhere("post.deletedAt IS NULL")
      .orderBy(orderColumn, "DESC")
      .limit(limit)
      .getMany();

    const result = {
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        viewCount: p.viewCount || 0,
        upvoteCount: p.upvoteCount || 0,
        downvoteCount: p.downvoteCount || 0,
        hotScore: p.hotScore || 0,
        authorUsername: p.author?.username || "unknown",
      })),
    };

    // 15분 캐시 (정렬 쿼리 비용 절감)
    await this.cacheService.set(cacheKey, result, CacheTTL.LONG);
    return result;
  }

  /**
   * 기여자 랭킹 조회
   */
  async getTopContributors(
    communityId: string,
    limit: number = 5,
  ): Promise<{
    contributors: Array<{
      userId: string;
      username: string;
      profileImage: string | null;
      postCount: number;
      upvoteCount: number;
    }>;
  }> {
    const cacheKey = `community:top-contributors:${communityId}:${limit}`;

    const cached = await this.cacheService.get<{
      contributors: Array<{
        userId: string;
        username: string;
        profileImage: string | null;
        postCount: number;
        upvoteCount: number;
      }>;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    // 게시물 수와 업보트 수 기준 기여자 집계
    const contributors = await this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("author.profile", "profile")
      .where("post.communityId = :communityId", { communityId })
      .andWhere("post.deletedAt IS NULL")
      .select("author.id", "userId")
      .addSelect("author.username", "username")
      .addSelect("profile.profileImage", "profileImage")
      .addSelect("COUNT(post.id)", "post_count")
      .addSelect("COALESCE(SUM(post.upvoteCount), 0)", "upvote_count")
      .groupBy("author.id")
      .addGroupBy("author.username")
      .addGroupBy("profile.profileImage")
      .orderBy("post_count", "DESC")
      .addOrderBy("upvote_count", "DESC")
      .limit(limit)
      .getRawMany();

    const result = {
      contributors: contributors.map((c) => ({
        userId: c.userId,
        username: c.username,
        profileImage: c.profileImage || null,
        postCount: parseInt(c.post_count, 10),
        upvoteCount: parseInt(c.upvote_count, 10),
      })),
    };

    // 1시간 캐시 (GROUP BY + SUM 쿼리 비용 높음)
    await this.cacheService.set(cacheKey, result, 3600);
    return result;
  }

  /**
   * 매일 전체 커뮤니티 통계 재계산
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async recalculateAllCommunityStats(): Promise<void> {
    this.logger.log("Starting daily community stats recalculation...");

    const communities = await this.communityRepository.find({
      select: ["id"],
    });

    let successCount = 0;
    let errorCount = 0;

    for (const community of communities) {
      try {
        await this.calculateAndSaveCommunityStats(community.id);

        // 일별 스냅샷 생성 (어제 날짜 기준)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        await this.saveDailySnapshot(community.id, yesterday);

        successCount++;
      } catch (error) {
        this.logger.error(
          `Failed to calculate stats for community ${community.id}`,
          error,
        );
        errorCount++;
      }
    }

    this.logger.log(
      `Community stats recalculation complete. Success: ${successCount}, Errors: ${errorCount}`,
    );
  }

  /**
   * 일별 통계 스냅샷 저장
   * @param communityId 커뮤니티 ID
   * @param date 기준 날짜
   */
  async saveDailySnapshot(communityId: string, date: Date): Promise<void> {
    date.setHours(0, 0, 0, 0); // Start of day

    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);

    // 해당 일자 게시물 수
    const postsCount = await this.postRepository
      .createQueryBuilder("post")
      .where("post.communityId = :communityId", { communityId })
      .andWhere("post.createdAt >= :date", { date })
      .andWhere("post.createdAt < :nextDate", { nextDate })
      .getCount();

    // 해당 일자 신규 멤버 수
    const newMembersCount = await this.memberRepository
      .createQueryBuilder("member")
      .where("member.communityId = :communityId", { communityId })
      .andWhere("member.joinedAt >= :date", { date })
      .andWhere("member.joinedAt < :nextDate", { nextDate })
      .getCount();

    // 해당 일자 게시물의 업보트 합계 (단순화: 생성일 기준)
    const { upvotes } = await this.postRepository
      .createQueryBuilder("post")
      .where("post.communityId = :communityId", { communityId })
      .andWhere("post.createdAt >= :date", { date })
      .andWhere("post.createdAt < :nextDate", { nextDate })
      .select("COALESCE(SUM(post.upvoteCount), 0)", "upvotes")
      .getRawOne();

    // 해당 일자 게시물의 댓글 합계 (단순화: 생성일 기준)
    const { comments } = await this.postRepository
      .createQueryBuilder("post")
      .where("post.communityId = :communityId", { communityId })
      .andWhere("post.createdAt >= :date", { date })
      .andWhere("post.createdAt < :nextDate", { nextDate })
      .select("COALESCE(SUM(post.commentCount), 0)", "comments")
      .getRawOne();

    const metrics = {
      posts: postsCount,
      members: newMembersCount,
      upvotes: parseInt(upvotes, 10),
      comments: parseInt(comments, 10),
      views: 0,
    };

    // 스냅샷 저장 (기존 데이터 있으면 업데이트)
    const existing = await this.snapshotRepository.findOne({
      where: {
        targetType: "community",
        targetId: communityId,
        period: "daily",
        periodStart: date,
      },
    });

    if (existing) {
      existing.metrics = metrics;
      await this.snapshotRepository.save(existing);
    } else {
      await this.snapshotRepository.save({
        targetType: "community",
        targetId: communityId,
        period: "daily",
        periodStart: date,
        metrics,
      });
    }

    this.logger.debug(
      `Saved daily snapshot for community ${communityId} on ${date.toISOString().split("T")[0]}`,
    );
  }
}
