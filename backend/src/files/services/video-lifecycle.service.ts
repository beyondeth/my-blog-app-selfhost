/**
 * Video Lifecycle Service
 *
 * @description
 * 비디오 파일 라이프사이클 관리 서비스
 * - 만료된 비디오 자동 삭제 (크론)
 * - 고아 비디오 감지 및 정리
 * - 포스트 저장 시 비디오 영구 보관 처리
 */

import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan, IsNull, Not } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Video, VideoStatus } from "../entities/video.entity";
import { VideoCleanupService } from "./video-cleanup.service";

export interface VideoCleanupResult {
  totalProcessed: number;
  deletedCount: number;
  failedCount: number;
  duration: number;
}

@Injectable()
export class VideoLifecycleService {
  private readonly logger = new Logger(VideoLifecycleService.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly videoCleanupService: VideoCleanupService,
  ) {}

  /**
   * 매일 새벽 3시: 만료된 비디오 자동 삭제
   *
   * @description
   * - expiresAt < now인 비디오 찾기
   * - R2 파일 삭제 (processed + thumbnail + raw)
   * - Video 엔티티 soft delete
   */
  @Cron("5 3 * * *", {
    name: "cleanup-expired-videos",
    timeZone: "Asia/Seoul",
  })
  async cleanupExpiredVideos(): Promise<VideoCleanupResult> {
    const startTime = Date.now();
    this.logger.log("🎬 Starting expired video cleanup...");

    const result: VideoCleanupResult = {
      totalProcessed: 0,
      deletedCount: 0,
      failedCount: 0,
      duration: 0,
    };

    try {
      // 만료된 비디오 조회 (배치 처리, 최대 100개씩)
      const expiredVideos = await this.videoRepository.find({
        where: {
          expiresAt: LessThan(new Date()),
          deletedAt: IsNull(), // soft delete 안 된 것만
        },
        take: 100, // 배치 크기 제한
      });

      result.totalProcessed = expiredVideos.length;

      if (expiredVideos.length === 0) {
        this.logger.log("✅ No expired videos to clean up");
        result.duration = Date.now() - startTime;
        return result;
      }

      this.logger.log(
        `Found ${expiredVideos.length} expired videos to clean up`,
      );

      // 각 비디오 삭제
      for (const video of expiredVideos) {
        try {
          await this.videoCleanupService.deleteVideoFiles(video.id);
          result.deletedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to delete expired video: ${video.id}`,
            error.message,
          );
          result.failedCount++;
        }
      }

      result.duration = Date.now() - startTime;

      this.logger.log(
        `✅ Expired video cleanup completed: ${result.deletedCount} deleted, ` +
          `${result.failedCount} failed, ${result.duration}ms`,
      );

      return result;
    } catch (error) {
      result.duration = Date.now() - startTime;
      this.logger.error("❌ Expired video cleanup failed:", error.stack);
      throw error;
    }
  }

  /**
   * 매일 새벽 4시: 처리 실패한 비디오 정리
   *
   * @description
   * - status = FAILED이고 48시간 경과한 비디오 삭제
   * - 원본 파일만 남아있는 경우 정리
   */
  @Cron("0 4 * * *", {
    name: "cleanup-failed-videos",
    timeZone: "Asia/Seoul",
  })
  async cleanupFailedVideos(): Promise<VideoCleanupResult> {
    const startTime = Date.now();
    this.logger.log("🔧 Starting failed video cleanup...");

    const result: VideoCleanupResult = {
      totalProcessed: 0,
      deletedCount: 0,
      failedCount: 0,
      duration: 0,
    };

    try {
      // 48시간 경과한 실패 비디오 조회
      const cutoffDate = new Date(Date.now() - 48 * 60 * 60 * 1000);

      const failedVideos = await this.videoRepository.find({
        where: {
          status: VideoStatus.FAILED,
          createdAt: LessThan(cutoffDate),
          deletedAt: IsNull(),
        },
        take: 100,
      });

      result.totalProcessed = failedVideos.length;

      if (failedVideos.length === 0) {
        this.logger.log("✅ No failed videos to clean up");
        result.duration = Date.now() - startTime;
        return result;
      }

      this.logger.log(`Found ${failedVideos.length} failed videos to clean up`);

      for (const video of failedVideos) {
        try {
          await this.videoCleanupService.deleteVideoFiles(video.id);
          result.deletedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to delete failed video: ${video.id}`,
            error.message,
          );
          result.failedCount++;
        }
      }

      result.duration = Date.now() - startTime;

      this.logger.log(
        `✅ Failed video cleanup completed: ${result.deletedCount} deleted, ` +
          `${result.failedCount} failed, ${result.duration}ms`,
      );

      return result;
    } catch (error) {
      result.duration = Date.now() - startTime;
      this.logger.error("❌ Failed video cleanup failed:", error.stack);
      throw error;
    }
  }

  /**
   * 포스트 저장 시 비디오 영구 보관 처리
   *
   * @description
   * - 포스트 content에 포함된 비디오의 expiresAt을 null로 설정
   * - 24시간 임시 보관에서 영구 보관으로 전환
   *
   * @param content - 포스트 HTML content
   */
  async markVideosAsPermanent(content: string): Promise<number> {
    // content에서 video ID 추출
    const videoIds =
      this.videoCleanupService.extractVideoIdsFromContent(content);

    if (videoIds.length === 0) {
      return 0;
    }

    // expiresAt을 null로 설정 (영구 보관)
    const result = await this.videoRepository.update(
      { id: videoIds.length === 1 ? videoIds[0] : (videoIds as any) },
      { expiresAt: null },
    );

    // 여러 개인 경우 In 연산자 사용
    if (videoIds.length > 1) {
      await this.videoRepository
        .createQueryBuilder()
        .update(Video)
        .set({ expiresAt: null })
        .where("id IN (:...ids)", { ids: videoIds })
        .execute();
    }

    this.logger.debug(`Marked ${videoIds.length} videos as permanent`);
    return videoIds.length;
  }

  /**
   * 수동 정리 트리거 (관리자용)
   */
  async triggerManualCleanup(): Promise<{
    expired: VideoCleanupResult;
    failed: VideoCleanupResult;
  }> {
    this.logger.log("🔧 Manual cleanup triggered");

    const expired = await this.cleanupExpiredVideos();
    const failed = await this.cleanupFailedVideos();

    return { expired, failed };
  }

  /**
   * 비디오 통계 조회 (관리자용)
   */
  async getVideoStats(): Promise<{
    total: number;
    byStatus: Record<VideoStatus, number>;
    expiringSoon: number;
    totalSize: number;
  }> {
    const videos = await this.videoRepository.find({
      where: { deletedAt: IsNull() },
      select: ["id", "status", "sizeProcessed", "sizeRaw", "expiresAt"],
    });

    const byStatus: Record<VideoStatus, number> = {
      [VideoStatus.UPLOADING]: 0,
      [VideoStatus.PROCESSING]: 0,
      [VideoStatus.READY]: 0,
      [VideoStatus.FAILED]: 0,
    };

    let expiringSoon = 0;
    let totalSize = 0;
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    for (const video of videos) {
      byStatus[video.status]++;
      totalSize += (video.sizeProcessed || 0) + (video.sizeRaw || 0);

      if (video.expiresAt && video.expiresAt < tomorrow) {
        expiringSoon++;
      }
    }

    return {
      total: videos.length,
      byStatus,
      expiringSoon,
      totalSize,
    };
  }
}
