/**
 * Video Processing Worker (BullMQ Processor)
 *
 * 비디오 업로드 후 FFmpeg 압축 처리를 담당합니다.
 * 처리 과정:
 * 1. R2에서 원본 비디오 다운로드 (tmp/)
 * 2. FFmpeg H.264 압축 (CRF 28, 720p, preset fast)
 * 3. 압축본 R2 업로드
 * 4. 원본 삭제
 * 5. Video 엔티티 상태 업데이트 (processing → ready)
 *
 * FFmpeg 설정 (MVP 최적):
 * - 코덱: H.264 (libx264) - 모든 브라우저 호환
 * - CRF: 28 - 품질/용량 밸런스 (70~95% 용량 감소)
 * - 해상도: 720p (scale=1280:-2)
 * - preset: fast - 빠른 인코딩 + 낮은 CPU 사용
 */

import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger, OnModuleDestroy } from "@nestjs/common";
import { Job } from "bullmq";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Video, VideoStatus } from "../entities/video.entity";
import { R2Service } from "../services/r2.service";
import {
  VIDEO_PROCESSING_QUEUE,
  VideoProcessingJobData,
  VideoProcessingResult,
} from "../queues/video-processing.queue";

const execAsync = promisify(exec);

@Processor(VIDEO_PROCESSING_QUEUE, {
  concurrency: 1, // 한 번에 하나의 Job만 처리 (CPU 집약적 작업)
  lockDuration: 600000, // 10분 잠금 유지 (대용량 비디오 처리 고려)
})
export class VideoProcessingProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(VideoProcessingProcessor.name);
  private readonly tmpDir: string;

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly r2Service: R2Service,
  ) {
    super();
    // 임시 디렉토리 설정 (시스템 tmp 또는 커스텀)
    this.tmpDir = path.join(os.tmpdir(), "video-processing");
    this.ensureTmpDir();
  }

  /**
   * Job 처리 메인 메서드
   * BullMQ가 자동으로 호출하며, 실패 시 자동 재시도
   */
  async process(
    job: Job<VideoProcessingJobData>,
  ): Promise<VideoProcessingResult> {
    const startTime = Date.now();
    const { videoId, userId, originalKey, outputKey, originalName } = job.data;

    this.logger.log(`🎬 비디오 처리 시작: ${videoId} (${originalName})`);
    this.logger.log(`   attempt: ${job.attemptsMade + 1}/${job.opts.attempts}`);

    // 임시 파일 경로
    const inputPath = path.join(this.tmpDir, `${videoId}_input.mp4`);
    const outputPath = path.join(this.tmpDir, `${videoId}_output.mp4`);
    const thumbnailPath = path.join(this.tmpDir, `${videoId}_thumb.jpg`);

    try {
      // 1. Video 엔티티 상태 확인 및 업데이트
      const video = await this.videoRepository.findOne({
        where: { id: videoId },
      });

      if (!video) {
        throw new Error(`Video not found: ${videoId}`);
      }

      // 처리 시작 상태로 업데이트
      await this.videoRepository.update(
        { id: videoId },
        {
          status: VideoStatus.PROCESSING,
          processingStartedAt: new Date(),
        },
      );

      // 2. R2에서 원본 다운로드
      this.logger.log(`   📥 원본 다운로드 중: ${originalKey}`);
      await job.updateProgress(10);

      await this.r2Service.downloadToLocal(originalKey, inputPath);
      const inputStats = fs.statSync(inputPath);
      this.logger.log(
        `   📥 다운로드 완료: ${this.formatBytes(inputStats.size)}`,
      );
      await job.updateProgress(30);

      // 3. FFmpeg 압축 실행
      this.logger.log(`   🔧 FFmpeg 압축 시작...`);
      const ffmpegResult = await this.runFfmpeg(inputPath, outputPath, job);
      await job.updateProgress(80);

      // 4. 압축본 R2 업로드
      this.logger.log(`   📤 압축본 업로드 중: ${outputKey}`);
      await this.r2Service.uploadFile(outputPath, outputKey, "video/mp4");
      await job.updateProgress(95);

      const outputStats = fs.statSync(outputPath);
      const compressionRatio = (
        (1 - outputStats.size / inputStats.size) *
        100
      ).toFixed(1);

      this.logger.log(
        `   📤 업로드 완료: ${this.formatBytes(outputStats.size)} (${compressionRatio}% 감소)`,
      );

      // 5. 썸네일 추출 및 업로드
      let thumbnailKey: string | null = null;
      try {
        // 비디오 길이에 따라 추출 시점 결정 (1초 또는 0.5초)
        const thumbnailTimestamp =
          ffmpegResult.duration > 2 ? "00:00:01" : "00:00:00.500";
        await this.extractThumbnail(
          outputPath,
          thumbnailPath,
          thumbnailTimestamp,
        );

        // 썸네일 R2 업로드
        thumbnailKey = `videos/thumbnails/${videoId}.jpg`;
        await this.r2Service.uploadFile(
          thumbnailPath,
          thumbnailKey,
          "image/jpeg",
        );
        this.logger.log(`   🖼️ 썸네일 생성 완료: ${thumbnailKey}`);
      } catch (thumbnailError) {
        // 썸네일 실패해도 비디오 처리는 계속 진행
        this.logger.warn(
          `   ⚠️ 썸네일 추출 실패 (비디오 처리는 계속): ${thumbnailError.message}`,
        );
        thumbnailKey = null;
      }

      // 6. 원본 삭제 (R2)
      this.logger.log(`   🗑️ 원본 삭제 중: ${originalKey}`);
      await this.r2Service.deleteFile(originalKey);

      // 7. Video 엔티티 업데이트
      await this.videoRepository.update(
        { id: videoId },
        {
          status: VideoStatus.READY,
          storageKeyProcessed: outputKey,
          thumbnailKey, // 썸네일 R2 경로 (실패 시 null)
          sizeProcessed: outputStats.size,
          duration: ffmpegResult.duration,
          resolution: 720, // 고정 720p
          processingCompletedAt: new Date(),
          errorMessage: null,
          metadata: {
            width: ffmpegResult.width,
            height: ffmpegResult.height,
            bitrate: ffmpegResult.bitrate,
            codec: "h264",
            fps: ffmpegResult.fps,
          },
        },
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `✅ 비디오 처리 완료: ${videoId} (${this.formatDuration(processingTime)})`,
      );
      await job.updateProgress(100);

      // 8. 임시 파일 정리
      this.cleanupTmpFiles(inputPath, outputPath, thumbnailPath);

      return {
        success: true,
        videoId,
        status: "ready",
        processedKey: outputKey,
        processedSize: outputStats.size,
        duration: ffmpegResult.duration,
        resolution: 720,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(`❌ 비디오 처리 실패: ${videoId}`, error.stack);

      // 최대 재시도 횟수 초과 시에만 failed 상태로 업데이트
      if (job.attemptsMade + 1 >= job.opts.attempts) {
        await this.videoRepository.update(
          { id: videoId },
          {
            status: VideoStatus.FAILED,
            errorMessage: error.message,
            processingCompletedAt: new Date(),
          },
        );

        this.logger.error(
          `💥 비디오 처리 최종 실패: ${videoId} (재시도 ${job.attemptsMade + 1}/${job.opts.attempts})`,
        );
      } else {
        this.logger.warn(`⚠️ 비디오 처리 실패, 재시도 예정: ${videoId}`);
      }

      // 임시 파일 정리
      this.cleanupTmpFiles(inputPath, outputPath, thumbnailPath);

      return {
        success: false,
        videoId,
        status: "failed",
        error: error.message,
        processingTime,
      };
    }
  }

  /**
   * FFmpeg 압축 실행
   *
   * 명령어:
   * ffmpeg -i input.mp4 \
   *   -vf scale=1280:-2 \
   *   -vcodec libx264 \
   *   -crf 28 \
   *   -preset fast \
   *   -c:a aac \
   *   -b:a 128k \
   *   -movflags +faststart \
   *   output.mp4
   */
  private async runFfmpeg(
    inputPath: string,
    outputPath: string,
    job: Job,
  ): Promise<{
    duration: number;
    width: number;
    height: number;
    bitrate: number;
    fps: number;
  }> {
    // FFmpeg 명령어 구성
    const ffmpegCommand = [
      "ffmpeg",
      "-i",
      `"${inputPath}"`,
      "-vf",
      "scale=1280:-2", // 720p 다운스케일 (종횡비 유지)
      "-vcodec",
      "libx264", // H.264 코덱
      "-crf",
      "28", // 품질/용량 밸런스 (MVP 최적)
      "-preset",
      "fast", // 빠른 인코딩 + 낮은 CPU
      "-c:a",
      "aac", // 오디오 AAC 코덱
      "-b:a",
      "128k", // 오디오 비트레이트
      "-movflags",
      "+faststart", // 스트리밍 최적화
      "-y", // 출력 파일 덮어쓰기
      `"${outputPath}"`,
    ].join(" ");

    try {
      // FFmpeg 실행 (타임아웃: 10분)
      await execAsync(ffmpegCommand, {
        timeout: 600000, // 10분
        maxBuffer: 50 * 1024 * 1024, // 50MB 버퍼
      });

      // FFprobe로 메타데이터 추출
      const metadata = await this.getVideoMetadata(outputPath);

      return metadata;
    } catch (error) {
      this.logger.error(`FFmpeg 실행 실패: ${error.message}`);
      throw new Error(`FFmpeg compression failed: ${error.message}`);
    }
  }

  /**
   * FFprobe로 비디오 메타데이터 추출
   */
  private async getVideoMetadata(filePath: string): Promise<{
    duration: number;
    width: number;
    height: number;
    bitrate: number;
    fps: number;
  }> {
    try {
      const probeCommand = [
        "ffprobe",
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        `"${filePath}"`,
      ].join(" ");

      const { stdout } = await execAsync(probeCommand);
      const data = JSON.parse(stdout);

      // 비디오 스트림 찾기
      const videoStream = data.streams?.find(
        (s: any) => s.codec_type === "video",
      );

      return {
        duration: parseFloat(data.format?.duration || "0"),
        width: videoStream?.width || 1280,
        height: videoStream?.height || 720,
        bitrate: parseInt(data.format?.bit_rate || "0", 10),
        fps: this.parseFps(videoStream?.r_frame_rate),
      };
    } catch (error) {
      this.logger.warn(`FFprobe 메타데이터 추출 실패: ${error.message}`);
      // 기본값 반환
      return {
        duration: 0,
        width: 1280,
        height: 720,
        bitrate: 0,
        fps: 30,
      };
    }
  }

  /**
   * 비디오에서 썸네일 추출
   *
   * FFmpeg를 사용하여 지정된 시점의 프레임을 JPEG 이미지로 추출합니다.
   * - 640px 너비로 리사이즈 (종횡비 유지)
   * - JPEG 품질 2 (고품질)
   *
   * @param inputPath 압축된 비디오 파일 경로
   * @param outputPath 썸네일 저장 경로
   * @param timestamp 추출 시점 (기본: 1초)
   */
  private async extractThumbnail(
    inputPath: string,
    outputPath: string,
    timestamp: string = "00:00:01",
  ): Promise<void> {
    const command = [
      "ffmpeg",
      "-i",
      `"${inputPath}"`,
      "-ss",
      timestamp, // 추출 시점
      "-vframes",
      "1", // 1프레임만 추출
      "-q:v",
      "2", // JPEG 품질 (1-31, 낮을수록 고품질)
      "-vf",
      "scale=640:-1", // 640px 너비로 리사이즈 (종횡비 유지)
      "-y", // 덮어쓰기
      `"${outputPath}"`,
    ].join(" ");

    try {
      await execAsync(command, { timeout: 30000 }); // 30초 타임아웃
    } catch (error) {
      this.logger.error(`썸네일 추출 FFmpeg 실행 실패: ${error.message}`);
      throw new Error(`Thumbnail extraction failed: ${error.message}`);
    }
  }

  /**
   * FPS 문자열 파싱 (예: "30/1" → 30)
   */
  private parseFps(fpsString?: string): number {
    if (!fpsString) return 30;
    const parts = fpsString.split("/");
    if (parts.length === 2) {
      return Math.round(parseInt(parts[0], 10) / parseInt(parts[1], 10));
    }
    return parseInt(fpsString, 10) || 30;
  }

  /**
   * 임시 디렉토리 생성
   */
  private ensureTmpDir(): void {
    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir, { recursive: true });
      this.logger.log(`📁 임시 디렉토리 생성: ${this.tmpDir}`);
    }
  }

  /**
   * 임시 파일 정리
   */
  private cleanupTmpFiles(...filePaths: string[]): void {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          this.logger.debug(`🧹 임시 파일 삭제: ${filePath}`);
        }
      } catch (error) {
        this.logger.warn(`임시 파일 삭제 실패: ${filePath}`, error.message);
      }
    }
  }

  /**
   * 바이트 포맷팅 (예: 1048576 → "1.00 MB")
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * 시간 포맷팅 (예: 120000 → "2m 0s")
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  /**
   * Job 완료 이벤트 핸들러
   */
  @OnWorkerEvent("completed")
  onCompleted(job: Job<VideoProcessingJobData>) {
    this.logger.debug(`Job ${job.id} completed for video ${job.data.videoId}`);
  }

  /**
   * Job 실패 이벤트 핸들러
   */
  @OnWorkerEvent("failed")
  onFailed(job: Job<VideoProcessingJobData>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed for video ${job.data.videoId}:`,
      error.message,
    );
  }

  /**
   * 모듈 종료 시 리소스 정리
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log("🧹 VideoProcessingProcessor 리소스 정리 시작...");

    try {
      if (this.worker) {
        await this.worker.close();
        this.logger.debug("✅ BullMQ Worker 종료 완료");
      }

      // 임시 디렉토리 정리 (옵션)
      // this.cleanupTmpDir();
    } catch (error) {
      this.logger.error(
        "❌ VideoProcessingProcessor 리소스 정리 중 오류:",
        error,
      );
    }

    this.logger.log("✅ VideoProcessingProcessor 리소스 정리 완료");
  }
}
