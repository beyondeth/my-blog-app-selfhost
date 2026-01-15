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

/**
 * CommunityBan 엔티티
 *
 * @description 커뮤니티에서 차단된 사용자 정보를 저장합니다.
 *
 * **설계 원칙:**
 * - expiresAt: null이면 영구 차단, 날짜면 임시 차단
 * - isActive: 차단 해제 시 false로 변경 (기록 보존)
 * - 차단 사유 필수: 모더레이션 투명성
 */
@Entity("community_bans")
@Index(["communityId", "userId"])
export class CommunityBan {
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
   * 차단된 사용자 ID
   */
  @Column({ type: "uuid" })
  userId: string;

  /**
   * 차단한 모더레이터 ID
   */
  @Column({ type: "uuid" })
  bannedById: string;

  /**
   * 차단 사유
   */
  @Column("text")
  reason: string;

  /**
   * 차단 만료 시간
   * - null: 영구 차단
   * - Date: 해당 시간 후 자동 해제
   */
  @Column({ type: "timestamp", nullable: true })
  expiresAt: Date;

  /**
   * 활성 여부
   * - false: 차단 해제됨 (기록 보존)
   */
  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  // =====================================================
  // 관계 (Relations)
  // =====================================================

  @ManyToOne(() => Community, { onDelete: "CASCADE" })
  @JoinColumn({ name: "communityId" })
  community: Community;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "bannedById" })
  bannedBy: User;

  // =====================================================
  // 헬퍼 메서드
  // =====================================================

  /**
   * 영구 차단 여부 확인
   */
  isPermanent(): boolean {
    return this.expiresAt === null;
  }

  /**
   * 차단 만료 여부 확인
   */
  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  /**
   * 유효한 차단 여부 확인
   */
  isEffective(): boolean {
    return this.isActive && !this.isExpired();
  }

  /**
   * 공개 JSON 변환
   */
  toPublicJSON() {
    return {
      id: this.id,
      communityId: this.communityId,
      userId: this.userId,
      user: this.user
        ? {
            id: this.user.id,
            username: this.user.username,
            profileImage: (this.user as any).profile?.profileImage || null,
          }
        : null,
      bannedById: this.bannedById,
      bannedBy: this.bannedBy
        ? {
            id: this.bannedBy.id,
            username: this.bannedBy.username,
          }
        : null,
      reason: this.reason,
      expiresAt: this.expiresAt,
      isPermanent: this.isPermanent(),
      isActive: this.isActive,
      createdAt: this.createdAt,
    };
  }
}
