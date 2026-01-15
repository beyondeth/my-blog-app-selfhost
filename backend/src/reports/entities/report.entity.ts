import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import {
  ReportType,
  ReportReason,
  ReportStatus,
  ReportAction,
} from "../enums/report.enum";

@Entity("reports")
@Index(["type", "targetId"])
@Index(["status"])
@Index(["reportedById"])
@Index(["createdAt"])
@Index(["communityId"])
@Index(["reportedModeratorId"])
export class Report {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: ReportType,
  })
  type: ReportType;

  @Column({
    type: "enum",
    enum: ReportReason,
  })
  reason: ReportReason;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "uuid" })
  targetId: string; // ID of the reported item (post, comment, or user)

  @Column({ type: "uuid" })
  reportedById: string;

  @Column({ name: "community_id", type: "uuid", nullable: true })
  communityId?: string | null;

  @Column({ name: "reported_moderator_id", type: "uuid", nullable: true })
  reportedModeratorId?: string | null;

  @Column({
    type: "enum",
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @Column({
    type: "enum",
    enum: ReportAction,
    nullable: true,
  })
  actionTaken: ReportAction;

  @Column({ type: "text", nullable: true })
  moderatorNotes: string;

  @Column({ type: "uuid", nullable: true })
  reviewedById: string;

  @Column({ type: "timestamp", nullable: true })
  reviewedAt: Date;

  @Column({ type: "int", default: 1 })
  priority: number; // 1 = low, 2 = medium, 3 = high, 4 = critical

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any>; // Additional data like screenshots, evidence, etc.

  @Column({ name: "action_payload", type: "jsonb", nullable: true })
  actionPayload?: Record<string, any> | null;

  @Column({ type: "varchar", nullable: true })
  ipAddress: string;

  @Column({ type: "varchar", nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "reportedById" })
  reportedBy: User;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "reviewedById" })
  reviewedBy: User;

  // Virtual properties for target relations (resolved in service layer)
  targetPost?: any;
  targetComment?: any;
  targetUser?: any;
}
