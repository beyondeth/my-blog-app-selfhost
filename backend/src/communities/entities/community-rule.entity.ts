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
import { Community } from "./community.entity";

/**
 * CommunityRule 엔티티
 *
 * @description 커뮤니티 규칙 정보를 저장합니다.
 * Reddit의 subreddit rules와 유사한 기능입니다.
 *
 * **설계 원칙:**
 * - displayOrder로 규칙 순서 관리
 * - 최대 15개 규칙 권장 (UI 가이드라인)
 */
@Entity("community_rules")
@Index(["communityId", "displayOrder"])
export class CommunityRule {
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
   * 규칙 제목
   * - 짧고 명확하게 (예: "스팸 금지", "존중하는 언어 사용")
   */
  @Column({ length: 100 })
  title: string;

  /**
   * 규칙 설명
   * - 상세 설명 및 예시
   */
  @Column("text")
  description: string;

  /**
   * 표시 순서
   * - 0부터 시작, 낮을수록 상단에 표시
   */
  @Column({ default: 0 })
  displayOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  // =====================================================
  // 관계 (Relations)
  // =====================================================

  @ManyToOne(() => Community, (community) => community.rules, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "communityId" })
  community: Community;

  // =====================================================
  // 헬퍼 메서드
  // =====================================================

  /**
   * 공개 JSON 변환
   */
  toPublicJSON() {
    return {
      id: this.id,
      communityId: this.communityId,
      title: this.title,
      description: this.description,
      displayOrder: this.displayOrder,
      createdAt: this.createdAt,
    };
  }
}
