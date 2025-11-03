import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Post } from '../../posts/entities/post.entity';
import { PostStats } from '../../posts/entities/post-stats.entity';
import { Blog } from '../../blogs/entities/blog.entity';
import { CacheService, CacheTTL } from '../../cache/cache.service';

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
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 블로그의 카테고리별 포스트 개수 조회
   * @param slug 블로그 slug
   * @returns 카테고리별 포스트 개수 배열
   */
  async getBlogCategoriesWithCount(slug: string): Promise<Array<{ category: string; count: number }>> {
    const cacheKey = `blog:stats:categories:${slug}`;

    // 캐시 확인
    const cached = await this.cacheService.get<Array<{ category: string; count: number }>>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache HIT for blog categories: ${slug}`);
      return cached;
    }

    this.logger.debug(`Cache MISS for blog categories: ${slug}`);

    // 블로그 ID 조회
    const blog = await this.blogRepository.findOne({
      where: { slug },
      select: ['id'],
    });

    if (!blog) {
      return [];
    }

    // 카테고리별 포스트 개수 집계
    const result = await this.postRepository
      .createQueryBuilder('post')
      .select('post.category', 'category')
      .addSelect('COUNT(post.id)', 'count')
      .where('post.blogId = :blogId', { blogId: blog.id })
      .andWhere('post.isDeleted = :isDeleted', { isDeleted: false })
      .groupBy('post.category')
      .orderBy('count', 'DESC')
      .getRawMany();

    // 결과 변환
    const categories = result.map(row => ({
      category: row.category || '미분류',
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
  async getBlogActivityStats(blogId: string, days: number = 30): Promise<{
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
      .createQueryBuilder('post')
      .leftJoin('post.stats', 'stats')
      .where('post.blogId = :blogId', { blogId })
      .andWhere('post.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('post.createdAt >= :startDate', { startDate });

    const result = await queryBuilder
      .select('COUNT(DISTINCT post.id)', 'totalPosts')
      .addSelect('COALESCE(SUM(stats.viewCount), 0)', 'totalViews')
      .addSelect('COALESCE(SUM(stats.likeCount), 0)', 'totalLikes')
      .getRawOne() as {
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
      stats.averageViewsPerPost = Math.round(stats.totalViews / stats.totalPosts);
    }

    // 캐싱 (30분)
    await this.cacheService.set(cacheKey, stats, CacheTTL.EXTRA_LONG);

    return stats;
  }

  /**
   * 블로그 인기 포스트 TOP N
   * @param blogId 블로그 ID
   * @param limit 개수 제한
   * @returns 인기 포스트 목록
   */
  async getBlogPopularPosts(blogId: string, limit: number = 5): Promise<Array<{
    id: string;
    title: string;
    slug: string;
    viewCount: number;
    likesCount: number;
    createdAt: Date;
  }>> {
    const cacheKey = `blog:stats:popular:${blogId}:${limit}`;

    const cached = await this.cacheService.get<Array<{
      id: string;
      title: string;
      slug: string;
      viewCount: number;
      likesCount: number;
      createdAt: Date;
    }>>(cacheKey);
    if (cached) {
      return cached;
    }

    const posts = await this.postRepository
      .createQueryBuilder('post')
      .leftJoin('post.stats', 'stats')
      .select([
        'post.id',
        'post.title',
        'post.slug',
        'stats.viewCount',
        'stats.likesCount',
        'post.createdAt',
      ])
      .where('post.blogId = :blogId', { blogId })
      .andWhere('post.isDeleted = :isDeleted', { isDeleted: false })
      .orderBy('(stats.viewCount + stats.likeCount * 2)', 'DESC')
      .limit(limit)
      .getMany();

    const result = posts.map(post => ({
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
    const patterns = [
      `blog:stats:*`,
      `blog:stats:categories:${slug}`,
      `blog:stats:posts:${blogId}`,
      `blog:stats:activity:${blogId}`,
      `blog:stats:popular:${blogId}`,
    ];

    // 간단히 Redis 패턴 삭제는 복잡하므로, 키들을 직접 관리
    // 실제 프로덕션에서는 Redis SCAN을 사용하거나 별도 캐시 관리 전략 필요
    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        // 패턴 매칭은 구현이 복잡하므로 로깅만
        this.logger.warn(`Cache invalidation pattern not implemented: ${pattern}`);
      } else {
        await this.cacheService.delete(pattern);
      }
    }

    this.logger.debug(`Invalidated blog stats cache: ${blogId}, slug: ${slug}`);
  }
}