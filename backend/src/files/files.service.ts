import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import * as crypto from "crypto";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { File } from "./entities/file.entity";
import {
  FileContext,
  FileContextType,
  FilePurpose,
} from "./entities/file-context.entity";
import { S3Service, PresignedUrlResponse } from "./services/s3.service";
import { CdnService } from "./services/cdn.service";
import { CreateUploadUrlDto } from "./dto/create-upload-url.dto";
import { UploadCompleteDto } from "./dto/upload-complete.dto";
import {
  CreateBatchUploadUrlDto,
  BatchUploadCompleteDto,
} from "./dto/batch-upload.dto";
import { UpdateImageOrderDto } from "./dto/update-image-order.dto";
import {
  generateUuidFileName,
  generateS3Key,
  isImageMimeType,
  validateMimeType,
  formatFileSize,
  SAFE_IMAGE_MIME_TYPES,
  validateImageBuffer,
} from "../common/utils/file.utils";

type UploadIntentPayload = {
  kind: "single";
  userId: string;
  organizationId?: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileType: string;
  exp: number;
};

type BatchUploadIntentPayload = {
  kind: "batch";
  userId: string;
  organizationId?: string;
  uploads: Array<
    Pick<
      UploadIntentPayload,
      "fileKey" | "fileName" | "mimeType" | "fileSize" | "fileType"
    >
  >;
  context?: string;
  exp: number;
};

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  private readonly uploadIntentTtlSeconds = 15 * 60;
  private readonly temporaryFileTtlMs = 24 * 60 * 60 * 1000;

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
  private async createTemporaryContext(
    userId: string,
    organizationId?: string,
  ): Promise<FileContext> {
    const context = this.contextRepository.create({
      contextType: FileContextType.SYSTEM,
      contextId: null, // UUID 타입이므로 임시 context는 null 사용
      purpose: FilePurpose.CONTENT, // 기존 enum 사용
      ownerId: userId,
      organizationId,
      isActive: true,
    });
    return await this.contextRepository.save(context);
  }

  private getUploadIntentSecret(): string {
    const secret =
      this.configService.get<string>("UPLOAD_INTENT_SECRET") ||
      this.configService.get<string>("JWT_SECRET");

    if (!secret || secret.length < 32) {
      throw new Error(
        "UPLOAD_INTENT_SECRET or JWT_SECRET must be at least 32 characters",
      );
    }

    return secret;
  }

  private createSignedUploadIntent(payload: Record<string, unknown>): string {
    const encodedPayload = Buffer.from(
      JSON.stringify({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + this.uploadIntentTtlSeconds,
      }),
    ).toString("base64url");
    const signature = crypto
      .createHmac("sha256", this.getUploadIntentSecret())
      .update(encodedPayload)
      .digest("base64url");

    return `${encodedPayload}.${signature}`;
  }

  private createUploadIntent(payload: {
    userId: string;
    organizationId?: string;
    fileKey: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    fileType: string;
  }): string {
    return this.createSignedUploadIntent({ kind: "single", ...payload });
  }

  private verifySignedUploadIntent<T extends { exp: number }>(
    token: string,
  ): T {
    if (typeof token !== "string" || token.length > 2048) {
      throw new BadRequestException("Invalid upload intent");
    }

    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature || token.split(".").length !== 2) {
      throw new BadRequestException("Invalid upload intent");
    }

    const expectedSignature = crypto
      .createHmac("sha256", this.getUploadIntentSecret())
      .update(encodedPayload)
      .digest("base64url");
    const receivedSignature = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);

    if (
      receivedSignature.length !== expectedSignatureBuffer.length ||
      !crypto.timingSafeEqual(receivedSignature, expectedSignatureBuffer)
    ) {
      throw new BadRequestException("Invalid upload intent");
    }

    let payload: T;
    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString("utf8"),
      );
    } catch {
      throw new BadRequestException("Invalid upload intent");
    }

    if (
      !payload ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new BadRequestException("Upload intent has expired");
    }

    return payload;
  }

  private verifyUploadIntent(tempId: string): UploadIntentPayload {
    const payload = this.verifySignedUploadIntent<UploadIntentPayload>(tempId);
    if (
      payload.kind !== "single" ||
      !payload.userId ||
      !payload.fileKey ||
      !payload.fileName ||
      !payload.mimeType ||
      !Number.isSafeInteger(payload.fileSize) ||
      !payload.fileType
    ) {
      throw new BadRequestException("Invalid upload intent");
    }

    return payload;
  }

  private verifyBatchUploadIntent(batchId: string): BatchUploadIntentPayload {
    const payload =
      this.verifySignedUploadIntent<BatchUploadIntentPayload>(batchId);
    if (
      payload.kind !== "batch" ||
      !payload.userId ||
      !Array.isArray(payload.uploads) ||
      payload.uploads.length === 0 ||
      payload.uploads.length > 5
    ) {
      throw new BadRequestException("Invalid batch upload intent");
    }

    return payload;
  }

  /**
   * 배치 파일 업로드용 Presigned URL 생성 (최대 5개)
   */
  async createBatchUploadUrl(
    userId: string,
    createBatchUploadUrlDto: CreateBatchUploadUrlDto,
    organizationId?: string,
  ) {
    const { files, context } = createBatchUploadUrlDto;

    try {
      const batchNonce = crypto.randomUUID();

      // 각 파일에 대해 업로드 URL 생성
      const uploads = await Promise.all(
        files.map(async (file, index) => {
          const { fileName, mimeType, fileSize, fileType = "image" } = file;

          const normalizedMimeType =
            mimeType.toLowerCase() === "image/jpg"
              ? "image/jpeg"
              : mimeType.toLowerCase();
          if (
            isImageMimeType(mimeType) &&
            !SAFE_IMAGE_MIME_TYPES.includes(normalizedMimeType as any)
          ) {
            throw new BadRequestException(
              `SVG 및 지원하지 않는 이미지 형식은 업로드할 수 없습니다: ${fileName}`,
            );
          }

          // 이미지 파일인 경우 WebP만 허용
          if (fileType === "image" && mimeType !== "image/webp") {
            throw new Error(
              `이미지 업로드는 WebP 형식만 허용됩니다: ${fileName}`,
            );
          }

          // 파일 크기 검증
          const maxFileSize = this.configService.get<number>(
            "MAX_FILE_SIZE",
            10485760,
          );
          if (fileSize > maxFileSize) {
            throw new Error(`파일 크기 초과: ${fileName}`);
          }

          // UUID 기반 파일명 생성
          const uuidFileName = generateUuidFileName(
            fileName,
            mimeType,
            fileType,
          );
          const s3Key = generateS3Key(uuidFileName, fileType);

          // S3 Presigned URL 생성
          const presignedData = await this.s3Service.generatePresignedUploadUrl(
            s3Key,
            mimeType,
            fileSize,
            fileType,
          );

          // 개별 업로드 UI에서 사용할 식별자. 완료 요청은 서명된 batchId를
          // 기준으로 다시 검증하므로 이 값만으로 파일을 확정할 수 없다.
          const tempId = `${batchNonce}_${index}`;

          return {
            ...presignedData,
            tempId,
            fileName,
            mimeType,
            fileSize,
            fileType,
            originalFileName: fileName,
            uuidFileName,
            s3Key,
          };
        }),
      );

      const batchId = this.createSignedUploadIntent({
        kind: "batch",
        userId,
        organizationId,
        context,
        uploads: uploads.map((upload, index) => ({
          fileKey: upload.fileKey,
          fileName: upload.fileName,
          mimeType: upload.mimeType,
          fileSize: files[index].fileSize,
          fileType: files[index].fileType || "image",
        })),
      });

      this.logger.log(
        `Batch upload URLs created for user ${userId}, files: ${files.length}`,
      );

      return {
        uploads,
        batchId,
        context,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create batch upload URLs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 배치 파일 업로드 완료 처리
   */
  async batchUploadComplete(
    userId: string,
    batchUploadCompleteDto: BatchUploadCompleteDto,
    organizationId?: string,
  ) {
    const { batchId, fileKeys, context } = batchUploadCompleteDto;

    try {
      const intent = this.verifyBatchUploadIntent(batchId);
      if (intent.userId !== userId) {
        throw new ForbiddenException(
          "Batch upload intent does not belong to this user",
        );
      }

      if ((intent.organizationId || null) !== (organizationId || null)) {
        throw new ForbiddenException(
          "Batch upload intent does not belong to this organization",
        );
      }

      if (context && context !== intent.context) {
        throw new BadRequestException(
          "Batch upload context does not match the issued intent",
        );
      }

      if (
        fileKeys.length !== intent.uploads.length ||
        new Set(fileKeys).size !== fileKeys.length
      ) {
        throw new BadRequestException(
          "Batch upload files do not match the issued intent",
        );
      }

      const expectedUploads = new Map(
        intent.uploads.map((upload) => [upload.fileKey, upload]),
      );

      this.logger.log(`Batch upload complete request received:`, {
        userId,
        count: fileKeys.length,
      });

      // 배치용 임시 context 하나 생성
      const tempContext = await this.createTemporaryContext(
        userId,
        organizationId,
      );

      // 각 파일에 대해 업로드 완료 처리
      const completedFiles = await Promise.all(
        fileKeys.map(async (fileKey) => {
          const expectedUpload = expectedUploads.get(fileKey);
          if (!expectedUpload || !fileKey.startsWith("uploads/")) {
            throw new BadRequestException("Invalid batch upload file");
          }

          // S3에서 파일 정보 가져오기 (메타데이터 포함)
          const fileMetadata = await this.s3Service.getObjectMetadata(fileKey);
          if (!fileMetadata) {
            throw new BadRequestException("Uploaded object was not found");
          }

          if (
            fileMetadata.contentLength !== expectedUpload.fileSize ||
            fileMetadata.contentType !== expectedUpload.mimeType
          ) {
            throw new BadRequestException(
              "Uploaded object metadata does not match the issued intent",
            );
          }

          if (isImageMimeType(expectedUpload.mimeType)) {
            await this.validateStoredImage(
              fileKey,
              fileMetadata.contentLength ?? expectedUpload.fileSize,
              fileMetadata.contentType || expectedUpload.mimeType,
            );
          }

          // 파일 정보 DB에 저장
          const file = this.fileRepository.create({
            originalName: expectedUpload.fileName,
            fileName: fileKey.split("/").pop(),
            fileKey,
            fileUrl: fileKey,
            fileSize: fileMetadata.contentLength,
            mimeType: fileMetadata.contentType,
            fileType: expectedUpload.fileType,
            userId,
            organizationId,
            contextId: tempContext.id, // 임시 context 추가
            expiresAt: new Date(Date.now() + this.temporaryFileTtlMs),
          });

          const savedFile = await this.fileRepository.save(file);

          // CDN URL 생성 (CDN 활성화 시 CDN URL, 비활성화 시 OCI 직접 URL)
          const cdnUrlResult = this.cdnService.generateCdnUrl(savedFile);
          const accessUrl = cdnUrlResult.url;

          this.logger.log(
            `Generated URL for file ${fileKey}: ${accessUrl} (CDN: ${cdnUrlResult.cached})`,
          );

          return {
            ...savedFile,
            accessUrl,
          };
        }),
      );

      this.logger.log(
        `Batch upload completed for user ${userId}, files: ${completedFiles.length}`,
      );

      return {
        files: completedFiles,
        batchId,
        context: intent.context,
      };
    } catch (error) {
      this.logger.error(
        `Failed to complete batch upload: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 이미지 순서 업데이트
   */
  async updateImageOrder(
    postId: string,
    userId: string,
    updateImageOrderDto: UpdateImageOrderDto,
    organizationId?: string,
  ) {
    const { imageOrder } = updateImageOrderDto;
    const fileIds = imageOrder.map(({ fileId }) => fileId);
    const orders = imageOrder.map(({ order }) => order);

    if (
      new Set(fileIds).size !== fileIds.length ||
      new Set(orders).size !== orders.length
    ) {
      throw new BadRequestException(
        "파일 ID와 이미지 순서는 각각 중복될 수 없습니다.",
      );
    }

    try {
      // 포스트 소유권 확인 (Post 엔티티를 직접 주입하지 않으므로 raw query 사용)
      const postOwnerCheck = await this.fileRepository.query(
        `SELECT p."authorId" AS author_id
         FROM posts p
         LEFT JOIN blogs b ON b.id = p."blogId"
         WHERE p.id = $1
           AND p."authorId" = $2
           AND ($3::uuid IS NULL OR b."organizationId" = $3)`,
        [postId, userId, organizationId || null],
      );

      if (!postOwnerCheck.length) {
        throw new ForbiddenException("포스트에 대한 권한이 없습니다.");
      }

      // 연결 검증과 순서 갱신을 각각 한 번의 쿼리로 처리한다.
      await this.fileRepository.manager.transaction(async (manager) => {
        if (fileIds.length === 0) {
          return;
        }

        const linkedFiles: Array<{ fileId: string }> = await manager.query(
          `SELECT pf."fileId" AS "fileId"
           FROM post_files pf
           JOIN files f ON f.id = pf."fileId"
           WHERE pf."postId" = $1
             AND pf."fileId" = ANY($2::uuid[])
             AND ($3::uuid IS NULL OR f."organizationId" = $3)`,
          [postId, fileIds, organizationId || null],
        );

        if (linkedFiles.length !== fileIds.length) {
          const linkedFileIds = new Set(
            linkedFiles.map(({ fileId }) => fileId),
          );
          const missingFileId = fileIds.find(
            (fileId) => !linkedFileIds.has(fileId),
          );
          throw new NotFoundException(
            `파일 ${missingFileId}가 포스트 ${postId}에 연결되어 있지 않습니다.`,
          );
        }

        await manager.query(
          `UPDATE post_files pf
           SET image_order = ordering.image_order
           FROM unnest($2::uuid[], $3::int[]) AS ordering(file_id, image_order)
           WHERE pf."postId" = $1
             AND pf."fileId" = ordering.file_id`,
          [postId, fileIds, orders],
        );
      });

      this.logger.log(
        `Image order updated for post ${postId}, images: ${imageOrder.length}`,
      );

      return {
        message: "이미지 순서가 업데이트되었습니다.",
        postId,
        updatedCount: imageOrder.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update image order: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 파일 업로드용 Presigned URL 생성 (UUID 기반)
   */
  async createUploadUrl(
    userId: string,
    createUploadUrlDto: CreateUploadUrlDto,
    organizationId?: string,
  ): Promise<
    PresignedUrlResponse & {
      tempId: string;
      uuidFileName: string;
      s3Key: string;
    }
  > {
    const { fileName, mimeType, fileSize, fileType } = createUploadUrlDto;

    try {
      const normalizedMimeType =
        mimeType.toLowerCase() === "image/jpg"
          ? "image/jpeg"
          : mimeType.toLowerCase();
      if (
        isImageMimeType(mimeType) &&
        !SAFE_IMAGE_MIME_TYPES.includes(normalizedMimeType as any)
      ) {
        throw new BadRequestException(
          normalizedMimeType === "image/svg+xml"
            ? "SVG 업로드는 보안 정책상 허용되지 않습니다. PNG, JPEG, WebP 이미지를 사용하세요."
            : "SVG 및 지원하지 않는 이미지 형식은 업로드할 수 없습니다.",
        );
      }

      // 이미지 파일인 경우 WebP만 허용
      if (fileType === "image" && mimeType !== "image/webp") {
        throw new Error("이미지 업로드는 WebP 형식만 허용됩니다.");
      }

      // 문서 파일인 경우 기존 검증 로직 적용
      if (fileType !== "image") {
        const allowedTypes = this.configService
          .get<string>(
            "SUPPORTED_IMAGE_TYPES",
            "image/jpeg,image/jpg,image/png,image/gif,image/webp",
          )
          .split(",");

        if (
          isImageMimeType(mimeType) &&
          !validateMimeType(mimeType, allowedTypes)
        ) {
          throw new Error(`Unsupported image type: ${mimeType}`);
        }
      }

      // 파일 크기 검증
      const maxFileSize = this.configService.get<number>(
        "MAX_FILE_SIZE",
        10485760,
      );
      if (fileSize > maxFileSize) {
        throw new Error(
          `File size exceeds limit: ${formatFileSize(fileSize)} > ${formatFileSize(maxFileSize)}`,
        );
      }

      // UUID 기반 파일명 생성
      const uuidFileName = generateUuidFileName(fileName, mimeType, fileType);
      const s3Key = generateS3Key(uuidFileName, fileType);

      this.logger.log(
        `Generated UUID filename: ${uuidFileName}, S3 Key: ${s3Key}`,
      );

      // S3 Presigned URL 생성 (UUID 파일명 사용)
      const presignedData = await this.s3Service.generatePresignedUploadUrl(
        s3Key,
        mimeType,
        fileSize,
        fileType,
      );

      // 업로드 완료 요청에서 key와 클라이언트 metadata를 위조하지 못하도록
      // 사용자와 발급 당시 metadata를 HMAC으로 묶은 intent를 반환한다.
      const tempId = this.createUploadIntent({
        userId,
        organizationId,
        fileKey: s3Key,
        fileName,
        mimeType,
        fileSize,
        fileType: fileType || "general",
      });

      this.logger.log(
        `Upload URL created for user ${userId}, file: ${fileName}`,
      );

      return {
        ...presignedData,
        tempId,
        uuidFileName,
        s3Key,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create upload URL: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 파일 업로드 완료 처리 (UUID 기반)
   */
  async uploadComplete(
    userId: string,
    uploadCompleteDto: UploadCompleteDto,
    organizationId?: string,
  ): Promise<File & { accessUrl: string }> {
    const { tempId, fileKey, fileUrl, fileName, mimeType, fileSize, fileType } =
      uploadCompleteDto;

    try {
      const intent = this.verifyUploadIntent(tempId);
      if (intent.userId !== userId) {
        throw new ForbiddenException(
          "Upload intent does not belong to this user",
        );
      }

      if ((intent.organizationId || null) !== (organizationId || null)) {
        throw new ForbiddenException(
          "Upload intent does not belong to this organization",
        );
      }

      if (
        intent.fileKey !== fileKey ||
        intent.fileName !== fileName ||
        intent.mimeType !== mimeType ||
        intent.fileSize !== fileSize ||
        intent.fileType !== (fileType || "general") ||
        fileUrl !== fileKey
      ) {
        throw new BadRequestException(
          "Upload metadata does not match the issued intent",
        );
      }

      if (!fileKey.startsWith("uploads/")) {
        throw new BadRequestException("Invalid S3 key format");
      }

      const existingFile = await this.fileRepository.findOne({
        where: { fileKey },
      });
      if (existingFile) {
        throw new ConflictException("Upload has already been completed");
      }

      const fileMetadata = await this.s3Service.getObjectMetadata(fileKey);
      if (!fileMetadata) {
        throw new BadRequestException("Uploaded object was not found");
      }

      if (
        fileMetadata.contentLength !== fileSize ||
        (fileMetadata.contentType && fileMetadata.contentType !== mimeType)
      ) {
        throw new BadRequestException(
          "Uploaded object metadata does not match the issued intent",
        );
      }

      if (isImageMimeType(mimeType)) {
        await this.validateStoredImage(
          fileKey,
          fileMetadata.contentLength ?? fileSize,
          fileMetadata.contentType || mimeType,
        );
      }

      // 임시 FileContext 생성
      const tempContext = await this.createTemporaryContext(
        userId,
        organizationId,
      );

      // 파일 정보 DB에 저장 - fileUrl에는 S3 키를 저장
      const file = this.fileRepository.create({
        originalName: fileName, // 원본 파일명 유지
        fileName: fileKey.split("/").pop(), // UUID 파일명
        fileKey, // S3 키 (전체 경로)
        fileUrl: fileKey, // S3 키를 저장 (일관성 유지)
        fileSize: fileMetadata.contentLength,
        mimeType: fileMetadata.contentType || mimeType,
        fileType: intent.fileType,
        userId,
        organizationId,
        contextId: tempContext.id, // 임시 context 추가
        expiresAt: new Date(Date.now() + this.temporaryFileTtlMs),
      });

      const savedFile = await this.fileRepository.save(file);

      // CDN URL 생성 (CDN 활성화 시 CDN URL, 비활성화 시 OCI 직접 URL)
      const cdnUrlResult = this.cdnService.generateCdnUrl(savedFile);
      const accessUrl = cdnUrlResult.url;

      this.logger.log(
        `File upload completed for user ${userId}, fileId: ${savedFile.id}, URL: ${accessUrl} (CDN: ${cdnUrlResult.cached})`,
      );

      return {
        ...savedFile,
        accessUrl,
      };
    } catch (error) {
      this.logger.error(
        `Failed to complete upload: ${error.message}`,
        error.stack,
      );
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
    limit: number = 20,
    organizationId?: string,
  ) {
    const queryBuilder = this.fileRepository
      .createQueryBuilder("file")
      .where("file.userId = :userId", { userId })
      .orderBy("file.createdAt", "DESC");

    if (organizationId) {
      queryBuilder.andWhere("file.organizationId = :organizationId", {
        organizationId,
      });
    }

    if (fileType) {
      queryBuilder.andWhere("file.fileType = :fileType", { fileType });
    }

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [files, total] = await queryBuilder.getManyAndCount();

    // 각 파일에 대해 접근 URL 생성
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        try {
          const accessUrl = isImageMimeType(file.mimeType)
            ? this.cdnService.generateCdnUrl(file).url
            : null;
          return { ...file, accessUrl };
        } catch (error) {
          this.logger.warn(
            `Failed to generate access URL for file ${file.id}: ${error.message}`,
          );
          return { ...file, accessUrl: null };
        }
      }),
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
  async getFileById(
    fileId: string,
    userId?: string,
    organizationId?: string,
  ): Promise<File> {
    const file = await this.fileRepository.findOne({
      where: {
        id: fileId,
        ...(organizationId ? { organizationId } : {}),
      },
      relations: ["user"],
    });

    if (!file) {
      throw new NotFoundException("File not found");
    }

    // 소유자 확인 (필요한 경우)
    if (userId && file.userId !== userId) {
      throw new ForbiddenException("Access denied to this file");
    }

    return file;
  }

  /**
   * 파일 삭제
   */
  async deleteFile(
    fileId: string,
    userId: string,
    organizationId?: string,
  ): Promise<void> {
    const file = await this.getFileById(fileId, userId, organizationId);

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
  async getDownloadUrl(
    fileId: string,
    userId?: string,
    organizationId?: string,
  ): Promise<string> {
    const file = await this.getFileById(fileId, userId, organizationId);

    try {
      // 이미지는 안정적인 프록시/CDN URL을 사용해 저장소 호스트와
      // 만료되는 presigned URL을 클라이언트에 노출하지 않는다.
      if (isImageMimeType(file.mimeType)) {
        return this.cdnService.generateCdnUrl(file).url;
      } else {
        return await this.s3Service.generatePresignedDownloadUrl(file.fileKey);
      }
    } catch (error) {
      this.logger.error(
        `Failed to generate download URL: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 파일 다운로드 URL 생성 (Public)
   */
  async getPublicDownloadUrl(fileId: string): Promise<string> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException("File not found");
    }

    // S3 키가 저장되어 있다면 사용
    const s3Key = file.fileKey || file.fileUrl;

    if (!s3Key || (!s3Key.startsWith("uploads/") && !s3Key.startsWith("v2/"))) {
      throw new BadRequestException("Invalid file reference");
    }

    // CDN URL 생성 (CDN 활성화 시 CDN URL, 비활성화 시 S3 Presigned URL)
    const cdnUrlResult = this.cdnService.generateCdnUrl(file);
    return cdnUrlResult.url;
  }

  /**
   * 파일 통계 조회
   */
  async getFileStats(userId: string, organizationId?: string) {
    const statsQuery = this.fileRepository
      .createQueryBuilder("file")
      .select("file.fileType", "fileType")
      .addSelect("COUNT(*)", "count")
      .addSelect("SUM(file.fileSize)", "totalSize")
      .where("file.userId = :userId", { userId });

    if (organizationId) {
      statsQuery.andWhere("file.organizationId = :organizationId", {
        organizationId,
      });
    }

    const stats = await statsQuery.groupBy("file.fileType").getRawMany();

    const totalFiles = await this.fileRepository.count({
      where: { userId, ...(organizationId ? { organizationId } : {}) },
    });
    const totalSizeQuery = this.fileRepository
      .createQueryBuilder("file")
      .select("SUM(file.fileSize)", "total")
      .where("file.userId = :userId", { userId });

    if (organizationId) {
      totalSizeQuery.andWhere("file.organizationId = :organizationId", {
        organizationId,
      });
    }

    const totalSize = await totalSizeQuery.getRawOne();

    return {
      totalFiles,
      totalSize: parseInt(totalSize?.total || "0"),
      byType: stats.map((stat) => ({
        fileType: stat.fileType,
        count: parseInt(stat.count),
        totalSize: parseInt(stat.totalSize || "0"),
      })),
    };
  }

  private async validateStoredImage(
    fileKey: string,
    size: number,
    mimeType: string,
  ): Promise<void> {
    const sample = await this.s3Service.getObjectSample(fileKey);
    const validation = validateImageBuffer(
      { size, mimetype: mimeType, buffer: sample ?? undefined },
      this.configService.get<number>("MAX_FILE_SIZE", 10 * 1024 * 1024),
      SAFE_IMAGE_MIME_TYPES,
    );
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }
  }

  /**
   * 파일 존재 여부 확인 (S3 키 기반)
   */
  async checkFileExists(s3Key: string): Promise<boolean> {
    try {
      return await this.s3Service.checkFileExists(s3Key);
    } catch (error) {
      this.logger.error(
        `Failed to check file existence: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
