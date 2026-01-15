import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { File } from "../entities/file.entity";
import { S3Service } from "./s3.service";
import * as sharp from "sharp";
import { Readable } from "stream";

export interface OptimizationOptions {
  quality?: number;
  format?: "webp" | "jpeg" | "png";
  resize?: {
    width?: number;
    height?: number;
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  };
  generateThumbnails?: boolean;
}

export interface ThumbnailSizes {
  small: { width: 150; height: 150 };
  medium: { width: 300; height: 300 };
  large: { width: 600; height: 600 };
}

/**
 * 이미지 최적화 서비스
 */
@Injectable()
export class ImageOptimizationService {
  private readonly logger = new Logger(ImageOptimizationService.name);

  private readonly thumbnailSizes: ThumbnailSizes = {
    small: { width: 150, height: 150 },
    medium: { width: 300, height: 300 },
    large: { width: 600, height: 600 },
  };

  constructor(
    @InjectRepository(File)
    private fileRepository: Repository<File>,
    private s3Service: S3Service,
  ) {}

  /**
   * 이미지 최적화
   */
  async optimizeImage(
    fileId: string,
    options: OptimizationOptions = {},
  ): Promise<void> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
    });

    if (!file || !this.isImage(file.mimeType)) {
      this.logger.warn(`File ${fileId} is not an image or not found`);
      return;
    }

    try {
      // S3에서 원본 이미지 다운로드
      const imageBuffer = await this.downloadFromS3(file.fileKey);

      // 이미지 최적화
      const optimizedBuffer = await this.processImage(imageBuffer, options);

      // 최적화된 이미지 업로드
      const optimizedKey = this.generateOptimizedKey(
        file.fileKey,
        options.format,
      );
      await this.uploadToS3(
        optimizedKey,
        optimizedBuffer,
        `image/${options.format || "webp"}`,
      );

      // 썸네일 생성
      if (options.generateThumbnails) {
        const thumbnails = await this.generateThumbnails(
          imageBuffer,
          file.fileKey,
        );
        file.metadata = {
          ...file.metadata,
          thumbnails: thumbnails.map((t) => t.key),
        };
      }

      // 메타데이터 업데이트
      const metadata = await sharp(imageBuffer).metadata();
      file.metadata = {
        ...file.metadata,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        optimized: true,
        optimizedAt: new Date().toISOString(),
      };

      file.isOptimized = true;
      await this.fileRepository.save(file);

      this.logger.log(`Image ${fileId} optimized successfully`);
    } catch (error) {
      this.logger.error(`Failed to optimize image ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * 썸네일 생성
   */
  async generateThumbnails(
    imageBuffer: Buffer,
    originalKey: string,
  ): Promise<Array<{ size: string; key: string }>> {
    const thumbnails = [];

    for (const [size, dimensions] of Object.entries(this.thumbnailSizes)) {
      try {
        const thumbnailBuffer = await sharp(imageBuffer)
          .resize(dimensions.width, dimensions.height, {
            fit: "cover",
            position: "center",
          })
          .webp({ quality: 80 })
          .toBuffer();

        const thumbnailKey = this.generateThumbnailKey(originalKey, size);
        await this.uploadToS3(thumbnailKey, thumbnailBuffer, "image/webp");

        thumbnails.push({ size, key: thumbnailKey });
        this.logger.log(`Generated ${size} thumbnail for ${originalKey}`);
      } catch (error) {
        this.logger.error(`Failed to generate ${size} thumbnail:`, error);
      }
    }

    return thumbnails;
  }

  /**
   * 배치 최적화 (크론 작업용)
   */
  async optimizeBatch(limit: number = 10): Promise<void> {
    const unoptimizedFiles = await this.fileRepository.find({
      where: {
        isOptimized: false,
        fileType: "image",
      },
      take: limit,
    });

    this.logger.log(`Found ${unoptimizedFiles.length} unoptimized images`);

    for (const file of unoptimizedFiles) {
      try {
        await this.optimizeImage(file.id, {
          format: "webp",
          quality: 85,
          generateThumbnails: true,
        });
      } catch (error) {
        this.logger.error(`Failed to optimize file ${file.id}:`, error);
      }
    }
  }

  /**
   * 이미지 리사이징
   */
  async resizeImage(
    fileId: string,
    width: number,
    height: number,
    fit: "cover" | "contain" | "fill" = "cover",
  ): Promise<string> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
    });

    if (!file || !this.isImage(file.mimeType)) {
      throw new Error("File is not an image");
    }

    const imageBuffer = await this.downloadFromS3(file.fileKey);

    const resizedBuffer = await sharp(imageBuffer)
      .resize(width, height, { fit })
      .toBuffer();

    const resizedKey = this.generateResizedKey(file.fileKey, width, height);
    await this.uploadToS3(resizedKey, resizedBuffer, file.mimeType);

    return resizedKey;
  }

  /**
   * Private: 이미지 처리
   */
  private async processImage(
    buffer: Buffer,
    options: OptimizationOptions,
  ): Promise<Buffer> {
    let pipeline = sharp(buffer);

    // 리사이징
    if (options.resize) {
      pipeline = pipeline.resize(options.resize.width, options.resize.height, {
        fit: options.resize.fit || "cover",
      });
    }

    // 포맷 변환
    switch (options.format) {
      case "webp":
        pipeline = pipeline.webp({ quality: options.quality || 85 });
        break;
      case "jpeg":
        pipeline = pipeline.jpeg({ quality: options.quality || 85 });
        break;
      case "png":
        pipeline = pipeline.png({ quality: options.quality || 85 });
        break;
      default:
        pipeline = pipeline.webp({ quality: 85 });
    }

    return pipeline.toBuffer();
  }

  /**
   * Private: S3에서 다운로드
   */
  private async downloadFromS3(key: string): Promise<Buffer> {
    // TODO: S3Service에 download 메서드 추가 필요
    // 임시로 fetch 사용
    const url = await this.s3Service.generatePresignedDownloadUrl(key);
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Private: S3에 업로드
   */
  private async uploadToS3(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<void> {
    // TODO: S3Service에 direct upload 메서드 추가 필요
    const presignedUrl = await this.s3Service.generatePresignedUploadUrl(
      key,
      mimeType,
      buffer.length,
      "image",
    );

    await fetch(presignedUrl.uploadUrl, {
      method: "PUT",
      body: buffer,
      headers: {
        "Content-Type": mimeType,
      },
    });
  }

  /**
   * Private: 이미지 여부 확인
   */
  private isImage(mimeType: string): boolean {
    return mimeType.startsWith("image/");
  }

  /**
   * Private: 최적화된 키 생성
   */
  private generateOptimizedKey(originalKey: string, format?: string): string {
    const parts = originalKey.split(".");
    const ext = format || "webp";
    parts[parts.length - 1] = `optimized.${ext}`;
    return parts.join(".");
  }

  /**
   * Private: 썸네일 키 생성
   */
  private generateThumbnailKey(originalKey: string, size: string): string {
    const parts = originalKey.split("/");
    const fileName = parts.pop();
    const nameParts = fileName.split(".");
    nameParts[nameParts.length - 2] =
      `${nameParts[nameParts.length - 2]}_${size}`;
    nameParts[nameParts.length - 1] = "webp";
    parts.push(nameParts.join("."));
    return parts.join("/");
  }

  /**
   * Private: 리사이즈 키 생성
   */
  private generateResizedKey(
    originalKey: string,
    width: number,
    height: number,
  ): string {
    const parts = originalKey.split("/");
    const fileName = parts.pop();
    const nameParts = fileName.split(".");
    nameParts[nameParts.length - 2] =
      `${nameParts[nameParts.length - 2]}_${width}x${height}`;
    parts.push(nameParts.join("."));
    return parts.join("/");
  }
}
