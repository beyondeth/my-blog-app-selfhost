import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { OnEvent, EventEmitter2 } from "@nestjs/event-emitter";
import { Interval } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, LessThanOrEqual, Repository } from "typeorm";
import {
  OutboxEvent,
  OutboxEventStatus,
} from "../entities/outbox-event.entity";
import { SecurityMetricsService } from "./security-metrics.service";
import { RequestContextService } from "./request-context.service";

export interface EnqueueOutboxEventInput {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  organizationId?: string | null;
  payload: Record<string, unknown>;
  availableAt?: Date;
  maxAttempts?: number;
  dedupeKey?: string | null;
  requestId?: string | null;
}

export interface OutboxDeadLetterSummary {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  organizationId: string | null;
  requestId: string | null;
  status: OutboxEventStatus;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  deadLetteredAt: Date | null;
  lastError: string | null;
  occurredAt: Date;
}

const DEFAULT_MAX_ATTEMPTS = 10;
const MAX_DISPATCH_BATCH = 25;
const STALE_PROCESSING_AFTER_MS = 5 * 60 * 1000;

/** Transactional outbox writer and single-process dispatcher. */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private dispatching = false;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly repository: Repository<OutboxEvent>,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly requestContextService?: RequestContextService,
    @Optional() private readonly securityMetrics?: SecurityMetricsService,
  ) {}

  async enqueue(
    manager: EntityManager,
    input: EnqueueOutboxEventInput,
  ): Promise<OutboxEvent> {
    const repository = manager.getRepository(OutboxEvent);
    return repository.save(
      repository.create({
        ...input,
        organizationId: input.organizationId || null,
        requestId:
          input.requestId ||
          this.requestContextService?.get().requestId ||
          null,
        availableAt: input.availableAt || new Date(),
        status: OutboxEventStatus.PENDING,
        attempts: 0,
        maxAttempts: this.normalizeMaxAttempts(input.maxAttempts),
        dedupeKey: input.dedupeKey || null,
        deadLetteredAt: null,
      }),
    );
  }

  async listDeadLetters(
    limit = 50,
    organizationId?: string,
  ): Promise<OutboxDeadLetterSummary[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 100);
    return this.repository
      .createQueryBuilder("event")
      .select([
        "event.id",
        "event.eventType",
        "event.aggregateType",
        "event.aggregateId",
        "event.organizationId",
        "event.requestId",
        "event.status",
        "event.attempts",
        "event.maxAttempts",
        "event.availableAt",
        "event.deadLetteredAt",
        "event.lastError",
        "event.occurredAt",
      ])
      .where("event.status = :status", {
        status: OutboxEventStatus.DEAD_LETTER,
      })
      .andWhere(
        organizationId
          ? "event.organizationId = :organizationId"
          : "event.organizationId IS NULL",
        organizationId ? { organizationId } : {},
      )
      .orderBy("event.deadLetteredAt", "DESC", "NULLS LAST")
      .addOrderBy("event.occurredAt", "DESC")
      .take(safeLimit)
      .getMany() as Promise<OutboxDeadLetterSummary[]>;
  }

  async replayDeadLetter(
    id: string,
    organizationId?: string,
  ): Promise<OutboxDeadLetterSummary> {
    const query = this.repository
      .createQueryBuilder()
      .update(OutboxEvent)
      .set({
        status: OutboxEventStatus.PENDING,
        attempts: 0,
        availableAt: new Date(),
        processedAt: null,
        lockedAt: null,
        deadLetteredAt: null,
        lastError: null,
      })
      .where("id = :id", { id })
      .andWhere("status = :status", {
        status: OutboxEventStatus.DEAD_LETTER,
      });
    query.andWhere(
      organizationId
        ? '"organizationId" = :organizationId'
        : '"organizationId" IS NULL',
      organizationId ? { organizationId } : {},
    );
    const result = await query.execute();

    if (result.affected !== 1) {
      throw new NotFoundException("Dead-letter outbox event not found");
    }

    const event = await this.repository
      .createQueryBuilder("event")
      .select([
        "event.id",
        "event.eventType",
        "event.aggregateType",
        "event.aggregateId",
        "event.organizationId",
        "event.requestId",
        "event.status",
        "event.attempts",
        "event.maxAttempts",
        "event.availableAt",
        "event.deadLetteredAt",
        "event.lastError",
        "event.occurredAt",
      ])
      .where("event.id = :id", { id })
      .getOne();

    if (!event) {
      throw new NotFoundException("Outbox event not found after replay");
    }

    return event as OutboxDeadLetterSummary;
  }

  @Interval(5000)
  async dispatchPending(): Promise<void> {
    if (this.dispatching) {
      return;
    }

    this.dispatching = true;
    try {
      const staleBefore = new Date(Date.now() - STALE_PROCESSING_AFTER_MS);
      await this.repository
        .createQueryBuilder()
        .update(OutboxEvent)
        .set({
          status: () =>
            `CASE WHEN "attempts" >= "maxAttempts" THEN '${OutboxEventStatus.DEAD_LETTER}' ELSE '${OutboxEventStatus.FAILED}' END`,
          availableAt: () => "CURRENT_TIMESTAMP",
          lockedAt: null,
          deadLetteredAt: () =>
            `CASE WHEN "attempts" >= "maxAttempts" THEN CURRENT_TIMESTAMP ELSE NULL END`,
          lastError: "Recovered stale processing event",
        })
        .where("status = :status", {
          status: OutboxEventStatus.PROCESSING,
        })
        .andWhere('"lockedAt" <= :staleBefore', { staleBefore })
        .execute();

      const events = await this.repository.find({
        where: [
          {
            status: OutboxEventStatus.PENDING,
            availableAt: LessThanOrEqual(new Date()),
          },
          {
            status: OutboxEventStatus.FAILED,
            availableAt: LessThanOrEqual(new Date()),
          },
        ],
        order: { occurredAt: "ASC" },
        take: MAX_DISPATCH_BATCH,
      });

      for (const event of events) {
        const claim = await this.repository
          .createQueryBuilder()
          .update(OutboxEvent)
          .set({
            status: OutboxEventStatus.PROCESSING,
            attempts: () => '"attempts" + 1',
            lockedAt: new Date(),
            deadLetteredAt: null,
          })
          .where("id = :id", { id: event.id })
          .andWhere("status IN (:...statuses)", {
            statuses: [OutboxEventStatus.PENDING, OutboxEventStatus.FAILED],
          })
          .andWhere('"attempts" < "maxAttempts"')
          .execute();

        if (claim.affected !== 1) {
          continue;
        }

        try {
          await this.eventEmitter.emitAsync(event.eventType, {
            ...event.payload,
            outboxEventId: event.id,
            organizationId: event.organizationId,
            requestId: event.requestId,
          });
          await this.repository.update(
            { id: event.id },
            {
              status: OutboxEventStatus.PROCESSED,
              processedAt: new Date(),
              lockedAt: null,
              lastError: null,
            },
          );
        } catch (error: any) {
          const attemptCount = (event.attempts || 0) + 1;
          const maxAttempts = this.normalizeMaxAttempts(event.maxAttempts);
          const isDeadLetter = attemptCount >= maxAttempts;
          const retryDelayMs = Math.min(
            60 * 60 * 1000,
            1000 * 2 ** Math.min(attemptCount, 10),
          );
          await this.repository.update(
            { id: event.id },
            {
              status: isDeadLetter
                ? OutboxEventStatus.DEAD_LETTER
                : OutboxEventStatus.FAILED,
              availableAt: isDeadLetter
                ? new Date()
                : new Date(Date.now() + retryDelayMs),
              lockedAt: null,
              deadLetteredAt: isDeadLetter ? new Date() : null,
              lastError: String(error?.message || error).slice(0, 2000),
            },
          );
          this.securityMetrics?.recordOutboxFailure(
            isDeadLetter ? "dead_letter" : "failed",
          );
          this.logger.error(
            `Outbox event ${isDeadLetter ? "dead-lettered" : "failed"}: ${event.eventType}/${event.id}`,
            error?.stack || error,
          );
        }
      }
    } finally {
      this.dispatching = false;
    }
  }

  @OnEvent("application.shutdown", { async: true })
  async flushOnShutdown(): Promise<void> {
    await this.dispatchPending();
  }

  private normalizeMaxAttempts(value?: number): number {
    if (!Number.isFinite(value)) {
      return DEFAULT_MAX_ATTEMPTS;
    }

    return Math.min(Math.max(Math.trunc(value as number), 1), 100);
  }
}
