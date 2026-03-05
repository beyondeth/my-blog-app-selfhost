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
import { User } from "../../users/entities/user.entity"; // Adjust path if necessary

export enum FeedbackType {
  BUG = "BUG",
  FEATURE = "FEATURE",
  INQUIRY = "INQUIRY",
  BUSINESS = "BUSINESS",
  REPORT = "REPORT",
  PERFORMANCE = "PERFORMANCE",
  CORRECTION = "CORRECTION",
  OTHER = "OTHER",
}

export enum FeedbackMode {
  FORM = "form",
  FREE = "free",
}

export enum FeedbackStatus {
  NEW = "new",
  IN_PROGRESS = "in_progress",
  DONE = "done",
}

@Entity("feedback_tickets")
export class FeedbackTicket {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id" })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ type: "enum", enum: FeedbackMode, default: FeedbackMode.FORM })
  mode: FeedbackMode;

  @Column({ type: "enum", enum: FeedbackType, nullable: true })
  type: FeedbackType | null;

  @Column({ length: 255 })
  title: string;

  @Column({ type: "text" })
  message: string;

  @Column({ name: "page_path", length: 500, nullable: true })
  pagePath: string;

  @Column({ length: 20, nullable: true })
  theme: string;

  @Column({ name: "user_agent", type: "text", nullable: true })
  userAgent: string;

  @Column({
    type: "enum",
    enum: FeedbackStatus,
    default: FeedbackStatus.NEW,
  })
  @Index()
  status: FeedbackStatus;

  @Column({ name: "email_sent", default: false })
  emailSent: boolean;

  @CreateDateColumn({ name: "created_at" })
  @Index()
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
