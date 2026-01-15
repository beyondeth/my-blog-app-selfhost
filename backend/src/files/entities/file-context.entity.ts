import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { File } from "./file.entity";

export const FileContextType = {
  PROFILE: "profile",
  POST: "post",
  BLOG: "blog",
  COMMUNITY: "community",
  COMMUNITY_WIDGET: "community_widget",
  SYSTEM: "system",
} as const;

export type FileContextType =
  (typeof FileContextType)[keyof typeof FileContextType];

export const FilePurpose = {
  AVATAR: "avatar",
  COVER: "cover",
  THUMBNAIL: "thumbnail",
  CONTENT: "content",
  ATTACHMENT: "attachment",
  LOGO: "logo",
  BANNER: "banner",
  FAVICON: "favicon",
  ICON: "icon",
  GENERAL: "general",
  WIDGET_ASSET: "widget_asset",
} as const;

export type FilePurpose = (typeof FilePurpose)[keyof typeof FilePurpose];

/**
 * 파일 컨텍스트 엔티티
 * 파일의 용도와 소속을 명확하게 관리
 */
@Entity("file_contexts")
@Index(["contextType", "contextId"])
@Index(["ownerId"])
export class FileContext {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: FileContextType,
  })
  contextType: FileContextType;

  @Column({ type: "uuid", nullable: true })
  contextId: string; // postId, blogId, userId 등

  @Column({ type: "uuid" })
  ownerId: string; // 파일 소유자 userId

  @Column({
    type: "enum",
    enum: FilePurpose,
  })
  purpose: FilePurpose;

  @Column({ default: 1 })
  version: number; // 버전 관리

  @Column({ default: true })
  isActive: boolean; // 활성 상태

  @Column({ type: "int", default: 0 })
  fileCount: number; // 연결된 파일 수

  @Column({ type: "bigint", default: 0 })
  totalSize: number; // 총 파일 크기 (bytes)

  @Column({ type: "int", nullable: true })
  maxFiles?: number; // 최대 파일 수 제한

  @Column({ type: "bigint", nullable: true })
  maxFileSize?: number; // 최대 파일 크기 제한 (bytes)

  @Column({ type: "simple-array", nullable: true })
  allowedTypes?: string[]; // 허용된 MIME 타입

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>; // 추가 메타데이터

  @Column({ nullable: true })
  general?: string; // General purpose field

  @OneToMany(() => File, (file) => file.context)
  files: File[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
