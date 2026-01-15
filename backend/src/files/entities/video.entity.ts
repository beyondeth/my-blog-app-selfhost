/**
 * Video Entity
 *
 * 비디오 파일 메타데이터 저장
 * - Cloudflare R2 스토리지 사용
 * - 원본(raw) 및 압축본(processed) 경로 관리
 * - BullMQ 처리 상태 추적
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

export enum VideoStatus {
  UPLOADING = "uploading", // 원본 업로드 중
  PROCESSING = "processing", // FFmpeg 압축 처리 중
  READY = "ready", // 압축 완료, 재생 가능
  FAILED = "failed", // 처리 실패
}

@Entity("videos")
@Index(["userId"])
@Index(["status"])
@Index(["createdAt"])
export class Video {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  // R2 스토리지 경로
  @Column({ name: "storage_key_raw" })
  storageKeyRaw: string; // videos/raw/{uuid}.mp4

  @Column({ name: "storage_key_processed", nullable: true })
  storageKeyProcessed: string | null; // videos/processed/{uuid}.mp4

  @Column({ name: "thumbnail_key", nullable: true })
  thumbnailKey: string | null; // videos/thumbnails/{uuid}.jpg

  // 파일 메타데이터
  @Column({ name: "original_name" })
  originalName: string; // 사용자가 업로드한 원본 파일명

  @Column({ name: "mime_type", default: "video/mp4" })
  mimeType: string;

  @Column({ default: 720 })
  resolution: number; // 480 | 720 | 1080

  @Column({ name: "size_raw", type: "bigint" })
  sizeRaw: number; // 원본 파일 크기 (bytes)

  @Column({ name: "size_processed", type: "bigint", nullable: true })
  sizeProcessed: number | null; // 압축 파일 크기 (bytes)

  @Column({ type: "float", nullable: true })
  duration: number | null; // 비디오 길이 (초)

  // 처리 상태
  @Column({
    type: "enum",
    enum: VideoStatus,
    default: VideoStatus.UPLOADING,
  })
  status: VideoStatus;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage: string | null; // 처리 실패 시 에러 메시지

  @Column({ name: "processing_started_at", type: "timestamp", nullable: true })
  processingStartedAt: Date | null;

  @Column({
    name: "processing_completed_at",
    type: "timestamp",
    nullable: true,
  })
  processingCompletedAt: Date | null;

  // 타임스탬프
  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt: Date | null; // 원본 청소 시점 (soft delete)

  /**
   * 만료 시점
   * - 업로드 시 24시간 후로 설정 (임시 파일)
   * - 포스트 저장 시 null로 설정 (영구 보관)
   * - 만료 시점 지나면 크론에서 자동 삭제
   */
  @Column({ name: "expires_at", type: "timestamp", nullable: true })
  @Index("IDX_videos_expires_at")
  expiresAt: Date | null;

  // 추가 메타데이터 (FFprobe 결과 등)
  @Column({ type: "jsonb", nullable: true })
  metadata: {
    width?: number;
    height?: number;
    bitrate?: number;
    codec?: string;
    fps?: number;
    aspectRatio?: string;
  } | null;
}
