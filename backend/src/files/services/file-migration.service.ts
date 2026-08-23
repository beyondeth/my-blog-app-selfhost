import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, Like } from "typeorm";
import { File } from "../entities/file.entity";
import {
  FileContext,
  FileContextType,
  FilePurpose,
} from "../entities/file-context.entity";
import { S3Service } from "./s3.service";
import { ContextualFileService } from "./contextual-file.service";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";

export interface MigrationProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  percentage: number;
}

export interface MigrationResult {
  startTime: Date;
  endTime: Date;
  duration: number;
  progress: MigrationProgress;
  errors: Array<{ fileId: string; error: string }>;
  success?: boolean;
}

export interface MigrationOptions {
  batchSize: number;
  dryRun: boolean;
}

/**
 * v1 → v2 파일 시스템 마이그레이션 서비스
 */
@Injectable()
export class FileMigrationService {
  private readonly logger = new Logger(FileMigrationService.name);
  private activeMigration: Promise<MigrationResult> | null = null;
  private migrationProgress: MigrationProgress = {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    percentage: 0,
  };

  constructor(
    @InjectRepository(File)
    private fileRepository: Repository<File>,
    @InjectRepository(FileContext)
    private contextRepository: Repository<FileContext>,
    private s3Service: S3Service,
    private contextualFileService: ContextualFileService,
  ) {}

  /**
   * 전체 마이그레이션 실행
   */
  async runFullMigration(): Promise<MigrationResult> {
    const startTime = new Date();
    const errors: Array<{ fileId: string; error: string }> = [];

    try {
      // 1. 기존 파일 분석
      const analysis = await this.analyzeExistingFiles();
      this.logger.log("File analysis completed:", analysis);

      // 2. 배치 단위로 마이그레이션
      const batchSize = 100;
      let hasMore = true;

      while (hasMore) {
        const batch = await this.getNextBatch(batchSize);
        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        for (const file of batch) {
          try {
            await this.migrateFile(file);
            this.migrationProgress.successful++;
          } catch (error) {
            this.migrationProgress.failed++;
            errors.push({
              fileId: file.id,
              error: error.message,
            });
            this.logger.error(`Failed to migrate file ${file.id}:`, error);
          }

          this.migrationProgress.processed++;
          this.updateProgress();
        }
      }

      const endTime = new Date();
      return {
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        progress: this.migrationProgress,
        errors,
      };
    } catch (error) {
      this.logger.error("Migration failed:", error);
      throw error;
    }
  }

  /**
   * 기존 파일 분석
   */
  async analyzeExistingFiles() {
    const total = await this.fileRepository.count();
    const v1Files = await this.fileRepository.count({
      where: { fileKey: Not(Like("v2/%")) },
    });
    const v2Files = await this.fileRepository.count({
      where: { fileKey: Like("v2/%") },
    });

    const fileTypes = await this.fileRepository
      .createQueryBuilder("file")
      .select("file.fileType", "type")
      .addSelect("COUNT(*)", "count")
      .groupBy("file.fileType")
      .getRawMany();

    this.migrationProgress.total = v1Files;

    return {
      total,
      v1Files,
      v2Files,
      fileTypes,
      needsMigration: v1Files > 0,
    };
  }

  /**
   * 다음 마이그레이션 배치 가져오기
   */
  private async getNextBatch(batchSize: number): Promise<File[]> {
    return this.fileRepository.find({
      where: {
        fileKey: Not(Like("v2/%")),
        contextId: null, // 아직 마이그레이션되지 않은 파일
      },
      take: batchSize,
      relations: ["user"],
    });
  }

  /**
   * 개별 파일 마이그레이션
   */
  private async migrateFile(file: File): Promise<void> {
    // 1. 파일 용도 추론
    const { contextType, purpose } = await this.inferFilePurpose(file);

    // 2. FileContext 생성 또는 조회
    const context = await this.findOrCreateContext(
      contextType,
      this.getContextId(file, contextType),
      file.userId,
      purpose,
    );

    // 3. 새로운 S3 키 생성
    const newS3Key = this.generateNewS3Key(file, context);

    // 4. S3에서 파일 복사
    try {
      await this.s3Service.copyObject(file.fileKey, newS3Key);
      this.logger.log(`Copied S3 object: ${file.fileKey} → ${newS3Key}`);
    } catch (error) {
      // S3 복사 실패 시 스킵
      this.logger.warn(
        `S3 copy failed for ${file.fileKey}, using existing key`,
      );
      this.migrationProgress.skipped++;
      return;
    }

    // 5. 파일 레코드 업데이트
    file.fileKey = newS3Key;
    file.contextId = context.id;
    file.s3Bucket = process.env.AWS_S3_BUCKET;
    file.s3Region = process.env.AWS_REGION || "us-east-1";

    await this.fileRepository.save(file);

    // 6. Context 통계 업데이트
    context.fileCount++;
    context.totalSize = Number(context.totalSize) + file.fileSize;
    await this.contextRepository.save(context);

    // 7. 이전 파일 삭제 예약 (안전을 위해 30일 후)
    await this.scheduleOldFileCleanup(file.fileKey);
  }

  /**
   * 파일 용도 추론
   */
  private async inferFilePurpose(file: File): Promise<{
    contextType: FileContextType;
    purpose: FilePurpose;
  }> {
    const fileKey = file.fileKey.toLowerCase();
    const fileName = file.fileName.toLowerCase();

    // 프로필 이미지 패턴
    if (fileKey.includes("profile") || fileKey.includes("avatar")) {
      return {
        contextType: FileContextType.PROFILE,
        purpose: FilePurpose.AVATAR,
      };
    }

    // 블로그 썸네일 패턴
    if (fileKey.includes("blog") && fileKey.includes("thumb")) {
      return {
        contextType: FileContextType.BLOG,
        purpose: FilePurpose.THUMBNAIL,
      };
    }

    // 포스트 관련 파일
    if (fileKey.includes("post") || fileKey.includes("content")) {
      return {
        contextType: FileContextType.POST,
        purpose: FilePurpose.CONTENT,
      };
    }

    // 이미지 파일은 대부분 콘텐츠
    if (file.fileType === "image") {
      return {
        contextType: FileContextType.POST,
        purpose: FilePurpose.CONTENT,
      };
    }

    // 기본값
    return {
      contextType: FileContextType.SYSTEM,
      purpose: FilePurpose.ATTACHMENT,
    };
  }

  /**
   * Context ID 추출
   */
  private getContextId(file: File, contextType: FileContextType): string {
    switch (contextType) {
      case FileContextType.PROFILE:
        return file.userId;
      case FileContextType.POST:
        // post_files 테이블에서 postId 조회 필요
        // 임시로 null 반환
        return null;
      case FileContextType.BLOG:
        // 블로그 ID 조회 필요
        return null;
      default:
        return null;
    }
  }

  /**
   * FileContext 생성 또는 조회
   */
  private async findOrCreateContext(
    contextType: FileContextType,
    contextId: string,
    ownerId: string,
    purpose: FilePurpose,
  ): Promise<FileContext> {
    let context = await this.contextRepository.findOne({
      where: {
        contextType,
        contextId: contextId || null,
        ownerId,
        purpose,
      },
    });

    if (!context) {
      context = this.contextRepository.create({
        contextType,
        contextId,
        ownerId,
        purpose,
        fileCount: 0,
        totalSize: 0,
      });
      await this.contextRepository.save(context);
    }

    return context;
  }

  /**
   * 새로운 S3 키 생성
   */
  private generateNewS3Key(file: File, context: FileContext): string {
    const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const uuid = uuidv4().split("-")[0];
    const ext = path.extname(file.fileName);
    const fileName = `${timestamp}_${uuid}_${context.purpose}${ext}`;

    switch (context.contextType) {
      case FileContextType.PROFILE:
        return `v2/users/${context.ownerId}/profile/${context.purpose}/${fileName}`;

      case FileContextType.POST:
        return `v2/users/${context.ownerId}/content/posts/${context.contextId || "misc"}/${fileName}`;

      case FileContextType.BLOG:
        return `v2/blogs/${context.contextId}/branding/${context.purpose}/${fileName}`;

      default:
        return `v2/system/misc/${fileName}`;
    }
  }

  /**
   * 이전 파일 삭제 예약
   */
  private async scheduleOldFileCleanup(oldS3Key: string): Promise<void> {
    // TODO: 백그라운드 작업 큐에 추가
    // 30일 후 삭제 예약
    this.logger.log(`Scheduled cleanup for old file: ${oldS3Key}`);
  }

  /**
   * 진행률 업데이트
   */
  private updateProgress(): void {
    this.migrationProgress.percentage = Math.round(
      (this.migrationProgress.processed / this.migrationProgress.total) * 100,
    );

    if (this.migrationProgress.processed % 10 === 0) {
      this.logger.log(
        `Migration progress: ${this.migrationProgress.percentage}%`,
        {
          ...this.migrationProgress,
        },
      );
    }
  }

  /**
   * 마이그레이션 상태 조회
   */
  async getMigrationStatus(): Promise<MigrationProgress> {
    return this.migrationProgress;
  }

  /**
   * Migrate files to v2 structure
   */
  async migrateToV2(options: MigrationOptions): Promise<MigrationResult> {
    if (this.activeMigration) {
      return this.activeMigration;
    }

    const migration = this.executeMigration(options);
    this.activeMigration = migration;

    try {
      return await migration;
    } finally {
      if (this.activeMigration === migration) {
        this.activeMigration = null;
      }
    }
  }

  private async executeMigration(
    options: MigrationOptions,
  ): Promise<MigrationResult> {
    const startTime = new Date();
    const errors: Array<{ fileId: string; error: string }> = [];

    // Reset progress
    this.migrationProgress = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      percentage: 0,
    };

    try {
      // Get v1 files count
      const v1Count = await this.fileRepository.count({
        where: { fileKey: Not(Like("v2/%")) },
      });
      this.migrationProgress.total = v1Count;

      if (v1Count === 0) {
        return {
          startTime,
          endTime: new Date(),
          duration: 0,
          progress: this.migrationProgress,
          errors: [],
          success: true,
        };
      }

      // Process in batches
      let offset = 0;
      while (offset < v1Count) {
        const batch = await this.fileRepository.find({
          where: { fileKey: Not(Like("v2/%")) },
          take: options.batchSize,
          skip: offset,
          relations: ["posts"],
        });

        if (batch.length === 0) break;
        let retainedInV1 = 0;

        for (const file of batch) {
          if (options.dryRun) {
            this.migrationProgress.processed++;
            this.migrationProgress.skipped++;
            retainedInV1++;
            continue;
          }

          try {
            const migratedFile = await this.migrateFileToContext(file);
            if (migratedFile) {
              this.migrationProgress.successful++;
            } else {
              this.migrationProgress.skipped++;
              retainedInV1++;
            }
          } catch (error) {
            this.migrationProgress.failed++;
            retainedInV1++;
            errors.push({
              fileId: file.id,
              error: error.message,
            });
          }
          this.migrationProgress.processed++;
        }

        // Successfully migrated rows no longer match the v1 query. Only rows
        // left in place should advance the offset, otherwise valid rows are skipped.
        offset += retainedInV1;
      }

      const endTime = new Date();
      return {
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        progress: this.migrationProgress,
        errors,
        success: true,
      };
    } catch (error) {
      this.logger.error("Migration failed:", error);
      return {
        startTime,
        endTime: new Date(),
        duration: new Date().getTime() - startTime.getTime(),
        progress: this.migrationProgress,
        errors: [...errors, { fileId: "system", error: error.message }],
        success: false,
      };
    }
  }

  /**
   * Migrate individual file to context
   */
  private async migrateFileToContext(file: File): Promise<File | null> {
    if (!file.userId) {
      return null;
    }

    // Infer context from file relationships or path
    const { contextType, purpose } = await this.inferFilePurpose(file);

    let contextId = null;

    // Check if file is attached to a post
    if (file.posts && (await file.posts).length > 0) {
      const posts = await file.posts;
      contextId = posts[0].id;
    } else if (contextType === FileContextType.PROFILE) {
      contextId = file.userId;
    } else if (contextType === FileContextType.SYSTEM) {
      contextId = file.userId;
    }

    // Create or find context
    const context = await this.findOrCreateContext(
      contextType,
      contextId,
      file.userId,
      purpose,
    );

    // Generate new S3 key
    const newS3Key = this.generateNewS3Key(file, context);

    // Copy file in S3
    await this.s3Service.copyFile(file.fileKey, newS3Key);

    // Delete old file
    await this.s3Service.deleteFile(file.fileKey);

    // Update file record
    file.fileKey = newS3Key;
    file.fileUrl = newS3Key;
    file.contextId = context.id;

    await this.fileRepository.save(file);

    return file;
  }

  /**
   * 롤백 기능
   */
  async rollbackMigration(): Promise<void> {
    this.logger.warn("Starting migration rollback...");

    // v2 파일들을 찾아서 원래 위치로 복원
    const v2Files = await this.fileRepository.find({
      where: { fileKey: Like("v2/%") },
    });

    for (const file of v2Files) {
      try {
        // 이전 키 복원 로직 필요
        this.logger.log(`Rollback file: ${file.id}`);
      } catch (error) {
        this.logger.error(`Failed to rollback file ${file.id}:`, error);
      }
    }
  }
}
