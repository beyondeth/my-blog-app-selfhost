import { Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

/**
 * 트랜잭션 내 이벤트를 버퍼링하고, 커밋 후 안전하게 발행하는 유틸리티
 *
 * 사용법:
 * ```typescript
 * const buffer = new TransactionEventBuffer();
 * const result = await this.dataSource.transaction(async (manager) => {
 *   // DB 작업...
 *   buffer.add("post.lifecycle.created", { postId, blogId });
 *   return savedEntity;
 * });
 * // 트랜잭션 커밋 성공 후
 * buffer.flush(this.eventEmitter, this.logger, requestId);
 * ```
 */
export class TransactionEventBuffer {
  private pending: Array<{ event: string; payload: any }> = [];

  /** 이벤트를 버퍼에 추가 (아직 발행 안 함) */
  add(event: string, payload: any): void {
    this.pending.push({ event, payload });
  }

  /** 버퍼에 쌓인 이벤트 개수 */
  get size(): number {
    return this.pending.length;
  }

  /**
   * 커밋 성공 후 호출 — 모든 이벤트를 실제로 발행
   * 개별 이벤트 emit 실패는 로그만 남기고 계속 진행 (best-effort)
   * API 응답에 영향을 주지 않도록 예외를 전파하지 않음
   *
   * @param emitter EventEmitter2 인스턴스
   * @param logger Logger 인스턴스
   * @param correlationId 트랜잭션 추적용 ID (optional, 로그 추적성 강화용)
   */
  flush(emitter: EventEmitter2, logger: Logger, correlationId?: string): void {
    const total = this.pending.length;
    let successCount = 0;
    let failCount = 0;
    const cid = correlationId || "N/A";

    for (const { event, payload } of this.pending) {
      try {
        emitter.emit(event, payload);
        successCount++;
        logger.debug(
          `[EventBuffer:flush] correlationId=${cid} event=${event} status=success`,
        );
      } catch (err) {
        failCount++;
        logger.error(
          `[EventBuffer:flush] correlationId=${cid} event=${event} status=failed: ${err.message}`,
          err.stack,
        );
      }
    }

    if (total > 0) {
      logger.log(
        `[EventBuffer:summary] correlationId=${cid} total=${total} success=${successCount} failed=${failCount}`,
      );
    }

    this.pending = [];
  }

  /** 롤백 시 호출 — 버퍼 비우기 */
  clear(): void {
    this.pending = [];
  }
}
