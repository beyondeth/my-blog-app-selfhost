import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum AuditAction {
  // User actions
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  USER_SUSPENDED = 'user_suspended',
  USER_BANNED = 'user_banned',
  USER_ACTIVATED = 'user_activated',
  USER_ROLE_CHANGED = 'user_role_changed',
  
  // Post actions
  POST_CREATED = 'post_created',
  POST_UPDATED = 'post_updated',
  POST_DELETED = 'post_deleted',
  POST_PUBLISHED = 'post_published',
  POST_UNPUBLISHED = 'post_unpublished',
  
  // Comment actions
  COMMENT_CREATED = 'comment_created',
  COMMENT_UPDATED = 'comment_updated',
  COMMENT_DELETED = 'comment_deleted',
  
  // Report actions
  REPORT_CREATED = 'report_created',
  REPORT_REVIEWED = 'report_reviewed',
  REPORT_RESOLVED = 'report_resolved',
  REPORT_DISMISSED = 'report_dismissed',
  REPORT_ESCALATED = 'report_escalated',
  
  // Admin actions
  ADMIN_LOGIN = 'admin_login',
  ADMIN_LOGOUT = 'admin_logout',
  ADMIN_ACCESS_DENIED = 'admin_access_denied',
  SETTINGS_UPDATED = 'settings_updated',
  BULK_ACTION_PERFORMED = 'bulk_action_performed',
}

@Entity('audit_logs')
@Index(['action'])
@Index(['entityType', 'entityId'])
@Index(['performedById'])
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({ type: 'varchar', length: 50 })
  entityType: string; // user, post, comment, report, etc.

  @Column({ type: 'uuid', nullable: true })
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  previousData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  newData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Additional context

  @Column({ type: 'uuid' })
  performedById: string;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string;

  @Column({ type: 'varchar', nullable: true })
  sessionId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'performedById' })
  performedBy: User;
}