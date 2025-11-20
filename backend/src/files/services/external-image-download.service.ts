import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as sharp from 'sharp';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilesService } from '../files.service';
import { S3Service } from './s3.service';
import { File } from '../entities/file.entity';
import { FileContext, FileContextType, FilePurpose } from '../entities/file-context.entity';

@Injectable()
export class ExternalImageDownloadService {
  private readonly logger = new Logger(ExternalImageDownloadService.name);
  private readonly downloadTimeout = 30000; // 30초
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  constructor(
    private readonly configService: ConfigService,
    private readonly filesService: FilesService,
    private readonly s3Service: S3Service,
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    @InjectRepository(FileContext)
    private readonly fileContextRepository: Repository<FileContext>,
  ) {}

  /**
   * 외부 이미지 URL 목록을 다운로드하여 S3에 업로드하고 File 엔티티 배열 반환
   * @param imageUrls 외부 이미지 URL 배열
   * @param userId 사용자 ID
   * @returns 성공적으로 업로드된 File 엔티티 배열
   */
  async downloadExternalImages(imageUrls: string[], userId: string): Promise<File[]> {
    if (!imageUrls || imageUrls.length === 0) {
      return [];
    }

    this.logger.log(`Starting download of ${imageUrls.length} external images for user: ${userId}`);
    const results: File[] = [];

    for (const imageUrl of imageUrls) {
      try {
        // 중복 URL 건너뛰기 (metadata에 originalUrl 저장)
        if (results.some(file => file.metadata?.originalUrl === imageUrl)) {
          continue;
        }

        const file = await this.downloadAndProcessImage(imageUrl, userId);
        if (file) {
          results.push(file);
          this.logger.log(`Successfully downloaded and processed: ${imageUrl}`);
        }
      } catch (error) {
        this.logger.error(`Failed to download image: ${imageUrl}`, error.stack);
        // 개별 이미지 실패는 전체 프로세스를 중단시키지 않음
      }
    }

    this.logger.log(`Downloaded ${results.length}/${imageUrls.length} images successfully`);
    return results;
  }

  /**
   * 단일 외부 이미지를 다운로드하고 처리
   * @param imageUrl 이미지 URL
   * @param userId 사용자 ID
   * @returns File 엔티티 또는 null (실패 시)
   */
  private async downloadAndProcessImage(imageUrl: string, userId: string): Promise<File | null> {
    try {
      // 1. 이미지 다운로드
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: this.downloadTimeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CodebaseBlog/1.0; +https://codebase.blog)',
        },
      });

      // 2. 응답 검증
      if (!this.isValidImageResponse(response)) {
        throw new Error(`Invalid image response: ${response.status} ${response.statusText}`);
      }

      // 3. 파일 크기 검증
      const buffer = Buffer.from(response.data);
      if (buffer.length > this.maxFileSize) {
        throw new Error(`File too large: ${buffer.length} bytes`);
      }

      // 4. 이미지 포맷 확인 및 변환
      const processedBuffer = await this.processImage(buffer);
      if (!processedBuffer) {
        throw new Error('Failed to process image');
      }

      // 5. WebP 포맷으로 변환
      const webpBuffer = await this.convertToWebP(processedBuffer);

      // 6. S3에 업로드
      const fileKey = await this.uploadToS3(webpBuffer, imageUrl);

      // 7. File 엔티티 생성
      const file = await this.createFileEntity(fileKey, webpBuffer, imageUrl, userId);

      return file;

    } catch (error) {
      this.logger.error(`Error processing image ${imageUrl}:`, error.message);
      return null;
    }
  }

  /**
   * 이미지 응답 유효성 검증
   * @param response Axios 응답
   * @returns 유효 여부
   */
  private isValidImageResponse(response: AxiosResponse): boolean {
    // 상태 코드 확인
    if (response.status !== 200) {
      return false;
    }

    // Content-Type 확인
    const contentType = response.headers['content-type'];
    if (!contentType || !contentType.startsWith('image/')) {
      return false;
    }

    return true;
  }

  /**
   * 이미지 처리 (초기 처리)
   * @param buffer 원본 이미지 버퍼
   * @returns 처리된 버퍼
   */
  private async processImage(buffer: Buffer): Promise<Buffer> {
    try {
      // Sharp로 이미지 메타데이터 확인
      const metadata = await sharp(buffer).metadata();

      // 지원되는 포맷 확인
      const supportedFormats = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'avif'];
      if (!metadata.format || !supportedFormats.includes(metadata.format.toLowerCase())) {
        throw new Error(`Unsupported image format: ${metadata.format}`);
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
      this.logger.error('Error processing image:', error);
      throw error;
    }
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
          fit: 'inside',
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

      this.logger.debug(`Converted to WebP: ${buffer.length} → ${webpBuffer.length} bytes`);
      return webpBuffer;

    } catch (error) {
      this.logger.error('Error converting to WebP:', error);
      throw error;
    }
  }

  /**
   * S3에 파일 업로드
   * @param buffer 파일 버퍼
   * @param originalUrl 원본 URL
   * @returns S3 파일 키
   */
  private async uploadToS3(buffer: Buffer, originalUrl: string): Promise<string> {
    // 파일명 생성 (UUID + 확장자)
    const fileName = `${uuidv4()}.webp`;
    const fileKey = `uploads/external/${fileName}`;

    // S3에 업로드
    try {
      await this.s3Service.uploadBuffer(
        fileKey,
        buffer,
        'image/webp',
        {
          'original-url': originalUrl,
          'downloaded-at': new Date().toISOString(),
          'source': 'external_download',
        }
      );

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
  ): Promise<File> {
    // 임시 FileContext 생성
    const tempContext = this.fileContextRepository.create({
      contextType: FileContextType.SYSTEM,
      purpose: FilePurpose.GENERAL,
      ownerId: userId,
    });
    const savedContext = await this.fileContextRepository.save(tempContext);

    // 파일 정보 DB에 저장
    const file = this.fileRepository.create({
      fileName: fileKey.split('/').pop(),
      originalName: this.extractOriginalFilename(originalUrl),
      fileKey, // S3 키 (전체 경로)
      fileUrl: fileKey, // S3 키를 저장
      fileSize: buffer.length,
      mimeType: 'image/webp',
      fileType: 'image',
      userId,
      contextId: savedContext.id, // 임시 context 추가
      metadata: {
        originalUrl,
        downloadedAt: new Date().toISOString(),
        source: 'external_download',
      },
    });

    const savedFile = await this.fileRepository.save(file);

    this.logger.debug(`File entity created: ${savedFile.id}, originalUrl: ${originalUrl}`);
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
      const filename = pathname.split('/').pop();

      // 확장자 제거 및 UUID 기반 이름 생성
      if (filename && filename.includes('.')) {
        return filename.split('.').slice(0, -1).join('.');
      }

      return `external_image_${Date.now()}`;
    } catch {
      return `external_image_${Date.now()}`;
    }
  }

  /**
   * HTML 콘텐츠에서 외부 이미지 URL 추출
   * @param content HTML 콘텐츠
   * @returns 외부 이미지 URL 배열
   */
  extractExternalImageUrls(content: string): string[] {
    const imageUrls: string[] = [];
    const urlPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = urlPattern.exec(content)) !== null) {
      const url = match[1];

      // 내부 URL 필터링
      if (this.isExternalImageUrl(url)) {
        imageUrls.push(url);
      }
    }

    // 중복 제거
    return [...new Set(imageUrls)];
  }

  /**
   * 외부 이미지 URL인지 확인
   * @param url 이미지 URL
   * @returns 외부 URL 여부
   */
  private isExternalImageUrl(url: string): boolean {
    // 내부 CDN URL 패턴
    const internalPatterns = [
      /^https:\/\/cdn\.codebase\.blog\//,
      /^https?:\/\/localhost:\d+\//,
      /^\/api\/v1\/files\//,
      /^uploads\//,
      /^data:image\//,
    ];

    // 외부 스토리지 패턴 (다운로드 필요)
    const externalPatterns = [
      /storage\.googleapis\.com/,
      /gemini-.*\.googleapis\.com/,
      /.*\.amazonaws\.com\/.*\/(?!.*\.codebase\.blog)/,
      /.*\.oraclecloud\.com\/.*\/(?!.*\.codebase\.blog)/,
    ];

    // 내부 URL이면 false
    if (internalPatterns.some(pattern => pattern.test(url))) {
      return false;
    }

    // 외부 스토리지이거나 일반 외부 URL이면 true
    return externalPatterns.some(pattern => pattern.test(url)) ||
           (url.startsWith('https://') && !url.includes('codebase.blog'));
  }

  /**
   * HTML 콘텐츠의 외부 이미지 URL을 CDN URL로 변환
   * @param content HTML 콘텐츠
   * @param urlMapping 원본 URL → CDN URL 매핑
   * @returns 변환된 HTML 콘텐츠
   */
  replaceImageUrls(content: string, urlMapping: Map<string, string>): string {
    let updatedContent = content;

    for (const [originalUrl, cdnUrl] of urlMapping.entries()) {
      // 정규식 이스케이프 처리
      const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`src=["']${escapedUrl}["']`, 'g');

      updatedContent = updatedContent.replace(regex, `src="${cdnUrl}"`);
    }

    return updatedContent;
  }
}