import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

/**
 * 사용자 차단 엔티티
 * 한 사용자가 다른 사용자를 차단한 정보를 저장
 */
@Entity("user_blocks")
@Index(["blockerId", "blockedId"])
@Index(["blockedId"])
@Unique(["blockerId", "blockedId"]) // 중복 차단 방지
export class Block {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /**
   * 차단한 사용자 ID
   */
  @Column({ type: "uuid" })
  blockerId: string;

  /**
   * 차단당한 사용자 ID
   */
  @Column({ type: "uuid" })
  blockedId: string;

  /**
   * 차단 사유 (선택사항)
   */
  @Column({ type: "varchar", length: 500, nullable: true })
  reason: string;

  /**
   * 차단 시간
   */
  @CreateDateColumn()
  createdAt: Date;

  // Relations
  /**
   * 차단한 사용자
   */
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "blockerId" })
  blocker: User;

  /**
   * 차단당한 사용자
   */
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "blockedId" })
  blocked: User;
}
