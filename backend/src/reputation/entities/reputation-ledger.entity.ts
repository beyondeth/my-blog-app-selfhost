/**
 * 평판 시스템 - 평판 원장(Ledger) 엔티티
 *
 * 모든 평판 점수 변동 내역을 기록하는 불변 원장입니다.
 * 각 레코드는 하나의 액션으로 인한 점수 변화를 나타냅니다.
 *
 * 설계 원칙:
 * - 불변성: 한번 기록된 데이터는 수정/삭제하지 않음
 * - 추적성: 모든 점수 변화의 원인을 추적 가능
 * - 성능: 적절한 인덱스로 집계 쿼리 최적화
 *
 * @see LedgerService.record()
 * @see AggregatorService.aggregateByPeriod()
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ReputationAction } from '../enums/reputation-action.enum';
import { User } from '../../users/entities/user.entity';

@Entity('reputation_ledger')
@Index('idx_reputation_ledger_user_recorded', ['userId', 'recordedAt'])
@Index('idx_reputation_ledger_action_recorded', ['actionType', 'recordedAt'])
export class ReputationLedger {
  /**
   * 기본 키 (UUID v7)
   * 시간순 정렬이 가능한 UUID 사용
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 점수를 받는 사용자 ID
   * 콘텐츠 작성자 또는 액션 수행자
   */
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  /**
   * 사용자 관계 (조회 최적화용)
   */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * 액션 타입
   * 점수 변동의 원인이 되는 행동 종류
   */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'action_type',
  })
  actionType: ReputationAction;

  /**
   * 대상 타입
   * 액션이 발생한 대상의 종류 (예: 'post', 'comment')
   */
  @Column({ type: 'varchar', length: 50, name: 'target_type', nullable: true })
  targetType: string | null;

  /**
   * 대상 ID
   * 액션이 발생한 대상의 고유 식별자
   */
  @Column({ type: 'uuid', name: 'target_id', nullable: true })
  targetId: string | null;

  /**
   * 점수 변화량
   * 양수: 점수 증가, 음수: 점수 감소
   */
  @Column({ type: 'int' })
  delta: number;

  /**
   * 반응 수 (선택적)
   * 좋아요/북마크 등의 누적 반응 수 스냅샷
   */
  @Column({ type: 'int', name: 'reaction_count', default: 0 })
  reactionCount: number;

  /**
   * 메타데이터 (JSONB)
   * 추가적인 컨텍스트 정보 저장
   * 예: { sourceUserId: '...', postTitle: '...' }
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  /**
   * 기록 시각
   * 레코드 생성 시점 (불변)
   */
  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt: Date;
}
