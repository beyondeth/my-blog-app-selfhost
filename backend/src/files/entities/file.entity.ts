import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { FileContext } from "./file-context.entity";

@Entity("files")
@Index(["fileKey"]) // s3Key가 아닌 fileKey 사용
@Index(["userId"])
@Index(["contextId"])
export class File {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "original_name" })
  originalName: string;

  @Column({ name: "file_name" })
  fileName: string;

  @Column({ name: "file_key" })
  fileKey: string;

  @Column({ name: "file_url" })
  fileUrl: string;

  @Column({ name: "file_size" })
  fileSize: number;

  @Column({ name: "mime_type" })
  mimeType: string;

  @Column({ name: "file_type", default: "general" })
  fileType: string; // 'image', 'document', 'video', 'general'

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  // 새로운 컨텍스트 관계
  @Column({ name: "context_id", type: "uuid", nullable: true })
  contextId: string;

  @ManyToOne(() => FileContext, (context) => context.files, { nullable: true })
  @JoinColumn({ name: "context_id" })
  context: FileContext;

  // 추가 메타데이터
  @Column({ name: "s3_bucket", nullable: true })
  s3Bucket: string;

  @Column({ name: "s3_region", nullable: true })
  s3Region: string;

  @Column({ nullable: true })
  checksum: string; // MD5 체크섬

  @Column({ default: false })
  isOptimized: boolean;

  @Column({ type: "jsonb", nullable: true })
  metadata: {
    width?: number;
    height?: number;
    thumbnails?: string[];
    alt?: string;
    caption?: string;
    exif?: any;
    archived?: boolean;
    format?: string;
    optimized?: boolean;
    optimizedAt?: string;
    originalUrl?: string;
    downloadedAt?: string;
    source?: string;
  };

  @Column({ type: "timestamp", nullable: true })
  expiresAt: Date; // 임시 파일 만료일

  // Post와의 관계 (순환 참조 방지를 위해 lazy loading 사용)
  @ManyToMany("Post", "attachedFiles")
  posts: Promise<any[]>;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
