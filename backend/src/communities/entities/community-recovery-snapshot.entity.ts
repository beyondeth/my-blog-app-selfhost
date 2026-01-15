import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  Index,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { Community } from "./community.entity";
import { User } from "../../users/entities/user.entity";

/**
 * 커뮤니티 복구 스냅샷 엔티티
 *
 * @description
 * - 모더레이션 폭주/대량 삭제 등 긴급 상황에 대비하여
 *   게시물/댓글/설정 상태를 저장합니다.
 * - Admin이 스냅샷을 기반으로 커뮤니티를 롤백할 수 있습니다.
 */
@Entity("community_recovery_snapshots")
@Index(["communityId", "createdAt"])
export class CommunityRecoverySnapshot {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @BeforeInsert()
  generateUuid() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  /**
   * 대상 커뮤니티 ID
   */
  @Column({ type: "uuid" })
  communityId: string;

  /**
   * 스냅샷 생성자 (Admin 또는 시스템)
   */
  @Column({ type: "uuid", nullable: true })
  createdById: string | null;

  /**
   * 스냅샷 생성 사유 (예: "mass_delete_detected")
   */
  @Column({ length: 120 })
  reason: string;

  /**
   * 게시물 상태 JSON
   * - [{ id, title, content, content_markdown, isDeleted, deletedAt, status, metadata }]
   */
  @Column("jsonb")
  postsSnapshot: Record<string, any>[];

  /**
   * 댓글 상태 JSON
   * - [{ id, postId, parentCommentId, content, isDeleted, deletedAt }]
   */
  @Column("jsonb")
  commentsSnapshot: Record<string, any>[];

  /**
   * 커뮤니티 설정 스냅샷
   */
  @Column("jsonb")
  settingsSnapshot: Record<string, any>;

  /**
   * 추가 메타데이터
   */
  @Column("jsonb", { nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Community, { onDelete: "CASCADE" })
  @JoinColumn({ name: "communityId" })
  community: Community;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "createdById" })
  createdBy?: User | null;
}
