import { Column, DeleteDateColumn } from 'typeorm';

/**
 * 소프트 삭제를 지원하는 기본 엔티티
 * 30일 보관 정책 구현
 */
export abstract class SoftDeleteEntity {
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'scheduled_purge_at' })
  scheduledPurgeAt: Date | null;

  @Column({ type: 'enum', enum: ['active', 'deleted', 'purging'], default: 'active' })
  status: 'active' | 'deleted' | 'purging';

  @Column({ type: 'jsonb', nullable: true })
  deletionMetadata: {
    reason?: string;
    deletedBy?: string;
    ip?: string;
    userAgent?: string;
    backupId?: string;
  };
}