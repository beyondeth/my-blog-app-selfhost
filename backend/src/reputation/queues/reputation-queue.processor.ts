/**
 * 평판 시스템 - 큐 프로세서
 *
 * BullMQ Worker로서 큐에 쌓인 평판 이벤트를 처리합니다.
 *
 * 두 가지 처리 모드:
 * 1. 개별 처리: 각 이벤트를 바로 ledger에 INSERT (비활성화)
 * 2. 배치 처리: 집계 시점에 한 번에 INSERT (권장)
 *
 * @see ReputationQueueService
 * @see LedgerService
 */
import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger, Injectable } from "@nestjs/common";
import { Job } from "bullmq";
import { REPUTATION_QUEUE, ReputationJobName } from "./reputation.queue";
import { ReputationEventData } from "./reputation-queue.service";
import { LedgerService } from "../services/ledger.service";

@Injectable()
@Processor(REPUTATION_QUEUE, {
  concurrency: 1, // 순차 처리 (배치 모드에서는 중요하지 않음)
})
export class ReputationQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(ReputationQueueProcessor.name);

  constructor(private readonly ledgerService: LedgerService) {
    super();
  }

  /**
   * Job 처리
   *
   * 현재는 Job을 큐에 두고, 집계 시점에 배치로 처리합니다.
   * 개별 처리가 필요한 경우 이 메서드에서 바로 INSERT 할 수 있습니다.
   */
  async process(job: Job<ReputationEventData>): Promise<void> {
    const { action, userId, targetId } = job.data;

    this.logger.debug(
      `Job 처리 중: ${job.name}, action=${action}, userId=${userId}, targetId=${targetId}`,
    );

    // 현재는 배치 모드라서 process에서 아무것도 안 함
    // 집계 Job에서 일괄 처리함
    //
    // 만약 실시간 처리가 필요하면 아래 주석 해제:
    // await this.ledgerService.record({
    //   userId,
    //   action,
    //   score: job.data.score,
    //   targetType: job.data.targetType,
    //   targetId,
    //   triggeredBy: job.data.triggeredBy,
    // });
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job) {
    this.logger.debug(`Job 완료: ${job.id}`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job 실패: ${job.id}, error=${error.message}`);
  }
}
