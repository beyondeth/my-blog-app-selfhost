import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { DateUtils } from '../../common/utils/date.utils';
import { User } from '../../users/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { Report } from '../../reports/entities/report.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { UnifiedRedisService } from '../../redis/unified-redis.service';
import { ReportStatus } from '../../reports/enums/report.enum';

export interface DashboardStats {
  users: {
    total: number;
    active: number;
    new: number;
    inactive: number;
    changePercent: number;
  };
  posts: {
    total: number;
    published: number;
    drafts: number; // Changed from 'draft' to 'drafts'
    todayCount: number;
    changePercent: number;
  };
  comments: {
    total: number;
    todayCount: number;
    pending: number; // Changed from 'pendingModeration'
    changePercent: number;
  };
  reports: {
    total: number;
    pending: number;
    resolved: number;
    todayCount: number;
  };
  metrics: {
    dau: number; // Daily Active Users
    mau: number; // Monthly Active Users
    avgPostsPerUser: number;
    avgCommentsPerPost: number;
    avgSessionDuration: number; // Added
    bounceRate: number; // Added
  };
}

export interface ActivityFeed {
  type: 'user_signup' | 'post_created' | 'comment_created' | 'report_created';
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface TrendData {
  date: string;
  users: number;
  posts: number;
  comments: number;
  reports: number;
}

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private readonly unifiedRedisService: UnifiedRedisService,
  ) {}

  /**
   * Get dashboard statistics
   * 최적화: 16개 COUNT 쿼리 → 1개 CTE 쿼리 (94% 쿼리 감소)
   */
  async getStats(): Promise<DashboardStats> {
    // 오늘 시작 시간 (00:00:00.000)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // DateUtils를 사용한 일수 기반 계산
    const thirtyDaysAgo = DateUtils.fromNowSubtractDays(30);
    const sevenDaysAgo = DateUtils.fromNowSubtractDays(7);

    // 최적화된 단일 쿼리: CTE를 사용한 조건부 집계 (FILTER 사용)
    // 16개의 개별 COUNT 쿼리를 1개의 통합 쿼리로 통합
    const [statsResult] = await this.userRepository.query(`
      WITH user_stats AS (
        SELECT
          COUNT(*) FILTER (WHERE TRUE) as total,
          COUNT(*) FILTER (WHERE "isActive" = true) as active,
          COUNT(*) FILTER (WHERE "createdAt" >= $1) as new,
          COUNT(*) FILTER (WHERE "isActive" = false) as inactive,
          COUNT(*) FILTER (WHERE "createdAt" >= $2) as last_week
        FROM users
      ),
      post_stats AS (
        SELECT
          COUNT(*) FILTER (WHERE TRUE) as total,
          COUNT(*) FILTER (WHERE "isPublished" = true) as published,
          COUNT(*) FILTER (WHERE "isPublished" = false) as draft,
          COUNT(*) FILTER (WHERE "createdAt" >= $3) as today,
          COUNT(*) FILTER (WHERE "createdAt" >= $2) as last_week
        FROM posts
      ),
      comment_stats AS (
        SELECT
          COUNT(*) FILTER (WHERE TRUE) as total,
          COUNT(*) FILTER (WHERE "createdAt" >= $3) as today,
          COUNT(*) FILTER (WHERE "createdAt" >= $2) as last_week
        FROM comments
      ),
      report_stats AS (
        SELECT
          COUNT(*) FILTER (WHERE TRUE) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
          COUNT(*) FILTER (WHERE "createdAt" >= $3) as today
        FROM reports
      )
      SELECT
        -- User stats
        u.total::integer as total_users,
        u.active::integer as active_users,
        u.new::integer as new_users,
        u.inactive::integer as inactive_users,
        u.last_week::integer as last_week_users,
        -- Post stats
        p.total::integer as total_posts,
        p.published::integer as published_posts,
        p.draft::integer as draft_posts,
        p.today::integer as today_posts,
        p.last_week::integer as last_week_posts,
        -- Comment stats
        c.total::integer as total_comments,
        c.today::integer as today_comments,
        c.last_week::integer as last_week_comments,
        -- Report stats
        r.total::integer as total_reports,
        r.pending::integer as pending_reports,
        r.resolved::integer as resolved_reports,
        r.today::integer as today_reports
      FROM user_stats u, post_stats p, comment_stats c, report_stats r
    `, [thirtyDaysAgo, sevenDaysAgo, today]);

    // 별도 쿼리: DAU, MAU (다른 로직을 사용하므로 분리)
    const [dau, mau] = await Promise.all([
      this.getDailyActiveUsers(),
      this.getMonthlyActiveUsers(),
    ]);

    // 결과 추출 (CTE 쿼리 결과를 변수로 분해)
    const {
      total_users: totalUsers,
      active_users: activeUsers,
      new_users: newUsers,
      inactive_users: inactiveUsers,
      last_week_users: lastWeekUsers,
      total_posts: totalPosts,
      published_posts: publishedPosts,
      draft_posts: draftPosts,
      today_posts: todayPosts,
      last_week_posts: lastWeekPosts,
      total_comments: totalComments,
      today_comments: todayComments,
      last_week_comments: lastWeekComments,
      total_reports: totalReports,
      pending_reports: pendingReports,
      resolved_reports: resolvedReports,
      today_reports: todayReports,
    } = statsResult;

    const avgPostsPerUser = totalUsers > 0 ? totalPosts / totalUsers : 0;
    const avgCommentsPerPost = totalPosts > 0 ? totalComments / totalPosts : 0;
    
    // Calculate change percentages
    const userChangePercent = lastWeekUsers > 0 ? Math.round(((newUsers - lastWeekUsers) / lastWeekUsers) * 100) : 0;
    const postChangePercent = lastWeekPosts > 0 ? Math.round(((todayPosts - (lastWeekPosts / 7)) / (lastWeekPosts / 7)) * 100) : 0;
    const commentChangePercent = lastWeekComments > 0 ? Math.round(((todayComments - (lastWeekComments / 7)) / (lastWeekComments / 7)) * 100) : 0;
    
    // Calculate session and bounce rate (mock data for now)
    const avgSessionDuration = 245; // seconds
    const bounceRate = 42.5; // percentage

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        new: newUsers,
        inactive: inactiveUsers,
        changePercent: userChangePercent,
      },
      posts: {
        total: totalPosts,
        published: publishedPosts,
        drafts: draftPosts, // Changed from 'draft' to 'drafts'
        todayCount: todayPosts,
        changePercent: postChangePercent,
      },
      comments: {
        total: totalComments,
        todayCount: todayComments,
        pending: 0, // TODO: Implement moderation queue
        changePercent: commentChangePercent,
      },
      reports: {
        total: totalReports,
        pending: pendingReports,
        resolved: resolvedReports,
        todayCount: todayReports,
      },
      metrics: {
        dau,
        mau,
        avgPostsPerUser: Math.round(avgPostsPerUser * 100) / 100,
        avgCommentsPerPost: Math.round(avgCommentsPerPost * 100) / 100,
        avgSessionDuration,
        bounceRate,
      },
    };
  }

  /**
   * Get recent activity feed
   * 최적화: 4개 개별 쿼리 → 1개 UNION ALL 쿼리 (75% 쿼리 감소)
   */
  async getActivityFeed(limit = 20): Promise<ActivityFeed[]> {
    // 최적화된 단일 쿼리: UNION ALL을 사용하여 4개 테이블의 최신 활동을 한 번에 조회
    // 기존 Promise.all로 4개 쿼리를 병렬 실행하던 것을 단일 쿼리로 통합
    // 각 엔티티 타입별로 최신 N개를 가져온 후 timestamp 기준으로 정렬하여 최종 limit 적용
    const activities = await this.userRepository.query(`
      (
        SELECT
          'user_signup' as type,
          'New user ' || COALESCE(username, email) || ' signed up' as message,
          "createdAt" as timestamp,
          jsonb_build_object('userId', id) as metadata
        FROM users
        ORDER BY "createdAt" DESC
        LIMIT $1
      )
      UNION ALL
      (
        SELECT
          'post_created' as type,
          COALESCE(u.username, 'User') || ' created post "' || p.title || '"' as message,
          p."createdAt" as timestamp,
          jsonb_build_object('postId', p.id, 'authorId', p."authorId") as metadata
        FROM posts p
        LEFT JOIN users u ON p."authorId" = u.id
        ORDER BY p."createdAt" DESC
        LIMIT $1
      )
      UNION ALL
      (
        SELECT
          'comment_created' as type,
          COALESCE(u.username, 'User') || ' commented on "' || COALESCE(p.title, 'a post') || '"' as message,
          c."createdAt" as timestamp,
          jsonb_build_object('commentId', c.id, 'postId', c."postId") as metadata
        FROM comments c
        LEFT JOIN users u ON c."authorId" = u.id
        LEFT JOIN posts p ON c."postId" = p.id
        ORDER BY c."createdAt" DESC
        LIMIT $1
      )
      UNION ALL
      (
        SELECT
          'report_created' as type,
          COALESCE(u.username, 'User') || ' reported ' || r.type as message,
          r."createdAt" as timestamp,
          jsonb_build_object('reportId', r.id, 'reportType', r.type) as metadata
        FROM reports r
        LEFT JOIN users u ON r."reportedById" = u.id
        ORDER BY r."createdAt" DESC
        LIMIT $1
      )
      ORDER BY timestamp DESC
      LIMIT $1
    `, [limit, limit, limit, limit, limit]);

    return activities;
  }

  /**
   * Get trend data for charts - showing cumulative data
   * 최적화: 28개 COUNT 쿼리 (7일 × 4 테이블) → 1개 쿼리로 통합 (96% 쿼리 감소)
   */
  async getTrendData(days = 7): Promise<TrendData[]> {
    // 최적화된 단일 쿼리: generate_series를 사용하여 날짜 범위 생성 후 각 날짜별 누적 카운트 계산
    // 기존 for 루프에서 Promise.all을 7번 실행 (7×4=28개 쿼리) 대신 단일 쿼리로 모든 데이터 조회
    const trends = await this.userRepository.query(`
      WITH dates AS (
        -- 최근 N일간의 날짜 시리즈 생성
        SELECT
          generate_series(
            CURRENT_DATE - $1::integer + 1,
            CURRENT_DATE,
            '1 day'::interval
          )::date as date
      )
      SELECT
        TO_CHAR(d.date, 'YYYY-MM-DD') as date,
        -- 각 날짜까지의 누적 카운트 (해당 날짜 23:59:59까지 포함)
        (SELECT COUNT(*) FROM users WHERE "createdAt"::date <= d.date)::integer as users,
        (SELECT COUNT(*) FROM posts WHERE "createdAt"::date <= d.date)::integer as posts,
        (SELECT COUNT(*) FROM comments WHERE "createdAt"::date <= d.date)::integer as comments,
        (SELECT COUNT(*) FROM reports WHERE "createdAt"::date <= d.date)::integer as reports
      FROM dates d
      ORDER BY d.date
    `, [days]);

    return trends;
  }

  /**
   * Get popular posts
   */
  async getPopularPosts(limit = 10) {
    const posts = await this.postRepository.find({
      where: { isPublished: true },
      relations: ['author'],
      order: {
        viewCount: 'DESC',
        likeCount: 'DESC',
        commentCount: 'DESC',
      },
      take: limit,
    });

    return posts.map(post => ({
      id: post.id,
      title: post.title,
      author: post.author?.username || 'Unknown',
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      createdAt: post.createdAt,
    }));
  }

  /**
   * Get top contributors
   */
  async getTopContributors(limit = 10) {
    const result = await this.postRepository
      .createQueryBuilder('post')
      .select('post.authorId', 'userId')
      .addSelect('COUNT(*)', 'postCount')
      .addSelect('SUM(post.viewCount)', 'totalViews')
      .addSelect('SUM(post.likeCount)', 'totalLikes')
      .groupBy('post.authorId')
      .orderBy('COUNT(*)', 'DESC')
      .limit(limit)
      .getRawMany();

    // Get user details
    const userIds = result.map(r => r.userId);
    const users = await this.userRepository.findByIds(userIds);
    const userMap = new Map(users.map(u => [u.id, u]));

    return result.map(r => {
      const user = userMap.get(r.userId);
      return {
        userId: r.userId,
        username: user?.username || user?.email || 'Unknown',
        postCount: parseInt(r.postCount),
        totalViews: parseInt(r.totalViews || '0'),
        totalLikes: parseInt(r.totalLikes || '0'),
      };
    });
  }

  /**
   * 시스템 상태 메트릭 조회 - 실제 Redis 상태 포함
   */
  async getSystemHealth() {
    try {
      // Redis 통계 조회
      const redisStats = await this.unifiedRedisService.getCacheStatistics();
      const redisInfo = await this.unifiedRedisService.getInfo();

      // Redis 상태 및 응답시간 계산
      const startTime = Date.now();
      await this.unifiedRedisService.getCache('temp', 'health-check');
      const redisResponseTime = Date.now() - startTime;

      // Redis 메모리 사용량 계산 (메모리 문자열을 숫자로 변환)
      const memoryUsage = redisStats.memoryUsage;
      const memoryBytes = this.parseRedisMemory(memoryUsage);
      const maxMemory = redisInfo?.memory?.maxmemory || '0';
      const maxMemoryBytes = parseInt(maxMemory) || 6442450944; // 기본 6GB
      const memoryUsageRatio = maxMemoryBytes > 0 ? memoryBytes / maxMemoryBytes : 0;

      // 데이터베이스 응답시간 체크 (간단한 쿼리 실행)
      const dbStartTime = Date.now();
      await this.userRepository.count();
      const dbResponseTime = Date.now() - dbStartTime;

      // 스토리지 사용량 (파일 시스템 체크 - 실제 구현 필요)
      const storageUsage = 0.45; // 임시 값, 실제로는 fs 모듈로 체크

      // 전체 시스템 상태 판단
      const isHealthy =
        redisResponseTime < 100 &&
        dbResponseTime < 100 &&
        memoryUsageRatio < 0.9 &&
        redisStats.hitRate > 0.5;

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        services: {
          database: {
            status: dbResponseTime < 100 ? 'operational' : 'slow',
            responseTime: dbResponseTime,
          },
          cache: {
            status: redisResponseTime < 50 ? 'operational' : 'slow',
            hitRate: redisStats.hitRate,
            responseTime: redisResponseTime,
            keys: redisStats.totalKeys,
            memory: redisStats.memoryUsage,
            patterns: redisStats.patterns,
          },
          storage: {
            status: storageUsage < 0.8 ? 'operational' : 'warning',
            usage: storageUsage,
          },
        },
        metrics: {
          avgResponseTime: Math.round((dbResponseTime + redisResponseTime) / 2),
          errorRate: 0.001, // TODO: 실제 에러율 계산 구현
          uptime: 99.99, // TODO: 실제 업타임 계산 구현
          cacheHitRate: Math.round(redisStats.hitRate * 100) / 100,
          totalCacheKeys: redisStats.totalKeys,
        },
      };
    } catch (error) {
      // 에러 발생 시 기본값 반환
      console.error('시스템 상태 조회 실패:', error);
      return {
        status: 'error',
        services: {
          database: { status: 'unknown', responseTime: null },
          cache: { status: 'unknown', hitRate: null },
          storage: { status: 'unknown', usage: null },
        },
        metrics: {
          avgResponseTime: null,
          errorRate: null,
          uptime: null,
        },
      };
    }
  }

  /**
   * Redis 메모리 문자열을 바이트로 변환
   * 예: "1.5M" -> 1572864, "2G" -> 2147483648
   */
  private parseRedisMemory(memory: string): number {
    if (!memory || memory === 'N/A') return 0;

    const units = {
      'K': 1024,
      'M': 1024 * 1024,
      'G': 1024 * 1024 * 1024,
    };

    const match = memory.match(/^([\d.]+)([KMG])?/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2] as keyof typeof units;

    return Math.floor(value * (units[unit] || 1));
  }

  // Private helper methods

  private async getDailyActiveUsers(): Promise<number> {
    // 오늘 시작 시간 (00:00:00.000)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count users who have logged in today
    return await this.userRepository.count({
      where: {
        lastLoginAt: MoreThanOrEqual(today),
      },
    });
  }

  private async getMonthlyActiveUsers(): Promise<number> {
    // DateUtils를 사용한 일수 기반 계산 (30일 전)
    const thirtyDaysAgo = DateUtils.fromNowSubtractDays(30);

    // Count users who have logged in in the last 30 days
    return await this.userRepository.count({
      where: {
        lastLoginAt: MoreThanOrEqual(thirtyDaysAgo),
      },
    });
  }

  /**
   * Get content moderation queue
   */
  async getModerationQueue() {
    const [
      pendingReports,
      flaggedPosts,
      flaggedComments,
    ] = await Promise.all([
      this.reportRepository.find({
        where: { status: ReportStatus.PENDING },
        relations: ['reportedBy'],
        order: { priority: 'DESC', createdAt: 'ASC' },
        take: 10,
      }),
      // TODO: Implement flagged content detection
      [],
      [],
    ]);

    return {
      reports: pendingReports,
      flaggedPosts,
      flaggedComments,
    };
  }

  /**
   * Get analytics summary for a specific date range
   */
  async getAnalyticsSummary(startDate: Date, endDate: Date) {
    const where = { createdAt: Between(startDate, endDate) };

    const [
      newUsers,
      newPosts,
      newComments,
      totalViews,
      totalLikes,
    ] = await Promise.all([
      this.userRepository.count({ where }),
      this.postRepository.count({ where }),
      this.commentRepository.count({ where }),
      this.postRepository
        .createQueryBuilder('post')
        .select('SUM(post.viewCount)', 'total')
        .where(where)
        .getRawOne()
        .then(r => parseInt(r?.total || '0')),
      this.postRepository
        .createQueryBuilder('post')
        .select('SUM(post.likeCount)', 'total')
        .where(where)
        .getRawOne()
        .then(r => parseInt(r?.total || '0')),
    ]);

    return {
      period: {
        start: startDate,
        end: endDate,
      },
      metrics: {
        newUsers,
        newPosts,
        newComments,
        totalViews,
        totalLikes,
        engagementRate: newPosts > 0 ? (newComments + totalLikes) / newPosts : 0,
      },
    };
  }
}