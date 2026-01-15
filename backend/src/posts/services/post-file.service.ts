import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, EntityManager } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Post } from "../entities/post.entity";
import { File } from "../../files/entities/file.entity";
import {
  FileContext,
  FileContextType,
  FilePurpose,
} from "../../files/entities/file-context.entity";
import { FilesService } from "../../files/files.service";
import { CdnService } from "../../files/services/cdn.service";
import {
  extractImageUrlsFromContent,
  extractS3KeyFromUrl,
} from "../utils/post.utils";
import { CacheInvalidationEvents } from "../../common/events/cache.events";

/**
 * 포스트 파일 관리 서비스
 *
 * 책임:
 * - 썸네일 이미지 설정
 * - 포스트 내용에서 파일 링크
 * - 파일 용량 검증
 * - 파일 컨텍스트 관리
 */
@Injectable()
export class PostFileService {
  private readonly logger = new Logger(PostFileService.name);
  private readonly MAX_POST_TOTAL_SIZE = 30 * 1024 * 1024; // 30MB
  private readonly MAX_FILES_PER_POST = 10; // Maximum 10 files per post

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(File)
    private readonly filesRepository: Repository<File>,
    @InjectRepository(FileContext)
    private readonly fileContextRepository: Repository<FileContext>,
    private readonly filesService: FilesService,
    private readonly cdnService: CdnService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 게시글 썸네일 설정 - thumbnailImageId만 설정
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @param setThumbnailDto 썸네일 설정 DTO
   */
  async setThumbnail(
    postId: string,
    userId: string,
    setThumbnailDto: { thumbnailFileId?: string },
  ) {
    try {
      const { thumbnailFileId } = setThumbnailDto;

      // 게시글 소유권 확인
      const post = await this.postsRepository.findOne({
        where: { id: postId, authorId: userId },
      });

      if (!post) {
        throw new NotFoundException("게시글을 찾을 수 없거나 권한이 없습니다.");
      }

      let thumbnailImageId: string | null = null;

      // 썸네일 파일 ID가 제공된 경우
      if (thumbnailFileId) {
        // 파일 소유권 확인
        const thumbnailFile = await this.filesRepository.findOne({
          where: { id: thumbnailFileId, userId },
        });

        if (!thumbnailFile) {
          throw new NotFoundException(
            "썸네일 파일을 찾을 수 없거나 권한이 없습니다.",
          );
        }

        thumbnailImageId = thumbnailFileId;
      }

      // thumbnailImageId만 설정 (thumbnail 필드는 삭제됨)
      await this.postsRepository.update(postId, {
        thumbnailImageId,
      });

      // 썸네일 변경 감지 및 이벤트 발행
      if (post.thumbnailImageId !== thumbnailImageId) {
        this.eventEmitter.emit(CacheInvalidationEvents.POST_THUMBNAIL_UPDATED, {
          postId,
          blogSlug: post.blog?.slug || post.blogId,
          oldThumbnailImageId: post.thumbnailImageId,
          newThumbnailImageId: thumbnailImageId,
          authorId: userId,
        });
      }

      return { success: true, thumbnailImageId };
    } catch (error) {
      this.logger.error(`썸네일 설정 실패: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 포스트 내용에서 이미지 URL 추출 후 파일 링크
   *
   * @param post 포스트 엔티티
   * @param userId 사용자 ID (선택사항)
   * @param manager 트랜잭션 EntityManager (선택사항)
   */
  async linkFilesFromContent(
    post: Post,
    userId?: string,
    manager?: EntityManager,
  ): Promise<void> {
    const postId = post.id;

    // Repository 선택 - 트랜잭션 EntityManager가 있으면 사용
    const filesRepository = manager
      ? manager.getRepository(File)
      : this.filesRepository;

    this.logger.debug(
      `[LINK_FILES] Starting linkFilesFromContent for postId=${postId}`,
    );
    this.logger.debug(
      `[LINK_FILES] Post content preview: ${post.content ? post.content.substring(0, 200) + "..." : "No content"}`,
    );

    try {
      // 1. 이미지 URL 추출
      const imageUrls = this.extractImageUrlsFromContent(post.content);
      this.logger.log(
        `[LINK_FILES] Extracted ${imageUrls.length} image URLs from content`,
      );
      if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
          this.logger.debug(`[LINK_FILES]   URL ${index + 1}: ${url}`);
        });
      }

      if (imageUrls.length === 0) {
        this.logger.debug(
          `[LINK_FILES] No images found in content, skipping file linking`,
        );
        return;
      }

      // 2. S3 키 추출
      const s3Keys = imageUrls
        .map((url) => this.extractS3KeyFromUrl(url))
        .filter(Boolean) as string[];
      this.logger.log(
        `[LINK_FILES] Extracted ${s3Keys.length} S3 keys from URLs`,
      );
      if (s3Keys.length > 0) {
        s3Keys.forEach((key, index) => {
          this.logger.debug(`[LINK_FILES]   S3 Key ${index + 1}: ${key}`);
        });
      }

      if (s3Keys.length === 0) {
        this.logger.warn(
          `[LINK_FILES] No valid S3 keys extracted from URLs. URL format might be incompatible.`,
        );
        return;
      }

      // 3. 사용자 ID 확인
      const authorUserId = userId || post.authorId;
      this.logger.debug(
        `[LINK_FILES] Using userId=${authorUserId} for file lookup`,
      );

      // 4. DB에서 파일 검색
      this.logger.debug(
        `[LINK_FILES] Searching for files with keys: ${JSON.stringify(s3Keys)} and userId=${authorUserId}`,
      );
      const files = await filesRepository.find({
        where: { fileKey: In(s3Keys), userId: authorUserId },
      });

      this.logger.log(`[LINK_FILES] Found ${files.length} files in database`);
      if (files.length > 0) {
        files.forEach((file, index) => {
          this.logger.debug(
            `[LINK_FILES]   File ${index + 1}: id=${file.id}, fileKey=${file.fileKey}, originalName=${file.originalName}`,
          );
        });
      }

      if (files.length > 0) {
        // 5. 기존 연결된 파일 확인
        const existingFileIds = post.attachedFiles?.map((f) => f.id) || [];
        this.logger.debug(
          `[LINK_FILES] Post already has ${existingFileIds.length} attached files: ${JSON.stringify(existingFileIds)}`,
        );

        // 6. 새로운 파일 필터링
        const newFiles = files.filter((f) => !existingFileIds.includes(f.id));
        this.logger.log(`[LINK_FILES] ${newFiles.length} new files to link`);

        if (newFiles.length > 0) {
          // 7. 포스트당 파일 컨텍스트 하나만 생성
          const fileContextRepository = manager
            ? manager.getRepository(FileContext)
            : this.fileContextRepository;

          // 이미 컨텍스트가 있는지 확인
          const existingContext = await fileContextRepository.findOne({
            where: {
              contextId: postId,
              contextType: FileContextType.POST,
            },
          });

          if (!existingContext) {
            // 포스트당 FileContext 하나만 생성
            const newContext = fileContextRepository.create({
              contextId: postId,
              contextType: FileContextType.POST,
              purpose: FilePurpose.CONTENT,
              ownerId: authorUserId,
              version: 1,
              isActive: true,
              fileCount: newFiles.length,
              totalSize: newFiles.reduce(
                (sum, file) => sum + (file.fileSize || 0),
                0,
              ),
            });

            await fileContextRepository.save(newContext);
            this.logger.log(
              `[LINK_FILES] Created single FileContext for postId=${postId} with ${newFiles.length} files`,
            );
          }

          // 8. 포스트에 파일 연결 (성능 최적화된 방식으로 구현)
          // 🔥 [FIX] Batch insertion using QueryBuilder for better performance
          await this.linkFilesToPostOptimized(postId, newFiles, manager);
          this.logger.log(
            `[LINK_FILES] ✅ Linked ${newFiles.length} files using optimized batch operation`,
          );

          this.logger.log(
            `[LINK_FILES] ✅ Successfully linked ${newFiles.length} files to postId=${postId}`,
          );
          newFiles.forEach((file) => {
            this.logger.debug(
              `[LINK_FILES]   Linked: fileId=${file.id}, fileKey=${file.fileKey}`,
            );
          });
        } else {
          this.logger.debug(`[LINK_FILES] All files already linked to post`);
        }
      } else {
        this.logger.warn(
          `[LINK_FILES] ⚠️ No files found in database for the extracted S3 keys`,
        );
        this.logger.warn(
          `[LINK_FILES]    This might indicate URL format mismatch or files not properly saved`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[LINK_FILES] ❌ Failed to link files for postId=${postId}:`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 사용되지 않는 파일 연결 해제
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @param fileIds 유지할 파일 ID 목록
   */
  async unlinkUnusedFiles(
    postId: string,
    userId: string,
    fileIds?: string[],
  ): Promise<void> {
    try {
      const post = await this.postsRepository.findOne({
        where: { id: postId, authorId: userId },
        relations: ["attachedFiles"],
      });

      if (!post) {
        throw new NotFoundException("게시글을 찾을 수 없거나 권한이 없습니다.");
      }

      // 유지할 파일이 지정되지 않은 경우, 모든 파일을 해제
      const filesToKeep = fileIds || [];

      // 현재 연결된 파일들 중 유지할 파일이 아닌 것들 찾기
      const filesToUnlink =
        post.attachedFiles?.filter((file) => !filesToKeep.includes(file.id)) ||
        [];

      if (filesToUnlink.length > 0) {
        // 파일 컨텍스트 삭제
        for (const file of filesToUnlink) {
          await this.deleteFileContext(file.id, FileContextType.POST);
        }

        // 포스트에서 파일 연결 해제
        post.attachedFiles =
          post.attachedFiles?.filter((file) => filesToKeep.includes(file.id)) ||
          [];
        await this.postsRepository.save(post);

        this.logger.log(
          `파일 연결 해제 완료: postId=${postId}, unlinkedCount=${filesToUnlink.length}`,
        );
      }
    } catch (error) {
      this.logger.error(`파일 연결 해제 실패: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 포스트당 총 파일 용량 검증
   *
   * @param files 업로드할 파일들
   * @param existingPostId 기존 포스트 ID (수정 시)
   */
  async validatePostTotalSize(
    files: File[],
    existingPostId?: string,
  ): Promise<void> {
    let totalSize = 0;

    // 신규 파일들의 총 크기 계산
    for (const file of files) {
      totalSize += file.fileSize || 0;
    }

    // 기존 포스트 수정인 경우, 이미 업로드된 파일들의 크기도 포함
    if (existingPostId) {
      // Post와 연관된 파일들을 찾기 위해 FileContext를 통해 조회
      const existingFileContexts = await this.fileContextRepository.find({
        where: {
          contextId: existingPostId,
          contextType: FileContextType.POST,
        },
        relations: ["files"],
      });

      for (const context of existingFileContexts) {
        if (context.files && context.files.length > 0) {
          for (const file of context.files) {
            totalSize += file.fileSize || 0;
          }
        }
      }
    }

    // 파일 개수 제한 검증
    const totalFileCount =
      files.length +
      (existingPostId
        ? await this.fileContextRepository.count({
            where: {
              contextId: existingPostId,
              contextType: FileContextType.POST,
            },
          })
        : 0);

    if (totalFileCount > this.MAX_FILES_PER_POST) {
      throw new BadRequestException(
        `포스트당 최대 ${this.MAX_FILES_PER_POST}개까지 파일을 첨부할 수 있습니다. (현재: ${totalFileCount}개)`,
      );
    }

    // 용량 제한 검증
    if (totalSize > this.MAX_POST_TOTAL_SIZE) {
      const sizeInMB = Math.round((totalSize / (1024 * 1024)) * 100) / 100;
      const maxSizeInMB =
        Math.round((this.MAX_POST_TOTAL_SIZE / (1024 * 1024)) * 100) / 100;
      throw new BadRequestException(
        `포스트당 총 파일 용량은 ${maxSizeInMB}MB를 초과할 수 없습니다. (현재: ${sizeInMB}MB)`,
      );
    }

    this.logger.debug(
      `파일 용량 검증 통과: postId=${existingPostId}, size=${totalSize}, count=${totalFileCount}`,
    );
  }

  /**
   * 신규 파일 업로드 시 포스트 용량 체크
   *
   * @param postId 포스트 ID
   * @param newFileSize 새로 추가할 파일 크기
   */
  async validateNewFileForPost(
    postId: string,
    newFileSize: number,
  ): Promise<void> {
    // Post와 연관된 파일들을 찾기
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ["attachedFiles"],
    });

    if (!post) {
      throw new NotFoundException("Post not found");
    }

    let currentTotalSize = 0;
    let currentFileCount = 0;

    // 현재 연결된 파일들의 크기 계산
    if (post.attachedFiles) {
      for (const file of post.attachedFiles) {
        currentTotalSize += file.fileSize || 0;
      }
      currentFileCount = post.attachedFiles.length;
    }

    // 파일 개수 제한 검증
    if (currentFileCount >= this.MAX_FILES_PER_POST) {
      throw new BadRequestException(
        `포스트당 최대 ${this.MAX_FILES_PER_POST}개까지 파일을 첨부할 수 있습니다.`,
      );
    }

    // 용량 제한 검증
    const newTotalSize = currentTotalSize + newFileSize;
    if (newTotalSize > this.MAX_POST_TOTAL_SIZE) {
      const sizeInMB = Math.round((newTotalSize / (1024 * 1024)) * 100) / 100;
      const maxSizeInMB =
        Math.round((this.MAX_POST_TOTAL_SIZE / (1024 * 1024)) * 100) / 100;
      throw new BadRequestException(
        `포스트당 총 파일 용량은 ${maxSizeInMB}MB를 초과할 수 없습니다.`,
      );
    }
  }

  /**
   * 여러 포스트의 파일 링크 재구성
   *
   * @param posts 포스트 배열
   */
  async relinkContentFiles(posts: Post[]): Promise<void> {
    this.logger.log(
      `Starting to relink content files for ${posts.length} posts`,
    );

    for (const post of posts) {
      try {
        // Lazy loading 방지: authorId 직접 사용
        await this.linkFilesFromContent(post, post.authorId);
        this.logger.log(`✅ Relinked files for post: ${post.title}`);
      } catch (error) {
        this.logger.error(
          `❌ Failed to relink files for post ${post.id}:`,
          error.message,
        );
      }
    }

    this.logger.log("Finished relinking content files");
  }

  /**
   * 파일을 포스트에 효율적으로 연결 (성능 최적화 버전)
   *
   * @param postId 포스트 ID
   * @param files 연결할 파일들
   * @param manager 트랜잭션 EntityManager (선택사항)
   */
  private async linkFilesToPostOptimized(
    postId: string,
    files: File[],
    manager?: EntityManager,
  ): Promise<void> {
    if (files.length === 0) {
      this.logger.debug(
        `[LINK_FILES_OPTIMIZED] No files to link for postId=${postId}`,
      );
      return;
    }

    try {
      // Repository 선택 - 트랜잭션 EntityManager가 있으면 사용
      const postsRepository = manager
        ? manager.getRepository(Post)
        : this.postsRepository;
      const filesRepository = manager
        ? manager.getRepository(File)
        : this.filesRepository;
      const fileContextRepository = manager
        ? manager.getRepository(FileContext)
        : this.fileContextRepository;

      // 성능 최적화: postId가 유효한지 먼저 확인
      const postExists = await postsRepository.findOne({
        where: { id: postId },
        select: ["id"],
      });

      if (!postExists) {
        throw new Error(`Post not found: ${postId}`);
      }

      // 성능 최적화: QueryBuilder를 사용한 대량 삽입
      // raw SQL을 사용하여 N+1 문제 방지
      const fileIds = files.map((f) => f.id);
      const values = fileIds
        .map((fileId) => `('${postId}', '${fileId}')`)
        .join(",");

      const query = `
        INSERT INTO "post_files" ("postId", "fileId")
        VALUES ${values}
        ON CONFLICT ("postId", "fileId") DO NOTHING
      `;

      await postsRepository.query(query);
      this.logger.log(
        `[LINK_FILES_OPTIMIZED] Batch inserted ${files.length} file relations for postId=${postId}`,
      );

      // File 엔티티의 contextId 업데이트는 건너뜀
      // PostFiles 중간 테이블로만 관계를 관리함으로써 외래 키 제약 조건 문제 방지
      this.logger.debug(
        `[LINK_FILES_OPTIMIZED] Skipping File contextId update to avoid FK constraints`,
      );

      // 인메모리 관계 업데이트 제거 - 타임아웃 방지
      // 데이터베이스에 이미 저장되었으므로 추가 작업 불필요
      this.logger.debug(
        `[LINK_FILES_OPTIMIZED] Skipping in-memory relation update to prevent timeouts`,
      );
    } catch (error) {
      this.logger.error(
        `[LINK_FILES_OPTIMIZED] Failed to batch insert file relations:`,
        error.stack,
      );
      throw new Error(`Failed to link files to post: ${error.message}`);
    }
  }

  /**
   * 포스트에 연결된 파일들 가져오기
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID (권한 확인용)
   */
  async getAttachedFiles(postId: string, userId?: string): Promise<File[]> {
    const whereCondition: any = {
      contextId: postId,
      contextType: FileContextType.POST,
    };

    const fileContexts = await this.fileContextRepository.find({
      where: whereCondition,
      relations: ["files"],
    });

    // userId가 있는 경우, 파일 소유권 확인
    if (userId) {
      const files: File[] = [];
      for (const fc of fileContexts) {
        if (fc.files) {
          files.push(...fc.files.filter((file) => file.userId === userId));
        }
      }
      return files;
    }

    const files: File[] = [];
    for (const fc of fileContexts) {
      if (fc.files) {
        files.push(...fc.files);
      }
    }
    return files;
  }

  /**
   * 파일 컨텍스트 업데이트 또는 생성
   *
   * @param fileId 파일 ID
   * @param purpose 파일 용도
   * @param contextId 컨텍스트 ID
   * @param contextType 컨텍스트 타입
   * @param userId 사용자 ID
   */
  private async updateOrCreateFileContext(
    fileId: string,
    purpose: FilePurpose,
    contextId: string,
    contextType: FileContextType,
    userId?: string,
  ): Promise<void> {
    // 파일의 contextId 업데이트 제거 - foreign key constraint 위반 방지
    // 썸네일 정보는 posts 테이블에서만 관리하면 충분함

    // 컨텍스트가 없으면 생성
    const existingContext = await this.fileContextRepository.findOne({
      where: { contextId, contextType },
    });

    if (!existingContext) {
      const fileContext = this.fileContextRepository.create({
        contextId,
        contextType,
        purpose,
        ownerId: userId || "00000000-0000-0000-0000-000000000000", // 빈 문자열 대신 기본 UUID 값 사용
      });
      await this.fileContextRepository.save(fileContext);
    }
  }

  /**
   * 파일 컨텍스트 삭제
   *
   * @param fileId 파일 ID
   * @param contextType 컨텍스트 타입
   */
  private async deleteFileContext(
    fileId: string,
    contextType: FileContextType,
  ): Promise<void> {
    // 파일의 contextId 업데이트 제거 - foreign key constraint 위반 방지
    // 썸네일 정보는 posts 테이블에서만 관리하면 충분함
    // await this.filesRepository.update(fileId, {
    //   contextId: null,
    // });
  }

  /**
   * UUID 기반 S3 키 추출
   *
   * @param url 파일 URL
   * @returns S3 키 또는 null
   */
  private extractS3KeyFromUrl(url: string): string | null {
    return extractS3KeyFromUrl(url);
  }

  /**
   * 콘텐츠에서 이미지 URL 추출
   *
   * @param content 포스트 콘텐츠
   * @returns 이미지 URL 배열
   */
  extractImageUrlsFromContent(content: string): string[] {
    return extractImageUrlsFromContent(content);
  }

  /**
   * 포스트의 총 파일 크기 계산
   *
   * @param postId 포스트 ID
   * @returns 총 파일 크기 (bytes)
   */
  async calculatePostFileSize(postId: string): Promise<number> {
    const fileContexts = await this.fileContextRepository.find({
      where: { contextId: postId, contextType: FileContextType.POST },
      relations: ["files"],
    });

    let totalSize = 0;

    for (const context of fileContexts) {
      if (context.files) {
        for (const file of context.files) {
          totalSize += file.fileSize || 0;
        }
      }
    }

    return totalSize;
  }

  /**
   * 파일 컨텍스트 배치 생성 (성능 최적화)
   * 여러 파일 컨텍스트를 한 번의 쿼리로 생성
   */
  private async createFileContextsBatch(
    contexts: Array<{
      fileId: string;
      purpose: FilePurpose;
      contextId: string;
      contextType: FileContextType;
      userId?: string;
    }>,
    manager?: EntityManager,
  ): Promise<void> {
    if (contexts.length === 0) return;

    try {
      // Repository 선택 - 트랜잭션 EntityManager가 있으면 사용
      const fileContextRepository = manager
        ? manager.getRepository(FileContext)
        : this.fileContextRepository;

      // contextId + contextType 조합으로 이미 존재하는 컨텍스트 조회
      const existingContexts = await fileContextRepository.find({
        where: {
          contextId: In(contexts.map((c) => c.contextId)),
          contextType: contexts[0].contextType,
        },
      });

      const existingKeys = new Set(
        existingContexts.map((c) => `${c.contextId}-${c.contextType}`),
      );

      // 생성이 필요한 컨텍스트만 필터링
      const newContexts = contexts.filter(
        (c) => !existingKeys.has(`${c.contextId}-${c.contextType}`),
      );

      if (newContexts.length > 0) {
        const entities = newContexts.map((context) =>
          fileContextRepository.create({
            contextId: context.contextId,
            contextType: context.contextType,
            purpose: context.purpose,
            ownerId: context.userId || "00000000-0000-0000-0000-000000000000",
            version: 1,
            isActive: true,
            fileCount: 1,
            totalSize: 0, // TODO: 실제 파일 크기로 업데이트 필요
          }),
        );

        await fileContextRepository.save(entities);
        this.logger.log(
          `[FILE_CONTEXT] Created ${entities.length} file contexts in batch`,
        );
      }
    } catch (error) {
      this.logger.error(`[FILE_CONTEXT] Batch creation failed:`, error.stack);
      throw error;
    }
  }
}
