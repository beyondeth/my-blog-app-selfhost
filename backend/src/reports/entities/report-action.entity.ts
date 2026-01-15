import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Report } from "./report.entity";
import { ReportAction } from "../enums/report.enum";

export const ReportActionLogStatus = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
} as const;

export type ReportActionLogStatus =
  (typeof ReportActionLogStatus)[keyof typeof ReportActionLogStatus];

@Entity("report_actions")
@Index(["reportId"])
@Index(["status"])
export class ReportActionLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "report_id", type: "uuid" })
  reportId: string;

  @Column({ type: "varchar" })
  action: ReportAction;

  @Column({ name: "executor_id", type: "uuid" })
  executorId: string;

  @Column({ type: "jsonb", nullable: true })
  payload?: Record<string, any> | null;

  @Column({ type: "jsonb", nullable: true })
  result?: Record<string, any> | null;

  @Column({
    type: "varchar",
    default: ReportActionLogStatus.PENDING,
  })
  status: ReportActionLogStatus;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage?: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => Report, { onDelete: "CASCADE" })
  @JoinColumn({ name: "report_id" })
  report: Report;
}
