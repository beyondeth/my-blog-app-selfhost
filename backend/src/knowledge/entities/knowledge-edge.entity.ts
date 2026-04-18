import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { KnowledgeRelationType } from "../knowledge.types";

@Entity("knowledge_edges")
@Index(["userId", "sourceId"])
@Index(["userId", "sourceId", "fromNodeId", "toNodeId", "relationType"], {
  unique: true,
})
@Index(["userId", "fromNodeId"])
@Index(["userId", "toNodeId"])
export class KnowledgeEdge {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "uuid" })
  sourceId: string;

  @Column({ type: "uuid" })
  fromNodeId: string;

  @Column({ type: "uuid" })
  toNodeId: string;

  @Column({ type: "varchar", length: 30 })
  relationType: KnowledgeRelationType;

  @Column({ type: "numeric", precision: 5, scale: 4, nullable: true })
  confidence: number | null;

  @Column({ type: "text", nullable: true })
  reason: string | null;

  @Column({ type: "int", default: 1 })
  evidenceCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
