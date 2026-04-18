import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { KnowledgeCandidateStatus, KnowledgeRelationType } from "../knowledge.types";

@Entity("knowledge_candidate_edges")
@Index(["userId", "blogId", "fromSlug", "toSlug", "relationType"], { unique: true })
@Index(["userId", "blogId", "status"])
export class KnowledgeCandidateEdgeEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "uuid", nullable: true })
  blogId: string | null;

  @Column({ type: "varchar", length: 160 })
  fromSlug: string;

  @Column({ type: "varchar", length: 160 })
  toSlug: string;

  @Column({ type: "varchar", length: 30 })
  relationType: KnowledgeRelationType;

  @Column({ type: "varchar", length: 20, default: "provisional" })
  status: KnowledgeCandidateStatus;

  @Column({ type: "int", default: 0 })
  sourceCount: number;

  @Column({ type: "int", default: 0 })
  postCount: number;

  @Column({ type: "numeric", precision: 5, scale: 4, nullable: true })
  avgConfidence: number | null;

  @Column({ type: "text", nullable: true })
  reason: string | null;

  @Column({ type: "jsonb", default: [] })
  evidence: Array<Record<string, unknown>>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
