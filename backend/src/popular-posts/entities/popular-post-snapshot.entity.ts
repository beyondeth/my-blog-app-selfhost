import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import { PopularPeriod, PopularSourceType } from "../types/popular-post.types";

@Entity("popular_post_snapshots")
@Index("idx_popular_snapshots_source_period_rank", ["sourceType", "period", "rank"])
@Index("idx_popular_snapshots_source_period_post", [
  "sourceType",
  "period",
  "postId",
])
export class PopularPostSnapshot {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "timestamptz", name: "snapshotAt" })
  snapshotAt: Date;

  @Column({ type: "varchar", length: 10 })
  period: PopularPeriod;

  @Column({ type: "varchar", length: 10, name: "sourceType" })
  sourceType: PopularSourceType;

  @Column({ type: "uuid", name: "postId" })
  postId: string;

  @Column({ type: "int" })
  score: number;

  @Column({ type: "int" })
  rank: number;

  @Column({ type: "jsonb", name: "metaJson", default: () => "'{}'::jsonb" })
  metaJson: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz", name: "createdAt" })
  createdAt: Date;
}
