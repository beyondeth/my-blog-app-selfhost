import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Message } from "./message.entity";

@Entity("conversations")
@Index(["user1Id", "user2Id"], { unique: true })
@Index(["lastMessageAt"])
@Index(["type", "lastMessageAt"])
export class Conversation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  user1Id: string;

  @Column({ type: "uuid" })
  user2Id: string;

  /** 대화 유형: social(소셜 DM) | transaction(거래 채팅) */
  @Column({ type: "varchar", length: 20, default: "social" })
  type: "social" | "transaction";

  /** 연결된 주문 ID (거래 채팅 전용) */
  @Column({ type: "uuid", nullable: true })
  orderId: string | null;

  /** 연결된 상품 포스트 ID (거래 채팅 전용) */
  @Column({ type: "uuid", nullable: true })
  productPostId: string | null;

  /** 보존 기간 (일): social=30, transaction=90 */
  @Column({ type: "integer", default: 30 })
  retentionDays: number;

  /** 관리자 열람 가능 여부 (분쟁 해결용) */
  @Column({ type: "boolean", default: false })
  isAdminViewable: boolean;

  @Column({ type: "timestamptz", nullable: true })
  lastMessageAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  user1LastReadAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  user2LastReadAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  user1DeletedAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  user2DeletedAt: Date;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;

  // Relations
  // 법적 보호: 사용자 간 분쟁 대비 보관 (social: 30일, transaction: 90일)
  // 사용자 삭제 시 CASCADE 아닌 SET NULL로 변경하여 메시지 보관
  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "user1Id" })
  user1: User;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "user2Id" })
  user2: User;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}
