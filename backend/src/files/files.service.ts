import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { File } from './entities/file.entity';
import { S3Service, PresignedUrlResponse } from './services/s3.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { UploadCompleteDto } from './dto/upload-complete.dto';
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
    private s3Service: S3Service,
    private configService: ConfigService,
  ) {}

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

      // 이미지 파일인 경우 Presigned URL 생성 (1시간 유효)
      const accessUrl = await this.s3Service.generatePresignedDownloadUrl(fileKey);
      
      this.logger.log(`Generated access URL for S3 key: ${fileKey}`);

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
      });

      const savedFile = await this.fileRepository.save(file);

      this.logger.log(`File upload completed for user ${userId}, fileId: ${savedFile.id}, S3 key: ${fileKey}`);
      
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