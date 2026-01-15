/**
 * 평판 시스템 - 일일 집계 Cron Job
 *
 * 매일 새벽 3시에 실행되어 모든 사용자의 기간별 평판 점수를 집계합니다.
 *
 * 수행 작업:
 * 1. 큐에 쌓인 이벤트 → ledger 배치 INSERT
 * 2. AggregatorService.aggregateAll() 호출
 * 3. 모든 기간(L7, L30, L90, ALL_TIME) 집계
 * 4. ReputationTotal 테이블 업데이트
 *
 * @see ReputationQueueService
 * @see AggregatorService
 * @see TitleService
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AggregatorService } from '../services/aggregator.service';
import { TitleService } from '../services/title.service';
import { LedgerService } from '../services/ledger.service';
import { ReputationQueueService, ReputationEventData } from '../queues/reputation-queue.service';
import { REPUTATION_ACTION_SCORES } from '../enums/reputation-action.enum';

@Injectable()
export class DailyAggregateJob {
  private readonly logger = new Logger(DailyAggregateJob.name);

  constructor(
    private readonly aggregatorService: AggregatorService,
    private readonly titleService: TitleService,
    private readonly ledgerService: LedgerService,
    private readonly queueService: ReputationQueueService,
  ) {}

  /**
   * 일일 집계 작업
   *
   * 매일 새벽 3시에 실행됩니다.
   * - 큐에 쌓인 이벤트를 ledger에 배치 INSERT
   * - 전체 사용자의 기간별 점수 집계
   * - 만료된 타이틀 정리
   */
  @Cron('10 3 * * *', {
    name: 'daily-reputation-aggregate',
    timeZone: 'Asia/Seoul',
  })
  async handleCron(): Promise<void> {
    this.logger.log('===== 일일 평판 집계 시작 =====');
    const startTime = Date.now();

    try {
      // 1. 큐에 쌓인 이벤트 → ledger 배치 INSERT
      const processedCount = await this.processQueueToLedger();
      this.logger.log(`큐 처리 완료: ${processedCount}개 이벤트`);

      // 2. 기간별 점수 집계
      await this.aggregatorService.aggregateAll();

      // 3. 만료된 타이틀 정리
      const expiredCount = await this.titleService.revokeExpired();
      this.logger.log(`만료 타이틀 정리: ${expiredCount}개`);

      const elapsed = Date.now() - startTime;
      this.logger.log(`===== 일일 평판 집계 완료 (${elapsed}ms) =====`);
    } catch (error) {
      this.logger.error(
        `일일 집계 실패: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 큐에 쌓인 이벤트를 ledger에 배치 INSERT
   *
   * @returns 처리된 이벤트 수
   */
  private async processQueueToLedger(): Promise<number> {
    const waitingJobs = await this.queueService.getWaitingJobs();
    
    if (waitingJobs.length === 0) {
      this.logger.debug('처리할 큐 이벤트가 없습니다.');
      return 0;
    }

    this.logger.log(`큐에서 ${waitingJobs.length}개 이벤트 처리 시작`);

    let processedCount = 0;
    const errors: string[] = [];

    for (const job of waitingJobs) {
      try {
        const data = job.data as ReputationEventData;
        
        // 점수 계산 (SCORE_POLICY에서 가져오거나 data.score 사용)
        const score = data.score ?? REPUTATION_ACTION_SCORES[data.action] ?? 0;

        // ledger에 INSERT
        await this.ledgerService.record({
          userId: data.userId,
          actionType: data.action,
          targetType: data.targetType,
          targetId: data.targetId,
          delta: score,
          actorId: data.triggeredBy,
          metadata: data.metadata,
        });

        // Job 완료 처리
        await job.moveToCompleted('processed', job.token || '', false);
        processedCount++;
      } catch (error) {
        errors.push(`Job ${job.id}: ${error.message}`);
        // Job 실패 처리
        await job.moveToFailed(error, job.token || '', false);
      }
    }

    if (errors.length > 0) {
      this.logger.warn(`큐 처리 중 ${errors.length}개 오류 발생`);
    }

    return processedCount;
  }

  /**
   * 수동 실행용 메서드
   *
   * 관리자가 Admin API를 통해 수동으로 집계를 실행할 때 사용합니다.
   * 큐 처리 → 집계 → 타이틀 정리 순서로 실행합니다.
   */
  async runManually(): Promise<{ success: boolean; elapsed: number; queueProcessed: number }> {
    this.logger.log('수동 집계 실행 시작');
    const startTime = Date.now();

    try {
      // 1. 큐 처리
      const queueProcessed = await this.processQueueToLedger();

      // 2. 집계
      await this.aggregatorService.aggregateAll();

      // 3. 타이틀 정리
      await this.titleService.revokeExpired();

      const elapsed = Date.now() - startTime;
      return { success: true, elapsed, queueProcessed };
    } catch (error) {
      this.logger.error(`수동 집계 실패: ${error.message}`);
      throw error;
    }
  }
}

