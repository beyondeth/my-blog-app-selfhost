import {
  Entity,
  Column,
  CreateDateColumn,
  Index,
  PrimaryColumn,
} from "typeorm";

@Entity("ip_block_list")
@Index(["expiresAt"])
export class IpBlockList {
  /**
   * 차단된 IP 주소 (PK)
   */
  @PrimaryColumn({ name: "ip_address", length: 150 })
  ipAddress: string;

  /**
   * 차단 사유
   */
  @Column("text")
  reason: string;

  /**
   * 차단한 관리자 ID
   */
  @Column({ name: "blocked_by", type: "uuid", nullable: true })
  blockedBy: string;

  /**
   * 차단 만료 시간
   * - null: 영구 차단
   */
  @Column({ name: "expires_at", type: "timestamp", nullable: true })
  expiresAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
