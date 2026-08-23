/**
 * 평판 시스템 - 큐 서비스
 *
 * 평판 이벤트를 BullMQ 큐에 추가하고 관리하는 서비스입니다.
 *
 * 주요 기능:
 * - 평판 이벤트를 큐에 추가
 * - 대기 중인 이벤트 일괄 처리
 * - 큐 상태 조회
 *
 * @see ReputationQueueProcessor
 * @see LedgerService
 */
import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";
import { REPUTATION_QUEUE, ReputationJobName } from "./reputation.queue";
import { ReputationAction } from "../enums/reputation-action.enum";

/**
 * 평판 이벤트 데이터
 */
export interface ReputationEventData {
  /** 액션 타입 */
  action: ReputationAction;
  /** 점수 받는 사용자 ID */
  userId: string;
  /** 이벤트 발생시킨 사용자 ID (optional) */
  triggeredBy?: string;
  /** 대상 타입 (POST, COMMENT 등) */
  targetType?: string;
  /** 대상 ID */
  targetId?: string;
  /** 점수 (미지정 시 정책에 따라 결정) */
  score?: number;
  /** 추가 메타데이터 */
  metadata?: Record<string, unknown>;
  /** 이벤트 발생 시간 */
  occurredAt: Date;
}

/**
 * 큐 통계 정보
 */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

@Injectable()
export class ReputationQueueService {
  private readonly logger = new Logger(ReputationQueueService.name);

  constructor(@InjectQueue(REPUTATION_QUEUE) private readonly queue: Queue) {}

  /**
   * 평판 이벤트를 큐에 추가
   *
   * 즉시 DB INSERT 대신 큐에 추가하여 배치 처리합니다.
   *
   * @param data 이벤트 데이터
   * @returns 추가된 Job
   */
  async addReputationEvent(data: ReputationEventData): Promise<Job> {
    this.logger.debug(
      `큐에 이벤트 추가: action=${data.action}, userId=${data.userId}`,
    );

    const outboxEventId =
      typeof data.metadata?.outboxEventId === "string"
        ? data.metadata.outboxEventId
        : null;

    return this.queue.add(ReputationJobName.REPUTATION_EVENT, data, {
      // 중복 방지: 같은 이벤트가 단시간 내 여러 번 들어오는 것 방지
      jobId: `${data.action}:${data.userId}:${data.targetId || "no-target"}:${outboxEventId || Date.now()}`,
    });
  }

  /**
   * 대기 중인 모든 이벤트 조회
   *
   * @returns 대기 중인 Job 목록
   */
  async getWaitingJobs(): Promise<Job[]> {
    return this.queue.getWaiting();
  }

  /**
   * 큐 통계 조회
   *
   * @returns 큐 상태 통계
   */
  async getQueueStats(): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * 큐 비우기 (긴급 상황용)
   *
   * @returns 삭제된 Job 수
   */
  async drainQueue(): Promise<number> {
    this.logger.warn("큐 비우기 실행");
    const waiting = await this.queue.getWaiting();
    const count = waiting.length;

    await this.queue.drain();
    return count;
  }

  /**
   * 실패한 Job 재시도
   *
   * @returns 재시도된 Job 수
   */
  async retryFailedJobs(): Promise<number> {
    const failed = await this.queue.getFailed();
    let retryCount = 0;

    for (const job of failed) {
      await job.retry();
      retryCount++;
    }

    this.logger.log(`실패한 Job ${retryCount}개 재시도`);
    return retryCount;
  }
}
