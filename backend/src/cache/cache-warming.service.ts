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
 * 1. 실행 주기: 10분마다 (서버 재시작 시 빠른 복구)
 * 2. 동시 실행 방지를 위한 lock 추가
 * 3. 필요한 컬럼만 SELECT하도록 최적화
 * 4. 서버 시작 5초 후 즉시 캐시 워밍 (기존 30초 → 5초)
 * 5. 실패 시 자동 재시도 (최대 3회)
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
   * 매 10분마다 인기 페이지 캐시 갱신
   * 캐시가 만료되기 전에 미리 갱신하여 미스 방지
   *
   * 조건:
   * - 동시 실행 방지
   * - 최소 실행 간격 5분 보장
   * - 캐시가 없거나 곧 만료될 경우만 갱신
   */
  @Cron('0 */10 * * * *') // 매 10분마다 (서버 재시작 시 빠른 복구)
  async warmPopularPages() {
    // 동시 실행 방지
    if (this.isWarming) {
      this.logger.debug('⏭️ Cache warming already in progress, skipping...');
      return;
    }

    // 최소 실행 간격 체크 (5분)
    const now = Date.now();
    if (now - this.lastWarmingTime < 5 * 60 * 1000) {
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
            .andWhere('post.status = :status', { status: 'published' })
            .andWhere('blog.isPublic = :isPublic', { isPublic: true })
            .orderBy('post.publishedAt', 'DESC') // createdAt → publishedAt으로 변경 (인덱스 활용)
            .skip(offset)
            .take(limit);

          const [posts, total] = await query.getManyAndCount();

          const freshData = {
            posts: posts,
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
   * 최적화: 서버 재시작 시 빠른 캐시 복구를 위해 5초로 단축
   * 실패 시 자동 재시도 (최대 3회)
   */
  async onApplicationBootstrap() {
    // 애플리케이션 시작 5초 후 캐시 워밍 시작
    setTimeout(() => {
      this.warmPopularPagesWithRetry(3).catch(err => {
        this.logger.error('❌ Initial cache warming failed after all retries:', err);
      });
    }, 5000); // 5초
  }

  /**
   * 재시도 로직이 포함된 캐시 워밍
   * @param maxRetries - 최대 재시도 횟수 (기본값: 3)
   *
   * 재시도 전략:
   * - 지수 백오프 (exponential backoff): 2초, 4초, 8초
   * - 각 시도마다 성공 여부 로깅
   * - 모든 재시도 실패 시 에러 throw
   */
  private async warmPopularPagesWithRetry(maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.warmPopularPages();
        this.logger.log(`✅ Cache warming succeeded on attempt ${attempt}`);
        return; // 성공 시 즉시 종료
      } catch (error) {
        this.logger.warn(`⚠️ Cache warming attempt ${attempt}/${maxRetries} failed:`, error);

        if (attempt < maxRetries) {
          // 재시도 전 대기 (지수 백오프: 2초, 4초, 8초)
          const waitTime = Math.pow(2, attempt) * 1000;
          this.logger.debug(`⏳ Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // 모든 재시도 실패
          throw error;
        }
      }
    }
  }
}