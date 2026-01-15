import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

export const AuditAction = {
  USER_CREATED: "user_created",
  USER_UPDATED: "user_updated",
  USER_DELETED: "user_deleted",
  USER_SUSPENDED: "user_suspended",
  USER_BANNED: "user_banned",
  USER_ACTIVATED: "user_activated",
  USER_ROLE_CHANGED: "user_role_changed",
  POST_UPDATED: "post_updated",
  POST_DELETED: "post_deleted",
  POST_PUBLISHED: "post_published",
  POST_UNPUBLISHED: "post_unpublished",
  COMMENT_UPDATED: "comment_updated",
  COMMENT_DELETED: "comment_deleted",
  REPORT_REVIEWED: "report_reviewed",
  REPORT_RESOLVED: "report_resolved",
  REPORT_DISMISSED: "report_dismissed",
  REPORT_ESCALATED: "report_escalated",
  ADMIN_LOGOUT: "admin_logout",
  ADMIN_ACCESS_DENIED: "admin_access_denied",
  SETTINGS_UPDATED: "settings_updated",
  BULK_ACTION_PERFORMED: "bulk_action_performed",
  IP_VIEW: "ip_view",
  IP_EXPORT: "ip_export",
  IP_BLOCK: "ip_block",
  IP_UNBLOCK: "ip_unblock",
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

@Entity("audit_logs")
@Index(["action"])
@Index(["entityType", "entityId"])
@Index(["performedById"])
@Index(["createdAt"])
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({ type: "varchar", length: 50 })
  entityType: string; // user, post, comment, report, etc.

  @Column({ type: "uuid", nullable: true })
  entityId: string;

  @Column({ type: "jsonb", nullable: true })
  previousData: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  newData: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any>; // Additional context

  @Column({ type: "uuid", nullable: true })
  performedById: string;

  @Column({ type: "varchar", nullable: true })
  ipAddress: string;

  @Column({ type: "varchar", nullable: true })
  userAgent: string;

  @Column({ type: "varchar", nullable: true })
  sessionId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "performedById" })
  performedBy: User;
}
