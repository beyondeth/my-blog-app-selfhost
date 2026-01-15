import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { User } from "../../users/entities/user.entity";
import { Community } from "./community.entity";
import { ModAction, ModActionDescription } from "../enums";

/**
 * CommunityModLog 엔티티
 *
 * @description 모더레이션 활동 로그를 저장합니다.
 * 모든 모더레이터 액션은 이 테이블에 기록됩니다.
 *
 * **설계 원칙:**
 * - 모든 모더레이션 액션 기록: 투명성 및 감사 추적
 * - targetUserId/targetPostId: 대상 식별
 * - metadata: 추가 정보 JSON 저장 (유연성)
 */
@Entity("community_mod_logs")
@Index(["communityId", "createdAt"])
export class CommunityModLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @BeforeInsert()
  generateUuidV7() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  /**
   * 커뮤니티 ID
   */
  @Column({ type: "uuid" })
  communityId: string;

  /**
   * 모더레이터 ID (액션 수행자)
   */
  @Column({ type: "uuid" })
  moderatorId: string;

  /**
   * 액션 타입
   */
  @Column({ length: 50 })
  action: ModAction;

  /**
   * 대상 사용자 ID
   * - ban_user, unban_user 등에서 사용
   */
  @Column({ type: "uuid", nullable: true })
  targetUserId: string;

  /**
   * 대상 게시물 ID
   * - remove_post, pin_post 등에서 사용
   */
  @Column({ type: "uuid", nullable: true })
  targetPostId: string;

  /**
   * 액션 사유
   */
  @Column("text", { nullable: true })
  reason: string;

  /**
   * 추가 메타데이터
   * - 액션별 추가 정보 저장
   * - 예: { oldValue: 'x', newValue: 'y' }
   */
  @Column("jsonb", { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  // =====================================================
  // 관계 (Relations)
  // =====================================================

  @ManyToOne(() => Community, { onDelete: "CASCADE" })
  @JoinColumn({ name: "communityId" })
  community: Community;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "moderatorId" })
  moderator: User;

  // =====================================================
  // 헬퍼 메서드
  // =====================================================

  /**
   * 액션 설명 가져오기
   */
  getActionDescription(): string {
    return ModActionDescription[this.action] || this.action;
  }

  /**
   * 공개 JSON 변환
   */
  toPublicJSON() {
    return {
      id: this.id,
      communityId: this.communityId,
      moderatorId: this.moderatorId,
      moderator: this.moderator
        ? {
            id: this.moderator.id,
            username: this.moderator.username,
          }
        : null,
      action: this.action,
      actionDescription: this.getActionDescription(),
      targetUserId: this.targetUserId,
      targetPostId: this.targetPostId,
      reason: this.reason,
      metadata: this.metadata,
      createdAt: this.createdAt,
    };
  }
}
