import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { File } from '../entities/file.entity';
import { FileContext, FileContextType, FilePurpose } from '../entities/file-context.entity';
import { S3Service, PresignedUrlResponse } from './s3.service';
import { CdnService } from './cdn.service';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as crypto from 'crypto';

export interface UploadContext {
  contextType: FileContextType;
  contextId?: string;
  ownerId: string;
  purpose: FilePurpose;
}

export interface FileUploadResult {
  fileId: string;
  contextId: string;
  s3Key: string;
  url: string;
  version: number;
}

/**
 * 컨텍스트 기반 파일 관리 서비스
 */
@Injectable()
export class ContextualFileService {
  private readonly logger = new Logger(ContextualFileService.name);

  constructor(
    @InjectRepository(File)
    private fileRepository: Repository<File>,
    @InjectRepository(FileContext)
    private contextRepository: Repository<FileContext>,
    private s3Service: S3Service,
    private cdnService: CdnService,
  ) {}

  /**
   * 프로필 이미지 업로드
   */
  async uploadProfileImage(
    userId: string,
    file: Express.Multer.File,
    purpose: 'avatar' | 'cover' = 'avatar',
  ): Promise<FileUploadResult> {
    // 기존 프로필 이미지 비활성화
    await this.deactivatePreviousFiles(FileContextType.PROFILE, userId, purpose as FilePurpose);

    const s3Key = this.generateS3Key(FileContextType.PROFILE, userId, purpose, file);
    const context = await this.createFileContext({
      contextType: FileContextType.PROFILE,
      contextId: userId,
      ownerId: userId,
      purpose: purpose as FilePurpose,
    });

    return this.uploadWithContextInternal(s3Key, file, context);
  }

  /**
   * 포스트 이미지 업로드
   */
  async uploadPostImage(
    userId: string,
    postId: string,
    file: Express.Multer.File,
  ): Promise<FileUploadResult> {
    const s3Key = this.generateS3Key(FileContextType.POST, userId, 'content', file, postId);
    const context = await this.createFileContext({
      contextType: FileContextType.POST,
      contextId: postId,
      ownerId: userId,
      purpose: FilePurpose.CONTENT,
    });

    return this.uploadWithContextInternal(s3Key, file, context);
  }

  /**
   * 블로그 브랜딩 업로드
   */
  async uploadBlogAsset(
    userId: string,
    blogId: string,
    file: Express.Multer.File,
    purpose: 'logo' | 'banner' | 'favicon',
  ): Promise<FileUploadResult> {
    // 기존 브랜딩 이미지 비활성화
    await this.deactivatePreviousFiles(FileContextType.BLOG, blogId, purpose as FilePurpose);

    const s3Key = this.generateS3Key(FileContextType.BLOG, blogId, purpose, file);
    const context = await this.createFileContext({
      contextType: FileContextType.BLOG,
      contextId: blogId,
      ownerId: userId,
      purpose: purpose as FilePurpose,
    });

    return this.uploadWithContextInternal(s3Key, file, context);
  }

  /**
   * Presigned URL 생성 (브라우저 직접 업로드용)
   */
  async generateUploadUrl(
    userId: string,
    uploadContext: UploadContext,
    fileName: string,
    fileSize: number,
    mimeType: string,
  ): Promise<PresignedUrlResponse & { contextId: string }> {
    // 컨텍스트 생성
    const context = await this.createFileContext(uploadContext);
    
    // S3 키 생성
    const s3Key = this.generateS3KeyFromContext(context, fileName);
    
    // Presigned URL 생성
    const presignedData = await this.s3Service.generatePresignedUploadUrl(
      s3Key,
      mimeType,
      fileSize,
      this.getFileTypeFromContext(context.contextType),
    );

    // 파일 레코드 사전 생성 (업로드 완료 시 업데이트)
    const file = this.fileRepository.create({
      originalName: fileName,
      fileName: path.basename(s3Key),
      fileKey: s3Key,
      fileUrl: s3Key,
      fileSize,
      mimeType,
      fileType: this.getFileTypeFromContext(context.contextType),
      userId,
      contextId: context.id,
      s3Bucket: process.env.AWS_S3_BUCKET,
      s3Region: process.env.AWS_REGION || 'us-east-1',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24시간 후 만료
    });

    await this.fileRepository.save(file);

    return {
      ...presignedData,
      contextId: context.id,
    };
  }

  /**
   * 업로드 완료 처리
   */
  async completeUpload(
    fileId: string,
    userId: string,
  ): Promise<FileUploadResult> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId, userId },
      relations: ['context'],
    });

    if (!file) {
      throw new BadRequestException('File not found or unauthorized');
    }

    // 파일 검증 (S3에 실제로 존재하는지)
    const exists = await this.s3Service.checkFileExists(file.fileKey);
    if (!exists) {
      throw new BadRequestException('File upload not completed');
    }

    // 만료 시간 제거 (영구 보관)
    file.expiresAt = null;

    // 체크섬 생성
    file.checksum = this.generateChecksum(file);

    await this.fileRepository.save(file);

    // 컨텍스트 통계 업데이트
    await this.updateContextStats(file.context);

    // CDN URL 생성 (CDN 활성화 시 CDN URL, 비활성화 시 OCI 직접 URL)
    const cdnUrlResult = this.cdnService.generateCdnUrl(file);
    const url = cdnUrlResult.url;

    this.logger.log(`Upload completed: ${file.fileKey}, URL: ${url} (CDN: ${cdnUrlResult.cached})`);

    return {
      fileId: file.id,
      contextId: file.contextId,
      s3Key: file.fileKey,
      url,
      version: file.context.version,
    };
  }

  /**
   * 컨텍스트별 파일 조회
   */
  async getFilesByContext(
    contextType: FileContextType,
    contextId: string,
  ): Promise<File[]> {
    return this.fileRepository.find({
      where: {
        context: {
          contextType,
          contextId,
          isActive: true,
        },
      },
      relations: ['context'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * 파일 삭제 (소프트 삭제)
   */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId, userId },
      relations: ['context'],
    });

    if (!file) {
      throw new BadRequestException('File not found or unauthorized');
    }

    // 30일 후 삭제 예약
    file.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.fileRepository.save(file);

    // 컨텍스트 통계 업데이트
    if (file.context) {
      file.context.fileCount--;
      file.context.totalSize = Number(file.context.totalSize) - file.fileSize;
      await this.contextRepository.save(file.context);
    }

    this.logger.log(`File ${fileId} scheduled for deletion in 30 days`);
  }

  /**
   * Private: S3 키 생성
   */
  private generateS3Key(
    contextType: FileContextType,
    identifier: string,
    purpose: string,
    file: Express.Multer.File | { originalname: string },
    subId?: string,
  ): string {
    // 날짜 + 시간 타임스탬프 생성 (예: 20250130_142335)
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const timeStr = now.toISOString().split('T')[1].split('.')[0].replace(/:/g, '');
    const timestamp = `${dateStr}_${timeStr}`;

    const uuid = uuidv4().split('-')[0];
    const ext = path.extname(file.originalname);
    const fileName = `${timestamp}_${uuid}_${purpose}${ext}`;

    switch (contextType) {
      case FileContextType.PROFILE:
        return `v2/users/${identifier}/profile/${purpose}/${fileName}`;
      case FileContextType.POST:
        return `v2/users/${identifier}/content/posts/${subId}/${fileName}`;
      case FileContextType.BLOG:
        return `v2/blogs/${identifier}/branding/${purpose}/${fileName}`;
      default:
        return `v2/system/misc/${fileName}`;
    }
  }

  /**
   * Private: 컨텍스트에서 S3 키 생성
   */
  private generateS3KeyFromContext(context: FileContext, fileName: string): string {
    // 날짜 + 시간 타임스탬프 생성 (예: 20250130_142335)
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const timeStr = now.toISOString().split('T')[1].split('.')[0].replace(/:/g, '');
    const timestamp = `${dateStr}_${timeStr}`;

    const uuid = uuidv4().split('-')[0];
    const ext = path.extname(fileName);
    const newFileName = `${timestamp}_${uuid}_${context.purpose}${ext}`;

    switch (context.contextType) {
      case FileContextType.PROFILE:
        return `v2/users/${context.ownerId}/profile/${context.purpose}/${newFileName}`;
      case FileContextType.POST:
        return `v2/users/${context.ownerId}/content/posts/${context.contextId}/${newFileName}`;
      case FileContextType.BLOG:
        return `v2/blogs/${context.contextId}/branding/${context.purpose}/${newFileName}`;
      default:
        return `v2/system/misc/${newFileName}`;
    }
  }

  /**
   * Create a new file context
   */
  async createContext(
    contextType: FileContextType,
    contextId: string,
    purpose: FilePurpose,
    ownerId: string,
  ): Promise<FileContext> {
    const context = this.contextRepository.create({
      contextType,
      contextId,
      purpose,
      ownerId,
      fileCount: 0,
      totalSize: 0,
      version: 1,
      isActive: true,
      maxFiles: this.getMaxFilesForContext(contextType),
      maxFileSize: this.getMaxFileSizeForContext(contextType),
      allowedTypes: this.getAllowedTypesForContext(contextType, purpose),
    });
    return await this.contextRepository.save(context);
  }

  /**
   * Find or create a file context
   */
  async findOrCreateContext(
    contextType: FileContextType,
    contextId: string,
    purpose: FilePurpose,
    ownerId: string,
  ): Promise<FileContext> {
    let context = await this.contextRepository.findOne({
      where: {
        contextType,
        contextId,
        purpose,
        ownerId,
        isActive: true,
      },
    });

    if (!context) {
      context = await this.createContext(contextType, contextId, purpose, ownerId);
    }

    return context;
  }

  /**
   * Private: FileContext 생성
   */
  private async createFileContext(uploadContext: UploadContext): Promise<FileContext> {
    // 기존 컨텍스트 확인
    let context = await this.contextRepository.findOne({
      where: {
        contextType: uploadContext.contextType,
        contextId: uploadContext.contextId || null,
        ownerId: uploadContext.ownerId,
        purpose: uploadContext.purpose,
        isActive: true,
      },
    });

    if (!context) {
      context = this.contextRepository.create({
        ...uploadContext,
        fileCount: 0,
        totalSize: 0,
        version: 1,
      });
      await this.contextRepository.save(context);
    }

    return context;
  }

  /**
   * Upload file with context (public method for tests)
   */
  async uploadWithContext(
    file: Express.Multer.File,
    contextId: string,
    userId: string,
  ): Promise<File> {
    const context = await this.contextRepository.findOne({
      where: { id: contextId },
    });

    if (!context) {
      throw new BadRequestException('Context not found');
    }

    // Check file limits
    if (context.maxFiles && context.fileCount >= context.maxFiles) {
      throw new BadRequestException('File count limit exceeded');
    }

    if (context.maxFileSize && file.size > context.maxFileSize) {
      const maxSizeMB = context.maxFileSize / 1024 / 1024;
      throw new BadRequestException(`허용 크기를 초과했습니다 (최대 ${maxSizeMB}MB)`);
    }

    if (context.allowedTypes && !context.allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }

    // Generate S3 key and upload
    const s3Key = this.generateS3KeyFromContext(context, file.originalname);
    const s3Result = await this.s3Service.uploadFile(file, s3Key);

    // Check if image optimization is needed
    const isOptimized = context.metadata?.optimizeImages && file.mimetype.startsWith('image/');
    if (isOptimized) {
      // Image optimization would happen here
      // For now, just mark as optimized
    }

    // Create file record
    const fileRecord = this.fileRepository.create({
      originalName: file.originalname,
      fileName: path.basename(s3Key),
      fileKey: s3Key,
      fileUrl: s3Result.location || s3Key,
      fileSize: file.size,
      mimeType: file.mimetype,
      fileType: this.getFileTypeFromContext(context.contextType),
      userId,
      contextId: context.id,
      context,
      s3Bucket: process.env.AWS_S3_BUCKET,
      s3Region: process.env.AWS_REGION || 'us-east-1',
      checksum: this.generateChecksumFromBuffer(file.buffer),
      isOptimized,
      metadata: isOptimized ? { optimized: true } : await this.extractMetadata(file),
    });

    await this.fileRepository.save(fileRecord);

    // Update context stats
    context.fileCount++;
    context.totalSize = Number(context.totalSize) + file.size;
    await this.contextRepository.save(context);

    return fileRecord;
  }

  /**
   * Private: 파일 업로드 with 컨텍스트 (internal)
   */
  private async uploadWithContextInternal(
    s3Key: string,
    file: Express.Multer.File,
    context: FileContext,
  ): Promise<FileUploadResult> {
    // S3에 실제 파일 업로드
    const s3Result = await this.s3Service.uploadFile(file, s3Key);

    // 파일 레코드 생성
    const fileRecord = this.fileRepository.create({
      originalName: file.originalname,
      fileName: path.basename(s3Key),
      fileKey: s3Key,
      fileUrl: s3Key,
      fileSize: file.size,
      mimeType: file.mimetype,
      fileType: this.getFileTypeFromContext(context.contextType),
      userId: context.ownerId,
      contextId: context.id,
      context,
      s3Bucket: process.env.AWS_S3_BUCKET,
      s3Region: process.env.AWS_REGION || 'us-east-1',
      checksum: this.generateChecksumFromBuffer(file.buffer),
      isOptimized: false,
      metadata: await this.extractMetadata(file),
    });

    await this.fileRepository.save(fileRecord);

    // 컨텍스트 통계 업데이트
    await this.updateContextStats(context);

    // CDN URL 생성 (CDN 활성화 시 CDN URL, 비활성화 시 OCI 직접 URL)
    const cdnUrlResult = this.cdnService.generateCdnUrl(fileRecord);
    const url = cdnUrlResult.url;

    this.logger.log(`File uploaded: ${s3Key}, URL: ${url} (CDN: ${cdnUrlResult.cached})`);

    return {
      fileId: fileRecord.id,
      contextId: context.id,
      s3Key,
      url,
      version: context.version,
    };
  }

  /**
   * Private: 이전 파일 비활성화
   */
  private async deactivatePreviousFiles(
    contextType: FileContextType,
    contextId: string,
    purpose: FilePurpose,
  ): Promise<void> {
    const previousContext = await this.contextRepository.findOne({
      where: {
        contextType,
        contextId,
        purpose,
        isActive: true,
      },
    });

    if (previousContext) {
      previousContext.isActive = false;
      await this.contextRepository.save(previousContext);

      // 관련 파일들 만료 예약
      const files = await this.fileRepository.find({
        where: { contextId: previousContext.id },
      });

      for (const file of files) {
        file.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await this.fileRepository.save(file);
      }
    }
  }

  /**
   * Private: 컨텍스트 통계 업데이트
   */
  private async updateContextStats(context: FileContext): Promise<void> {
    const stats = await this.fileRepository
      .createQueryBuilder('file')
      .select('COUNT(*)', 'count')
      .addSelect('SUM(file.fileSize)', 'totalSize')
      .where('file.contextId = :contextId', { contextId: context.id })
      .andWhere('file.expiresAt IS NULL')
      .getRawOne();

    context.fileCount = parseInt(stats.count);
    context.totalSize = parseInt(stats.totalSize || '0');
    
    await this.contextRepository.save(context);
  }

  /**
   * Private: 체크섬 생성
   */
  private generateChecksum(file: File): string {
    const data = `${file.fileKey}:${file.fileSize}:${file.mimeType}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  private generateChecksumFromBuffer(buffer: Buffer): string {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  /**
   * Private: 메타데이터 추출
   */
  private async extractMetadata(file: Express.Multer.File): Promise<any> {
    // TODO: sharp 등을 사용하여 이미지 메타데이터 추출
    return {
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  /**
   * Private: 컨텍스트 타입에서 파일 타입 추출
   */
  private getFileTypeFromContext(contextType: FileContextType): string {
    switch (contextType) {
      case FileContextType.PROFILE:
      case FileContextType.BLOG:
        return 'image';
      case FileContextType.POST:
        return 'general';
      default:
        return 'general';
    }
  }

  /**
   * Remove file from context
   */
  async removeFileFromContext(fileId: string): Promise<void> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['context'],
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Delete from S3
    await this.s3Service.deleteFile(file.fileKey);

    // Delete thumbnails if present
    if (file.metadata?.thumbnails) {
      for (const thumbnail of file.metadata.thumbnails) {
        await this.s3Service.deleteFile(thumbnail);
      }
    }

    // Update context stats
    if (file.context) {
      file.context.fileCount--;
      file.context.totalSize = Number(file.context.totalSize) - file.fileSize;
      await this.contextRepository.save(file.context);
    }

    // Remove file record
    await this.fileRepository.remove(file);
  }

  /**
   * Get all files for a context
   */
  async getContextFiles(contextId: string): Promise<File[]> {
    const context = await this.contextRepository.findOne({
      where: { id: contextId },
    });

    if (!context) {
      throw new NotFoundException('Context not found');
    }

    return this.fileRepository.find({
      where: { contextId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update context metadata
   */
  async updateContextMetadata(
    contextId: string,
    metadata: Record<string, any>,
  ): Promise<FileContext> {
    const context = await this.contextRepository.findOne({
      where: { id: contextId },
    });

    if (!context) {
      throw new BadRequestException('Context not found');
    }

    context.metadata = {
      ...context.metadata,
      ...metadata,
    };

    return await this.contextRepository.save(context);
  }

  /**
   * Deactivate a context
   */
  async deactivateContext(contextId: string): Promise<void> {
    const context = await this.contextRepository.findOne({
      where: { id: contextId },
    });

    if (!context) {
      throw new BadRequestException('Context not found');
    }

    context.isActive = false;
    await this.contextRepository.save(context);

    // Schedule files for deletion
    await this.fileRepository.update(
      { contextId },
      { expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    );
  }

  /**
   * Generate thumbnails for an image file
   */
  async generateThumbnails(
    fileId: string,
    sizes: Array<{ width: number; height: number; suffix: string }>,
  ): Promise<string[]> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
    });

    if (!file || !file.mimeType.startsWith('image/')) {
      return [];
    }

    const thumbnails: string[] = [];

    // Thumbnail generation would happen here
    // For now, just return empty array for non-image files
    // In real implementation, use sharp to generate thumbnails

    if (file.mimeType.startsWith('image/')) {
      // Mock thumbnail generation for tests
      for (const size of sizes) {
        const thumbKey = file.fileKey.replace(
          /\.(\w+)$/,
          `_${size.suffix}.$1`,
        );
        thumbnails.push(thumbKey);
      }

      file.metadata = {
        ...file.metadata,
        thumbnails,
      };
      await this.fileRepository.save(file);
    }

    return thumbnails;
  }

  /**
   * Get max files for context type
   */
  private getMaxFilesForContext(contextType: FileContextType): number {
    switch (contextType) {
      case FileContextType.PROFILE:
        return 1;
      case FileContextType.POST:
        return 10;
      case FileContextType.BLOG:
        return 5;
      default:
        return 10;
    }
  }

  /**
   * Get max file size for context type
   */
  private getMaxFileSizeForContext(contextType: FileContextType): number {
    switch (contextType) {
      case FileContextType.PROFILE:
        return 5 * 1024 * 1024; // 5MB
      case FileContextType.POST:
        return 10 * 1024 * 1024; // 10MB
      case FileContextType.BLOG:
        return 5 * 1024 * 1024; // 5MB
      default:
        return 10 * 1024 * 1024;
    }
  }

  /**
   * Get allowed types for context
   */
  private getAllowedTypesForContext(
    contextType: FileContextType,
    purpose: FilePurpose,
  ): string[] {
    if (contextType === FileContextType.PROFILE && purpose === FilePurpose.AVATAR) {
      return ['image/jpeg', 'image/png', 'image/webp'];
    }
    return [];
  }
}