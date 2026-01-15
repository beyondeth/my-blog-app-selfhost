import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * StatsSnapshot 엔티티
 *
 * 일별/주별/월별 통계 스냅샷을 저장합니다 (시계열 데이터).
 *
 * **설계 원칙:**
 * - 유연성: JSONB로 다양한 메트릭 저장
 * - 성능: 복합 인덱스로 시계열 조회 최적화
 * - 확장성: targetType으로 블로그/커뮤니티 구분
 */
@Entity('stats_snapshot')
@Index('idx_stats_snapshot_target_period', [
  'targetType',
  'targetId',
  'period',
  'periodStart',
])
@Index(
  'idx_stats_snapshot_unique',
  ['targetType', 'targetId', 'period', 'periodStart'],
  { unique: true },
)
export class StatsSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 대상 타입
   */
  @Column({ name: 'target_type', type: 'varchar', length: 20 })
  targetType: 'blog' | 'community';

  /**
   * 대상 ID (블로그 또는 커뮤니티 UUID)
   */
  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  /**
   * 집계 기간
   */
  @Column({ name: 'period', type: 'varchar', length: 20 })
  period: 'daily' | 'weekly' | 'monthly';

  /**
   * 기간 시작일
   */
  @Column({ name: 'period_start', type: 'date' })
  periodStart: Date;

  /**
   * 메트릭 데이터 (JSONB)
   *
   * 블로그 예시: { views: 100, likes: 20, comments: 5, newPosts: 3 }
   * 커뮤니티 예시: { views: 500, upvotes: 100, comments: 30, newMembers: 10 }
   */
  @Column({ name: 'metrics', type: 'jsonb', default: {} })
  metrics: Record<string, number>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * 특정 메트릭 값 조회
   */
  getMetric(key: string): number {
    return this.metrics[key] ?? 0;
  }

  /**
   * 공개 JSON 변환
   */
  toPublicJSON() {
    return {
      targetType: this.targetType,
      targetId: this.targetId,
      period: this.period,
      periodStart: this.periodStart,
      metrics: this.metrics,
      createdAt: this.createdAt,
    };
  }
}
