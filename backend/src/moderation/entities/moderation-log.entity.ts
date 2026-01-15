import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity"; // Relative path check needed

export enum ModerationAction {
  WARN = "WARN",
  MUTE = "MUTE", // Not used yet, but reserved
  KICK = "KICK", // Not used yet
  BAN_ACCOUNT = "BAN_ACCOUNT",
  BAN_USER = "BAN_USER", // Alias/Compatibility
  SUSPEND_USER = "SUSPEND_USER",
  UNBAN_USER = "UNBAN_USER",
  BLOCK_IP = "BLOCK_IP",
  UNBLOCK_IP = "UNBLOCK_IP",
}

@Entity("moderation_logs")
@Index(["adminId"])
@Index(["targetUserId"])
@Index(["targetIp"])
@Index(["createdAt"])
export class ModerationLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /**
   * 조치를 취한 관리자 ID
   */
  @Column({ name: "admin_id", type: "uuid" })
  adminId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "admin_id" })
  admin: User;

  /**
   * 제재 대상 유저 ID (비회원인 경우 null)
   */
  @Column({ name: "target_user_id", type: "uuid", nullable: true })
  targetUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "target_user_id" })
  targetUser: User;

  /**
   * 제재 대상 IP (식별 가능한 경우)
   * - 평문 저장 (감사 목적)
   * - 필요 시 마스킹 가능하지만, 운영 편의상 평문 유지 권장
   */
  @Column({ name: "target_ip", length: 45, nullable: true })
  targetIp: string;

  /**
   * 취해진 조치 유형
   */
  @Column({
    type: "enum",
    enum: ModerationAction,
    default: ModerationAction.WARN,
  })
  action: ModerationAction;

  /**
   * 제재 기간 (분 단위)
   * - null: 영구 제재
   */
  @Column({ name: "duration_minutes", type: "int", nullable: true })
  durationMinutes: number;

  /**
   * 공개 사유 (유저에게 통보됨)
   */
  @Column("text")
  reason: string;

  /**
   * 관리자 메모 (관리자 전용)
   */
  @Column({ name: "admin_memo", type: "text", nullable: true })
  adminMemo: string;

  /**
   * 증거 스냅샷 (JSON)
   * - 제재 시점의 원본 컨텐츠
   * - { contentId, contentType, title, body, ... }
   */
  @Column({ name: "evidence_snapshot", type: "jsonb", nullable: true })
  evidenceSnapshot: Record<string, any>;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
