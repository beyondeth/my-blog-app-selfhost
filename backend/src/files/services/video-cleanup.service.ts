/**
 * Video Cleanup Service
 *
 * @description
 * 비디오 파일 정리 서비스
 * - 포스트 삭제 시 관련 비디오 R2 파일 삭제
 * - 포스트 content에서 video ID 추출
 * - 비디오 파일 삭제 (processed + thumbnail + raw)
 */

import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Video } from "../entities/video.entity";
import { R2Service } from "./r2.service";

@Injectable()
export class VideoCleanupService {
  private readonly logger = new Logger(VideoCleanupService.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly r2Service: R2Service,
  ) {}

  /**
   * 포스트 content에서 video ID 추출
   *
   * @description
   * TipTap VideoEmbed 노드의 data-video-id 속성에서 UUID 추출
   * 예시: <figure data-video-embed data-video-id="uuid-here">...</figure>
   *
   * @param content - 포스트 HTML content
   * @returns 추출된 video ID 배열
   */
  extractVideoIdsFromContent(content: string): string[] {
    if (!content) {
      return [];
    }

    // data-video-id 속성에서 UUID 추출
    // 패턴: data-video-id="uuid" 또는 data-video-id='uuid'
    const videoIdPattern = /data-video-id=["']([^"']+)["']/g;
    const videoIds: string[] = [];

    let match;
    while ((match = videoIdPattern.exec(content)) !== null) {
      const videoId = match[1];
      // UUID 형식 검증 (8-4-4-4-12)
      if (this.isValidUUID(videoId)) {
        videoIds.push(videoId);
      }
    }

    // 중복 제거
    return [...new Set(videoIds)];
  }

  /**
   * UUID 형식 검증
   */
  private isValidUUID(str: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * 비디오 R2 파일 삭제
   *
   * @description
   * 비디오 관련 모든 R2 파일 삭제:
   * - storageKeyProcessed (압축본)
   * - thumbnailKey (썸네일)
   * - storageKeyRaw (원본, 있으면)
   *
   * @param videoId - 비디오 UUID
   */
  async deleteVideoFiles(videoId: string): Promise<void> {
    try {
      const video = await this.videoRepository.findOne({
        where: { id: videoId },
      });

      if (!video) {
        this.logger.warn(`Video not found for deletion: ${videoId}`);
        return;
      }

      // 1. 압축본 삭제 (processed)
      if (video.storageKeyProcessed) {
        try {
          await this.r2Service.deleteFile(video.storageKeyProcessed);
          this.logger.debug(
            `Deleted processed video: ${video.storageKeyProcessed}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to delete processed video: ${video.storageKeyProcessed}`,
            error.message,
          );
        }
      }

      // 2. 썸네일 삭제
      if (video.thumbnailKey) {
        try {
          await this.r2Service.deleteFile(video.thumbnailKey);
          this.logger.debug(`Deleted thumbnail: ${video.thumbnailKey}`);
        } catch (error) {
          this.logger.error(
            `Failed to delete thumbnail: ${video.thumbnailKey}`,
            error.message,
          );
        }
      }

      // 3. 원본 삭제 (raw, 혹시 남아있으면)
      if (video.storageKeyRaw) {
        try {
          // 원본 파일이 존재하는지 먼저 확인
          const rawExists = await this.r2Service.checkFileExists(
            video.storageKeyRaw,
          );
          if (rawExists) {
            await this.r2Service.deleteFile(video.storageKeyRaw);
            this.logger.debug(`Deleted raw video: ${video.storageKeyRaw}`);
          }
        } catch (error) {
          this.logger.error(
            `Failed to delete raw video: ${video.storageKeyRaw}`,
            error.message,
          );
        }
      }

      // 4. Video 엔티티 soft delete
      await this.videoRepository.softDelete(videoId);
      this.logger.log(`Video soft deleted: ${videoId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete video files: ${videoId}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 포스트 삭제 시 관련 비디오 정리
   *
   * @description
   * BullMQ 백그라운드 작업에서 호출
   * - 포스트 content에서 video ID 추출
   * - 각 비디오의 R2 파일 삭제
   *
   * @param postId - 삭제된 포스트 ID
   * @param content - 포스트 HTML content
   */
  async handlePostDeletion(postId: string, content: string): Promise<void> {
    this.logger.log(`Cleaning up videos for deleted post: ${postId}`);

    // 1. content에서 video ID 추출
    const videoIds = this.extractVideoIdsFromContent(content);

    if (videoIds.length === 0) {
      this.logger.debug(`No videos found in post: ${postId}`);
      return;
    }

    this.logger.log(
      `Found ${videoIds.length} videos to clean up in post: ${postId}`,
    );

    // 2. 각 비디오 삭제
    let successCount = 0;
    let failCount = 0;

    for (const videoId of videoIds) {
      try {
        await this.deleteVideoFiles(videoId);
        successCount++;
      } catch (error) {
        this.logger.error(
          `Failed to delete video ${videoId} from post ${postId}`,
          error.message,
        );
        failCount++;
      }
    }

    this.logger.log(
      `Post ${postId} video cleanup completed: ${successCount} deleted, ${failCount} failed`,
    );
  }

  /**
   * 여러 비디오 일괄 삭제 (만료된 비디오 정리용)
   *
   * @param videoIds - 삭제할 비디오 ID 배열
   * @returns 삭제된 비디오 수
   */
  async deleteMultipleVideos(videoIds: string[]): Promise<number> {
    let deletedCount = 0;

    for (const videoId of videoIds) {
      try {
        await this.deleteVideoFiles(videoId);
        deletedCount++;
      } catch (error) {
        this.logger.error(`Failed to delete video: ${videoId}`, error.message);
      }
    }

    return deletedCount;
  }
}
