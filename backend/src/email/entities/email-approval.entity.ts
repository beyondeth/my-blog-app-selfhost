import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * 이메일 발송 승인 관리 엔티티
 * - 대량 이메일 발송 전 관리자 승인 필요
 * - 법률 변경, 정책 변경 시 대응 가능
 */
@Entity('email_approvals')
@Index(['status'])
@Index(['type'])
@Index(['createdAt'])
export class EmailApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: [
      'DATA_RETENTION_NOTICE',     // 개인정보 보유기간 만료 알림
      'ACCOUNT_DELETION_NOTICE',   // 계정 삭제 알림
      'DORMANT_ACCOUNT_NOTICE',    // 휴면 계정 전환 알림
      'MARKETING',                 // 마케팅 이메일
      'SYSTEM_UPDATE'              // 시스템 업데이트 알림
    ]
  })
  type: string;

  @Column({ type: 'int', default: 0 })
  targetCount: number; // 발송 대상 수

  @Column({ type: 'jsonb', nullable: true })
  targetUserIds: string[]; // 발송 대상 사용자 ID 목록

  @Column({
    type: 'enum',
    enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT', 'FAILED'],
    default: 'PENDING_APPROVAL'
  })
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SENT' | 'FAILED';

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date; // 발송 예정 시점

  @Column({ nullable: true })
  template: string; // 이메일 템플릿 이름

  // 이메일 제목 (직접 필드로 추가)
  @Column({ type: 'text', nullable: true })
  subject: string;

  // 이메일 본문 내용 (직접 필드로 추가)
  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    preview?: string; // 미리보기 텍스트
    variables?: Record<string, any>; // 템플릿 변수
  };

  // 승인 관련
  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approvedBy' })
  approver: User;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'text', nullable: true })
  approvalNote: string; // 승인/거부 사유

  // 거부 관련 (rejection fields)
  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string; // 거부 사유

  // 발송 결과
  @Column({ type: 'int', default: 0 })
  sentCount: number; // 실제 발송 완료 수

  @Column({ type: 'int', default: 0 })
  failedCount: number; // 발송 실패 수

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date; // 발송 완료 시점

  @Column({ type: 'jsonb', nullable: true })
  errors: string[]; // 발생한 에러 목록

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
