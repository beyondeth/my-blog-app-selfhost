import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Order } from "./order.entity";
import { DeliveryItem } from "./delivery-item.entity";
import { User } from "../../users/entities/user.entity";

/**
 * 다운로드 이력 엔티티
 *
 * per-item 다운로드 추적 (기존 order.metadata.downloadCount 대체).
 * 다운로드 횟수 제한(5회/항목/주문) 및 감사 로그 용도.
 */
@Entity("download_logs")
@Index(["orderId", "deliveryItemId"])
@Index(["buyerId"])
@Index(["deliveryItemId", "downloadedAt"])
export class DownloadLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: "CASCADE" })
  @JoinColumn({ name: "orderId" })
  order: Order;

  @Column({ type: "uuid" })
  deliveryItemId: string;

  @ManyToOne(() => DeliveryItem, { onDelete: "CASCADE" })
  @JoinColumn({ name: "deliveryItemId" })
  deliveryItem: DeliveryItem;

  @Column({ type: "uuid", nullable: true })
  buyerId: string | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "buyerId" })
  buyer: User | null;

  @Column({ type: "timestamptz", default: () => "now()" })
  downloadedAt: Date;

  /** IP 주소 (암호화 권장, select: false) */
  @Column({ type: "varchar", length: 150, nullable: true, select: false })
  ipAddress: string | null;

  /** User-Agent (select: false) */
  @Column({ type: "text", nullable: true, select: false })
  userAgent: string | null;

  /** 확장 메타데이터 (presigned URL 만료 시각, 파일 크기 등) */
  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;
}
