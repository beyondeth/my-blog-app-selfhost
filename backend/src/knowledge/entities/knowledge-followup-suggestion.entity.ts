import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { KnowledgeFollowupStatus } from "../knowledge.types";

@Entity("knowledge_followup_suggestions")
@Index(["userId", "status"])
@Index(["userId", "postId"])
export class KnowledgeFollowupSuggestion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "uuid", nullable: true })
  postId: string | null;

  @Column({ type: "uuid", nullable: true })
  nodeId: string | null;

  @Column({ type: "varchar", length: 240 })
  title: string;

  @Column({ type: "text" })
  reason: string;

  @Column({ type: "varchar", length: 20, default: "pending" })
  status: KnowledgeFollowupStatus;

  @Column({ type: "timestamp", nullable: true })
  dismissedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
