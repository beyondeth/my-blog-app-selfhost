import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { KnowledgeCandidateStatus, KnowledgeNodeType } from "../knowledge.types";

@Entity("knowledge_candidate_nodes")
@Index(["userId", "blogId", "slug"], { unique: true })
@Index(["userId", "blogId", "status"])
@Index(["userId", "blogId", "canonicalNodeId"])
export class KnowledgeCandidateNodeEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "uuid", nullable: true })
  blogId: string | null;

  @Column({ type: "varchar", length: 160 })
  slug: string;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "varchar", length: 20 })
  nodeType: KnowledgeNodeType;

  @Column({ type: "varchar", length: 160, nullable: true })
  proposedParentSlug: string | null;

  @Column({ type: "text", nullable: true })
  summary: string | null;

  @Column({ type: "varchar", length: 20, default: "provisional" })
  status: KnowledgeCandidateStatus;

  @Column({ type: "uuid", nullable: true })
  canonicalNodeId: string | null;

  @Column({ type: "int", default: 0 })
  sourceCount: number;

  @Column({ type: "int", default: 0 })
  postCount: number;

  @Column({ type: "numeric", precision: 5, scale: 4, nullable: true })
  avgConfidence: number | null;

  @Column({ type: "jsonb", default: [] })
  evidence: Array<Record<string, unknown>>;

  @Column({ type: "jsonb", default: [] })
  aliases: string[];

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
