import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { KnowledgeArtifactStatus } from "../knowledge.types";

@Entity("knowledge_source_artifacts")
@Index(["userId", "postId"], { unique: true })
@Index(["userId", "status"])
export class KnowledgeSourceArtifact {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "uuid", nullable: true })
  blogId: string | null;

  @Column({ type: "uuid" })
  postId: string;

  @Column({ type: "uuid", nullable: true })
  sourceId: string | null;

  @Column({ type: "varchar", length: 128 })
  contentHash: string;

  @Column({ type: "jsonb", default: {} })
  artifact: Record<string, unknown>;

  @Column({ type: "jsonb", nullable: true })
  draftPayload: Record<string, unknown> | null;

  @Column({ type: "varchar", length: 20, default: "active" })
  status: KnowledgeArtifactStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
