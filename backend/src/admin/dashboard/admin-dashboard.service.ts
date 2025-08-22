import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { Report } from '../../reports/entities/report.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
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
  ) {}

  /**
   * Get dashboard statistics
   */
  async getStats(): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalUsers,
      activeUsers,
      newUsers,
      inactiveUsers,
      totalPosts,
      publishedPosts,
      draftPosts,
      todayPosts,
      totalComments,
      todayComments,
      pendingReports,
      resolvedReports,
      todayReports,
      totalReports,
      dau,
      mau,
      // For change percentages - compare with last week
      lastWeekUsers,
      lastWeekPosts,
      lastWeekComments,
    ] = await Promise.all([
      // User stats
      this.userRepository.count(),
      this.userRepository.count({ where: { isActive: true } }),
      this.userRepository.count({ where: { createdAt: MoreThanOrEqual(thirtyDaysAgo) } }),
      this.userRepository.count({ where: { isActive: false } }),
      
      // Post stats
      this.postRepository.count(),
      this.postRepository.count({ where: { isPublished: true } }),
      this.postRepository.count({ where: { isPublished: false } }),
      this.postRepository.count({ where: { createdAt: MoreThanOrEqual(today) } }),
      
      // Comment stats
      this.commentRepository.count(),
      this.commentRepository.count({ where: { createdAt: MoreThanOrEqual(today) } }),
      
      // Report stats
      this.reportRepository.count({ where: { status: ReportStatus.PENDING } }),
      this.reportRepository.count({ where: { status: ReportStatus.RESOLVED } }),
      this.reportRepository.count({ where: { createdAt: MoreThanOrEqual(today) } }),
      this.reportRepository.count(), // Total reports
      
      // Active user metrics
      this.getDailyActiveUsers(),
      this.getMonthlyActiveUsers(),
      
      // Last week stats for change calculation
      this.userRepository.count({ where: { createdAt: MoreThanOrEqual(sevenDaysAgo) } }),
      this.postRepository.count({ where: { createdAt: MoreThanOrEqual(sevenDaysAgo) } }),
      this.commentRepository.count({ where: { createdAt: MoreThanOrEqual(sevenDaysAgo) } }),
    ]);

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
   */
  async getActivityFeed(limit = 20): Promise<ActivityFeed[]> {
    const [
      recentUsers,
      recentPosts,
      recentComments,
      recentReports,
    ] = await Promise.all([
      this.userRepository.find({
        order: { createdAt: 'DESC' },
        take: limit / 4,
      }),
      this.postRepository.find({
        relations: ['author'],
        order: { createdAt: 'DESC' },
        take: limit / 4,
      }),
      this.commentRepository.find({
        relations: ['author', 'post'],
        order: { createdAt: 'DESC' },
        take: limit / 4,
      }),
      this.reportRepository.find({
        relations: ['reportedBy'],
        order: { createdAt: 'DESC' },
        take: limit / 4,
      }),
    ]);

    const activities: ActivityFeed[] = [];

    // Add user signups
    recentUsers.forEach(user => {
      activities.push({
        type: 'user_signup',
        message: `New user ${user.username || user.email} signed up`,
        timestamp: user.createdAt,
        metadata: { userId: user.id },
      });
    });

    // Add post creations
    recentPosts.forEach(post => {
      activities.push({
        type: 'post_created',
        message: `${post.author?.username || 'User'} created post "${post.title}"`,
        timestamp: post.createdAt,
        metadata: { postId: post.id, authorId: post.authorId },
      });
    });

    // Add comment creations
    recentComments.forEach(comment => {
      activities.push({
        type: 'comment_created',
        message: `${comment.author?.username || 'User'} commented on "${comment.post?.title || 'a post'}"`,
        timestamp: comment.createdAt,
        metadata: { commentId: comment.id, postId: comment.postId },
      });
    });

    // Add reports
    recentReports.forEach(report => {
      activities.push({
        type: 'report_created',
        message: `${report.reportedBy?.username || 'User'} reported ${report.type}`,
        timestamp: report.createdAt,
        metadata: { reportId: report.id, reportType: report.type },
      });
    });

    // Sort by timestamp and limit
    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get trend data for charts - showing cumulative data
   */
  async getTrendData(days = 7): Promise<TrendData[]> {
    const trends: TrendData[] = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(23, 59, 59, 999);

      // Get cumulative counts up to each date
      const [users, posts, comments, reports] = await Promise.all([
        this.userRepository.count({
          where: { createdAt: LessThanOrEqual(date) },
        }),
        this.postRepository.count({
          where: { createdAt: LessThanOrEqual(date) },
        }),
        this.commentRepository.count({
          where: { createdAt: LessThanOrEqual(date) },
        }),
        this.reportRepository.count({
          where: { createdAt: LessThanOrEqual(date) },
        }),
      ]);

      trends.push({
        date: date.toISOString().split('T')[0],
        users,
        posts,
        comments,
        reports,
      });
    }

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
   * Get system health metrics
   */
  async getSystemHealth() {
    // This would integrate with actual monitoring systems
    // For now, return mock data
    return {
      status: 'healthy',
      services: {
        database: { status: 'operational', responseTime: 15 },
        cache: { status: 'operational', hitRate: 0.92 },
        storage: { status: 'operational', usage: 0.45 },
      },
      metrics: {
        avgResponseTime: 120, // ms
        errorRate: 0.001, // 0.1%
        uptime: 99.99, // percentage
      },
    };
  }

  // Private helper methods

  private async getDailyActiveUsers(): Promise<number> {
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
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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