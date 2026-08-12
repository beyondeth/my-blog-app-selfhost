import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("email_verifications")
@Index("IDX_email_verifications_email_codeHash", ["email", "codeHash"])
@Index(["expiresAt"])
export class EmailVerification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 255 })
  email: string;

  /**
   * Legacy plaintext code retained only for rolling deployments. New rows
   * leave this column empty; a successful legacy verification upgrades the
   * row to codeHash and clears this value.
   */
  @Column({ length: 6, nullable: true })
  code: string | null;

  @Column({ length: 64, nullable: true })
  codeHash: string | null;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: 0 })
  attemptCount: number;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  verifiedAt: Date;

  @Column({ nullable: true, length: 255 })
  sessionToken: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
