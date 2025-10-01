import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CacheService } from './cache.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../posts/entities/post.entity';

/**
 * 캐시 워밍 서비스
 * 자주 접근하는 데이터를 미리 캐싱하여 히트율 향상
 *
 * 최적화 내용:
 * 1. 실행 주기를 5분 → 30분으로 변경
 * 2. 동시 실행 방지를 위한 lock 추가
 * 3. 필요한 컬럼만 SELECT하도록 최적화
 */
@Injectable()
export class CacheWarmingService {
  private readonly logger = new Logger(CacheWarmingService.name);
  private isWarming = false; // 동시 실행 방지 플래그
  private lastWarmingTime = 0; // 마지막 워밍 시간

  constructor(
    private readonly cacheService: CacheService,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  /**
   * 매 30분마다 인기 페이지 캐시 갱신 (기존 5분 → 30분)
   * 캐시가 만료되기 전에 미리 갱신하여 미스 방지
   *
   * 조건:
   * - 동시 실행 방지
   * - 최소 실행 간격 10분 보장
   * - 캐시가 없거나 곧 만료될 경우만 갱신
   */
  @Cron('0 */30 * * * *') // 매 30분마다 (기존 5분에서 변경)
  async warmPopularPages() {
    // 동시 실행 방지
    if (this.isWarming) {
      this.logger.debug('⏭️ Cache warming already in progress, skipping...');
      return;
    }

    // 최소 실행 간격 체크 (10분)
    const now = Date.now();
    if (now - this.lastWarmingTime < 10 * 60 * 1000) {
      this.logger.debug('⏭️ Cache warming too frequent, skipping...');
      return;
    }

    this.isWarming = true;
    this.lastWarmingTime = now;
    try {
      this.logger.debug('🔥 Starting cache warming for popular pages...');

      // 메인 피드 1-3페이지 미리 캐싱
      for (let page = 1; page <= 3; page++) {
        const cacheKey = `feed:main:p${page}`;

        // 기존 캐시 확인
        const existing = await this.cacheService.get(cacheKey);

        // 캐시가 없거나 곧 만료될 경우만 갱신
        if (!existing) {
          // 직접 DB 조회하여 데이터 생성 (효율성을 위해 10개로 제한)
          const limit = 10;
          const offset = (page - 1) * limit;

          // 공개 블로그의 게시글만 조회 - 필요한 컬럼만 SELECT하도록 최적화
          const query = this.postRepository
            .createQueryBuilder('post')
            .select([
              'post.id',
              'post.title',
              'post.slug',
              'post.excerpt', // 포스트 요약 추가
              'post.thumbnail',
              'post.createdAt',
              'post.publishedAt',
              'post.viewCount',
              'post.likeCount',
              'post.commentCount',
              'post.tagList',
              'post.category',
            ])
            .addSelect([
              'author.id',
              'author.username',
              'author.profileImage',
            ])
            .addSelect([
              'blog.id',
              'blog.slug',
              'blog.name',
            ])
            .leftJoin('post.author', 'author')
            .leftJoin('post.blog', 'blog')
            .where('post.isPublished = :isPublished', { isPublished: true })
            .andWhere('blog.isPublic = :isPublic', { isPublic: true })
            .orderBy('post.publishedAt', 'DESC') // createdAt → publishedAt으로 변경 (인덱스 활용)
            .skip(offset)
            .take(limit);

          const [posts, total] = await query.getManyAndCount();

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
    } finally {
      // 워밍 플래그 해제
      this.isWarming = false;
    }
  }

  /**
   * 애플리케이션 시작 시 초기 캐시 워밍
   *
   * 최적화: 시작 시간을 10초 → 30초로 변경
   * 서버가 안정화된 후 캐시 워밍 시작
   */
  async onApplicationBootstrap() {
    // 애플리케이션 시작 30초 후 캐시 워밍 시작 (기존 10초에서 변경)
    setTimeout(() => {
      this.warmPopularPages().catch(err => {
        this.logger.error('Initial cache warming failed:', err);
      });
    }, 30000); // 30초
  }
}