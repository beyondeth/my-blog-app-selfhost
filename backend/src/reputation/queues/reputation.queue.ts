/**
 * 평판 시스템 - 큐 상수 정의
 *
 * BullMQ 큐 이름 및 Job 타입을 정의합니다.
 */

/**
 * 평판 이벤트 처리 큐 이름
 */
export const REPUTATION_QUEUE = 'reputation-events';

/**
 * 큐 Job 이름
 */
export enum ReputationJobName {
  /**
   * 평판 이벤트 처리
   */
  REPUTATION_EVENT = 'reputation-event',

  /**
   * 배치 처리 (일괄 ledger INSERT)
   */
  BATCH_PROCESS = 'batch-process',
}
