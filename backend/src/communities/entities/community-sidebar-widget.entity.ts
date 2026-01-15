import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from "typeorm";
import { Community } from "./community.entity";
import { CommunitySidebarWidgetEntry } from "./community-sidebar-widget-entry.entity";
import { CommunitySidebarWidgetType } from "../enums";

/**
 * 커뮤니티 사이드바 위젯 엔티티
 */
@Entity("community_sidebar_widgets")
@Index(["communityId", "type"])
@Index(["communityId", "orderIndex"])
export class CommunitySidebarWidget {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "community_id" })
  communityId: string;

  @ManyToOne(() => Community, (community) => community.sidebarWidgets, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "community_id" })
  community: Community;

  @Column({
    type: "enum",
    enum: CommunitySidebarWidgetType,
  })
  type: CommunitySidebarWidgetType;

  @Column({ name: "order_index", type: "int", default: 0 })
  orderIndex: number;

  @Column({ name: "is_enabled", type: "boolean", default: true })
  isEnabled: boolean;

  @Column({ length: 120, nullable: true })
  title?: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(() => CommunitySidebarWidgetEntry, (entry) => entry.widget, {
    cascade: true,
  })
  entries: CommunitySidebarWidgetEntry[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
