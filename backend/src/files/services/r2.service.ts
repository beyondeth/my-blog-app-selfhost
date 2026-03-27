/**
 * Cloudflare R2 Service
 *
 * 비디오 파일 저장을 위한 Cloudflare R2 서비스
 * - S3 호환 API 사용
 * - 비디오 전용 스토리지 (무료 10GB 티어)
 * - Presigned URL 업로드/다운로드 지원
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as fs from "fs";
import * as path from "path";

export interface R2PresignedUrlResponse {
  uploadUrl: string;
  fileKey: string;
  expiresIn: number;
}

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl?: string;
  private readonly isConfigured: boolean;

  constructor(private configService: ConfigService) {
    // R2 환경변수 읽기
    const accountId = this.configService.get<string>("R2_ACCOUNT_ID");
    const accessKeyId = this.configService.get<string>("R2_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get<string>(
      "R2_SECRET_ACCESS_KEY",
    );
    const bucket = this.configService.get<string>("R2_BUCKET");

    // R2 설정이 없으면 비활성화 상태로 초기화
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      this.logger.warn(
        "R2 configuration is incomplete. Video upload will be disabled.",
      );
      this.isConfigured = false;
      this.bucket = "";
      return;
    }

    this.isConfigured = true;
    this.bucket = bucket;
    this.publicUrl = this.configService.get<string>("R2_PUBLIC_URL");

    // R2 S3 호환 엔드포인트
    // 형식: https://{accountId}.r2.cloudflarestorage.com
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

    this.s3Client = new S3Client({
      region: "auto", // R2는 region 대신 'auto' 사용
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log("✅ Cloudflare R2 initialized");
    this.logger.log(`   Bucket: ${this.bucket}`);
    this.logger.log(`   Endpoint: ${endpoint}`);
    if (this.publicUrl) {
      this.logger.log(`   Public URL: ${this.publicUrl}`);
    }
  }

  /**
   * R2 설정 여부 확인
   */
  isEnabled(): boolean {
    return this.isConfigured;
  }

  /**
   * 비디오 업로드용 Presigned URL 생성
   *
   * @param videoId - 비디오 UUID
   * @param mimeType - MIME 타입 (video/mp4, video/webm, video/quicktime)
   * @param fileSize - 파일 크기 (bytes)
   * @param isRaw - 원본 파일 여부 (true: raw, false: processed)
   */
  async generatePresignedUploadUrl(
    videoId: string,
    mimeType: string,
    fileSize: number,
    isRaw: boolean = true,
  ): Promise<R2PresignedUrlResponse> {
    this.ensureConfigured();
    this.validateVideoMimeType(mimeType);

    // R2 경로 구조: videos/raw/{uuid}.mp4 또는 videos/processed/{uuid}.mp4
    const folder = isRaw ? "raw" : "processed";
    const extension = this.getExtensionFromMimeType(mimeType);
    const fileKey = `videos/${folder}/${videoId}.${extension}`;

    try {
      const putObjectCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        ContentType: mimeType,
        ContentLength: fileSize,
        Metadata: {
          "video-id": videoId,
          "upload-date": new Date().toISOString(),
          "is-raw": isRaw.toString(),
        },
      });

      // Presigned URL 생성 (30분 유효 - 대용량 비디오 업로드 고려)
      const expiresIn = 30 * 60; // 30분
      const uploadUrl = await getSignedUrl(this.s3Client, putObjectCommand, {
        expiresIn,
        signableHeaders: new Set(["content-type"]),
      });

      this.logger.log(`R2 presigned URL generated for video: ${videoId}`);

      return {
        uploadUrl,
        fileKey,
        expiresIn,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate R2 presigned URL: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        "Failed to generate video upload URL",
      );
    }
  }

  /**
   * 비디오 다운로드용 Presigned URL 생성
   */
  async generatePresignedDownloadUrl(
    fileKey: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    this.ensureConfigured();

    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });

      const url = await getSignedUrl(this.s3Client, getObjectCommand, {
        expiresIn,
      });

      return url;
    } catch (error) {
      this.logger.error(
        `Failed to generate R2 download URL: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        "Failed to generate video download URL",
      );
    }
  }

  /**
   * 비디오 파일 스트림 가져오기 (FFmpeg 처리용)
   */
  async getVideoStream(fileKey: string): Promise<{
    stream: NodeJS.ReadableStream;
    contentType?: string;
    contentLength?: number;
  }> {
    this.ensureConfigured();

    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });

      const response = await this.s3Client.send(getObjectCommand);

      if (!response.Body) {
        throw new Error("Empty response body from R2");
      }

      return {
        stream: response.Body as NodeJS.ReadableStream,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get video stream from R2: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        "Failed to get video from storage",
      );
    }
  }

  /**
   * 로컬 파일을 R2에 업로드 (FFmpeg 처리 후)
   */
  async uploadFile(
    localPath: string,
    fileKey: string,
    contentType: string = "video/mp4",
  ): Promise<void> {
    this.ensureConfigured();

    try {
      const fileBuffer = fs.readFileSync(localPath);
      const fileStats = fs.statSync(localPath);

      const putObjectCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        Body: fileBuffer,
        ContentType: contentType,
        ContentLength: fileStats.size,
      });

      await this.s3Client.send(putObjectCommand);
      this.logger.log(
        `Video uploaded to R2: ${fileKey} (${fileStats.size} bytes)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to upload video to R2: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException("Failed to upload video");
    }
  }

  /**
   * R2에서 로컬로 파일 다운로드 (FFmpeg 처리용)
   */
  async downloadToLocal(fileKey: string, localPath: string): Promise<void> {
    this.ensureConfigured();

    try {
      const { stream } = await this.getVideoStream(fileKey);

      // 디렉토리 생성
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 스트림을 파일로 저장
      const writeStream = fs.createWriteStream(localPath);
      await new Promise<void>((resolve, reject) => {
        stream.pipe(writeStream);
        stream.on("error", reject);
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      this.logger.log(`Video downloaded from R2 to: ${localPath}`);
    } catch (error) {
      this.logger.error(
        `Failed to download video from R2: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException("Failed to download video");
    }
  }

  /**
   * 비디오 파일 삭제
   */
  async deleteFile(fileKey: string): Promise<void> {
    this.ensureConfigured();

    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });

      await this.s3Client.send(deleteCommand);
      this.logger.log(`Video deleted from R2: ${fileKey}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete video from R2: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException("Failed to delete video");
    }
  }

  /**
   * 비디오 파일 존재 여부 확인
   */
  async checkFileExists(fileKey: string): Promise<boolean> {
    this.ensureConfigured();

    try {
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });

      await this.s3Client.send(headCommand);
      return true;
    } catch (error) {
      if (
        error.name === "NotFound" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw error;
    }
  }

  /**
   * 마켓플레이스 파일 업로드용 Presigned URL 생성
   * 비디오와 달리 fileKey를 직접 받고, MIME 검증은 호출자(FileSafetyService)가 담당
   */
  async generateMarketplaceUploadUrl(
    fileKey: string,
    mimeType: string,
    fileSize: number,
  ): Promise<R2PresignedUrlResponse> {
    this.ensureConfigured();

    try {
      const putObjectCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        ContentType: mimeType,
        ContentLength: fileSize,
        Metadata: {
          "upload-date": new Date().toISOString(),
          "upload-type": "marketplace",
        },
      });

      const expiresIn = 15 * 60; // 15분 (파일 업로드)
      const uploadUrl = await getSignedUrl(this.s3Client, putObjectCommand, {
        expiresIn,
        signableHeaders: new Set(["content-type"]),
      });

      this.logger.log(
        `R2 marketplace upload URL generated: ${fileKey}`,
      );

      return { uploadUrl, fileKey, expiresIn };
    } catch (error) {
      this.logger.error(
        `Failed to generate R2 marketplace upload URL: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        "Failed to generate marketplace upload URL",
      );
    }
  }

  /**
   * Content-Disposition 포함 다운로드 URL (구매자 파일 다운로드 시 파일명 지정)
   */
  async generatePresignedDownloadUrlWithDisposition(
    fileKey: string,
    fileName: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    this.ensureConfigured();

    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
      });

      const url = await getSignedUrl(this.s3Client, getObjectCommand, {
        expiresIn,
      });

      this.logger.log(
        `R2 download URL with disposition generated: ${fileKey} → ${fileName}`,
      );
      return url;
    } catch (error) {
      this.logger.error(
        `Failed to generate R2 download URL: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        "Failed to generate download URL",
      );
    }
  }

  /**
   * Public URL 생성 (R2 Custom Domain 또는 Workers 사용 시)
   */
  getPublicUrl(fileKey: string): string | null {
    if (!this.publicUrl) {
      return null;
    }
    return `${this.publicUrl}/${fileKey}`;
  }

  /**
   * R2 설정 확인 헬퍼
   */
  private ensureConfigured(): void {
    if (!this.isConfigured) {
      throw new BadRequestException(
        "R2 스토리지가 설정되지 않았습니다. R2 인증 정보를 확인하세요.",
      );
    }
  }

  /**
   * 비디오 MIME 타입 검증
   */
  private validateVideoMimeType(mimeType: string): void {
    const allowedMimeTypes = ["video/mp4", "video/webm", "video/quicktime"];
    if (!allowedMimeTypes.includes(mimeType)) {
      throw new BadRequestException(
        `Invalid video MIME type: ${mimeType}. Allowed: ${allowedMimeTypes.join(", ")}`,
      );
    }
  }

  /**
   * MIME 타입에서 확장자 추출
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const extensionMap: Record<string, string> = {
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
    };
    return extensionMap[mimeType] || "mp4";
  }
}
