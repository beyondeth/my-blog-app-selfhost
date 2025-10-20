/**
 * 캐시 메트릭 서비스
 * @description Redis 캐시 시스템 전용 Prometheus 메트릭 관리
 * Chat/Like 큐 시스템(ChatMetricsService/LikeMetricsService)의 패턴을 그대로 적용
 */

import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  register,
} from 'prom-client';

@Injectable()
export class CacheMetricsService {
  // ========================================
  // Counter 메트릭 (누적 값을 측정)
  // ========================================

  /**
   * 포스트 캐시 히트 카운터
   * 캐시에서 성공적으로 데이터를 가져온 총 횟수
   * type 라벨: core (제목/내용/작성자 등 Core 데이터)
   */
  public readonly postCacheHits: Counter<string>;

  /**
   * 포스트 캐시 미스 카운터
   * 캐시에 데이터가 없어서 DB 조회가 필요했던 총 횟수
   * type 라벨: core
   */
  public readonly postCacheMisses: Counter<string>;

  /**
   * 댓글 캐시 히트 카운터
   * 캐시에서 성공적으로 댓글 트리를 가져온 총 횟수
   */
  public readonly commentsCacheHits: Counter<string>;

  /**
   * 댓글 캐시 미스 카운터
   * 캐시에 댓글 트리가 없어서 DB 조회가 필요했던 총 횟수
   */
  public readonly commentsCacheMisses: Counter<string>;

  /**
   * 캐시 무효화 카운터
   * 캐시가 무효화된 총 횟수
   * type 라벨: post_core, comments_tree
   * reason 라벨: update, delete, create
   */
  public readonly cacheInvalidations: Counter<string>;

  /**
   * 캐시 락 획득 카운터
   * Cache Stampede 방지를 위해 락을 획득한 총 횟수
   * type 라벨: post, comments
   */
  public readonly cacheLockAcquired: Counter<string>;

  /**
   * 캐시 락 대기 카운터
   * 다른 요청이 캐시를 재구축하는 동안 대기한 총 횟수
   * type 라벨: post, comments
   */
  public readonly cacheLockWaited: Counter<string>;

  // ========================================
  // Gauge 메트릭 (현재 값을 측정)
  // ========================================

  /**
   * 포스트 캐시 히트율
   * 실시간 히트율 (hits / (hits + misses))
   * 0.0 ~ 1.0 사이 값
   */
  public readonly postCacheHitRate: Gauge<string>;

  /**
   * 댓글 캐시 히트율
   * 실시간 히트율 (hits / (hits + misses))
   * 0.0 ~ 1.0 사이 값
   */
  public readonly commentsCacheHitRate: Gauge<string>;

  // ========================================
  // Histogram 메트릭 (분포를 측정)
  // ========================================

  /**
   * 캐시 재구축 시간 히스토그램
   * 캐시 미스 발생 시 DB에서 데이터를 가져와 캐시를 재구축하는데 걸린 시간 (초 단위)
   * buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]
   */
  public readonly cacheRebuildDuration: Histogram<string>;

  /**
   * 캐시 락 대기 시간 히스토그램
   * 락 대기 시 실제로 대기한 시간 (초 단위)
   * buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
   */
  public readonly cacheLockWaitDuration: Histogram<string>;

  constructor() {
    // ========================================
    // Counter 메트릭 초기화
    // ========================================

    this.postCacheHits = new Counter({
      name: 'cache_post_hits_total',
      help: '포스트 캐시 히트 총 횟수',
      labelNames: ['type'],
      registers: [register],
    });

    this.postCacheMisses = new Counter({
      name: 'cache_post_misses_total',
      help: '포스트 캐시 미스 총 횟수',
      labelNames: ['type'],
      registers: [register],
    });

    this.commentsCacheHits = new Counter({
      name: 'cache_comments_hits_total',
      help: '댓글 캐시 히트 총 횟수',
      registers: [register],
    });

    this.commentsCacheMisses = new Counter({
      name: 'cache_comments_misses_total',
      help: '댓글 캐시 미스 총 횟수',
      registers: [register],
    });

    this.cacheInvalidations = new Counter({
      name: 'cache_invalidations_total',
      help: '캐시 무효화 총 횟수',
      labelNames: ['type', 'reason'],
      registers: [register],
    });

    this.cacheLockAcquired = new Counter({
      name: 'cache_lock_acquired_total',
      help: 'Cache Stampede 방지 락 획득 총 횟수',
      labelNames: ['type'],
      registers: [register],
    });

    this.cacheLockWaited = new Counter({
      name: 'cache_lock_waited_total',
      help: 'Cache Stampede 방지 락 대기 총 횟수',
      labelNames: ['type'],
      registers: [register],
    });

    // ========================================
    // Gauge 메트릭 초기화
    // ========================================

    this.postCacheHitRate = new Gauge({
      name: 'cache_post_hit_rate',
      help: '포스트 캐시 히트율 (0.0 ~ 1.0)',
      registers: [register],
    });

    this.commentsCacheHitRate = new Gauge({
      name: 'cache_comments_hit_rate',
      help: '댓글 캐시 히트율 (0.0 ~ 1.0)',
      registers: [register],
    });

    // ========================================
    // Histogram 메트릭 초기화
    // ========================================

    this.cacheRebuildDuration = new Histogram({
      name: 'cache_rebuild_duration_seconds',
      help: '캐시 재구축 시간 (초)',
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      labelNames: ['type'],
      registers: [register],
    });

    this.cacheLockWaitDuration = new Histogram({
      name: 'cache_lock_wait_duration_seconds',
      help: '캐시 락 대기 시간 (초)',
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      labelNames: ['type'],
      registers: [register],
    });

    // 초기값 설정
    this.initializeMetrics();
  }

  /**
   * 메트릭 초기화
   * 서비스 시작 시 모든 메트릭을 0으로 설정
   */
  private initializeMetrics() {
    // Counter 메트릭 초기화 (Prometheus에 즉시 노출하기 위해)
    // 초기값 0으로 설정하여 Grafana에서 "No data" 방지
    this.postCacheHits.inc({ type: 'core' }, 0);
    this.postCacheMisses.inc({ type: 'core' }, 0);
    this.commentsCacheHits.inc(0);
    this.commentsCacheMisses.inc(0);
    this.cacheInvalidations.inc({ type: 'post_core', reason: 'update' }, 0);
    this.cacheInvalidations.inc({ type: 'comments_tree', reason: 'create' }, 0);
    this.cacheLockAcquired.inc({ type: 'post' }, 0);
    this.cacheLockAcquired.inc({ type: 'comments' }, 0);
    this.cacheLockWaited.inc({ type: 'post' }, 0);
    this.cacheLockWaited.inc({ type: 'comments' }, 0);

    // Gauge 메트릭 초기화
    this.postCacheHitRate.set(0);
    this.commentsCacheHitRate.set(0);
  }

  // ========================================
  // 메트릭 업데이트 메서드
  // ========================================

  /**
   * 포스트 캐시 히트 기록
   * 캐시에서 데이터를 성공적으로 가져왔을 때 호출
   */
  recordPostCacheHit() {
    this.postCacheHits.inc({ type: 'core' });
    this.updatePostCacheHitRate();
  }

  /**
   * 포스트 캐시 미스 기록
   * 캐시에 데이터가 없어서 DB 조회가 필요할 때 호출
   */
  recordPostCacheMiss() {
    this.postCacheMisses.inc({ type: 'core' });
    this.updatePostCacheHitRate();
  }

  /**
   * 댓글 캐시 히트 기록
   * 캐시에서 댓글 트리를 성공적으로 가져왔을 때 호출
   */
  recordCommentsCacheHit() {
    this.commentsCacheHits.inc();
    this.updateCommentsCacheHitRate();
  }

  /**
   * 댓글 캐시 미스 기록
   * 캐시에 댓글 트리가 없어서 DB 조회가 필요할 때 호출
   */
  recordCommentsCacheMiss() {
    this.commentsCacheMisses.inc();
    this.updateCommentsCacheHitRate();
  }

  /**
   * 캐시 무효화 기록
   *
   * @param type - 캐시 타입 (post_core, comments_tree)
   * @param reason - 무효화 이유 (update, delete, create)
   */
  recordCacheInvalidation(type: string, reason: string) {
    this.cacheInvalidations.inc({ type, reason });
  }

  /**
   * 캐시 락 획득 기록
   * Cache Stampede 방지를 위해 락을 획득했을 때 호출
   *
   * @param type - 캐시 타입 (post, comments)
   */
  recordCacheLockAcquired(type: string) {
    this.cacheLockAcquired.inc({ type });
  }

  /**
   * 캐시 락 대기 기록
   * 다른 요청이 캐시를 재구축하는 동안 대기했을 때 호출
   *
   * @param type - 캐시 타입 (post, comments)
   * @param waitTimeMs - 대기 시간 (밀리초)
   */
  recordCacheLockWaited(type: string, waitTimeMs: number) {
    this.cacheLockWaited.inc({ type });
    this.cacheLockWaitDuration.observe({ type }, waitTimeMs / 1000);
  }

  /**
   * 캐시 재구축 시간 기록
   * 캐시 미스 발생 시 DB에서 데이터를 가져와 캐시를 재구축하는데 걸린 시간 기록
   *
   * @param type - 캐시 타입 (post, comments)
   * @param durationMs - 재구축 시간 (밀리초)
   */
  recordCacheRebuildDuration(type: string, durationMs: number) {
    this.cacheRebuildDuration.observe({ type }, durationMs / 1000);
  }

  /**
   * 포스트 캐시 히트율 업데이트
   * 히트율 = hits / (hits + misses)
   */
  private async updatePostCacheHitRate() {
    try {
      const metrics = await register.getMetricsAsJSON();
      const hitsMetric = metrics.find((m: any) => m.name === 'cache_post_hits_total');
      const missesMetric = metrics.find((m: any) => m.name === 'cache_post_misses_total');

      if (hitsMetric && missesMetric && hitsMetric.values && missesMetric.values) {
        const hits = hitsMetric.values.find((v: any) => v.labels?.type === 'core')?.value || 0;
        const misses = missesMetric.values.find((v: any) => v.labels?.type === 'core')?.value || 0;
        const total = hits + misses;

        if (total > 0) {
          this.postCacheHitRate.set(hits / total);
        }
      }
    } catch (error) {
      // 에러 발생 시 무시 (메트릭 업데이트 실패는 치명적이지 않음)
    }
  }

  /**
   * 댓글 캐시 히트율 업데이트
   * 히트율 = hits / (hits + misses)
   */
  private async updateCommentsCacheHitRate() {
    try {
      const metrics = await register.getMetricsAsJSON();
      const hitsMetric = metrics.find((m: any) => m.name === 'cache_comments_hits_total');
      const missesMetric = metrics.find((m: any) => m.name === 'cache_comments_misses_total');

      if (hitsMetric && missesMetric && hitsMetric.values && missesMetric.values) {
        const hits = hitsMetric.values[0]?.value || 0;
        const misses = missesMetric.values[0]?.value || 0;
        const total = hits + misses;

        if (total > 0) {
          this.commentsCacheHitRate.set(hits / total);
        }
      }
    } catch (error) {
      // 에러 발생 시 무시 (메트릭 업데이트 실패는 치명적이지 않음)
    }
  }
}
