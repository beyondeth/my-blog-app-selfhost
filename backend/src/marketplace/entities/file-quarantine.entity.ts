import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from "typeorm";
import { DeliveryItem } from "./delivery-item.entity";
import { User } from "../../users/entities/user.entity";

/**
 * 파일 격리 엔티티
 *
 * S3 격리 → 검증 플로우 추적.
 * 판매자가 파일을 업로드하면 quarantine/ 경로에 저장 후,
 * magic bytes 검증 + (선택적) 바이러스 스캔을 거쳐 verified/ 경로로 이동.
 *
 * S3 경로 규칙:
 *   격리: marketplace/quarantine/{uploaderId}/{uuid}.{ext}
 *   검증: marketplace/verified/{productDetailId}/{uuid}.{ext}
 */
@Entity("file_quarantine")
@Index(["status"])
@Index(["uploaderId"])
@Index(["deliveryItemId"])
@Check(`"status" IN ('pending', 'scanning', 'clean', 'infected', 'failed')`)
export class FileQuarantine {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** 연결된 배송 항목 (파일 승인 후 연결) */
  @Column({ type: "uuid", nullable: true })
  deliveryItemId: string | null;

  @ManyToOne(() => DeliveryItem, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "deliveryItemId" })
  deliveryItem: DeliveryItem | null;

  /** 업로더 (판매자) */
  @Column({ type: "uuid" })
  uploaderId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "uploaderId" })
  uploader: User;

  /** S3 격리 경로 키 */
  @Column({ type: "varchar", length: 500 })
  quarantineKey: string;

  /** S3 검증 완료 경로 키 (승인 후 설정) */
  @Column({ type: "varchar", length: 500, nullable: true })
  verifiedKey: string | null;

  /** 원본 파일명 */
  @Column({ type: "varchar", length: 300 })
  originalName: string;

  /** MIME 타입 */
  @Column({ type: "varchar", length: 100 })
  mimeType: string;

  /** 파일 크기 (bytes) */
  @Column({ type: "bigint" })
  fileSize: number;

  /** 검증 상태 */
  @Column({ type: "varchar", length: 20, default: "pending" })
  status: "pending" | "scanning" | "clean" | "infected" | "failed";

  /** Magic bytes 검증 통과 여부 */
  @Column({ type: "boolean", nullable: true })
  magicBytesValid: boolean | null;

  /** 스캔 결과 상세 (엔진명, 위협 목록, 스캔 시각) */
  @Column({ type: "jsonb", nullable: true })
  scanResult: {
    engine?: string;
    threats?: string[];
    scannedAt?: string;
  } | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
