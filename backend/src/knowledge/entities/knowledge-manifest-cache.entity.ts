import {
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("knowledge_manifest_cache")
export class KnowledgeManifestCache {
  @PrimaryColumn({ type: "uuid" })
  userId: string;

  @Column({ type: "int", default: 1 })
  version: number;

  @Column({ type: "jsonb", default: {} })
  snapshot: Record<string, unknown>;

  @UpdateDateColumn()
  updatedAt: Date;
}
