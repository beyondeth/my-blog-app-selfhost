import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { LikeQueueService } from '../services/like-queue.service';
import { PostsService } from '../posts.service';
import { LikeMetricsService } from '../../metrics/like-metrics.service';
import {
  LikeBatchConfig,
  DEFAULT_LIKE_BATCH_CONFIG,
} from '../interfaces/like-batch-config.interface';
import {
  QueuedLike,
  LikeBatchResult,
  LikeQueueMetrics,
} from '../interfaces/like-queue.interface';

/**
 * 좋아요 배치 처리 워커
 * Chat 모듈의 MessageBatchWorker 패턴을 재사용
 *
 * 핵심 기능:
 * 1. 500ms마다 큐 확인 (시간 기반 트리거)
 * 2. 1개든 100개든 배치로 처리
 * 3. 실패 시 자동 재시도 + DLQ
 * 4. 모듈 종료 시 남은 요청 처리
 */
@Injectable()
export class LikeBatchWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LikeBatchWorker.name);
  private readonly config: LikeBatchConfig;
  private isProcessing = false;
  private intervalHandle: NodeJS.Timeout;
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 5;

  constructor(
    private readonly queueService: LikeQueueService,
    private readonly postsService: PostsService,
    private readonly metricsService: LikeMetricsService,
  ) {
    this.config = DEFAULT_LIKE_BATCH_CONFIG;
  }

  async onModuleInit() {
    this.logger.log('LikeBatchWorker 초기화');

    // 배치 처리 인터벌 시작
    this.startBatchProcessing();

    // 이전 세션에서 남은 요청 처리
    await this.processInitialQueue();
  }

  async onModuleDestroy() {
    this.logger.log('LikeBatchWorker 종료 중');

    // 인터벌 중지
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }

    // 종료 전 남은 요청 처리
    await this.processBatch();
  }

  /**
   * 배치 처리 인터벌 시작
   */
  private startBatchProcessing() {
    this.intervalHandle = setInterval(async () => {
      await this.processBatch();
    }, this.config.batchInterval);

    this.logger.log(
      `배치 처리 시작: ${this.config.batchInterval}ms 간격, 최대 ${this.config.batchSize}개씩 처리`,
    );
  }

  /**
   * 초기 큐 처리 (서버 재시작 시)
   */
  private async processInitialQueue() {
    try {
      const metrics = await this.queueService.getMetrics();

      // Redis 연결 성공 → 메트릭 업데이트
      this.metricsService.updateRedisConnectionStatus(true);

      // Prometheus 메트릭 업데이트
      this.metricsService.updateQueueMetrics(metrics.queueSize, metrics.dlqSize);

      if (metrics.queueSize > 0) {
        this.logger.log(
          `이전 세션에서 ${metrics.queueSize}개 좋아요 요청 발견`,
        );
        await this.processBatch();
      }

      if (metrics.dlqSize > 0) {
        this.logger.warn(`DLQ에 ${metrics.dlqSize}개 실패 요청 존재`);
        await this.recoverDeadLetterQueue();
      }
    } catch (error) {
      this.logger.error('초기 큐 처리 실패:', error);
      // Redis 연결 실패
      this.metricsService.updateRedisConnectionStatus(false);
    }
  }

  /**
   * 메인 배치 처리 함수
   *
   * 동작:
   * 1. 큐에서 요청 가져오기 (최대 100개)
   * 2. PostsService.processBatchLikes() 호출
   * 3. 성공 시 메트릭 업데이트
   * 4. 실패 시 DLQ로 이동 + 재시도
   */
  async processBatch(): Promise<LikeBatchResult> {
    // 동시 처리 방지
    if (this.isProcessing) {
      this.logger.debug('배치 처리 중 - 건너뜀');
      return {
        success: false,
        processedCount: 0,
        failedCount: 0,
        processingTime: 0,
        error: '이미 처리 중',
      };
    }

    this.isProcessing = true;
    const startTime = Date.now();

    // Prometheus 메트릭: 처리 시작
    this.metricsService.startBatchProcessing();

    try {
      // 1. 큐에서 좋아요 요청 가져오기
      const likes = await this.queueService.dequeueLikes(
        this.config.batchSize,
      );

      // Redis 연결 성공 (큐에서 데이터 가져오기 성공)
      this.metricsService.updateRedisConnectionStatus(true);

      if (likes.length === 0) {
        const processingTime = Date.now() - startTime;

        // Prometheus 메트릭: 처리 완료 (빈 배치)
        this.metricsService.endBatchProcessing(processingTime, 0, 0, 0);

        return {
          success: true,
          processedCount: 0,
          failedCount: 0,
          processingTime,
        };
      }

      this.logger.debug(`${likes.length}개 좋아요 요청 배치 처리 시작`);

      // 2. 지연 시간 계산 및 Prometheus 메트릭 기록
      likes.forEach((like) => {
        if (like.queuedAt) {
          const latency = Date.now() - new Date(like.queuedAt).getTime();

          // Prometheus 메트릭: 지연 시간 기록
          this.metricsService.recordLikeLatency(latency);

          if (latency > 1000) {
            // 1초 이상 지연 시 경고
            this.logger.warn(
              `좋아요 요청 지연: ${latency}ms (post: ${like.postId})`,
            );
          }
        }
      });

      // 3. DB에 배치 처리
      try {
        const processedCount =
          await this.postsService.processBatchLikes(likes);

        // 4. 처리 완료된 데이터 정리
        await this.queueService.clearProcessedLikes(likes.map((l) => l.id));

        // 5. 메트릭 업데이트
        const processingTime = Date.now() - startTime;
        await this.queueService.updateMetrics(processedCount, processingTime);

        // Prometheus 메트릭: 처리 완료 (성공)
        this.metricsService.endBatchProcessing(
          processingTime,
          processedCount,
          0,
          likes.length,
        );

        // 큐 크기 업데이트
        const metrics = await this.queueService.getMetrics();
        this.metricsService.updateQueueMetrics(metrics.queueSize, metrics.dlqSize);

        // 연속 실패 카운터 리셋
        this.consecutiveFailures = 0;
        this.metricsService.updateConsecutiveFailures(0);

        this.logger.log(
          `✅ ${processedCount}개 좋아요 처리 완료 (${processingTime}ms)`,
        );

        return {
          success: true,
          processedCount,
          failedCount: 0,
          processingTime,
        };
      } catch (dbError) {
        // FK 위반 오류 특별 처리
        if (dbError instanceof QueryFailedError &&
            dbError.message.includes('violates foreign key constraint')) {

          // FK 위반 로깅 및 메트릭
          this.logger.warn(
            `⚠️ [FK Violation] ${likes.length}개 좋아요 요청에 유효하지 않은 postId 포함됨`,
            {
              error: dbError.message,
              samplePostIds: likes.slice(0, 3).map(l => l.postId),
              totalInvalidLikes: likes.length
            }
          );

          // FK 위반 항목만 DLQ로 이동 (전체 배치가 아닌 개별 처리)
          if (this.config.dlqEnabled) {
            await this.queueService.moveToDeadLetterQueue(likes);
          }

          // FK 위반은 연속 실패로 간주하지 않음 (데이터 정합성 문제, 서버 오류 아님)
          // 이렇게 하면 서비스 계속 운영 가능
          const processingTime = Date.now() - startTime;

          // Prometheus 메트릭: FK 위반 기록
          this.metricsService.recordForeignKeyViolation(likes.length);

          // 큐 크기 업데이트
          const metrics = await this.queueService.getMetrics();
          this.metricsService.updateQueueMetrics(metrics.queueSize, metrics.dlqSize);

          return {
            success: false,
            processedCount: 0,
            failedCount: likes.length,
            failedLikes: likes,
            processingTime,
            error: `Foreign Key Violation: ${likes.length} likes with invalid postIds`,
          };
        }

        // 기타 DB 오류 처리
        this.logger.error('DB 처리 실패:', dbError);

        // DLQ로 이동
        if (this.config.dlqEnabled) {
          await this.queueService.moveToDeadLetterQueue(likes);
        } else {
          // DLQ 비활성화 시 재큐잉
          for (const like of likes) {
            await this.queueService.queueLike(
              like.postId,
              like.userId,
              like.action,
            );
          }
        }

        // 연속 실패 카운트 증가
        this.consecutiveFailures++;
        this.metricsService.updateConsecutiveFailures(this.consecutiveFailures);

        // 연속 실패가 너무 많으면 처리 일시 중지
        if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          this.logger.error(
            `${this.MAX_CONSECUTIVE_FAILURES}회 연속 실패 - 배치 처리 일시 중지`,
          );
          clearInterval(this.intervalHandle);
        }

        const processingTime = Date.now() - startTime;

        // Prometheus 메트릭: 처리 완료 (실패)
        this.metricsService.endBatchProcessing(
          processingTime,
          0,
          likes.length,
          likes.length,
        );

        // 큐 크기 업데이트
        const metrics = await this.queueService.getMetrics();
        this.metricsService.updateQueueMetrics(metrics.queueSize, metrics.dlqSize);

        return {
          success: false,
          processedCount: 0,
          failedCount: likes.length,
          failedLikes: likes,
          processingTime,
          error: dbError.message,
        };
      }
    } catch (error) {
      this.logger.error('배치 처리 중 예상치 못한 오류:', error);

      // Redis 연결 오류 가능성 체크
      if (error.message?.includes('Redis') || error.message?.includes('ECONNREFUSED')) {
        this.metricsService.updateRedisConnectionStatus(false);
      }

      const processingTime = Date.now() - startTime;

      // Prometheus 메트릭: 처리 완료 (오류)
      this.metricsService.endBatchProcessing(processingTime, 0, 1, 0);

      return {
        success: false,
        processedCount: 0,
        failedCount: 0,
        processingTime,
        error: error.message,
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 즉시 배치 처리 (인터벌 우회)
   */
  async processImmediate(): Promise<LikeBatchResult> {
    return this.processBatch();
  }

  /**
   * DLQ에서 복구
   */
  async recoverDeadLetterQueue(limit: number = 10): Promise<number> {
    try {
      const likes = await this.queueService.recoverFromDeadLetterQueue(limit);
      this.logger.log(`DLQ에서 ${likes.length}개 요청 복구`);
      return likes.length;
    } catch (error) {
      this.logger.error('DLQ 복구 실패:', error);
      return 0;
    }
  }

  /**
   * 큐 메트릭 조회
   */
  async getQueueMetrics(): Promise<LikeQueueMetrics> {
    return this.queueService.getMetrics();
  }

  /**
   * 큐 건강 상태 확인
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    queueSize: number;
    dlqSize: number;
    isProcessing: boolean;
    consecutiveFailures: number;
  }> {
    const metrics = await this.queueService.getMetrics();

    return {
      healthy: metrics.queueSize < 1000 && metrics.dlqSize < 100,
      queueSize: metrics.queueSize,
      dlqSize: metrics.dlqSize,
      isProcessing: this.isProcessing,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  /**
   * 배치 처리 재개 (일시 중지 후)
   */
  resumeProcessing() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }

    this.consecutiveFailures = 0;
    this.startBatchProcessing();

    this.logger.log('배치 처리 재개');
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<LikeBatchConfig>) {
    Object.assign(this.config, newConfig);

    // 인터벌 변경 시 재시작
    if (newConfig.batchInterval) {
      if (this.intervalHandle) {
        clearInterval(this.intervalHandle);
      }
      this.startBatchProcessing();
    }

    this.logger.log('배치 설정 업데이트:', this.config);
  }
}
