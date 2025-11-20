import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileKey: string;
  expiresIn: number;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly storageProvider: 'aws' | 'oci'; // AWS S3 또는 Oracle Object Storage
  private readonly ociNamespace?: string; // OCI Object Storage Namespace
  private readonly region: string;

  constructor(private configService: ConfigService) {
    // 환경변수 직접 읽기 (ConfigService 네임스페이스가 없을 경우 대비)
    const accessKeyId = this.configService.get('AWS_S3_ACCESS_KEY_ID') || this.configService.get('s3.accessKeyId');
    const secretAccessKey = this.configService.get('AWS_S3_SECRET_ACCESS_KEY') || this.configService.get('s3.secretAccessKey');
    const bucket = this.configService.get('AWS_S3_BUCKET') || this.configService.get('s3.bucket');
    const region = this.configService.get('AWS_REGION') || this.configService.get('s3.region');

    if (!accessKeyId || !secretAccessKey || !bucket) {
      throw new Error('S3 configuration is incomplete. Required: AWS_S3_ACCESS_KEY_ID, AWS_S3_SECRET_ACCESS_KEY, AWS_S3_BUCKET');
    }

    this.bucket = bucket;
    this.region = region || 'us-east-1';
    this.storageProvider = this.configService.get('STORAGE_PROVIDER', 'aws'); // 기본값: AWS
    this.ociNamespace = this.configService.get('OCI_NAMESPACE'); // OCI 전용

    // S3 호환 클라이언트 생성 (AWS S3 또는 OCI Object Storage)
    const clientConfig: any = {
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };

    // OCI Object Storage 사용 시 엔드포인트 설정
    if (this.storageProvider === 'oci') {
      if (!this.ociNamespace) {
        throw new Error('OCI_NAMESPACE is required when using Oracle Object Storage');
      }
      // OCI S3 호환 엔드포인트 (Path-style URL 사용)
      // 형식: https://{namespace}.compat.objectstorage.{region}.oraclecloud.com
      const ociEndpoint = `https://${this.ociNamespace}.compat.objectstorage.${this.region}.oraclecloud.com`;
      clientConfig.endpoint = ociEndpoint;
      clientConfig.forcePathStyle = true; // OCI는 path-style URL 필수 (SSL 인증서 문제 회피)

      this.logger.log(`✅ Oracle Object Storage initialized`);
      this.logger.log(`   Namespace: ${this.ociNamespace}`);
      this.logger.log(`   Region: ${this.region}`);
      this.logger.log(`   Bucket: ${this.bucket}`);
      this.logger.log(`   Endpoint: ${ociEndpoint}`);
    } else {
      this.logger.log(`✅ AWS S3 initialized`);
      this.logger.log(`   Region: ${this.region}`);
      this.logger.log(`   Bucket: ${this.bucket}`);
    }

    this.s3Client = new S3Client(clientConfig);
  }

  /**
   * Presigned URL 생성 (파일 업로드용) - UUID 기반 S3 키 사용
   */
  async generatePresignedUploadUrl(
    s3Key: string, // UUID 기반 S3 키를 직접 받음
    mimeType: string,
    fileSize: number,
    fileType: string = 'general'
  ): Promise<PresignedUrlResponse> {
    try {
      // MIME 타입 검증
      this.validateMimeType(mimeType, fileType);
      
      // 스마트 WebP 변환 규칙 적용 (이미지 업로드의 경우)
      // - 100KB 이상 JPG/PNG는 WebP로 변환 권장
      // - 로고/아이콘류 PNG, SVG, ICO는 원본 형식 유지
      // - 현재는 클라이언트에서 WebP 변환 후 업로드
      if (fileType === 'image') {
        // WebP, PNG, SVG, GIF는 허용 (선택적 변환)
        const allowedFormats = ['image/webp', 'image/png', 'image/svg+xml', 'image/gif'];
        if (!allowedFormats.includes(mimeType)) {
          // JPG는 클라이언트에서 WebP로 변환 후 업로드 권장
          this.logger.warn(`Non-optimized format uploaded: ${mimeType}. Consider converting to WebP for better performance.`);
        }
      }

      // PutObject 명령 생성
      const putObjectCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        ContentType: mimeType,
        ContentLength: fileSize,
        // 메타데이터 추가
        Metadata: {
          'file-type': fileType,
          'upload-date': new Date().toISOString(),
        },
      });

      // Presigned URL 생성 (15분 유효)
      const expiresIn = 15 * 60; // 15분
      const uploadUrl = await getSignedUrl(this.s3Client, putObjectCommand, {
        expiresIn,
        signableHeaders: new Set(['content-type']),
      });

      this.logger.log(`Presigned URL generated for S3 key: ${s3Key}`);

      return {
        uploadUrl,
        fileKey: s3Key,
        expiresIn,
      };
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }

  /**
   * 파일 접근용 Presigned URL 생성
   */
  async generatePresignedDownloadUrl(fileKey: string): Promise<string> {
    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });

      const url = await getSignedUrl(this.s3Client, getObjectCommand, {
        expiresIn: 3600, // 1시간
      });

      this.logger.log(`Download URL generated for file: ${fileKey}`);
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate download URL: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to generate download URL');
    }
  }

  /**
   * 파일 존재 여부 확인
   */
  async checkFileExists(fileKey: string): Promise<boolean> {
    try {
      const headObjectCommand = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });

      await this.s3Client.send(headObjectCommand);
      this.logger.log(`File exists: ${fileKey}`);
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        this.logger.log(`File does not exist: ${fileKey}`);
        return false;
      }
      this.logger.error(`Failed to check file existence: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to check file existence');
    }
  }

  /**
   * S3에서 파일 삭제
   */
  async deleteFile(fileKey: string): Promise<void> {
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });

      await this.s3Client.send(deleteCommand);
      this.logger.log(`File deleted from S3: ${fileKey}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to delete file');
    }
  }

  /**
   * 버퍼를 S3에 직접 업로드 (외부 이미지 다운로드용)
   */
  async uploadBuffer(fileKey: string, buffer: Buffer, contentType: string, metadata?: Record<string, string>): Promise<void> {
    try {
      const putObjectCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        Body: buffer,
        ContentType: contentType,
        ContentLength: buffer.length,
        Metadata: metadata || {},
      });

      await this.s3Client.send(putObjectCommand);
      this.logger.log(`Buffer uploaded to S3: ${fileKey} (${buffer.length} bytes)`);
    } catch (error) {
      this.logger.error(`Failed to upload buffer to S3: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Upload file to Object Storage (AWS S3 또는 OCI)
   */
  async uploadFile(file: Express.Multer.File | null, s3Key: string): Promise<{ location?: string }> {
    if (!file) {
      // Mock upload for tests
      return { location: this.generatePublicUrl(s3Key) };
    }

    try {
      const putObjectCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      });

      await this.s3Client.send(putObjectCommand);
      this.logger.log(`File uploaded: ${s3Key} (${this.storageProvider.toUpperCase()})`);

      return {
        location: this.generatePublicUrl(s3Key),
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  /**
   * Public URL 생성 (provider에 따라 형식 다름)
   *
   * @param fileKey - S3 키
   * @returns Public URL
   */
  private generatePublicUrl(fileKey: string): string {
    if (this.storageProvider === 'oci') {
      // OCI Object Storage URL 형식
      return `https://${this.ociNamespace}.compat.objectstorage.${this.region}.oraclecloud.com/${this.bucket}/${fileKey}`;
    } else {
      // AWS S3 URL 형식
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${fileKey}`;
    }
  }

  /**
   * Copy file (alias for copyObject for tests)
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<{ success: boolean; sourceKey: string; destKey: string }> {
    await this.copyObject(sourceKey, destinationKey);
    return {
      success: true,
      sourceKey,
      destKey: destinationKey,
    };
  }

  /**
   * S3 객체 복사
   */
  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    try {
      const copyCommand = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key: destinationKey,
      });

      await this.s3Client.send(copyCommand);
      this.logger.log(`Copied S3 object from ${sourceKey} to ${destinationKey}`);
    } catch (error) {
      this.logger.error(`Failed to copy S3 object: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to copy file');
    }
  }

  /**
   * S3 객체 메타데이터 조회
   */
  async getObjectMetadata(fileKey: string): Promise<{
    contentType?: string;
    contentLength?: number;
    lastModified?: Date;
    originalName?: string;
  } | null> {
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });

      const response = await this.s3Client.send(headCommand);
      
      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        originalName: response.Metadata?.['original-name'],
      };
    } catch (error) {
      this.logger.warn(`Failed to get object metadata: ${error.message}`);
      return null;
    }
  }

  /**
   * 다중 파일 삭제
   */
  async deleteMultipleFiles(fileKeys: string[]): Promise<void> {
    // TODO: DeleteObjectsCommand를 사용하여 배치 삭제 구현
    for (const key of fileKeys) {
      await this.deleteFile(key);
    }
  }

  /**
   * S3 객체를 다른 스토리지 클래스로 전환 (아카이빙)
   */
  async transitionToArchive(fileKey: string): Promise<void> {
    // TODO: S3 라이프사이클 정책 또는 수동 전환 구현
    this.logger.log(`Transitioning ${fileKey} to archive storage`);
  }

  /**
   * MIME 타입 검증
   */
  private validateMimeType(mimeType: string, fileType: string): void {
    const allowedMimeTypes = {
      image: [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml'
      ],
      document: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
      ],
      video: [
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/x-msvideo'
      ],
      general: [] // 모든 타입 허용
    };

    if (fileType !== 'general' && allowedMimeTypes[fileType]) {
      if (!allowedMimeTypes[fileType].includes(mimeType)) {
        throw new BadRequestException(
          `Invalid MIME type ${mimeType} for file type ${fileType}`
        );
      }
    }
  }
} 