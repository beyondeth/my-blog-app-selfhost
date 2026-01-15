import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Community } from './community.entity';

/**
 * CommunityStats 엔티티
 *
 * 커뮤니티 레벨 통계를 저장합니다 (Community와 1:1 관계).
 *
 * **설계 원칙:**
 * - SRP: 통계 전용 테이블로 분리
 * - 성능: 역정규화된 카운트 필드로 JOIN 없이 조회
 * - 캐싱: Redis 캐시 + 주기적 배치 업데이트
 */
@Entity('community_stats')
export class CommunityStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 커뮤니티 ID (1:1 관계)
   */
  @Column({ name: 'community_id', type: 'uuid', unique: true })
  communityId: string;

  /**
   * Community 관계
   */
  @OneToOne(() => Community, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'community_id' })
  community: Community;

  /**
   * 전체 게시물 수
   */
  @Column({ name: 'total_posts', type: 'int', default: 0 })
  totalPosts: number;

  /**
   * 전체 조회수
   */
  @Column({ name: 'total_views', type: 'bigint', default: 0 })
  totalViews: number;

  /**
   * 전체 업보트 수
   */
  @Column({ name: 'total_upvotes', type: 'int', default: 0 })
  totalUpvotes: number;

  /**
   * 전체 다운보트 수
   */
  @Column({ name: 'total_downvotes', type: 'int', default: 0 })
  totalDownvotes: number;

  /**
   * 전체 댓글 수
   */
  @Column({ name: 'total_comments', type: 'int', default: 0 })
  totalComments: number;

  /**
   * 활성 멤버 수 (최근 30일 활동)
   */
  @Column({ name: 'active_member_count', type: 'int', default: 0 })
  activeMemberCount: number;

  /**
   * 평균 핫 스코어
   */
  @Column({
    name: 'avg_hot_score',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
  })
  avgHotScore: number;

  /**
   * 최근 7일 게시물 수
   */
  @Column({ name: 'weekly_posts', type: 'int', default: 0 })
  weeklyPosts: number;

  /**
   * 최근 7일 신규 멤버 수
   */
  @Column({ name: 'weekly_members', type: 'int', default: 0 })
  weeklyMembers: number;

  /**
   * 마지막 통계 계산 시각
   */
  @Column({
    name: 'last_calculated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastCalculatedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * 순 투표 점수 (업보트 - 다운보트)
   */
  get netScore(): number {
    return this.totalUpvotes - this.totalDownvotes;
  }

  /**
   * 공개 JSON 변환
   */
  toPublicJSON() {
    return {
      communityId: this.communityId,
      totalPosts: this.totalPosts,
      totalViews: Number(this.totalViews),
      totalUpvotes: this.totalUpvotes,
      totalDownvotes: this.totalDownvotes,
      netScore: this.netScore,
      totalComments: this.totalComments,
      activeMemberCount: this.activeMemberCount,
      avgHotScore: Number(this.avgHotScore),
      weeklyPosts: this.weeklyPosts,
      weeklyMembers: this.weeklyMembers,
      lastCalculatedAt: this.lastCalculatedAt,
    };
  }
}
