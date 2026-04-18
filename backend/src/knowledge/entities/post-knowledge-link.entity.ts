import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { KnowledgeLinkRole } from "../knowledge.types";

@Entity("post_knowledge_links")
@Index(["userId", "postId"])
@Index(["userId", "nodeId"])
@Index(["postId", "nodeId"], { unique: true })
export class PostKnowledgeLink {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "uuid" })
  postId: string;

  @Column({ type: "uuid" })
  nodeId: string;

  @Column({ type: "uuid", nullable: true })
  sourceId: string | null;

  @Column({ type: "varchar", length: 20 })
  role: KnowledgeLinkRole;

  @Column({ type: "numeric", precision: 5, scale: 4, nullable: true })
  confidence: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
