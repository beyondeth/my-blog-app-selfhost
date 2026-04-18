import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { KnowledgeNodeStatus, KnowledgeNodeType } from "../knowledge.types";

@Entity("knowledge_nodes")
@Index(["userId", "slug"], { unique: true })
@Index(["userId", "parentNodeId"])
@Index(["userId", "status"])
export class KnowledgeNode {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "uuid", nullable: true })
  parentNodeId: string | null;

  @Column({ type: "varchar", length: 140 })
  slug: string;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "varchar", length: 20 })
  nodeType: KnowledgeNodeType;

  @Column({ type: "varchar", length: 500 })
  canonicalPath: string;

  @Column({ type: "text", nullable: true })
  summary: string | null;

  @Column({ type: "jsonb", default: [] })
  aliases: string[];

  @Column({ type: "varchar", length: 20, default: "active" })
  status: KnowledgeNodeStatus;

  @Column({ type: "int", default: 0 })
  postCount: number;

  @Column({ type: "int", default: 0 })
  evidenceCount: number;

  @Column({ type: "timestamp", nullable: true })
  lastCompiledAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
