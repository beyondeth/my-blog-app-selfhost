import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Blog } from './blog.entity';

/**
 * BlogStats 엔티티
 *
 * 블로그 레벨 통계를 저장합니다 (Blog와 1:1 관계).
 *
 * **설계 원칙:**
 * - SRP: 통계 전용 테이블로 분리
 * - 성능: 역정규화된 카운트 필드로 JOIN 없이 조회
 * - 캐싱: Redis 캐시 + 주기적 배치 업데이트
 */
@Entity('blog_stats')
export class BlogStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 블로그 ID (1:1 관계)
   */
  @Column({ name: 'blog_id', type: 'uuid', unique: true })
  blogId: string;

  /**
   * Blog 관계
   */
  @OneToOne(() => Blog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blog_id' })
  blog: Blog;

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
   * 전체 좋아요 수
   */
  @Column({ name: 'total_likes', type: 'int', default: 0 })
  totalLikes: number;

  /**
   * 전체 댓글 수
   */
  @Column({ name: 'total_comments', type: 'int', default: 0 })
  totalComments: number;

  /**
   * 팔로워 수
   */
  @Column({ name: 'follower_count', type: 'int', default: 0 })
  followerCount: number;

  /**
   * 평균 참여율 (%)
   * 계산식: (좋아요 + 댓글) / 조회수 * 100
   */
  @Column({
    name: 'avg_engagement_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  avgEngagementRate: number;

  /**
   * 최근 7일 조회수
   */
  @Column({ name: 'weekly_views', type: 'int', default: 0 })
  weeklyViews: number;

  /**
   * 최근 7일 좋아요
   */
  @Column({ name: 'weekly_likes', type: 'int', default: 0 })
  weeklyLikes: number;

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
   * 공개 JSON 변환
   */
  toPublicJSON() {
    return {
      blogId: this.blogId,
      totalPosts: this.totalPosts,
      totalViews: Number(this.totalViews),
      totalLikes: this.totalLikes,
      totalComments: this.totalComments,
      followerCount: this.followerCount,
      avgEngagementRate: Number(this.avgEngagementRate),
      weeklyViews: this.weeklyViews,
      weeklyLikes: this.weeklyLikes,
      lastCalculatedAt: this.lastCalculatedAt,
    };
  }
}
