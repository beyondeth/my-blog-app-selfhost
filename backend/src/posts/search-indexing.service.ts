import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import { Post } from "./entities/post.entity";
import { Cron } from "@nestjs/schedule";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";
import { UnifiedRedisService } from "../redis/unified-redis.service";

/**
 * 검색 인덱싱 배치 처리 서비스
 * @description
 * - 포스트 저장 시 트리거 대신 배치로 검색 인덱스 생성
 * - 30분마다 실행되어 인덱싱 안 된 포스트를 처리
 * - Redis 락으로 중복 실행 방지
 * - content 제외하여 인덱싱 성능 최적화
 */
@Injectable()
export class SearchIndexingService {
  private readonly logger = new Logger(SearchIndexingService.name);
  private readonly LOCK_KEY = "search:indexing:lock";
  private readonly LOCK_TTL = 1800000; // 30분 (밀리초)
  private readonly BATCH_SIZE = 100; // 한 번에 처리할 포스트 수
  private isRunning = false;

  constructor(
    @InjectRepository(Post)
    private postsRepository: Repository<Post>,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly unifiedRedisService: UnifiedRedisService,
  ) {}

  /**
   * 30분마다 실행되는 크론 작업
   * 인덱싱 안 된 포스트를 찾아서 배치로 처리
   */
  @Cron("0 */30 * * * *") // 매 30분마다 (정시와 30분)
  async handleCron() {
    await this.indexPendingPosts();
  }

  /**
   * 수동 실행용 메서드 (테스트나 즉시 실행이 필요할 때)
   */
  async indexPendingPosts(): Promise<void> {
    // 이미 실행 중이면 스킵
    if (this.isRunning) {
      this.logger.warn("이전 인덱싱이 아직 실행 중입니다. 스킵합니다.");
      return;
    }

    try {
      // Redis 락 획득
      const lockAcquired = await this.acquireLock();
      if (!lockAcquired) {
        this.logger.log("다른 인스턴스가 인덱싱 중입니다. 스킵합니다.");
        return;
      }

      this.isRunning = true;
      const startTime = Date.now();

      // 메트릭 수집
      const unindexedCount = await this.countUnindexedPosts();
      if (unindexedCount === 0) {
        this.logger.debug("인덱싱할 포스트가 없습니다.");
        return;
      }

      this.logger.log(
        `🔄 검색 인덱싱 시작: ${unindexedCount}개 포스트 대기 중`,
      );

      // 배치로 처리
      let totalProcessed = 0;
      while (totalProcessed < unindexedCount) {
        const posts = await this.findUnindexedPosts(this.BATCH_SIZE);
        if (posts.length === 0) break;

        await this.batchUpdateSearchVectors(posts);
        totalProcessed += posts.length;

        this.logger.log(`   처리 완료: ${totalProcessed}/${unindexedCount}`);
      }

      const elapsedTime = Date.now() - startTime;
      this.logger.log(
        `✅ 검색 인덱싱 완료: ${totalProcessed}개 처리 (${elapsedTime}ms)`,
      );

      // 인덱싱 메트릭 로깅
      await this.logIndexingMetrics();
    } catch (error) {
      this.logger.error("검색 인덱싱 실패:", error);
      throw error;
    } finally {
      this.isRunning = false;
      await this.releaseLock();
    }
  }

  /**
   * 인덱싱 안 된 포스트 찾기
   */
  private async findUnindexedPosts(limit: number): Promise<Post[]> {
    return this.postsRepository
      .createQueryBuilder("post")
      .innerJoin("post.blog", "blog")
      .where("post.indexedAt IS NULL")
      .andWhere("post.isPublished = true")
      .andWhere("post.status = :status", { status: "published" })
      .andWhere("post.isDeleted = false")
      .andWhere("post.visibility = :postVisibility", { postVisibility: "public" })
      .andWhere("blog.isPublic = true")
      .orderBy("post.createdAt", "ASC")
      .take(limit)
      .select(["post.id", "post.title", "post.excerpt", "post.tags"])
      .getMany();
  }

  /**
   * 인덱싱 안 된 포스트 개수 확인
   */
  private async countUnindexedPosts(): Promise<number> {
    return this.postsRepository
      .createQueryBuilder("post")
      .innerJoin("post.blog", "blog")
      .where("post.indexedAt IS NULL")
      .andWhere("post.isPublished = true")
      .andWhere("post.status = :status", { status: "published" })
      .andWhere("post.isDeleted = false")
      .andWhere("post.visibility = :postVisibility", { postVisibility: "public" })
      .andWhere("blog.isPublic = true")
      .getCount();
  }

  /**
   * 배치로 search_vector 업데이트
   * content를 제외하여 성능 최적화
   */
  private async batchUpdateSearchVectors(posts: Post[]): Promise<void> {
    if (posts.length === 0) return;

    const postIds = posts.map((p) => p.id);

    // PostgreSQL의 tsvector 생성 (content 제외)
    const query = `
      UPDATE "posts"
      SET
        "search_vector" =
          setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
          setweight(to_tsvector('simple', COALESCE(excerpt, '')), 'B') ||
          setweight(to_tsvector('simple', COALESCE("tags"::text, '')), 'C'),
        "indexed_at" = NOW()
      WHERE
        id = ANY($1::uuid[])
        AND "indexed_at" IS NULL
    `;

    try {
      const result = await this.postsRepository.query(query, [postIds]);
      this.logger.debug(`배치 업데이트 완료: ${result[1]}개 포스트`);
    } catch (error) {
      this.logger.error("배치 업데이트 실패:", error);
      throw error;
    }
  }

  /**
   * Redis 락 획득
   * 중복 실행 방지를 위해 분산 락 사용
   */
  private async acquireLock(): Promise<boolean> {
    try {
      const lockAcquired = await this.unifiedRedisService.acquireLock(
        "search-indexing",
        this.LOCK_TTL / 1000, // 초 단위로 변환
      );
      return lockAcquired;
    } catch (error) {
      this.logger.error("락 획득 실패:", error);
      return false;
    }
  }

  /**
   * Redis 락 해제
   */
  private async releaseLock(): Promise<void> {
    try {
      await this.unifiedRedisService.releaseLock("search-indexing");
    } catch (error) {
      this.logger.error("락 해제 실패:", error);
    }
  }

  /**
   * 인덱싱 메트릭 로깅
   */
  private async logIndexingMetrics(): Promise<void> {
    try {
      // 인덱싱 안 된 포스트 수
      const unindexedCount = await this.countUnindexedPosts();

      // 평균 인덱싱 지연 시간
      const avgDelayResult = await this.postsRepository.query(`
        SELECT
          AVG(EXTRACT(EPOCH FROM (NOW() - p."createdAt"))) as avg_delay_seconds
        FROM "posts" p
        INNER JOIN "blogs" b ON b.id = p."blogId" AND b."isPublic" = true
        WHERE
          p."indexed_at" IS NULL
          AND p."isPublished" = true
          AND p."status" = 'published'
          AND p."isDeleted" = false
          AND p."visibility" = 'public'
      `);

      const avgDelaySeconds = avgDelayResult[0]?.avg_delay_seconds || 0;
      const avgDelayMinutes = Math.round(avgDelaySeconds / 60);

      // 총 인덱싱된 포스트 수
      const indexedCount = await this.postsRepository.count({
        where: {
          indexedAt: Not(IsNull()),
        },
      });

      this.logger.log(`📊 인덱싱 메트릭:`);
      this.logger.log(`   - 인덱싱 대기: ${unindexedCount}개`);
      this.logger.log(`   - 평균 지연: ${avgDelayMinutes}분`);
      this.logger.log(`   - 총 인덱싱됨: ${indexedCount}개`);

      // Redis에 메트릭 저장 (모니터링용)
      await this.redis.hset("search:metrics", {
        unindexedCount: unindexedCount.toString(),
        avgDelayMinutes: avgDelayMinutes.toString(),
        indexedCount: indexedCount.toString(),
        lastRun: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error("메트릭 로깅 실패:", error);
    }
  }

  /**
   * 강제 인덱싱 (관리자용)
   * 특정 포스트를 즉시 인덱싱
   */
  async forceIndexPost(postId: string): Promise<void> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      select: ["id", "title", "excerpt", "tags"],
    });

    if (!post) {
      throw new Error(`포스트를 찾을 수 없습니다: ${postId}`);
    }

    await this.batchUpdateSearchVectors([post]);
    this.logger.log(`포스트 ${postId} 강제 인덱싱 완료`);
  }

  /**
   * 모든 포스트 재인덱싱 (관리자용)
   * 주의: 시스템 부하가 크므로 오프피크 시간에만 실행
   */
  async reindexAll(): Promise<void> {
    this.logger.warn("⚠️  모든 포스트 재인덱싱 시작 - 시스템 부하 주의!");

    // indexed_at을 모두 null로 리셋 (Worker 처리 완료된 포스트만)
    await this.postsRepository.update(
      {
        isPublished: true,
        status: "published",
      },
      { indexedAt: null },
    );

    // 배치 인덱싱 실행
    await this.indexPendingPosts();
  }
}
