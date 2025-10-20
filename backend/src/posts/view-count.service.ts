import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { Cron } from '@nestjs/schedule';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class ViewCountService {
  private readonly logger = new Logger(ViewCountService.name);
  private viewCounts = new Map<string, number>();
  private lastUpdate = new Date();

  constructor(
    @InjectRepository(Post)
    private postsRepository: Repository<Post>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 조회수 증가 (메모리에 임시 저장)
   */
  async incrementViewCount(postId: string): Promise<void> {
    const currentCount = this.viewCounts.get(postId) || 0;
    this.viewCounts.set(postId, currentCount + 1);
    
    // 임계값에 도달하면 즉시 플러시 (100 views)
    if (currentCount + 1 >= 100) {
      await this.flushViewCount(postId);
    }
  }

  /**
   * 특정 포스트의 조회수를 DB에 반영
   */
  private async flushViewCount(postId: string): Promise<void> {
    const count = this.viewCounts.get(postId);
    if (!count) return;

    try {
      await this.postsRepository
        .createQueryBuilder()
        .update(Post)
        .set({ viewCount: () => `"viewCount" + ${count}` })
        .where('id = :id', { id: postId })
        .execute();

      this.viewCounts.delete(postId);
      this.logger.log(`Flushed ${count} views for post ${postId}`);
    } catch (error) {
      this.logger.error(`Failed to flush view count for post ${postId}:`, error);
    }
  }

  /**
   * 인기 포스트 캐시 무효화
   * @description 조회수 변경으로 인기 순위가 달라질 수 있으므로 인기 포스트 캐시 무효화
   */
  private async invalidatePopularPostsCache(): Promise<void> {
    const popularPeriods = ['daily', 'weekly', 'monthly'];
    const limits = [5, 10];

    try {
      const invalidationPromises = [];

      for (const period of popularPeriods) {
        for (const limit of limits) {
          const cacheKey = `popular:posts:${period}:${limit}`;
          invalidationPromises.push(
            this.cacheService.delete(cacheKey).catch(err => {
              this.logger.error(`Failed to invalidate cache key ${cacheKey}:`, err);
            })
          );
        }
      }

      await Promise.all(invalidationPromises);
      this.logger.log('✅ Invalidated popular posts cache after view count update');
    } catch (error) {
      this.logger.error('❌ Failed to invalidate popular posts cache:', error);
    }
  }

  /**
   * 모든 조회수를 DB에 반영
   */
  async flushAllViewCounts(): Promise<void> {
    if (this.viewCounts.size === 0) return;

    const entries = Array.from(this.viewCounts.entries());
    this.logger.log(`Flushing ${entries.length} posts with view count updates`);

    // 배치 업데이트를 위해 트랜잭션 사용
    const queryRunner = this.postsRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const [postId, count] of entries) {
        await queryRunner.manager
          .createQueryBuilder()
          .update(Post)
          .set({ viewCount: () => `"viewCount" + ${count}` })
          .where('id = :id', { id: postId })
          .execute();
      }

      await queryRunner.commitTransaction();
      this.viewCounts.clear();
      this.lastUpdate = new Date();

      const totalViews = entries.reduce((sum, [, count]) => sum + count, 0);
      this.logger.log(`Successfully flushed ${totalViews} total views across ${entries.length} posts`);

      // 조회수 업데이트 후 인기 포스트 캐시 무효화
      // 인기 순위 산정에 viewCount가 포함되므로 무효화 필요
      await this.invalidatePopularPostsCache();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to flush view counts:', error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 매 5분마다 조회수 배치 업데이트
   */
  @Cron('*/5 * * * *')
  async handleCron() {
    await this.flushAllViewCounts();
  }

  /**
   * 애플리케이션 종료 시 남은 조회수 플러시
   */
  async onApplicationShutdown() {
    this.logger.log('Application shutting down, flushing remaining view counts...');
    await this.flushAllViewCounts();
  }

  /**
   * 현재 메모리에 있는 조회수 상태 조회 (디버깅용)
   */
  getViewCountStats() {
    const stats = {
      postsWithPendingViews: this.viewCounts.size,
      totalPendingViews: Array.from(this.viewCounts.values()).reduce((sum, count) => sum + count, 0),
      lastUpdate: this.lastUpdate,
      topPosts: Array.from(this.viewCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([postId, count]) => ({ postId, pendingViews: count })),
    };
    return stats;
  }
}