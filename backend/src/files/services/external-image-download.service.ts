import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosResponse } from "axios";
import * as http from "http";
import * as https from "https";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FilesService } from "../files.service";
import { S3Service } from "./s3.service";
import { CdnService } from "./cdn.service";
import { File } from "../entities/file.entity";
import {
  FileContext,
  FileContextType,
  FilePurpose,
} from "../entities/file-context.entity";
import { UrlSafetyService } from "../../common/services/url-safety.service";

/**
 * 이미지 다운로드 결과 인터페이스
 */
export interface ImageDownloadResult {
  originalUrl: string;
  success: boolean;
  file?: File;
  cdnUrl?: string;
  error?: string;
}

@Injectable()
export class ExternalImageDownloadService {
  private readonly logger = new Logger(ExternalImageDownloadService.name);
  private readonly downloadTimeout = 10000; // 10초로 단축 (Gemini URL 만료 대비)
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly maxBatchBytes = 50 * 1024 * 1024;
  private readonly maxExternalImages = 20;
  private readonly maxRedirects = 2;
  private readonly maxRetries = 3; // 재시도 횟수
  private readonly retryDelay = 1000; // 재시도 간격 (ms)

  constructor(
    private readonly configService: ConfigService,
    private readonly filesService: FilesService,
    private readonly s3Service: S3Service,
    private readonly cdnService: CdnService,
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    @InjectRepository(FileContext)
    private readonly fileContextRepository: Repository<FileContext>,
    private readonly urlSafetyService: UrlSafetyService,
  ) {}

  /**
   * 외부 이미지 URL 목록을 다운로드하여 S3에 업로드하고 상세 결과 반환
   * 성공/실패 정보와 원본 URL을 포함한 결과 반환
   * @param imageUrls 외부 이미지 URL 배열
   * @param userId 사용자 ID
   * @returns 이미지 다운로드 결과 배열 (성공/실패 모두 포함)
   */
  async downloadExternalImages(
    imageUrls: string[],
    userId: string,
    organizationId?: string,
  ): Promise<ImageDownloadResult[]> {
    if (!imageUrls || imageUrls.length === 0) {
      return [];
    }

    const boundedImageUrls = imageUrls.slice(0, this.maxExternalImages);
    if (imageUrls.length > boundedImageUrls.length) {
      this.logger.warn(
        `External image limit reached; skipping ${imageUrls.length - boundedImageUrls.length} URLs`,
      );
    }

    const startTime = Date.now();
    const downloadStats = {
      total: boundedImageUrls.length,
      successful: 0,
      failed: 0,
      geminiUrls: 0,
      duplicates: 0,
      totalBytes: 0,
      errors: [] as { url: string; error: string }[],
    };

    // Gemini URL 카운트
    downloadStats.geminiUrls = boundedImageUrls.filter((url) =>
      this.isGeminiImageUrl(url),
    ).length;

    this.logger.log(
      `Starting download of ${boundedImageUrls.length} external images`,
      {
        userId,
        geminiCount: downloadStats.geminiUrls,
        totalUrls: downloadStats.total,
      },
    );

    const results: ImageDownloadResult[] = [];
    const processedUrls = new Set<string>();

    for (const imageUrl of boundedImageUrls) {
      if (downloadStats.totalBytes >= this.maxBatchBytes) {
        results.push({
          originalUrl: imageUrl,
          success: false,
          error: "External image batch byte limit exceeded",
        });
        downloadStats.failed++;
        downloadStats.errors.push({
          url: this.redactUrl(imageUrl),
          error: "External image batch byte limit exceeded",
        });
        continue;
      }

      // 중복 URL 건너뛰기
      if (processedUrls.has(imageUrl)) {
        downloadStats.duplicates++;
        this.logger.debug(
          `Skipping duplicate URL: ${this.redactUrl(imageUrl)}`,
        );
        continue;
      }
      processedUrls.add(imageUrl);

      try {
        const file = await this.downloadAndProcessImage(
          imageUrl,
          userId,
          organizationId,
        );
        if (file) {
          // 성공한 경우
          const cdnUrl = this.cdnService.generateCdnUrl(file).url;
          results.push({
            originalUrl: imageUrl,
            success: true,
            file,
            cdnUrl,
          });
          downloadStats.successful++;
          downloadStats.totalBytes += file.fileSize || 0;
          this.logger.log(
            `Successfully downloaded: ${this.redactUrl(imageUrl)}`,
            {
              fileId: file.id,
              size: file.fileSize,
              cdnUrl,
              isGemini: this.isGeminiImageUrl(imageUrl),
            },
          );
        } else {
          // 다운로드 실패 (재시도 후에도)
          results.push({
            originalUrl: imageUrl,
            success: false,
            error: "Download failed after retries",
          });
          downloadStats.failed++;
          downloadStats.errors.push({
            url: this.redactUrl(imageUrl),
            error: "Download failed after retries",
          });
        }
      } catch (error) {
        // 예외 발생
        const errorMessage = error.message || "Unknown error";
        results.push({
          originalUrl: imageUrl,
          success: false,
          error: errorMessage,
        });
        downloadStats.failed++;
        downloadStats.errors.push({
          url: this.redactUrl(imageUrl),
          error: errorMessage,
        });
        this.logger.error(
          `Failed to download image: ${this.redactUrl(imageUrl)}`,
          {
            error: errorMessage,
            stack: error.stack,
          },
        );
        // 개별 이미지 실패는 전체 프로세스를 중단시키지 않음
      }
    }

    const duration = Date.now() - startTime;

    // 최종 통계 로깅
    this.logger.log(`Image download batch completed`, {
      ...downloadStats,
      duration: `${duration}ms`,
      successRate: `${((downloadStats.successful / downloadStats.total) * 100).toFixed(2)}%`,
      averageSize:
        downloadStats.successful > 0
          ? `${Math.round(downloadStats.totalBytes / downloadStats.successful / 1024)}KB`
          : "0KB",
    });

    // 실패한 URL이 있으면 경고 로그
    if (downloadStats.errors.length > 0) {
      this.logger.warn(
        `Failed to download ${downloadStats.errors.length} images`,
        {
          errors: downloadStats.errors,
        },
      );
    }

    return results;
  }

  /**
   * 이전 버전과의 호환성을 위한 헬퍼 메서드
   * File 배열만 반환 (성공한 것만)
   * @deprecated downloadExternalImages를 직접 사용하세요
   */
  async downloadExternalImagesLegacy(
    imageUrls: string[],
    userId: string,
  ): Promise<File[]> {
    const results = await this.downloadExternalImages(imageUrls, userId);
    return results
      .filter((result) => result.success && result.file)
      .map((result) => result.file!);
  }

  /**
   * Follow a small number of redirects while re-validating and pinning the
   * resolved address at every hop. Axios' default redirect handling would
   * otherwise allow a public URL to redirect into a private network.
   */
  private async downloadSafeResponse(
    initialUrl: string,
    headers: Record<string, string>,
  ): Promise<{ response: AxiosResponse; finalUrl: string }> {
    let target =
      await this.urlSafetyService.normalizeAndValidateWithAddress(initialUrl);

    for (let redirect = 0; redirect <= this.maxRedirects; redirect++) {
      const parsedUrl = new URL(target.url);
      const agent = this.createPinnedAgent(parsedUrl.protocol, target.address);
      const response = await axios.get(target.url, {
        responseType: "arraybuffer",
        timeout: this.downloadTimeout,
        maxRedirects: 0,
        maxContentLength: this.maxFileSize,
        maxBodyLength: this.maxFileSize,
        proxy: false,
        validateStatus: (status) =>
          status === 200 || (status >= 300 && status < 400),
        headers,
        ...(parsedUrl.protocol === "https:"
          ? { httpsAgent: agent }
          : { httpAgent: agent }),
      });

      if (response.status < 300 || response.status >= 400) {
        return { response, finalUrl: target.url };
      }

      if (redirect === this.maxRedirects) {
        throw new Error("Too many redirects while downloading image");
      }

      const location = response.headers.location;
      if (typeof location !== "string" || location.length === 0) {
        throw new Error("Redirect response did not include a Location header");
      }

      const nextUrl = new URL(location, target.url).toString();
      target =
        await this.urlSafetyService.normalizeAndValidateWithAddress(nextUrl);
    }

    throw new Error("Unable to download image safely");
  }

  private createPinnedAgent(
    protocol: string,
    address: string,
  ): http.Agent | https.Agent {
    const family = address.includes(":") ? 6 : 4;
    const lookup = (
      _hostname: string,
      _options: unknown,
      callback: (
        error: Error | null,
        address?: string,
        family?: number,
      ) => void,
    ) => callback(null, address, family);

    return protocol === "https:"
      ? new https.Agent({ lookup: lookup as any })
      : new http.Agent({ lookup: lookup as any });
  }

  /**
   * 단일 외부 이미지를 다운로드하고 처리 (재시도 로직 포함)
   * @param imageUrl 이미지 URL
   * @param userId 사용자 ID
   * @returns File 엔티티 또는 null (실패 시)
   */
  private async downloadAndProcessImage(
    imageUrl: string,
    userId: string,
    organizationId?: string,
  ): Promise<File | null> {
    const normalizedUrl = await this.urlSafetyService
      .normalizeAndValidate(imageUrl)
      .catch((error) => {
        this.logger.warn(
          `Blocked unsafe image URL: ${this.redactUrl(imageUrl)}`,
          {
            error: error.message,
          },
        );
        return null;
      });

    if (!normalizedUrl) {
      return null;
    }

    const isGeminiUrl = this.isGeminiImageUrl(normalizedUrl);
    if (isGeminiUrl) {
      this.logger.log(
        `Detected Gemini image URL: ${this.redactUrl(normalizedUrl)}`,
      );
    }

    // 재시도 로직
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // 1. 이미지 다운로드
        this.logger.debug(
          `Downloading image (attempt ${attempt}/${this.maxRetries}): ${this.redactUrl(normalizedUrl)}`,
        );
        const { response, finalUrl } = await this.downloadSafeResponse(
          normalizedUrl,
          {
            "User-Agent": `Mozilla/5.0 (compatible; Aigory/1.0; +${
              this.configService.get("PUBLIC_SITE_URL") ||
              this.configService.get("FRONTEND_URL") ||
              "http://localhost:3001"
            })`,
            Accept: "image/webp,image/avif,image/*,*/*;q=0.8",
            ...(isGeminiUrl && {
              "Cache-Control": "no-cache",
            }),
          },
        );

        // 2. 응답 검증
        if (!this.isValidImageResponse(response, finalUrl)) {
          throw new Error(
            `Invalid image response: ${response.status} ${response.statusText}`,
          );
        }

        // 3. 파일 크기 검증
        const buffer = Buffer.from(response.data);
        if (buffer.length > this.maxFileSize) {
          throw new Error(
            `File too large: ${buffer.length} bytes (max: ${this.maxFileSize})`,
          );
        }

        // 4. 이미지 포맷 확인 및 변환
        const processedBuffer = await this.processImage(buffer);
        if (!processedBuffer) {
          throw new Error("Failed to process image");
        }

        const sanitizedBuffer =
          await this.stripSensitiveMetadata(processedBuffer);

        // 5. WebP 포맷으로 변환
        const webpBuffer = await this.convertToWebP(sanitizedBuffer);

        // 6. S3에 업로드
        const fileKey = await this.uploadToS3(webpBuffer, normalizedUrl);

        // 7. File 엔티티 생성
        const file = await this.createFileEntity(
          fileKey,
          webpBuffer,
          normalizedUrl,
          userId,
          organizationId,
        );

        this.logger.log(
          `Successfully processed image (attempt ${attempt}): ${this.redactUrl(normalizedUrl)}`,
        );
        return file;
      } catch (error) {
        const errorMessage =
          error.response?.statusText || error.message || "Unknown error";
        const statusCode = error.response?.status;

        this.logger.warn(
          `Failed to download image (attempt ${attempt}/${this.maxRetries}): ${this.redactUrl(normalizedUrl)}`,
          {
            error: errorMessage,
            statusCode,
            isGemini: isGeminiUrl,
            responseData: error.response?.data ? "Data received" : "No data",
          },
        );

        // 마지막 시도가 아니면 대기 후 재시도
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt; // 점진적 지연
          this.logger.debug(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          // 모든 시도 실패
          this.logger.error(
            `All attempts failed for image: ${this.redactUrl(normalizedUrl)}`,
            {
              error: errorMessage,
              statusCode,
              isGemini: isGeminiUrl,
              attempts: attempt,
            },
          );
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Gemini 생성 이미지 URL인지 확인
   * @param url 확인할 URL
   * @returns Gemini URL 여부
   */
  private isGeminiImageUrl(url: string): boolean {
    return (
      url.includes("storage.googleapis.com/gemini") ||
      (url.includes("gemini") && url.includes("googleapis.com")) ||
      url.includes("X-Goog-Signature") ||
      url.includes("X-Goog-Algorithm")
    );
  }

  redactUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return "<invalid-url>";
    }
  }

  /**
   * 이미지 응답 유효성 검증
   * @param response Axios 응답
   * @returns 유효 여부
   */
  private isValidImageResponse(
    response: AxiosResponse,
    finalUrl: string,
  ): boolean {
    // 상태 코드 확인 (200만 허용)
    if (response.status !== 200) {
      this.logger.warn(
        `Invalid status code: ${response.status} for URL: ${this.redactUrl(finalUrl)}`,
      );
      return false;
    }

    // 최종 URL이 에러 페이지인지 확인
    if (this.isErrorPageUrl(finalUrl)) {
      this.logger.warn(`Detected error page URL: ${this.redactUrl(finalUrl)}`);
      return false;
    }

    // Content-Type 확인
    const contentType = response.headers["content-type"];
    if (typeof contentType !== "string" || !contentType.startsWith("image/")) {
      this.logger.warn(
        `Invalid content-type: ${contentType} for URL: ${this.redactUrl(finalUrl)}`,
      );
      return false;
    }

    return true;
  }

  /**
   * URL이 에러 페이지인지 확인
   * @param url 확인할 URL
   * @returns 에러 페이지 여부
   */
  private isErrorPageUrl(url: string): boolean {
    const errorPatterns = [
      /error\.(php|html|htm|asp|aspx|jsp)/i,
      /\/error\//i,
      /403\.(php|html|htm)/i,
      /404\.(php|html|htm)/i,
      /denied\.(php|html|htm)/i,
      /forbidden\.(php|html|htm)/i,
      /cloudflare.*challenge/i,
    ];

    return errorPatterns.some((pattern) => pattern.test(url));
  }

  /**
   * 이미지 처리 (초기 처리)
   * @param buffer 원본 이미지 버퍼
   * @returns 처리된 버퍼
   */
  private async processImage(buffer: Buffer): Promise<Buffer> {
    try {
      // HTML/PHP 콘텐츠 감지 (버퍼 시작 부분 검사)
      const bufferStart = buffer.toString(
        "utf8",
        0,
        Math.min(1000, buffer.length),
      );
      if (this.isHtmlContent(bufferStart)) {
        throw new Error("Detected HTML/PHP content instead of image");
      }

      // Sharp로 이미지 메타데이터 확인
      const metadata = await sharp(buffer).metadata();

      // 지원되는 포맷 확인
      const supportedFormats = ["jpeg", "jpg", "png", "gif", "webp", "avif"];
      if (
        !metadata.format ||
        !supportedFormats.includes(metadata.format.toLowerCase())
      ) {
        throw new Error(`Unsupported image format: ${metadata.format}`);
      }

      // 이미지 크기 검증 (너무 작거나 큰 이미지 거부)
      if (metadata.width && metadata.height) {
        if (metadata.width < 10 || metadata.height < 10) {
          throw new Error(
            `Image too small: ${metadata.width}x${metadata.height}`,
          );
        }
        if (metadata.width > 10000 || metadata.height > 10000) {
          throw new Error(
            `Image too large: ${metadata.width}x${metadata.height}`,
          );
        }
      }

      // 이미지 정보 로깅
      this.logger.debug(`Image metadata:`, {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        size: buffer.length,
      });

      return buffer;
    } catch (error) {
      this.logger.error("Error processing image:", error);
      throw error;
    }
  }

  /**
   * 버퍼가 HTML/PHP 콘텐츠인지 확인
   * @param content 버퍼 시작 부분의 문자열
   * @returns HTML/PHP 여부
   */
  private isHtmlContent(content: string): boolean {
    const htmlPatterns = [
      /<!DOCTYPE/i,
      /<html/i,
      /<head/i,
      /<body/i,
      /<?php/i,
      /<script/i,
      /<meta/i,
      /error\s*:/i,
      /forbidden/i,
      /access\s*denied/i,
      /cloudflare/i,
    ];

    return htmlPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * 이미지를 WebP 포맷으로 변환
   * @param buffer 이미지 버퍼
   * @returns WebP 버퍼
   */
  private async convertToWebP(buffer: Buffer): Promise<Buffer> {
    try {
      // Sharp를 사용하여 WebP 변환 및 최적화
      let sharpInstance = sharp(buffer);

      // 이미지 정보 가져오기
      const metadata = await sharp(buffer).metadata();

      // 최대 크기 제한 (2048x2048)
      if (metadata.width && metadata.width > 2048) {
        sharpInstance = sharpInstance.resize(2048, null, {
          withoutEnlargement: true,
          fit: "inside",
        });
      }

      // WebP 변환
      const webpBuffer = await sharpInstance
        .webp({
          quality: 85,
          effort: 4,
          smartSubsample: true,
        })
        .toBuffer();

      this.logger.debug(
        `Converted to WebP: ${buffer.length} → ${webpBuffer.length} bytes`,
      );
      return webpBuffer;
    } catch (error) {
      this.logger.error("Error converting to WebP:", error);
      throw error;
    }
  }

  /**
   * 이미지 버퍼에서 EXIF/메타데이터 제거
   */
  private async stripSensitiveMetadata(buffer: Buffer): Promise<Buffer> {
    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.exif && !metadata.icc && !metadata.xmp) {
        return buffer;
      }

      this.logger.debug("Stripping sensitive metadata from image", {
        hasExif: Boolean(metadata.exif),
        hasICC: Boolean(metadata.icc),
        hasXmp: Boolean(metadata.xmp),
      });

      const format = metadata.format;
      const sanitizer = sharp(buffer);

      switch (format as string) {
        case "jpeg":
        case "jpg":
          return sanitizer.jpeg({ quality: 100 }).toBuffer();
        case "png":
          return sanitizer.png().toBuffer();
        case "webp":
          return sanitizer.webp({ lossless: true }).toBuffer();
        case "avif":
          return sanitizer.avif({ lossless: true }).toBuffer();
        default:
          return sanitizer.toBuffer();
      }
    } catch (error) {
      this.logger.warn(
        `Failed to strip metadata, using original buffer: ${error.message}`,
      );
      return buffer;
    }
  }

  /**
   * S3에 파일 업로드
   * @param buffer 파일 버퍼
   * @param originalUrl 원본 URL
   * @returns S3 파일 키
   */
  private async uploadToS3(
    buffer: Buffer,
    originalUrl: string,
  ): Promise<string> {
    // 파일명 생성 (UUID + 확장자)
    const fileName = `${uuidv4()}.webp`;
    const fileKey = `uploads/external/${fileName}`;

    // S3에 업로드
    try {
      await this.s3Service.uploadBuffer(fileKey, buffer, "image/webp", {
        "original-url": this.redactUrl(originalUrl),
        "downloaded-at": new Date().toISOString(),
        source: "external_download",
      });

      this.logger.debug(`Uploaded to S3: ${fileKey}`);
      return fileKey;
    } catch (error) {
      this.logger.error(`Failed to upload to S3: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * File 엔티티 생성
   * @param fileKey S3 파일 키
   * @param buffer 파일 버퍼
   * @param originalUrl 원본 URL
   * @param userId 사용자 ID
   * @returns File 엔티티
   */
  private async createFileEntity(
    fileKey: string,
    buffer: Buffer,
    originalUrl: string,
    userId: string,
    organizationId?: string,
  ): Promise<File> {
    // 임시 FileContext 생성
    const tempContext = this.fileContextRepository.create({
      contextType: FileContextType.SYSTEM,
      purpose: FilePurpose.GENERAL,
      ownerId: userId,
      organizationId,
    });
    const savedContext = await this.fileContextRepository.save(tempContext);

    // 파일 정보 DB에 저장
    const file = this.fileRepository.create({
      fileName: fileKey.split("/").pop(),
      originalName: this.extractOriginalFilename(originalUrl),
      fileKey, // S3 키 (전체 경로)
      fileUrl: fileKey, // S3 키를 저장
      fileSize: buffer.length,
      mimeType: "image/webp",
      fileType: "image",
      userId,
      organizationId,
      contextId: savedContext.id, // 임시 context 추가
      metadata: {
        originalUrl: this.redactUrl(originalUrl),
        downloadedAt: new Date().toISOString(),
        source: "external_download",
      },
    });

    const savedFile = await this.fileRepository.save(file);

    this.logger.debug(
      `File entity created: ${savedFile.id}, originalUrl: ${this.redactUrl(originalUrl)}`,
    );
    return savedFile;
  }

  /**
   * URL에서 원본 파일명 추출
   * @param url 이미지 URL
   * @returns 추출된 파일명
   */
  private extractOriginalFilename(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split("/").pop();

      // 확장자 제거 및 UUID 기반 이름 생성
      if (filename && filename.includes(".")) {
        return filename.split(".").slice(0, -1).join(".");
      }

      return `external_image_${Date.now()}`;
    } catch {
      return `external_image_${Date.now()}`;
    }
  }

  /**
   * 콘텐츠에서 외부 이미지 URL 추출 (HTML 및 Markdown 모두 지원)
   * @param content HTML 또는 Markdown 콘텐츠
   * @returns 외부 이미지 URL 배열
   */
  extractExternalImageUrls(content: string): string[] {
    const imageUrls: string[] = [];

    // Pattern 1: HTML img 태그
    const htmlPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;

    // HTML 이미지 URL 추출
    while ((match = htmlPattern.exec(content)) !== null) {
      const url = match[1];
      if (this.isExternalImageUrl(url)) {
        imageUrls.push(url);
      }
    }

    // Pattern 2: Markdown 이미지 문법 ![alt](url)
    const markdownPattern = /!\[.*?\]\(([^)]+)\)/gi;

    // Markdown 이미지 URL 추출
    while ((match = markdownPattern.exec(content)) !== null) {
      const url = match[1].trim(); // 공백 제거

      // URL이 아닌 경우 제외 (예: ![alt](./local-image.png))
      if (url.startsWith("http://") || url.startsWith("https://")) {
        if (this.isExternalImageUrl(url)) {
          imageUrls.push(url);
        }
      }
    }

    // 중복 제거 및 서버 측 리소스 상한
    const uniqueUrls = [...new Set(imageUrls)];
    if (uniqueUrls.length > this.maxExternalImages) {
      this.logger.warn(
        `External image URL limit reached; keeping first ${this.maxExternalImages} of ${uniqueUrls.length}`,
      );
    }
    return uniqueUrls.slice(0, this.maxExternalImages);
  }

  /**
   * 외부 이미지 URL인지 확인
   * @param url 이미지 URL
   * @returns 외부 URL 여부
   */
  private isExternalImageUrl(url: string): boolean {
    // localhost:3000/user_images는 외부 URL로 처리 (MCP 자동포스팅에서 사용)
    if (/^https?:\/\/localhost:\d+\/user_images\//.test(url)) {
      this.logger.debug(
        `[External Image] localhost user_images URL detected as external: ${this.redactUrl(url)}`,
      );
      return true;
    }

    // 내부 CDN URL 패턴
    const internalPatterns = [
      /^https:\/\/cdn\.aigory\.com\//,
      /^https?:\/\/localhost:\d+\//, // localhost의 다른 경로는 여전히 내부로 처리
      /^\/api\/v1\/files\//,
      /^uploads\//,
      /^data:image\//,
    ];

    // 외부 스토리지 패턴 (다운로드 필요)
    const externalPatterns = [
      /storage\.googleapis\.com/,
      /gemini-.*\.googleapis\.com/,
      /.*\.amazonaws\.com\/.*\/(?!.*\.aigory\.com)/,
      /.*\.oraclecloud\.com\/.*\/(?!.*\.aigory\.com)/,
    ];

    // 내부 URL이면 false
    if (internalPatterns.some((pattern) => pattern.test(url))) {
      return false;
    }

    // 외부 스토리지이거나 일반 외부 URL이면 true
    return (
      externalPatterns.some((pattern) => pattern.test(url)) ||
      (url.startsWith("https://") && !url.includes("aigory.com")) ||
      (url.startsWith("http://") && !url.includes("localhost"))
    ); // http 외부 URL도 처리
  }

  /**
   * HTML 및 Markdown 콘텐츠의 외부 이미지 URL을 CDN URL로 변환
   * @param content HTML 또는 Markdown 콘텐츠
   * @param urlMapping 원본 URL → CDN URL 매핑
   * @returns 변환된 콘텐츠
   */
  replaceImageUrls(content: string, urlMapping: Map<string, string>): string {
    let updatedContent = content;

    for (const [originalUrl, cdnUrl] of urlMapping.entries()) {
      // 정규식 이스케이프 처리
      const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // Pattern 1: HTML img 태그의 src 속성
      const htmlRegex = new RegExp(`src=["']${escapedUrl}["']`, "g");
      updatedContent = updatedContent.replace(htmlRegex, `src="${cdnUrl}"`);

      // Pattern 2: Markdown 이미지 문법 ![alt](url)
      // markdownRegex는 `!\[([^\]]*)\]\(([^)]+)\)` 형식
      // 첫 번째 캡처: alt text
      // 두 번째 캡처: URL
      const markdownRegex = new RegExp(
        `(!\\[[^\\]]*\\]\\()${escapedUrl}(\\))`,
        "g",
      );
      updatedContent = updatedContent.replace(markdownRegex, `$1${cdnUrl}$2`);
    }

    return updatedContent;
  }

  /**
   * 다운로드 실패한 이미지 태그를 콘텐츠에서 제거
   * 404 에러 등으로 다운로드 실패한 이미지를 완전히 제거
   * @param content HTML 또는 Markdown 콘텐츠
   * @param failedUrls 실패한 이미지 URL 목록
   * @returns 실패한 이미지가 제거된 콘텐츠
   */
  removeFailedImages(content: string, failedUrls: string[]): string {
    if (!failedUrls || failedUrls.length === 0) {
      return content;
    }

    let updatedContent = content;

    for (const failedUrl of failedUrls) {
      // 정규식 이스케이프 처리
      const escapedUrl = failedUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // Pattern 1: HTML img 태그 전체 제거
      // <img ... src="url" ... > 형태를 찾아 제거 (속성 순서 무관)
      const htmlImgRegex = new RegExp(
        `<img[^>]*\\ssrc=["']${escapedUrl}["'][^>]*>`,
        "gi",
      );
      updatedContent = updatedContent.replace(htmlImgRegex, "");

      // Pattern 2: HTML img 태그 (src가 먼저 오는 경우)
      const htmlImgRegex2 = new RegExp(
        `<img\\s+src=["']${escapedUrl}["'][^>]*>`,
        "gi",
      );
      updatedContent = updatedContent.replace(htmlImgRegex2, "");

      // Pattern 3: Markdown 이미지 문법 제거 ![alt text](url)
      const markdownRegex = new RegExp(
        `!\\[[^\\]]*\\]\\(${escapedUrl}\\)`,
        "g",
      );
      updatedContent = updatedContent.replace(markdownRegex, "");

      // Pattern 4: Figure/Image 태그 조합 제거 (필요한 경우)
      // <figure>...<img src="url">...</figure> 형태
      const figureRegex = new RegExp(
        `<figure[^>]*>.*?<img[^>]*\\ssrc=["']${escapedUrl}["'][^>]*>.*?</figure>`,
        "gis",
      );
      updatedContent = updatedContent.replace(figureRegex, "");

      // 연속된 빈 줄 정리 (이미지 제거 후 남은 공백)
      updatedContent = updatedContent.replace(/\n\s*\n\s*\n/g, "\n\n");
    }

    // 실패한 이미지 제거 로깅
    if (failedUrls.length > 0) {
      this.logger.log(
        `Removed ${failedUrls.length} failed image(s) from content`,
        {
          failedUrls: failedUrls.map((url) => this.redactUrl(url)),
        },
      );
    }

    return updatedContent.trim();
  }
}
