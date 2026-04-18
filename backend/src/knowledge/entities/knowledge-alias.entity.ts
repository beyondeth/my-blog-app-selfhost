import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import {
  KnowledgeAliasSourceType,
  KnowledgeAliasStatus,
} from "../knowledge.types";

@Entity("knowledge_aliases")
@Index(["userId", "blogId", "aliasSlug"], { unique: true })
@Index(["userId", "blogId", "status"])
export class KnowledgeAliasEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "uuid", nullable: true })
  blogId: string | null;

  @Column({ type: "varchar", length: 160 })
  aliasSlug: string;

  @Column({ type: "varchar", length: 200 })
  label: string;

  @Column({ type: "uuid", nullable: true })
  targetNodeId: string | null;

  @Column({ type: "uuid", nullable: true })
  candidateNodeId: string | null;

  @Column({ type: "varchar", length: 20, default: "artifact" })
  sourceType: KnowledgeAliasSourceType;

  @Column({ type: "varchar", length: 20, default: "active" })
  status: KnowledgeAliasStatus;

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
