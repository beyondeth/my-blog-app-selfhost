import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { KnowledgeCompileStatus } from "../knowledge.types";

@Entity("knowledge_compile_runs")
@Index(["userId", "postId", "contentHash"])
@Index(["userId", "status"])
export class KnowledgeCompileRun {
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

  @Column({ type: "varchar", length: 20, default: "queued" })
  status: KnowledgeCompileStatus;

  @Column({ type: "varchar", length: 20, default: "heuristic" })
  mode: "heuristic" | "llm";

  @Column({ type: "text", nullable: true })
  error: string | null;

  @Column({ type: "jsonb", default: {} })
  resultSummary: Record<string, unknown>;

  @Column({ type: "timestamp", nullable: true })
  startedAt: Date | null;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
