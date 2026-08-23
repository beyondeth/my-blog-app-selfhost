import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export enum OutboxEventStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  PROCESSED = "processed",
  FAILED = "failed",
  DEAD_LETTER = "dead_letter",
}

@Entity("outbox_events")
@Index(["status", "availableAt"])
@Index(["aggregateType", "aggregateId"])
@Index(["requestId"])
@Index(["eventType", "dedupeKey"], {
  unique: true,
  where: '"dedupeKey" IS NOT NULL',
})
export class OutboxEvent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 120 })
  eventType: string;

  @Column({ length: 80 })
  aggregateType: string;

  @Column({ type: "uuid" })
  aggregateId: string;

  @Column({ type: "uuid", nullable: true })
  organizationId: string | null;

  @Column({ type: "varchar", length: 128, nullable: true })
  requestId: string | null;

  @Column({ type: "jsonb" })
  payload: Record<string, unknown>;

  @Column({
    type: "varchar",
    length: 20,
    default: OutboxEventStatus.PENDING,
  })
  status: OutboxEventStatus;

  @Column({ type: "int", default: 0 })
  attempts: number;

  @Column({ type: "int", default: 10 })
  maxAttempts: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  dedupeKey: string | null;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  availableAt: Date;

  @Column({ type: "timestamp", nullable: true })
  processedAt: Date | null;

  @Column({ type: "timestamp", nullable: true })
  lockedAt: Date | null;

  @Column({ type: "timestamp", nullable: true })
  deadLetteredAt: Date | null;

  @Column({ type: "text", nullable: true })
  lastError: string | null;

  @CreateDateColumn()
  occurredAt: Date;
}
