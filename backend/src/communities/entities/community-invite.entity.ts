import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { Community } from "./community.entity";
import { User } from "../../users/entities/user.entity";

/**
 * CommunityInvite 엔티티
 *
 * @description 커뮤니티 초대 링크/코드 정보를 저장합니다.
 * PRIVATE 또는 RESTRICTED 커뮤니티에서 초대 링크를 통한 가입을 관리합니다.
 *
 * **설계 원칙:**
 * - 고유 토큰으로 초대 링크 생성 (/invite/{token})
 * - 사용 횟수 제한 (maxUses: 0 = 무제한)
 * - 만료 시간 설정
 * - 활성/비활성 상태 관리
 */
@Entity("community_invites")
@Index(["communityId"])
@Index(["token"])
@Index(["isActive", "expiresAt"])
export class CommunityInvite {
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
   * 초대 생성자 ID
   */
  @Column({ type: "uuid" })
  createdById: string;

  /**
   * 초대 토큰 (고유)
   * - URL에서 사용: /invite/{token}
   * - 64자 랜덤 문자열
   */
  @Column({ length: 64, unique: true })
  token: string;

  /**
   * 최대 사용 횟수
   * - 0: 무제한
   * - N: N번까지 사용 가능
   */
  @Column({ default: 0 })
  maxUses: number;

  /**
   * 현재 사용 횟수
   */
  @Column({ default: 0 })
  useCount: number;

  /**
   * 만료 시간
   */
  @Column({ type: "timestamptz" })
  expiresAt: Date;

  /**
   * 활성화 여부
   * - false: 비활성화됨 (수동으로 삭제됨)
   */
  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // =====================================================
  // 관계 (Relations)
  // =====================================================

  @ManyToOne(() => Community, { onDelete: "CASCADE" })
  @JoinColumn({ name: "communityId" })
  community: Community;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "createdById" })
  createdBy: User;

  // =====================================================
  // 헬퍼 메서드
  // =====================================================

  /**
   * 초대 링크가 유효한지 확인
   * - 활성 상태
   * - 만료되지 않음
   * - 사용 횟수 초과하지 않음
   */
  isValid(): boolean {
    if (!this.isActive) return false;
    if (new Date() > this.expiresAt) return false;
    if (this.maxUses > 0 && this.useCount >= this.maxUses) return false;
    return true;
  }

  /**
   * 만료 여부 확인
   */
  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  /**
   * 사용 횟수 초과 여부 확인
   */
  isMaxUsesReached(): boolean {
    return this.maxUses > 0 && this.useCount >= this.maxUses;
  }

  /**
   * 남은 사용 횟수
   * - 무제한인 경우 null 반환
   */
  getRemainingUses(): number | null {
    if (this.maxUses === 0) return null;
    return Math.max(0, this.maxUses - this.useCount);
  }

  /**
   * 공개 JSON 변환
   */
  toPublicJSON() {
    return {
      id: this.id,
      communityId: this.communityId,
      token: this.token,
      maxUses: this.maxUses,
      useCount: this.useCount,
      remainingUses: this.getRemainingUses(),
      expiresAt: this.expiresAt,
      isActive: this.isActive,
      isValid: this.isValid(),
      createdAt: this.createdAt,
      createdBy: this.createdBy
        ? {
            id: this.createdBy.id,
            username: this.createdBy.username,
          }
        : null,
    };
  }
}
