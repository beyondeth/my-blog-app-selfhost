import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export enum IdempotencyRecordStatus {
  PROCESSING = "processing",
  COMPLETED = "completed",
}

@Entity("idempotency_records")
@Index(["scope", "key"], { unique: true })
@Index(["expiresAt"])
export class IdempotencyRecord {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 200 })
  scope: string;

  @Column({ type: "varchar", length: 200 })
  key: string;

  @Column({ type: "varchar", length: 64 })
  requestHash: string;

  @Column({ type: "varchar", length: 20 })
  status: IdempotencyRecordStatus;

  @Column({ type: "jsonb", nullable: true })
  result: unknown;

  @Column({ type: "timestamp", nullable: true })
  lockedAt: Date | null;

  @Column({ type: "timestamp" })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
