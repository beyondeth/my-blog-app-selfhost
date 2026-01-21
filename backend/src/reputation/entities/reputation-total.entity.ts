/**
 * 평판 시스템 - 평판 총점 엔티티
 *
 * 사용자별 기간별 집계된 총 평판 점수를 저장합니다.
 * Cron job(AggregatorService)에 의해 주기적으로 갱신됩니다.
 *
 * 설계 원칙:
 * - 기간별 분리: L7, L30, L90, ALL_TIME 각각 별도 레코드
 * - 감쇠 점수: 오래된 활동은 감쇠되어 최신 활동 가치 강조
 * - 빠른 조회: 리더보드/프로필 표시용 사전 집계 데이터
 *
 * @see AggregatorService.aggregateByPeriod()
 * @see LeaderboardService
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Unique,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { ReputationPeriod } from "../enums/reputation-period.enum";
import { User } from "../../users/entities/user.entity";

@Entity("reputation_total")
@Unique("uq_reputation_total_user_period", ["userId", "period"])
@Index("idx_reputation_total_period_score", ["period", "decayedScore"])
export class ReputationTotal {
  /**
   * 기본 키 (UUID)
   */
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /**
   * 사용자 ID
   */
  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  /**
   * 사용자 관계
   */
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  /**
   * 집계 기간
   * L7: 최근 7일, L30: 최근 30일, L90: 최근 90일, ALL_TIME: 전체
   */
  @Column({
    type: "varchar",
    length: 20,
  })
  period: ReputationPeriod;

  /**
   * 원본 점수 (감쇠 미적용)
   * 해당 기간 내 모든 delta의 단순 합계
   */
  @Column({
    type: "numeric",
    precision: 12,
    scale: 2,
    default: 0,
  })
  score: number;

  /**
   * 감쇠 적용 점수
   * score = Σ(delta × decayFactor)
   * decayFactor는 시간이 지남에 따라 감소하는 가중치
   * 리더보드 정렬에 사용됨
   */
  @Column({
    type: "numeric",
    precision: 12,
    scale: 2,
    default: 0,
    name: "decayed_score",
  })
  decayedScore: number;

  /**
   * 마지막 집계 시각
   * AggregatorService가 이 레코드를 갱신한 시점
   */
  @UpdateDateColumn({ name: "last_computed_at" })
  lastComputedAt: Date;
}
