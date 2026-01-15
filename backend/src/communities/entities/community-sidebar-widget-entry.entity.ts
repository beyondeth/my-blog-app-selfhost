import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from "typeorm";
import { CommunitySidebarWidget } from "./community-sidebar-widget.entity";
import { Community } from "./community.entity";
import { CommunitySidebarWidgetEntryType } from "../enums";

/**
 * 커뮤니티 사이드바 위젯 항목 엔티티
 */
@Entity("community_sidebar_widget_entries")
@Index(["widgetId", "orderIndex"])
export class CommunitySidebarWidgetEntry {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "widget_id" })
  widgetId: string;

  @ManyToOne(() => CommunitySidebarWidget, (widget) => widget.entries, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "widget_id" })
  widget: CommunitySidebarWidget;

  @Column({
    type: "enum",
    enum: CommunitySidebarWidgetEntryType,
    name: "entry_type",
  })
  entryType: CommunitySidebarWidgetEntryType;

  @Column({ name: "order_index", type: "int", default: 0 })
  orderIndex: number;

  @Column({ length: 150, nullable: true })
  label?: string;

  @Column({ type: "text", nullable: true })
  body?: string;

  @Column({ name: "link_url", length: 500, nullable: true })
  linkUrl?: string;

  @Column({ name: "image_url", length: 500, nullable: true })
  imageUrl?: string;

  @Column({ name: "image_alt", length: 255, nullable: true })
  imageAlt?: string;

  @Column({ name: "cta_label", length: 120, nullable: true })
  ctaLabel?: string;

  @Column({ name: "cta_url", length: 500, nullable: true })
  ctaUrl?: string;

  @Column({ name: "target_community_id", type: "uuid", nullable: true })
  targetCommunityId?: string;

  @ManyToOne(() => Community, { onDelete: "SET NULL" })
  @JoinColumn({ name: "target_community_id" })
  targetCommunity?: Community;

  @Column({ name: "starts_at", type: "timestamptz", nullable: true })
  startsAt?: Date;

  @Column({ name: "ends_at", type: "timestamptz", nullable: true })
  endsAt?: Date;

  @Column({ length: 250, nullable: true })
  location?: string;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
