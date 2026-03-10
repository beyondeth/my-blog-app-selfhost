import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, EntityManager, In } from "typeorm";
import { Post } from "../entities/post.entity";
import { PostStats } from "../entities/post-stats.entity";
import { PostMetadata } from "../entities/post-metadata.entity";
import { User } from "../../users/entities/user.entity";
import { Blog } from "../../blogs/entities/blog.entity";
import { File } from "../../files/entities/file.entity";
import { CreatePostDto } from "../dto/create-post.dto";
import { generateSlug } from "../utils/post.utils";
import { PostContentService } from "./post-content.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UrlSanitizerUtil } from "../../common/utils/url-sanitizer.util";
import { IpSecurityService } from "../../common/services/ip-security.service";
import { TransactionEventBuffer } from "../../common/utils/transaction-event-buffer";
import {
  PostLifecycleEvents,
  PostLifecyclePayload,
} from "../events/post-lifecycle.events";
import { CacheService } from "../../cache/cache.service";
import { PostMetadataSyncService } from "./post-metadata-sync.service";
import { PostSearchVectorService } from "./post-search-vector.service";
import {
  normalizeGithubResourceUrl,
  sanitizeGithubResourceDescription,
} from "../utils/github-resource.util";

/**
 * 포스트 생성 전담 서비스
 *
 * 책임:
 * - 포스트 생성 (초안, 발행)
 * - 파일 로드 및 연결
 * - 콘텐츠 처리 및 메타데이터 생성
 *
 * ⚠️ 캐시 무효화:
 * 기본은 CacheInvalidationListener가 PostLifecycleEvents 구독으로 처리.
 * 생성 직후 홈피드 지연을 줄이기 위해 발행 포스트는 응답 전에 핵심 캐시를 동기 정리한다.
 */
@Injectable()
export class PostCreator {
  private readonly logger = new Logger(PostCreator.name);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly postContentService: PostContentService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
    private readonly ipSecurityService: IpSecurityService,
    private readonly cacheService: CacheService,
    private readonly postMetadataSyncService: PostMetadataSyncService,
    private readonly postSearchVectorService: PostSearchVectorService,
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
        `[PostCreator] Loading ${createPostDto.attachedFileIds.length} files from attachedFileIds`,
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
  async loadFilesByIds(fileIds: string[], userId: string): Promise<File[]> {
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
        `[PostCreator] Could not find all files. Missing: ${missingIds.join(", ")}`,
      );
      throw new NotFoundException(
        `${missingIds.length}개의 파일을 찾을 수 없거나 권한이 없습니다.`,
      );
    }

    this.logger.log(
      `[PostCreator] Loaded ${files.length} files for user ${userId}`,
    );
    return files;
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
    const eventBuffer = new TransactionEventBuffer();

    const result = await this.dataSource.transaction(
      async (manager: EntityManager) => {
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
            forceMarkdown: !!createPostDto.content_markdown,
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
        const visibility =
          createPostDto.visibility === "private" ? "private" : "public";
        const githubUrl = normalizeGithubResourceUrl(createPostDto.githubUrl);
        const githubDescription = githubUrl
          ? sanitizeGithubResourceDescription(createPostDto.githubDescription)
          : null;

        // 4. 썸네일 설정 (thumbnailImageId만 사용 - thumbnail 필드는 PostMapperService에서 동적 생성)
        // thumbnailImageId 우선순위: 명시적 thumbnailImageId
        const thumbnailImageId: string | null =
          createPostDto.thumbnailImageId || null;

        // 썸네일 설정 로깅
        if (thumbnailImageId) {
          this.logger.log(
            `[PostCreator] Using provided thumbnailImageId: ${thumbnailImageId}`,
          );
        } else {
          this.logger.log(
            `[PostCreator] No thumbnailImageId provided - will auto-detect from content after post creation`,
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
          visibility,
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
          `[PostCreator] Post saved - ID: ${savedPost.id}, Tags: ${JSON.stringify(savedPost.tags)}, Input Tags: ${JSON.stringify(createPostDto.tags)}`,
        );

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

        const metadata = this.postMetadataSyncService.syncShadowFromPost(
          savedPost,
          manager.create(PostMetadata, {
            postId: savedPost.id,
            wordCount: readingStats.wordCount,
            readingTimeMinutes: readingStats.readingTimeMinutes,
            lastEditedAt: new Date(),
            editCount: 0,
          }),
        );

        metadata.excerpt = excerpt;
        metadata.wordCount = readingStats.wordCount;
        metadata.readingTimeMinutes = readingStats.readingTimeMinutes;
        metadata.lastEditedAt = new Date();
        metadata.editCount = 0;
        metadata.githubUrl = githubUrl;
        metadata.githubDescription = githubDescription;
        await manager.save(metadata);

        if (savedPost.isPublished) {
          await this.postSearchVectorService.syncSearchVector(
            savedPost.id,
            savedPost,
            manager,
          );
          savedPost.indexedAt = new Date();
          this.logger.debug(
            `[PostCreator] Search vector synced for post: ${savedPost.id}`,
          );
        }

        // Debug: 저장된 메타데이터의 태그 확인
        this.logger.debug(
          `[PostCreator] Metadata saved - PostId: ${savedPost.id}, Metadata Tags: ${JSON.stringify(metadata.tags)}`,
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
            `[PostCreator] Linked ${files.length} files to post ${savedPost.id}`,
          );
        }

        // 10. 라이프사이클 이벤트 버퍼 (커밋 후 발행)
        eventBuffer.add(PostLifecycleEvents.CREATED, {
          postId: savedPost.id,
          blogId: blog.id,
          blogSlug: blog.slug,
          authorId: author.id,
          isPublished,
          title: savedPost.title,
          tags: savedPost.tags,
          category: savedPost.category,
        } as PostLifecyclePayload);

        this.logger.log(
          `Post created successfully: ${savedPost.id} (slug: ${savedPost.slug}, published: ${isPublished})`,
        );

        // blog 관계 로드 (MCP와 같은 API에서 blog 정보가 필요한 경우)
        const postWithBlog = await manager.findOne(Post, {
          where: { id: savedPost.id },
          relations: ["blog"],
        });

        return postWithBlog || savedPost; // blog 관계 로드 실패 시 원본 post 반환
      },
    );

    // 발행 포스트는 응답 전에 핵심 피드 캐시를 선제 무효화한다.
    if (result.isPublished) {
      try {
        await this.cacheService.invalidatePostCache(
          result.id,
          result.blog?.slug,
        );
        if (result.blog?.id) {
          await this.cacheService.deletePattern(
            `feed:blog:${result.blog.id}:page:*`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `[PostCreator] Synchronous cache invalidation failed: ${message}`,
        );
      }
    }

    // 트랜잭션 커밋 성공 후 이벤트 발행 (best-effort)
    eventBuffer.flush(this.eventEmitter, this.logger);
    return result;
  }
}
