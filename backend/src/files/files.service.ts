import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { File } from './entities/file.entity';
import { FileContext, FileContextType, FilePurpose } from './entities/file-context.entity';
import { S3Service, PresignedUrlResponse } from './services/s3.service';
import { CdnService } from './services/cdn.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { UploadCompleteDto } from './dto/upload-complete.dto';
import { CreateBatchUploadUrlDto, BatchUploadCompleteDto } from './dto/batch-upload.dto';
import { UpdateImageOrderDto } from './dto/update-image-order.dto';
import {
  generateUuidFileName,
  generateS3Key,
  isImageMimeType,
  validateMimeType,
  formatFileSize
} from '../common/utils/file.utils';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectRepository(File)
    private fileRepository: Repository<File>,
    @InjectRepository(FileContext)
    private contextRepository: Repository<FileContext>,
    private s3Service: S3Service,
    private cdnService: CdnService,
    private configService: ConfigService,
  ) {}

  /**
   * 임시 FileContext 생성
   * 파일 업로드 시 사용되는 임시 컨텍스트
   * 나중에 포스트 저장 시 정식 컨텍스트로 전환됨
   */
  private async createTemporaryContext(userId: string): Promise<FileContext> {
    const context = this.contextRepository.create({
      contextType: FileContextType.SYSTEM,
      contextId: null, // UUID 타입이므로 임시 context는 null 사용
      purpose: FilePurpose.CONTENT, // 기존 enum 사용
      ownerId: userId,
      isActive: true,
    });
    return await this.contextRepository.save(context);
  }

  /**
   * 배치 파일 업로드용 Presigned URL 생성 (최대 5개)
   */
  async createBatchUploadUrl(
    userId: string,
    createBatchUploadUrlDto: CreateBatchUploadUrlDto
  ) {
    const { files, context } = createBatchUploadUrlDto;

    try {
      // 배치 ID 생성
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 각 파일에 대해 업로드 URL 생성
      const uploads = await Promise.all(
        files.map(async (file, index) => {
          const { fileName, mimeType, fileSize, fileType = 'image' } = file;

          // 이미지 파일인 경우 WebP만 허용
          if (fileType === 'image' && mimeType !== 'image/webp') {
            throw new Error(`이미지 업로드는 WebP 형식만 허용됩니다: ${fileName}`);
          }

          // 파일 크기 검증
          const maxFileSize = this.configService.get<number>('MAX_FILE_SIZE', 10485760);
          if (fileSize > maxFileSize) {
            throw new Error(`파일 크기 초과: ${fileName}`);
          }

          // UUID 기반 파일명 생성
          const uuidFileName = generateUuidFileName(fileName, mimeType, fileType);
          const s3Key = generateS3Key(uuidFileName, fileType);

          // S3 Presigned URL 생성
          const presignedData = await this.s3Service.generatePresignedUploadUrl(
            s3Key,
            mimeType,
            fileSize,
            fileType
          );

          // 임시 ID 생성 (배치 ID + 인덱스)
          const tempId = `${batchId}_${index}`;

          return {
            ...presignedData,
            tempId,
            fileName,
            originalFileName: fileName,
            uuidFileName,
            s3Key,
          };
        })
      );

      this.logger.log(`Batch upload URLs created for user ${userId}, batch: ${batchId}, files: ${files.length}`);

      return {
        uploads,
        batchId,
        context,
      };
    } catch (error) {
      this.logger.error(`Failed to create batch upload URLs: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 배치 파일 업로드 완료 처리
   */
  async batchUploadComplete(
    userId: string,
    batchUploadCompleteDto: BatchUploadCompleteDto
  ) {
    const { fileKeys, context } = batchUploadCompleteDto;

    try {
      this.logger.log(`Batch upload complete request received:`, {
        userId,
        fileKeys,
        context,
        count: fileKeys.length
      });

      // 배치용 임시 context 하나 생성
      const tempContext = await this.createTemporaryContext(userId);

      // 각 파일에 대해 업로드 완료 처리
      const completedFiles = await Promise.all(
        fileKeys.map(async (fileKey, index) => {
          // S3 키 검증
          if (!fileKey || !fileKey.includes('uploads/')) {
            throw new Error(`Invalid S3 key format: ${fileKey}`);
          }

          // S3에서 파일 정보 가져오기 (메타데이터 포함)
          const fileMetadata = await this.s3Service.getObjectMetadata(fileKey);
          if (!fileMetadata) {
            throw new Error(`File metadata not found: ${fileKey}`);
          }

          // 파일 정보 DB에 저장
          const file = this.fileRepository.create({
            originalName: fileMetadata.originalName || fileKey.split('/').pop(),
            fileName: fileKey.split('/').pop(),
            fileKey,
            fileUrl: fileKey,
            fileSize: fileMetadata.contentLength || 0,
            mimeType: fileMetadata.contentType || 'image/webp',
            fileType: 'image',
            userId,
            contextId: tempContext.id, // 임시 context 추가
          });

          const savedFile = await this.fileRepository.save(file);

          // CDN URL 생성 (CDN 활성화 시 CDN URL, 비활성화 시 OCI 직접 URL)
          const cdnUrlResult = this.cdnService.generateCdnUrl(savedFile);
          const accessUrl = cdnUrlResult.url;

          this.logger.log(`Generated URL for file ${fileKey}: ${accessUrl} (CDN: ${cdnUrlResult.cached})`);

          return {
            ...savedFile,
            accessUrl,
          };
        })
      );

      this.logger.log(`Batch upload completed for user ${userId}, files: ${completedFiles.length}`);
      
      return {
        files: completedFiles,
        batchId: `batch_${Date.now()}`,
        context,
      };
    } catch (error) {
      this.logger.error(`Failed to complete batch upload: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 이미지 순서 업데이트
   */
  async updateImageOrder(
    postId: string,
    userId: string,
    updateImageOrderDto: UpdateImageOrderDto
  ) {
    const { imageOrder } = updateImageOrderDto;

    try {
      // 포스트 소유권 확인 (Post 엔티티를 직접 주입하지 않으므로 raw query 사용)
      const postOwnerCheck = await this.fileRepository.query(
        'SELECT author_id FROM posts WHERE id = $1',
        [postId]
      );
      
      if (!postOwnerCheck.length || postOwnerCheck[0].author_id !== userId) {
        throw new ForbiddenException('포스트에 대한 권한이 없습니다.');
      }

      // 트랜잭션으로 순서 업데이트
      await this.fileRepository.manager.transaction(async (manager) => {
        for (const orderInfo of imageOrder) {
          const { fileId, order } = orderInfo;
          
          // 파일이 해당 포스트에 연결되어 있는지 확인
          const fileExists = await manager.query(
            'SELECT 1 FROM post_files WHERE "postId" = $1 AND "fileId" = $2',
            [postId, fileId]
          );
          
          if (!fileExists.length) {
            throw new NotFoundException(`파일 ${fileId}가 포스트 ${postId}에 연결되어 있지 않습니다.`);
          }

          // 순서 업데이트
          await manager.query(
            'UPDATE post_files SET image_order = $1 WHERE "postId" = $2 AND "fileId" = $3',
            [order, postId, fileId]
          );
        }
      });

      this.logger.log(`Image order updated for post ${postId}, images: ${imageOrder.length}`);
      
      return {
        message: '이미지 순서가 업데이트되었습니다.',
        postId,
        updatedCount: imageOrder.length,
      };
    } catch (error) {
      this.logger.error(`Failed to update image order: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 파일 업로드용 Presigned URL 생성 (UUID 기반)
   */
  async createUploadUrl(
    userId: string, 
    createUploadUrlDto: CreateUploadUrlDto
  ): Promise<PresignedUrlResponse & { tempId: string; uuidFileName: string; s3Key: string }> {
    const { fileName, mimeType, fileSize, fileType } = createUploadUrlDto;

    try {
      // 이미지 파일인 경우 WebP만 허용
      if (fileType === 'image' && mimeType !== 'image/webp') {
        throw new Error('이미지 업로드는 WebP 형식만 허용됩니다.');
      }

      // 문서 파일인 경우 기존 검증 로직 적용
      if (fileType !== 'image') {
        const allowedTypes = this.configService.get<string>('SUPPORTED_IMAGE_TYPES', 
          'image/jpeg,image/jpg,image/png,image/gif,image/webp').split(',');
        
        if (isImageMimeType(mimeType) && !validateMimeType(mimeType, allowedTypes)) {
          throw new Error(`Unsupported image type: ${mimeType}`);
        }
      }

      // 파일 크기 검증
      const maxFileSize = this.configService.get<number>('MAX_FILE_SIZE', 10485760);
      if (fileSize > maxFileSize) {
        throw new Error(`File size exceeds limit: ${formatFileSize(fileSize)} > ${formatFileSize(maxFileSize)}`);
      }

      // UUID 기반 파일명 생성
      const uuidFileName = generateUuidFileName(fileName, mimeType, fileType);
      const s3Key = generateS3Key(uuidFileName, fileType);

      this.logger.log(`Generated UUID filename: ${uuidFileName}, S3 Key: ${s3Key}`);

      // S3 Presigned URL 생성 (UUID 파일명 사용)
      const presignedData = await this.s3Service.generatePresignedUploadUrl(
        s3Key,
        mimeType,
        fileSize,
        fileType
      );

      // 임시 ID 생성 (업로드 완료 시 연결용)
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.logger.log(`Upload URL created for user ${userId}, file: ${fileName}`);

      return {
        ...presignedData,
        tempId,
        uuidFileName,
        s3Key,
      };
    } catch (error) {
      this.logger.error(`Failed to create upload URL: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 파일 업로드 완료 처리 (UUID 기반)
   */
  async uploadComplete(
    userId: string,
    uploadCompleteDto: UploadCompleteDto
  ): Promise<File & { accessUrl: string }> {
    const { fileKey, fileUrl, fileName, mimeType, fileSize, fileType } = uploadCompleteDto;

    try {
      this.logger.log(`Upload complete request received:`, {
        userId,
        fileKey,
        fileUrl,
        fileName,
        mimeType,
        fileSize,
        fileType
      });

      // S3 키 검증 (UUID 형식인지 확인)
      if (!fileKey || !fileKey.includes('uploads/')) {
        throw new Error('Invalid S3 key format');
      }

      // 임시 FileContext 생성
      const tempContext = await this.createTemporaryContext(userId);

      // 파일 정보 DB에 저장 - fileUrl에는 S3 키를 저장
      const file = this.fileRepository.create({
        originalName: fileName, // 원본 파일명 유지
        fileName: fileKey.split('/').pop(), // UUID 파일명
        fileKey, // S3 키 (전체 경로)
        fileUrl: fileKey, // S3 키를 저장 (일관성 유지)
        fileSize,
        mimeType,
        fileType: fileType || 'general',
        userId,
        contextId: tempContext.id, // 임시 context 추가
      });

      const savedFile = await this.fileRepository.save(file);

      // CDN URL 생성 (CDN 활성화 시 CDN URL, 비활성화 시 OCI 직접 URL)
      const cdnUrlResult = this.cdnService.generateCdnUrl(savedFile);
      const accessUrl = cdnUrlResult.url;

      this.logger.log(`File upload completed for user ${userId}, fileId: ${savedFile.id}, URL: ${accessUrl} (CDN: ${cdnUrlResult.cached})`);

      return {
        ...savedFile,
        accessUrl
      };
    } catch (error) {
      this.logger.error(`Failed to complete upload: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 사용자의 파일 목록 조회
   */
  async getUserFiles(
    userId: string,
    fileType?: string,
    page: number = 1,
    limit: number = 20
  ) {
    const queryBuilder = this.fileRepository
      .createQueryBuilder('file')
      .where('file.userId = :userId', { userId })
      .orderBy('file.createdAt', 'DESC');

    if (fileType) {
      queryBuilder.andWhere('file.fileType = :fileType', { fileType });
    }

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [files, total] = await queryBuilder.getManyAndCount();

    // 각 파일에 대해 접근 URL 생성
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        try {
          const accessUrl = isImageMimeType(file.mimeType) 
            ? await this.s3Service.generatePresignedDownloadUrl(file.fileKey)
            : null;
          return { ...file, accessUrl };
        } catch (error) {
          this.logger.warn(`Failed to generate access URL for file ${file.id}: ${error.message}`);
          return { ...file, accessUrl: null };
        }
      })
    );

    return {
      files: filesWithUrls,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 파일 정보 조회
   */
  async getFileById(fileId: string, userId?: string): Promise<File> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['user'],
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // 소유자 확인 (필요한 경우)
    if (userId && file.userId !== userId) {
      throw new ForbiddenException('Access denied to this file');
    }

    return file;
  }

  /**
   * 파일 삭제
   */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    const file = await this.getFileById(fileId, userId);

    try {
      // S3에서 파일 삭제
      await this.s3Service.deleteFile(file.fileKey);

      // DB에서 파일 정보 삭제
      await this.fileRepository.remove(file);

      this.logger.log(`File deleted: ${file.fileKey}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 파일 다운로드 URL 생성
   */
  async getDownloadUrl(fileId: string, userId?: string): Promise<string> {
    const file = await this.getFileById(fileId, userId);
    
    try {
      // 이미지 파일이면 Presigned URL 생성
      if (isImageMimeType(file.mimeType)) {
        return await this.s3Service.generatePresignedDownloadUrl(file.fileKey);
      } else {
        return await this.s3Service.generatePresignedDownloadUrl(file.fileKey);
      }
    } catch (error) {
      this.logger.error(`Failed to generate download URL: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 파일 다운로드 URL 생성 (Public)
   */
  async getPublicDownloadUrl(fileId: string): Promise<string> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId }
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // S3 키가 저장되어 있다면 사용
    const s3Key = file.fileKey || file.fileUrl;

    if (!s3Key || !s3Key.includes('uploads/')) {
      throw new BadRequestException('Invalid file reference');
    }

    // CDN URL 생성 (CDN 활성화 시 CDN URL, 비활성화 시 S3 Presigned URL)
    const cdnUrlResult = this.cdnService.generateCdnUrl(file);
    return cdnUrlResult.url;
  }

  /**
   * 파일 통계 조회
   */
  async getFileStats(userId: string) {
    const stats = await this.fileRepository
      .createQueryBuilder('file')
      .select('file.fileType', 'fileType')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(file.fileSize)', 'totalSize')
      .where('file.userId = :userId', { userId })
      .groupBy('file.fileType')
      .getRawMany();

    const totalFiles = await this.fileRepository.count({ where: { userId } });
    const totalSize = await this.fileRepository
      .createQueryBuilder('file')
      .select('SUM(file.fileSize)', 'total')
      .where('file.userId = :userId', { userId })
      .getRawOne();

    return {
      totalFiles,
      totalSize: parseInt(totalSize?.total || '0'),
      byType: stats.map(stat => ({
        fileType: stat.fileType,
        count: parseInt(stat.count),
        totalSize: parseInt(stat.totalSize || '0'),
      })),
    };
  }

  /**
   * 파일 존재 여부 확인 (S3 키 기반)
   */
  async checkFileExists(s3Key: string): Promise<boolean> {
    try {
      return await this.s3Service.checkFileExists(s3Key);
    } catch (error) {
      this.logger.error(`Failed to check file existence: ${error.message}`, error.stack);
      return false;
    }
  }

} 