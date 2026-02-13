import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan, IsNull } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { File } from "../entities/file.entity";
import {
  FileContext,
  FileContextType,
  FilePurpose,
} from "../entities/file-context.entity";
import { S3Service } from "./s3.service";

export const FileLifecycleEvent = {
  UPLOADED: "uploaded",
  OPTIMIZED: "optimized",
  ATTACHED: "attached",
  DETACHED: "detached",
  ARCHIVED: "archived",
  DELETED: "deleted",
  EXPIRED: "expired",
} as const;

export type FileLifecycleEvent =
  (typeof FileLifecycleEvent)[keyof typeof FileLifecycleEvent];

export interface CleanupResult {
  orphanedFiles: number;
  expiredFiles: number;
  archivedFiles: number;
  deletedFiles: number;
  errors: string[];
}

/**
 * 파일 라이프사이클 관리 서비스
 */
@Injectable()
export class FileLifecycleService {
  private readonly logger = new Logger(FileLifecycleService.name);

  constructor(
    @InjectRepository(File)
    private fileRepository: Repository<File>,
    @InjectRepository(FileContext)
    private contextRepository: Repository<FileContext>,
    private s3Service: S3Service,
  ) {}

  /**
   * 매일 새벽 2시: 자동 정리 시스템
   */
  @Cron("0 2 * * *")
  async performDailyCleanup(): Promise<CleanupResult> {
    this.logger.log("Starting daily cleanup...");

    const result: CleanupResult = {
      orphanedFiles: 0,
      expiredFiles: 0,
      archivedFiles: 0,
      deletedFiles: 0,
      errors: [],
    };

    try {
      // 1. 만료된 임시 파일 삭제
      result.expiredFiles = await this.deleteExpiredTemporaryFiles();

      // 2. 고아 파일 처리
      result.orphanedFiles = await this.cleanupOrphanedFiles();

      // 3. 오래된 파일 아카이브
      result.archivedFiles = await this.archiveOldFiles();

      // 4. 삭제 예약된 파일 처리
      result.deletedFiles = await this.processScheduledDeletions();

      this.logger.log("Daily cleanup completed:", result);
    } catch (error) {
      this.logger.error("Daily cleanup failed:", error);
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * 24시간 이상 된 임시 파일 삭제
   */
  async deleteExpiredTemporaryFiles(): Promise<number> {
    const expiredFiles = await this.fileRepository.find({
      where: {
        expiresAt: LessThan(new Date()),
      },
    });

    let deleted = 0;
    for (const file of expiredFiles) {
      try {
        await this.deleteFile(file);
        deleted++;
      } catch (error) {
        this.logger.error(`Failed to delete expired file ${file.id}:`, error);
      }
    }

    return deleted;
  }

  /**
   * 참조되지 않는 파일 찾기 및 정리
   * - legacy orphan: contextId IS NULL
   * - upload orphan: system/content context 이지만 post_files 연결이 없는 파일
   */
  async cleanupOrphanedFiles(): Promise<number> {
    // 24시간 이상 경과 + 아직 삭제 예약이 되지 않은 파일
    const orphanedFiles = await this.fileRepository
      .createQueryBuilder("file")
      .leftJoin("file.context", "context")
      .leftJoin("post_files", "pf", 'pf."fileId" = file.id')
      .where(
        `
        file.contextId IS NULL
        OR (
          context.contextType = :systemType
          AND context.purpose = :contentPurpose
          AND pf."postId" IS NULL
        )
      `,
        {
          systemType: FileContextType.SYSTEM,
          contentPurpose: FilePurpose.CONTENT,
        },
      )
      .andWhere("file.createdAt < :date", {
        date: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .andWhere("file.expiresAt IS NULL") // 이미 처리된 파일 제외
      .getMany();

    let cleaned = 0;
    for (const file of orphanedFiles) {
      try {
        // 30일 후 삭제 예약
        file.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await this.fileRepository.save(file);
        cleaned++;

        // 개별 파일 로그 대신 debug 레벨로 변경 - 로그 스팸 방지를 위해 주석 처리
        // this.logger.debug(`Scheduled orphaned file ${file.id} for deletion`);
      } catch (error) {
        this.logger.error(`Failed to process orphaned file ${file.id}:`, error);
      }
    }

    // 처리 결과를 한 번만 로그로 출력
    if (cleaned > 0) {
      this.logger.log(`Scheduled ${cleaned} orphaned files for deletion`);
    }

    return cleaned;
  }

  /**
   * 6개월 이상 된 파일 아카이브
   */
  async archiveOldFiles(): Promise<number> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const oldFiles = await this.fileRepository
      .createQueryBuilder("file")
      .where("file.createdAt < :date", { date: sixMonthsAgo })
      .andWhere("file.isOptimized = false")
      .limit(100) // 배치 처리
      .getMany();

    let archived = 0;
    for (const file of oldFiles) {
      try {
        await this.archiveFile(file);
        archived++;
      } catch (error) {
        this.logger.error(`Failed to archive file ${file.id}:`, error);
      }
    }

    return archived;
  }

  /**
   * 파일 아카이브 (S3 Glacier)
   */
  async archiveFile(file: File): Promise<void> {
    // S3 스토리지 클래스 변경
    await this.s3Service.transitionToArchive(file.fileKey);

    // DB 상태 업데이트
    file.metadata = {
      ...file.metadata,
      archived: true,
      optimizedAt: new Date().toISOString(),
    };
    file.isOptimized = true; // 아카이브됨 표시

    await this.fileRepository.save(file);

    this.recordLifecycleEvent(file.id, FileLifecycleEvent.ARCHIVED);
    this.logger.log(`File ${file.id} archived to Glacier`);
  }

  /**
   * 삭제 예약된 파일 처리
   */
  async processScheduledDeletions(): Promise<number> {
    const scheduledFiles = await this.fileRepository.find({
      where: {
        expiresAt: LessThan(new Date()),
      },
    });

    let deleted = 0;
    for (const file of scheduledFiles) {
      try {
        await this.deleteFile(file);
        deleted++;
      } catch (error) {
        this.logger.error(`Failed to delete scheduled file ${file.id}:`, error);
      }
    }

    return deleted;
  }

  /**
   * 파일 완전 삭제
   */
  private async deleteFile(file: File): Promise<void> {
    try {
      // S3에서 삭제
      await this.s3Service.deleteFile(file.fileKey);

      // 썸네일이 있다면 함께 삭제
      if (file.metadata?.thumbnails) {
        for (const thumbnail of file.metadata.thumbnails) {
          try {
            await this.s3Service.deleteFile(thumbnail);
          } catch (error) {
            this.logger.warn(`Failed to delete thumbnail ${thumbnail}`);
          }
        }
      }

      // DB에서 삭제
      await this.fileRepository.remove(file);

      // 컨텍스트 통계 업데이트
      if (file.contextId) {
        await this.updateContextStats(file.contextId);
      }

      this.recordLifecycleEvent(file.id, FileLifecycleEvent.DELETED);
      this.logger.log(`File ${file.id} permanently deleted`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${file.id}:`, error);
      throw error;
    }
  }

  /**
   * 파일 버전 관리
   */
  async createNewVersion(
    contextId: string,
    newFile: Express.Multer.File,
  ): Promise<File> {
    // 기존 파일들을 비활성화
    await this.fileRepository.update(
      { contextId, expiresAt: IsNull() },
      { expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    );

    // 컨텍스트 버전 업데이트
    const context = await this.contextRepository.findOne({
      where: { id: contextId },
    });

    if (context) {
      context.version++;
      await this.contextRepository.save(context);
    }

    // 새 파일은 ContextualFileService를 통해 업로드
    this.logger.log(`Created new version for context ${contextId}`);

    return null; // 실제 업로드는 ContextualFileService에서 처리
  }

  /**
   * 포스트 삭제 시 관련 파일 처리
   */
  async handlePostDeletion(postId: string): Promise<void> {
    const context = await this.contextRepository.findOne({
      where: {
        contextType: FileContextType.POST,
        contextId: postId,
      },
    });

    if (!context) {
      return;
    }

    // 관련 파일들 30일 후 삭제 예약
    const files = await this.fileRepository.find({
      where: { contextId: context.id },
    });

    for (const file of files) {
      file.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await this.fileRepository.save(file);

      this.recordLifecycleEvent(file.id, FileLifecycleEvent.DETACHED);
    }

    // 컨텍스트 비활성화
    context.isActive = false;
    await this.contextRepository.save(context);

    this.logger.log(
      `Scheduled deletion for ${files.length} files from post ${postId}`,
    );
  }

  /**
   * 사용자 탈퇴 시 파일 처리
   */
  async handleUserDeletion(userId: string): Promise<void> {
    // 사용자의 모든 파일 찾기
    const files = await this.fileRepository.find({
      where: { userId },
    });

    // 30일 후 삭제 예약
    for (const file of files) {
      file.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await this.fileRepository.save(file);

      this.recordLifecycleEvent(file.id, FileLifecycleEvent.DETACHED);
    }

    // 사용자의 모든 컨텍스트 비활성화
    await this.contextRepository.update(
      { ownerId: userId },
      { isActive: false },
    );

    this.logger.log(
      `Scheduled deletion for ${files.length} files from user ${userId}`,
    );
  }

  /**
   * 컨텍스트 통계 업데이트
   */
  private async updateContextStats(contextId: string): Promise<void> {
    const stats = await this.fileRepository
      .createQueryBuilder("file")
      .select("COUNT(*)", "count")
      .addSelect("SUM(file.fileSize)", "totalSize")
      .where("file.contextId = :contextId", { contextId })
      .andWhere("file.expiresAt IS NULL")
      .getRawOne();

    await this.contextRepository.update(contextId, {
      fileCount: parseInt(stats.count),
      totalSize: parseInt(stats.totalSize || "0"),
    });
  }

  /**
   * 라이프사이클 이벤트 기록
   */
  private recordLifecycleEvent(
    fileId: string,
    event: FileLifecycleEvent,
  ): void {
    // TODO: 이벤트 로깅 시스템 구현
    this.logger.log(`Lifecycle event: ${event} for file ${fileId}`);
  }

  /**
   * 수동 정리 트리거
   */
  async triggerManualCleanup(): Promise<CleanupResult> {
    this.logger.log("Manual cleanup triggered");
    return this.performDailyCleanup();
  }
}
