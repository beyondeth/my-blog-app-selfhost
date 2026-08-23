import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { User } from "../../users/entities/user.entity";

@Entity("refresh_sessions")
@Index(["jti"], { unique: true })
@Index(["userId", "revokedAt"])
@Index(["familyId"])
export class RefreshSession {
  @PrimaryColumn("uuid")
  id: string;

  @BeforeInsert()
  generateUuidV7() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  @Column({ type: "uuid" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "uuid" })
  jti: string;

  @Column({ type: "uuid" })
  familyId: string;

  @Column({ type: "varchar", length: 64 })
  tokenHash: string;

  @Column({ type: "timestamp" })
  expiresAt: Date;

  @Column({ type: "timestamp", nullable: true })
  revokedAt: Date | null;

  @Column({ type: "uuid", nullable: true })
  replacedBySessionId: string | null;

  @Column({ type: "timestamp", nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  userAgent: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  deviceName: string | null;

  @Column({ type: "inet", nullable: true })
  ipAddress: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
