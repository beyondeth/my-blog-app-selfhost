import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 사용자 삭제 로그 엔티티
 * - 삭제 작업 추적 및 감사 목적
 * - 실패 시 관리자 수동 처리를 위한 데이터 보관
 */
@Entity('user_deletion_logs')
@Index(['status'])
@Index(['userId'])
@Index(['createdAt'])
export class UserDeletionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column()
  email: string; // 삭제 당시 이메일 (추적용)

  @Column({ nullable: true })
  username: string; // 삭제 당시 사용자명

  @Column({ type: 'timestamp' })
  deletedAt: Date; // 삭제 요청 시점

  @Column({ type: 'jsonb', nullable: true })
  deletionResult: {
    blogCount: number;
    postCount: number;
    commentCount: number;
    fileCount: number;
    s3Keys: string[]; // 삭제된 S3 파일 목록 (추적용)
    subscriptionCount: number;
    messageCount: number;
    errors: string[]; // 발생한 에러 목록
  };

  @Column({
    type: 'enum',
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending'
  })
  status: 'pending' | 'in_progress' | 'completed' | 'failed';

  @Column({ type: 'text', nullable: true })
  failureReason: string; // 실패 사유

  @Column({ type: 'int', default: 0 })
  retryCount: number; // 재시도 횟수

  @Column({ type: 'timestamp', nullable: true })
  lastRetryAt: Date; // 마지막 재시도 시점

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date; // 완료 시점

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    requestIp?: string;
    userAgent?: string;
    adminApproved?: boolean;
    adminId?: string;
    s3BackupKey?: string; // TODO: 실제 백업 파일 경로 (나중에 구현)
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
