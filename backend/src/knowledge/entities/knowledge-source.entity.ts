import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { KnowledgeSourceStatus } from "../knowledge.types";

@Entity("knowledge_sources")
@Index(["userId", "postId"], { unique: true })
@Index(["userId", "status"])
export class KnowledgeSource {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "uuid", nullable: true })
  blogId: string | null;

  @Column({ type: "uuid" })
  postId: string;

  @Column({ type: "int", default: 1 })
  postVersion: number;

  @Column({ type: "varchar", length: 128 })
  contentHash: string;

  @Column({ type: "jsonb", default: {} })
  normalizedPayload: Record<string, unknown>;

  @Column({ type: "jsonb", default: [] })
  outboundUrls: string[];

  @Column({ type: "varchar", length: 20, default: "pending" })
  status: KnowledgeSourceStatus;

  @Column({ type: "timestamp", nullable: true })
  compiledAt: Date | null;

  @Column({ type: "text", nullable: true })
  lastError: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
