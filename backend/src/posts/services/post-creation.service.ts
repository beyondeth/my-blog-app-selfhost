import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Repository,
  DataSource,
  EntityManager,
  OptimisticLockVersionMismatchError,
  In,
} from "typeorm";
import { Post } from "../entities/post.entity";
import { PostStats } from "../entities/post-stats.entity";
import { PostMetadata } from "../entities/post-metadata.entity";
import { User } from "../../users/entities/user.entity";
import { Blog } from "../../blogs/entities/blog.entity";
import { File } from "../../files/entities/file.entity";
import { Role } from "../../common/enums/role.enum";
import { CreatePostDto } from "../dto/create-post.dto";
import { UpdatePostDto } from "../dto/update-post.dto";
import { generateSlug } from "../utils/post.utils";
import { PostContentService } from "./post-content.service";
import { PostFileService } from "./post-file.service";
import { PostCacheService } from "./post-cache.service";
import { CacheInvalidationEvents } from "../../common/events/cache.events";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  POST_PROCESSING_QUEUE,
  PostProcessingJobData,
} from "../queues/post-processing.queue";
import { BlogStatsService } from "../../common/services/blog-stats.service";
import { UrlSanitizerUtil } from "../../common/utils/url-sanitizer.util";
import { IpSecurityService } from "../../common/services/ip-security.service";

/**
 * 포스트 생성/수정/삭제 서비스
 *
 * 책임:
 * - 포스트 생성 (초안, 발행)
 * - 포스트 수정 (내용, 메타데이터)
 * - 포스트 삭제 (소프트 삭제)
 * - 버전 관리 및 낙관적 잠금
 * - 연관 데이터 처리 (파일, 통계)
 */
@Injectable()
export class PostCreationService {
  private readonly logger = new Logger(PostCreationService.name);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(PostStats)
    private readonly postStatsRepository: Repository<PostStats>,
    @InjectRepository(PostMetadata)
    private readonly postMetadataRepository: Repository<PostMetadata>,
    @InjectRepository(Blog)
    private readonly blogsRepository: Repository<Blog>,
    private readonly postContentService: PostContentService,
    private readonly postFileService: PostFileService,
    private readonly postCacheService: PostCacheService,
    private readonly blogStatsService: BlogStatsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
    @InjectQueue(POST_PROCESSING_QUEUE)
    private readonly postProcessingQueue: Queue<PostProcessingJobData>,
    private readonly ipSecurityService: IpSecurityService,
  ) {}

  /**
   * 새 포스트 생성
   *
   * @param createPostDto 생성 데이터
   * @param author 작성자
   * @param files 첨부 파일들 (호출자에서 직접 전달하는 경우, 주로 테스트용)
   * @returns 생성된 포스트
   */
  async create(
    createPostDto: CreatePostDto,
    author: User,
    files?: File[],
    ip?: string,
  ): Promise<Post> {
    // CreatePostDto의 isPublished 값 사용 (기본값: true - 자동 발행)
    // isPublished 값이 명시적으로 전달되지 않으면 true로 처리
    const isPublished = createPostDto.isPublished !== false;

    // attachedFileIds가 있는 경우 파일들을 로드
    if (
      !files &&
      createPostDto.attachedFileIds &&
      createPostDto.attachedFileIds.length > 0
    ) {
      this.logger.debug(
        `[PostCreationService] Loading ${createPostDto.attachedFileIds.length} files from attachedFileIds`,
      );
      files = await this.loadFilesByIds(
        createPostDto.attachedFileIds,
        author.id,
      );
    }

    return await this.createPost(createPostDto, author, files, isPublished, ip);
  }

  /**
   * ID 목록으로 파일들을 로드
   *
   * @param fileIds 파일 ID 목록
   * @param userId 사용자 ID (소유권 확인)
   * @returns 파일 엔티티 배열
   */
  private async loadFilesByIds(
    fileIds: string[],
    userId: string,
  ): Promise<File[]> {
    if (!fileIds || fileIds.length === 0) {
      return [];
    }

    // 파일들을 소유권과 함께 로드
    const files = await this.dataSource.getRepository(File).find({
      where: {
        id: In(fileIds),
        userId: userId, // 파일 소유권 확인
      },
    });

    if (files.length !== fileIds.length) {
      const foundIds = files.map((f) => f.id);
      const missingIds = fileIds.filter((id) => !foundIds.includes(id));
      this.logger.warn(
        `[PostCreationService] Could not find all files. Missing: ${missingIds.join(", ")}`,
      );
      throw new NotFoundException(
        `${missingIds.length}개의 파일을 찾을 수 없거나 권한이 없습니다.`,
      );
    }

    this.logger.log(
      `[PostCreationService] Loaded ${files.length} files for user ${userId}`,
    );
    return files;
  }

  /**
   * 포스트 생성 (내부용)
   *
   * @param createPostDto 생성 데이터
   * @param author 작성자
   * @param files 첨부 파일들
   * @param isPublished 발행 여부
   * @returns 생성된 포스트
   */
  private async createPost(
    createPostDto: CreatePostDto,
    author: User,
    files?: File[],
    isPublished: boolean = false,
    ip?: string,
  ): Promise<Post> {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      this.logger.log(`Creating new post for user: ${author.id}`);

      // 1. 블로그 확인
      const blog = await manager.findOne(Blog, {
        where: { userId: author.id },
      });

      if (!blog) {
        throw new NotFoundException("블로그를 찾을 수 없습니다.");
      }

      // 2. slug은 Post 엔티티의 @BeforeInsert 훅에서 자동 생성됨

      // 3. 포스트 콘텐츠 처리
      // content_markdown을 우선적으로 사용, 없으면 content 사용
      const rawContent =
        createPostDto.content_markdown || createPostDto.content || "";

      // Debug: 콘텐츠 처리 로깅
      this.logger.debug(`[Post Content Processing]`, {
        postId: "pending",
        hasContent_markdown: !!createPostDto.content_markdown,
        hasContent: !!createPostDto.content,
        rawContentLength: rawContent.length,
        contentType: createPostDto.content_markdown ? "markdown" : "html",
      });

      const processedContent = await this.postContentService.processContent(
        rawContent,
        {
          sanitize: true,
          processCode: true,
          processImages: true,
          preserveMermaid: true,
        },
      );

      const sanitizedTitle = UrlSanitizerUtil.sanitizeDisplayText(
        createPostDto.title,
        500,
      );
      const sanitizedCategory = UrlSanitizerUtil.sanitizeDisplayText(
        createPostDto.category,
        120,
      );
      const sanitizedTags =
        createPostDto.tags
          ?.map((tag) => UrlSanitizerUtil.sanitizeDisplayText(tag, 64))
          .filter((tag) => !!tag) ?? [];

      // 4. 썸네일 설정 (thumbnailImageId만 사용 - thumbnail 필드는 PostMapperService에서 동적 생성)
      // thumbnailImageId 우선순위: 명시적 thumbnailImageId
      const thumbnailImageId: string | null =
        createPostDto.thumbnailImageId || null;

      // 썸네일 설정 로깅
      if (thumbnailImageId) {
        this.logger.log(
          `[PostCreationService] Using provided thumbnailImageId: ${thumbnailImageId}`,
        );
      } else {
        this.logger.log(
          `[PostCreationService] No thumbnailImageId provided - will auto-detect from content after post creation`,
        );
      }

      // 캡션 디버그: 저장되는 HTML에 캡션 포함 여부 확인
      this.logger.debug(`[CAPTION_DEBUG] Saving post content:`, {
        hasFigcaption: processedContent.html.includes("<figcaption"),
        hasFigure: processedContent.html.includes("<figure"),
        figcaptionCount: (processedContent.html.match(/<figcaption/g) || [])
          .length,
        contentLength: processedContent.html.length,
        contentPreview:
          processedContent.html.substring(0, 300) +
          (processedContent.html.length > 300 ? "..." : ""),
      });

      // 5. 포스트 엔티티 생성
      const post = manager.create(Post, {
        title: sanitizedTitle,
        // SEO 친화적 URL (YYYY-MM-DD-title-timestamp)
        slug: generateSlug(sanitizedTitle),
        content: processedContent.html, // 처리된 HTML 콘텐츠 저장
        content_markdown: createPostDto.content_markdown, // 원본 마크다운 저장
        excerpt: this.postContentService.extractExcerpt(rawContent),
        thumbnailImageId: thumbnailImageId,
        category: sanitizedCategory,
        tags: sanitizedTags,
        isPublished: isPublished, // 파라미터로 받은 값 사용
        authorId: author.id,
        blogId: blog.id,
        content_type: createPostDto.content_markdown ? "markdown" : "html",
        version: 1, // 명시적으로 초기 버전 설정
        ipAddress: this.ipSecurityService.encrypt(ip), // 암호화하여 저장
        userAgent: "Unknown", // Controller에서 userAgent도 받으면 좋지만 일단 IP만
      });

      // 6. 발행 시간 설정
      if (isPublished) {
        post.publishedAt = new Date();
        post.status = "published";
      } else {
        post.publishedAt = null;
        post.status = "draft";
      }

      // 6. 포스트 저장 (search_vector는 null로 초기화)
      post.search_vector = null; // 트리거 방지를 위해 명시적으로 null 설정
      const savedPost = await manager.save(post);

      // Debug: 저장된 포스트의 태그 확인
      this.logger.debug(
        `[PostCreationService] Post saved - ID: ${savedPost.id}, Tags: ${JSON.stringify(savedPost.tags)}, Input Tags: ${JSON.stringify(createPostDto.tags)}`,
      );

      // 6.1. 검색 벡터 업데이트 (트리거 없이 직접 처리)
      if (savedPost.title || savedPost.content) {
        const searchText =
          `${savedPost.title || ""} ${savedPost.content || ""}`.trim();
        if (searchText) {
          await manager.query(
            `UPDATE posts SET search_vector = to_tsvector('simple', $1) WHERE id = $2`,
            [searchText, savedPost.id],
          );
          this.logger.debug(
            `[PostCreationService] Search vector updated for post: ${savedPost.id}`,
          );
        }
      }

      // 7. PostStats 생성
      const stats = manager.create(PostStats, {
        postId: savedPost.id,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
      });
      await manager.save(stats);

      // 8. PostMetadata 생성
      const contentForStats =
        createPostDto.content_markdown || createPostDto.content || "";
      const readingStats =
        this.postContentService.calculateReadingTime(contentForStats);
      const excerpt = this.postContentService.extractExcerpt(contentForStats);

      // Debug: PostMetadata 생성 데이터 로깅
      this.logger.debug(`[PostMetadata Creation]`, {
        postId: savedPost.id,
        category: createPostDto.category,
        tags: createPostDto.tags,
        excerptLength: excerpt.length,
        wordCount: readingStats.wordCount,
        readingTime: readingStats.readingTimeMinutes,
      });

      const metadata = manager.create(PostMetadata, {
        postId: savedPost.id,
        category: createPostDto.category, // 카테고리 저장
        tags: createPostDto.tags || [], // 태그 저장
        excerpt: excerpt, // 요약문 저장
        wordCount: readingStats.wordCount,
        readingTimeMinutes: readingStats.readingTimeMinutes,
        lastEditedAt: new Date(),
        editCount: 0,
      });
      await manager.save(metadata);

      // Debug: 저장된 메타데이터의 태그 확인
      this.logger.debug(
        `[PostCreationService] Metadata saved - PostId: ${savedPost.id}, Metadata Tags: ${JSON.stringify(metadata.tags)}`,
      );

      // 9. 파일 연결 (있는 경우) - 트랜잭션 내에서 직접 처리
      if (files && files.length > 0) {
        // post_files 테이블에 직접 삽입 (트랜잭션 내에서)
        const fileIds = files.map((f) => f.id);
        const values = fileIds
          .map((fileId) => `('${savedPost.id}', '${fileId}')`)
          .join(",");

        await manager.query(`
          INSERT INTO "post_files" ("postId", "fileId")
          VALUES ${values}
          ON CONFLICT ("postId", "fileId") DO NOTHING
        `);

        this.logger.log(
          `[PostCreationService] Linked ${files.length} files to post ${savedPost.id}`,
        );
      }

      // 10. 비동기 처리 작업 큐에 추가 (발행된 경우만)
      if (isPublished) {
        await this.postProcessingQueue.add(
          "process-published-post",
          {
            postId: savedPost.id,
            userId: author.id,
            blogId: blog.id,
            title: savedPost.title,
            content: savedPost.content,
            tags: savedPost.tags,
            category: savedPost.category,
          },
          {
            delay: 1000, // 1초 후 실행
            attempts: 3,
          },
        );
      }

      // 11. 블로그 통계 업데이트 (발행된 경우만)
      if (isPublished) {
        await this.blogStatsService.incrementPostCount(blog.id);
      }

      // 12. 캐시 무효화
      this.eventEmitter.emit("cache.posts.invalidate", {
        postId: savedPost.id,
        blogId: blog.id,
        isPublished: isPublished,
      });

      this.logger.log(
        `Post created successfully: ${savedPost.id} (slug: ${savedPost.slug}, published: ${isPublished})`,
      );

      // blog 관계 로드 (MCP와 같은 API에서 blog 정보가 필요한 경우)
      const postWithBlog = await manager.findOne(Post, {
        where: { id: savedPost.id },
        relations: ["blog"],
      });

      return postWithBlog || savedPost; // blog 관계 로드 실패 시 원본 post 반환
    });
  }

  /**
   * 포스트 수정
   *
   * @param id 포스트 ID
   * @param updatePostDto 수정 데이터
   * @param user 사용자
   * @param files 추가/수정할 파일들
   * @returns 수정된 포스트
   */
  async update(
    id: string,
    updatePostDto: UpdatePostDto,
    user: User,
    files?: File[],
  ): Promise<Post> {
    return await this.dataSource
      .transaction(async (manager: EntityManager) => {
        this.logger.log(`Updating post: ${id} by user: ${user.id}`);

        // 1. 포스트 조회 (잠금 포함)
        let post: Post | null = null;
        if (typeof updatePostDto.version === "number") {
          this.logger.debug(
            `[PostCreationService] Applying optimistic lock for post ${id} with version ${updatePostDto.version}`,
          );
          post = await manager.findOne(Post, {
            where: { id },
            relations: ["blog", "stats", "metadata"],
            lock: {
              mode: "optimistic",
              version: updatePostDto.version,
            },
          });
        } else {
          post = await manager.findOne(Post, {
            where: { id },
            relations: ["blog", "stats", "metadata"],
          });
        }

        if (!post) {
          throw new NotFoundException("포스트를 찾을 수 없습니다.");
        }

        // 2. 권한 확인
        if (
          post.authorId !== user.id &&
          post.blog.userId !== user.id &&
          user.role !== Role.ADMIN
        ) {
          throw new ForbiddenException("수정 권한이 없습니다.");
        }

        // 3. 발행 상태 변경 처리
        const wasPublished = post.isPublished;
        const willBePublished =
          updatePostDto.isPublished !== undefined
            ? updatePostDto.isPublished
            : post.isPublished;

        // 3.1. 썸네일 변경 감지를 위한 원본 값 저장 (업데이트 전)
        const oldThumbnailImageId = post.thumbnailImageId;
        // oldThumbnailUrl은 PostMapperService에서 동적 생성되므로 여기서는 null로 처리
        const oldThumbnailUrl = null;

        // 4. 콘텐츠 업데이트
        const hasMarkdownUpdate = updatePostDto.content_markdown !== undefined;
        const hasHtmlUpdate = updatePostDto.content !== undefined;

        if (hasMarkdownUpdate || hasHtmlUpdate) {
          const rawInput = hasMarkdownUpdate
            ? updatePostDto.content_markdown || ""
            : updatePostDto.content || "";

          const processedContent = await this.postContentService.processContent(
            rawInput,
            {
              sanitize: true,
              processCode: true,
              processImages: true,
              preserveMermaid: true,
            },
          );

          let htmlToPersist = processedContent.html;
          if (!hasMarkdownUpdate && htmlToPersist) {
            htmlToPersist = htmlToPersist.replace(
              /\s+data-image-id=["'][^"']*["']/g,
              "",
            );
            this.logger.debug(
              `[PostCreationService] Cleaned invalid data-image-id attributes from HTML update`,
            );
          }

          post.content = htmlToPersist;
          post.content_markdown = hasMarkdownUpdate
            ? updatePostDto.content_markdown || ""
            : null;
          post.content_type = hasMarkdownUpdate ? "markdown" : "html";

          if (!post.thumbnailImageId && !updatePostDto.thumbnailImageId) {
            const extractedThumbnailUrl =
              this.postContentService.extractThumbnail(processedContent.html);
            if (extractedThumbnailUrl) {
              this.logger.log(
                `[PostCreationService] Found thumbnail candidate during update - PostMapperService will handle assignment`,
              );
            }
          }

          post.excerpt = this.postContentService.extractExcerpt(rawInput);

          if (post.metadata) {
            const readingTime =
              this.postContentService.calculateReadingTime(rawInput);
            post.metadata.wordCount = readingTime.wordCount;
            post.metadata.readingTimeMinutes = readingTime.readingTimeMinutes;
            post.metadata.lastEditedAt = new Date();
            post.metadata.editCount = (post.metadata.editCount || 0) + 1;
            await manager.save(post.metadata);
          }
        }

        // 5. 기본 정보 업데이트
        if (updatePostDto.title !== undefined) {
          post.title = UrlSanitizerUtil.sanitizeDisplayText(
            updatePostDto.title,
            500,
          );
          // 제목이 변경되고 slug가 없거나 draft로 시작하는 경우만 새로 생성
          // 실제 slug는 @BeforeUpdate 훅에서 생성됨
        }

        if (updatePostDto.category !== undefined) {
          post.category = UrlSanitizerUtil.sanitizeDisplayText(
            updatePostDto.category,
            120,
          );
        }

        if (updatePostDto.tags !== undefined) {
          post.tags =
            updatePostDto.tags
              ?.map((tag) => UrlSanitizerUtil.sanitizeDisplayText(tag, 64))
              .filter((tag) => !!tag) ?? [];
        }

        // 6. 발행 상태 변경
        if (
          updatePostDto.isPublished !== undefined &&
          updatePostDto.isPublished !== post.isPublished
        ) {
          post.isPublished = updatePostDto.isPublished;
          if (updatePostDto.isPublished && !post.publishedAt) {
            post.publishedAt = new Date();
            post.status = "published";
          }
        }

        // 8. Editor's Pick (관리자만)
        if (
          updatePostDto.isEditorPick !== undefined &&
          user.role === Role.ADMIN
        ) {
          post.isEditorPick = updatePostDto.isEditorPick;
          if (updatePostDto.isEditorPick) {
            post.editorPickedAt = new Date();
            if (post.metadata) {
              post.metadata.setAsEditorPick();
              await manager.save(post.metadata);
            }
          } else {
            post.editorPickedAt = null;
            if (post.metadata) {
              post.metadata.removeEditorPick();
              await manager.save(post.metadata);
            }
          }
        }

        // 9. 썸네일 설정 (PostFileService를 통한 처리) - 트랜잭션 내에서 처리
        if (updatePostDto.thumbnailImageId !== undefined) {
          // 🎯 [THUMBNAIL_TRACK] PostFileService를 통해 썸네일 처리
          this.logger.log(
            `[PostCreationService] Calling PostFileService.setThumbnail for postId=${id}, thumbnailImageId=${updatePostDto.thumbnailImageId}`,
          );

          // 트랜잭션 내에서 setThumbnail 호출 - 실패 시 전체 트랜잭션이 롤백됨
          await this.postFileService.setThumbnail(id, user.id, {
            thumbnailFileId: updatePostDto.thumbnailImageId,
          });

          // PostFileService에서 post를 직접 업데이트하므로 여기서는 다시 설정할 필요 없음
          // 썸네일 변경 후 post 객체를 다시 조회하여 최신 상태 유지
          const updatedPostAfterThumbnail = await this.postsRepository.findOne({
            where: { id },
            relations: ["thumbnailImage"],
          });

          if (updatedPostAfterThumbnail) {
            post.thumbnailImageId = updatedPostAfterThumbnail.thumbnailImageId;
            // post.thumbnail은 PostMapperService에서 동적 생성되므로 설정하지 않음
          }
        }

        // 10. 버전 증가
        post.version = (post.version || 0) + 1;
        post.updatedAt = new Date();

        // 11. 저장
        const updatedPost = await manager.save(post);

        // 12. 파일 처리
        if (files) {
          const fileIds = files.map((f) => f.id);
          await this.postFileService.unlinkUnusedFiles(id, user.id, fileIds);
          await this.postFileService.linkFilesFromContent(updatedPost, user.id);
        }

        // 13. 썸네일 변경 시 특정 이벤트 발행
        // thumbnailImageId만 확인 - thumbnail URL은 PostMapperService에서 동적 생성
        const newThumbnailImageId = post.thumbnailImageId;
        // newThumbnailUrl은 PostMapperService에서 동적 생성되므로 여기서는 null로 처리
        const newThumbnailUrl = null;

        // 썸네일이 실제로 변경된 경우에만 이벤트 발행
        if (oldThumbnailImageId !== newThumbnailImageId) {
          // 디버깅용 상세 로그
          this.logger.log(
            `[POST_THUMBNAIL_UPDATED] Thumbnail change detected for post: ${updatedPost.id}`,
          );
          this.logger.debug(
            `  Old thumbnailImageId: ${oldThumbnailImageId} -> New: ${newThumbnailImageId}`,
          );
          this.logger.debug(`  Blog slug: ${post.blog?.slug || post.blogId}`);

          this.eventEmitter.emit(
            CacheInvalidationEvents.POST_THUMBNAIL_UPDATED,
            {
              postId: updatedPost.id,
              blogSlug: post.blog?.slug || post.blogId,
              oldThumbnailImageId,
              newThumbnailImageId,
              oldThumbnailUrl,
              newThumbnailUrl,
              authorId: user.id,
            },
          );
        }

        // 14. 일반 캐시 무효화 (다른 변경들도 고려)
        await this.postCacheService.invalidatePostUpdateCache(
          updatedPost.id,
          post.blog?.slug || post.blogId,
          post.blogId,
        );

        // 15. 발행 상태 변경 이벤트
        if (!wasPublished && willBePublished) {
          await this.postProcessingQueue.add(
            "process-published-post",
            {
              postId: updatedPost.id,
              userId: user.id,
              blogId: post.blogId,
              title: updatedPost.title,
              content: updatedPost.content,
              tags: updatedPost.tags,
              category: updatedPost.category,
            },
            {
              delay: 1000,
              attempts: 3,
            },
          );

          // 블로그 통계 업데이트
          await this.blogStatsService.incrementPostCount(post.blogId);
        } else if (wasPublished && !willBePublished) {
          // 발행 취소 시 통계 감소
          await this.blogStatsService.decrementPostCount(post.blogId);
        }

        this.logger.log(`Post updated successfully: ${updatedPost.id}`);

        // PostMapperService에서 data-image-id를 추가하기 위해 attachedFiles 관계 포함하여 조회
        const finalPost = await this.postsRepository.findOne({
          where: { id: updatedPost.id },
          relations: [
            "attachedFiles",
            "thumbnailImage",
            "blog",
            "author",
            "stats",
            "metadata",
          ],
        });

        // isEditorPick 변경 시 이벤트 발행 (관리자 업데이트)
        if (
          updatePostDto.isEditorPick !== undefined &&
          user.role === Role.ADMIN
        ) {
          this.eventEmitter.emit(
            CacheInvalidationEvents.POST_EDITOR_PICK_TOGGLED,
            {
              postId: updatedPost.id,
              isPicked: updatePostDto.isEditorPick,
            },
          );
        } else {
          // 기존 로직 유지: 에디터 픽인 게시글이 수정된 경우 캐시 무효화
          const isEditorPick =
            finalPost?.metadata?.isEditorPick ??
            finalPost?.isEditorPick ??
            false;
          if (isEditorPick) {
            await this.postCacheService.invalidateEditorPicksCache(
              updatedPost.id,
            );
          }
        }

        return finalPost || updatedPost;
      })
      .catch((error) => {
        if (error instanceof OptimisticLockVersionMismatchError) {
          throw new ConflictException(
            "포스트가 다른 사용자에 의해 수정되었습니다. 새로고침 후 다시 시도해주세요.",
          );
        }
        throw error;
      });
  }

  /**
   * 포스트 삭제 (소프트 삭제)
   *
   * @param id 포스트 ID
   * @param user 사용자
   */
  async delete(id: string, user: User): Promise<void> {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      this.logger.log(`Deleting post: ${id} by user: ${user.id}`);

      // 1. 포스트 조회
      const post = await manager.findOne(Post, {
        where: { id },
        relations: ["blog", "stats", "metadata"],
      });

      if (!post) {
        throw new NotFoundException("포스트를 찾을 수 없습니다.");
      }

      // 2. 권한 확인
      if (
        post.authorId !== user.id &&
        post.blog.userId !== user.id &&
        user.role !== Role.ADMIN
      ) {
        throw new ForbiddenException("삭제 권한이 없습니다.");
      }

      // 3. 이미 삭제된 포스트 확인
      if (post.isDeleted) {
        throw new BadRequestException("이미 삭제된 포스트입니다.");
      }

      const wasEditorPick =
        post.metadata?.isEditorPick ?? post.isEditorPick ?? false;

      // 4. 소프트 삭제
      await manager.update(Post, id, {
        isDeleted: true,
        deletedAt: new Date(),
        slug: `deleted-${post.slug}-${Date.now()}`, // slug 중복 방지
        isEditorPick: false,
        editorPickedAt: null,
      });

      if (wasEditorPick && post.metadata) {
        post.metadata.removeEditorPick();
        await manager.save(PostMetadata, post.metadata);
      }

      // 5. 블로그 통계 업데이트
      if (post.isPublished) {
        await this.blogStatsService.decrementPostCount(post.blogId);
      }

      // 6. 캐시 무효화
      this.eventEmitter.emit("cache.posts.invalidate", {
        postId: id,
        blogId: post.blogId,
        isPublished: post.isPublished,
        isDeleted: true,
      });

      if (wasEditorPick) {
        this.eventEmitter.emit(CacheInvalidationEvents.POST_EDITOR_PICK_TOGGLED, {
          postId: id,
          isPicked: false,
        });
      }

      // 7. 비동기 정리 작업 (비디오 파일 R2 삭제 포함)
      await this.postProcessingQueue.add(
        "cleanup-deleted-post",
        {
          postId: id,
          blogId: post.blogId,
          content: post.content, // 비디오 ID 추출을 위해 content 포함
        } as PostProcessingJobData,
        {
          delay: 60000, // 1분 후 실행
          attempts: 3, // 3번 재시도 (R2 삭제 실패 대비)
        },
      );

      this.logger.log(`Post deleted successfully: ${id}`);
    });
  }

  /**
   * 포스트 복원 (삭제 취소)
   *
   * @param id 포스트 ID
   * @param user 사용자
   */
  async restore(id: string, user: User): Promise<Post> {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      this.logger.log(`Restoring post: ${id} by user: ${user.id}`);

      // 1. 포스트 조회
      const post = await manager.findOne(Post, {
        where: { id, isDeleted: true },
        relations: ["blog"],
      });

      if (!post) {
        throw new NotFoundException("삭제된 포스트를 찾을 수 없습니다.");
      }

      // 2. 권한 확인
      if (
        post.authorId !== user.id &&
        post.blog.userId !== user.id &&
        user.role !== Role.ADMIN
      ) {
        throw new ForbiddenException("복원 권한이 없습니다.");
      }

      // 3. slug 복원 (중복 확인)
      const originalSlug = post.slug
        .replace(/^deleted-/, "")
        .split("-")
        .slice(0, -1)
        .join("-");
      const slugExists = await manager.findOne(Post, {
        where: { slug: originalSlug, isDeleted: false },
        select: ["id"],
      });

      if (slugExists) {
        post.slug = `${originalSlug}-restored-${Date.now()}`;
      } else {
        post.slug = originalSlug;
      }

      // 4. 복원
      post.isDeleted = false;
      post.deletedAt = null;
      await manager.save(post);

      // 5. 블로그 통계 업데이트
      if (post.isPublished) {
        await this.blogStatsService.incrementPostCount(post.blogId);
      }

      // 6. 캐시 무효화
      this.eventEmitter.emit("cache.posts.invalidate", {
        postId: id,
        blogId: post.blogId,
        isPublished: post.isPublished,
      });

      this.logger.log(`Post restored successfully: ${id}`);
      return post;
    });
  }

  /**
   * 포스트 영구 삭제 (관리자용)
   *
   * @param id 포스트 ID
   * @param user 관리자
   */
  async permanentDelete(id: string, user: User): Promise<void> {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException("관리자만 영구 삭제할 수 있습니다.");
    }

    return await this.dataSource.transaction(async (manager: EntityManager) => {
      this.logger.log(`Permanently deleting post: ${id} by admin: ${user.id}`);

      // 1. 관련 데이터 삭제
      await manager.delete(PostStats, { postId: id });
      await manager.delete(PostMetadata, { postId: id });

      // 2. 포스트 삭제
      await manager.delete(Post, { id });

      // 3. 캐시 무효화 (blogId는 없으므로 null)
      this.postCacheService.invalidatePostUpdateCache(id, null, null);

      this.logger.log(`Post permanently deleted: ${id}`);
    });
  }

  /**
   * 초안 저장
   *
   * @param createPostDto 저장 데이터
   * @param author 작성자
   * @returns 저장된 포스트
   */
  async saveDraft(createPostDto: CreatePostDto, author: User): Promise<Post> {
    this.logger.log(`Saving draft for user: ${author.id}`);

    // CreatePostDto에 isPublished와 slug이 없으므로 내부적으로 처리
    return this.createPost(createPostDto, author, undefined, false);
  }

  /**
   * 포스트 발행
   *
   * @param id 포스트 ID
   * @param user 사용자
   * @returns 발행된 포스트
   */
  async publish(id: string, user: User): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ["blog"],
    });

    if (!post) {
      throw new NotFoundException("포스트를 찾을 수 없습니다.");
    }

    if (
      post.authorId !== user.id &&
      post.blog.userId !== user.id &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException("발행 권한이 없습니다.");
    }

    if (post.isPublished) {
      throw new BadRequestException("이미 발행된 포스트입니다.");
    }

    return this.update(id, { isPublished: true, version: post.version }, user);
  }

  /**
   * 발행 취소
   *
   * @param id 포스트 ID
   * @param user 사용자
   * @returns 발행 취소된 포스트
   */
  async unpublish(id: string, user: User): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ["blog"],
    });

    if (!post) {
      throw new NotFoundException("포스트를 찾을 수 없습니다.");
    }

    if (
      post.authorId !== user.id &&
      post.blog.userId !== user.id &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException("발행 취소 권한이 없습니다.");
    }

    if (!post.isPublished) {
      throw new BadRequestException("발행되지 않은 포스트입니다.");
    }

    return this.update(id, { isPublished: false, version: post.version }, user);
  }

  /**
   * 포스트에 썸네일 설정
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @param thumbnailFileId 썸네일 파일 ID
   */
  async setThumbnail(
    postId: string,
    userId: string,
    thumbnailFileId?: string,
  ): Promise<{ success: boolean; thumbnailUrl?: string }> {
    return this.postFileService.setThumbnail(postId, userId, {
      thumbnailFileId,
    });
  }

  /**
   * 포스트 내용 재렌더링
   *
   * @param postId 포스트 ID
   * @param user 사용자
   * @returns 재렌더링 결과
   */
  async rerenderContent(
    postId: string,
    user: User,
  ): Promise<{
    html: string;
    thumbnail: string | null;
  }> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      select: ["content", "authorId"],
    });

    if (!post) {
      throw new NotFoundException("포스트를 찾을 수 없습니다.");
    }

    if (post.authorId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException("권한이 없습니다.");
    }

    const result = await this.postContentService.rerenderMarkdown(
      postId,
      post.content,
    );

    // 썸네일 업데이트 - thumbnail 필드는 직접 저장하지 않고 PostMapperService에서 동적 생성
    // result.thumbnail은 content에서 추출된 URL이지만, 이제는 thumbnailImageId만 사용
    // 이 부분은 현재 사용되지 않으므로 주석 처리
    // if (result.thumbnail !== null) {
    //   // TODO: result.thumbnail URL을 File로 변환하여 thumbnailImageId 설정
    //   this.logger.log(`[rerenderContent] Extracted thumbnail URL: ${result.thumbnail}`);
    // }

    // 캐시 무효화
    this.eventEmitter.emit("cache.posts.invalidate", {
      postId,
    });

    return result;
  }
}
