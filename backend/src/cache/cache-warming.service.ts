import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CacheService } from './cache.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../posts/entities/post.entity';

/**
 * 캐시 워밍 서비스
 * 자주 접근하는 데이터를 미리 캐싱하여 히트율 향상
 */
@Injectable()
export class CacheWarmingService {
  private readonly logger = new Logger(CacheWarmingService.name);

  constructor(
    private readonly cacheService: CacheService,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  /**
   * 매 5분마다 인기 페이지 캐시 갱신
   * 캐시가 만료되기 전에 미리 갱신하여 미스 방지
   */
  @Cron('0 */5 * * * *') // 매 5분마다
  async warmPopularPages() {
    try {
      this.logger.debug('🔥 Starting cache warming for popular pages...');

      // 메인 피드 1-3페이지 미리 캐싱
      for (let page = 1; page <= 3; page++) {
        const cacheKey = `feed:main:p${page}`;

        // 기존 캐시 확인
        const existing = await this.cacheService.get(cacheKey);

        // 캐시가 없거나 곧 만료될 경우만 갱신
        if (!existing) {
          // 직접 DB 조회하여 데이터 생성
          const limit = 10;
          const offset = (page - 1) * limit;

          const [posts, total] = await this.postRepository.findAndCount({
            where: { isPublished: true },
            relations: ['author', 'blog'],
            order: { createdAt: 'DESC' },
            skip: offset,
            take: limit,
          });

          const freshData = {
            items: posts,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          };

          // TTL 설정: 1페이지는 10분, 나머지는 30분
          const ttl = page === 1 ? 600 : 1800;
          await this.cacheService.set(cacheKey, freshData, ttl);

          this.logger.debug(`✅ Warmed cache for page ${page}`);
        }
      }

      this.logger.debug('🔥 Cache warming completed');
    } catch (error) {
      this.logger.error('❌ Cache warming failed:', error);
    }
  }

  /**
   * 애플리케이션 시작 시 초기 캐시 워밍
   */
  async onApplicationBootstrap() {
    // 애플리케이션 시작 10초 후 캐시 워밍 시작
    setTimeout(() => {
      this.warmPopularPages().catch(err => {
        this.logger.error('Initial cache warming failed:', err);
      });
    }, 10000);
  }
}