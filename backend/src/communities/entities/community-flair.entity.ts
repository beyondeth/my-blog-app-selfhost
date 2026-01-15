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
import { FlairType } from "../enums";

/**
 * CommunityFlair 엔티티
 *
 * @description 커뮤니티 플레어(태그) 정보를 저장합니다.
 * 게시물 플레어와 사용자 플레어 두 가지 타입을 지원합니다.
 *
 * **설계 원칙:**
 * - POST 타입: 게시물 카테고리/태그 (예: "질문", "정보", "토론")
 * - USER 타입: 멤버 역할/특성 (예: "뉴비", "고수", "기여자")
 * - 배경색/텍스트색으로 시각적 구분
 * - isModOnly: 모더레이터만 사용 가능한 플레어
 */
@Entity("community_flairs")
@Index(["communityId", "type"])
export class CommunityFlair {
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
   * 플레어 이름
   */
  @Column({ length: 64 })
  name: string;

  /**
   * 배경색 (HEX)
   * - 예: #FF5733
   */
  @Column({ nullable: true, length: 7 })
  backgroundColor: string;

  /**
   * 텍스트색 (HEX)
   * - 예: #FFFFFF
   */
  @Column({ nullable: true, length: 7 })
  textColor: string;

  /**
   * 플레어 타입
   * - post: 게시물용
   * - user: 사용자용
   */
  @Column({
    type: "enum",
    enum: FlairType,
    default: FlairType.POST,
  })
  type: FlairType;

  /**
   * 활성화 여부
   */
  @Column({ default: true })
  isEnabled: boolean;

  /**
   * 모더레이터 전용 여부
   * - true: 모더레이터만 사용/지정 가능
   */
  @Column({ default: false })
  isModOnly: boolean;

  /**
   * 표시 순서
   */
  @Column({ default: 0 })
  displayOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  // =====================================================
  // 관계 (Relations)
  // =====================================================

  @ManyToOne(() => Community, (community) => community.flairs, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "communityId" })
  community: Community;

  // =====================================================
  // 헬퍼 메서드
  // =====================================================

  /**
   * 게시물 플레어 여부 확인
   */
  isPostFlair(): boolean {
    return this.type === FlairType.POST;
  }

  /**
   * 사용자 플레어 여부 확인
   */
  isUserFlair(): boolean {
    return this.type === FlairType.USER;
  }

  /**
   * 공개 JSON 변환
   */
  toPublicJSON() {
    return {
      id: this.id,
      communityId: this.communityId,
      name: this.name,
      backgroundColor: this.backgroundColor,
      textColor: this.textColor,
      type: this.type,
      isEnabled: this.isEnabled,
      isModOnly: this.isModOnly,
      displayOrder: this.displayOrder,
    };
  }
}
