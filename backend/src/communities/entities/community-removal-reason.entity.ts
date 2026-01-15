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

/**
 * CommunityRemovalReason 엔티티
 *
 * @description 커뮤니티별 삭제 사유 템플릿을 저장합니다.
 * 모더레이터가 게시물/댓글 삭제 시 미리 정의된 사유를 선택할 수 있습니다.
 *
 * **설계 원칙:**
 * - 커뮤니티별 독립적인 삭제 사유 관리
 * - displayOrder로 표시 순서 정렬
 * - 삭제된 사용자에게 메시지 전송 옵션
 */
@Entity("community_removal_reasons")
@Index(["communityId", "displayOrder"])
export class CommunityRemovalReason {
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
   * 삭제 사유 제목
   * 예: "스팸", "규칙 1 위반", "부적절한 콘텐츠"
   */
  @Column({ length: 100 })
  title: string;

  /**
   * 삭제 사유 상세 설명
   * 삭제된 게시물 작성자에게 표시될 수 있음
   */
  @Column({ type: "text", nullable: true })
  description?: string;

  /**
   * 표시 순서 (낮을수록 먼저 표시)
   */
  @Column({ default: 0 })
  displayOrder: number;

  /**
   * 사용자에게 알림 메시지 포함 여부
   * - true: 삭제 시 작성자에게 사유 공개
   * - false: 사유 비공개 (모더레이터만 확인 가능)
   */
  @Column({ default: true })
  notifyUser: boolean;

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
      notifyUser: this.notifyUser,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
