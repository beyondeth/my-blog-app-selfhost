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
import { PostMetadata } from "../entities/post-metadata.entity";
import { User } from "../../users/entities/user.entity";
import { File } from "../../files/entities/file.entity";
import { Role } from "../../common/enums/role.enum";
import { UpdatePostDto } from "../dto/update-post.dto";
import { PostContentService } from "./post-content.service";
import { PostFileService } from "./post-file.service";
import { PostCacheService } from "./post-cache.service";
import { CacheInvalidationEvents } from "../../common/events/cache.events";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UrlSanitizerUtil } from "../../common/utils/url-sanitizer.util";
import { TransactionEventBuffer } from "../../common/utils/transaction-event-buffer";
import {
  PostLifecycleEvents,
  PostLifecyclePayload,
} from "../events/post-lifecycle.events";
import { CacheService, CacheKeys } from "../../cache/cache.service";
import { PostMetadataSyncService } from "./post-metadata-sync.service";
import { PostSearchVectorService } from "./post-search-vector.service";

/**
 * 포스트 수정 전담 서비스
 *
 * 책임:
 * - 포스트 수정 (내용, 메타데이터)
 * - Editor's Pick 관리
 * - 썸네일 설정
 * - 콘텐츠 재렌더링
 * - 버전 관리 및 낙관적 잠금
 *
 * ⚠️ 캐시 무효화:
 * 기본은 CacheInvalidationListener가 PostLifecycleEvents 구독으로 처리.
 * 수정 직후 상세/피드 반영 지연을 줄이기 위해 응답 전에 핵심 캐시를 동기 정리한다.
 */
@Injectable()
export class PostUpdater {
  private readonly logger = new Logger(PostUpdater.name);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(PostMetadata)
    private readonly postMetadataRepository: Repository<PostMetadata>,
    private readonly postContentService: PostContentService,
    private readonly postFileService: PostFileService,
    private readonly postCacheService: PostCacheService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    private readonly postMetadataSyncService: PostMetadataSyncService,
    private readonly postSearchVectorService: PostSearchVectorService,
  ) {}

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
    const eventBuffer = new TransactionEventBuffer();

    const result = await this.dataSource
      .transaction(async (manager: EntityManager) => {
        this.logger.log(`Updating post: ${id} by user: ${user.id}`);

        // 1. 포스트 조회 (잠금 포함)
        let post: Post | null = null;
        if (typeof updatePostDto.version === "number") {
          this.logger.debug(
            `[PostUpdater] Applying optimistic lock for post ${id} with version ${updatePostDto.version}`,
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
              forceMarkdown: hasMarkdownUpdate,
            },
          );

          let htmlToPersist = processedContent.html;
          if (!hasMarkdownUpdate && htmlToPersist) {
            htmlToPersist = htmlToPersist.replace(
              /\s+data-image-id=["'][^"']*["']/g,
              "",
            );
            this.logger.debug(
              `[PostUpdater] Cleaned invalid data-image-id attributes from HTML update`,
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
                `[PostUpdater] Found thumbnail candidate during update - PostMapperService will handle assignment`,
              );
            }
          }

          post.excerpt = this.postContentService.extractExcerpt(rawInput);

          const metadata = this.postMetadataSyncService.ensureMetadata(
            post.id,
            post.metadata,
          );
          const readingTime =
            this.postContentService.calculateReadingTime(rawInput);
          metadata.wordCount = readingTime.wordCount;
          metadata.readingTimeMinutes = readingTime.readingTimeMinutes;
          metadata.lastEditedAt = new Date();
          metadata.editCount = (metadata.editCount || 0) + 1;
          post.metadata = metadata;
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

        if (updatePostDto.visibility !== undefined) {
          post.visibility =
            updatePostDto.visibility === "private" ? "private" : "public";
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
          } else if (!updatePostDto.isPublished) {
            post.status = "draft";
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
            `[PostUpdater] Calling PostFileService.setThumbnail for postId=${id}, thumbnailImageId=${updatePostDto.thumbnailImageId}`,
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

        post.metadata = this.postMetadataSyncService.syncShadowFromPost(
          post,
          post.metadata,
        );
        await manager.save(post.metadata);

        // 11. 저장
        const updatedPost = await manager.save(post);

        if (updatedPost.isPublished && updatedPost.status === "published") {
          await this.postSearchVectorService.syncSearchVector(
            updatedPost.id,
            updatedPost,
            manager,
          );
          updatedPost.indexedAt = new Date();
          if (post.metadata) {
            post.metadata.indexedAt = updatedPost.indexedAt;
          }
        }

        // 12. 파일 처리
        // update 경로에서도 attachedFileIds를 실제 파일 관계와 동기화해
        // 수정 페이지 재진입 시 첨부 목록/썸네일 후보가 일관되게 유지되도록 한다.
        let filesToSync = files;
        if (!filesToSync && updatePostDto.attachedFileIds !== undefined) {
          filesToSync = await this.loadFilesByIds(
            updatePostDto.attachedFileIds,
            user.id,
            manager,
          );
        }

        if (filesToSync || updatePostDto.attachedFileIds !== undefined) {
          const fileIds = (filesToSync || []).map((f) => f.id);
          await this.postFileService.unlinkUnusedFiles(id, user.id, fileIds);
          await this.postFileService.linkFilesFromContent(updatedPost, user.id);

          // 첨부 파일 동기화 이후 썸네일 파일이 더 이상 유지 목록에 없으면
          // 고아 thumbnailImageId를 제거해 상세/피드 상태를 일치시킨다.
          if (
            post.thumbnailImageId &&
            !fileIds.includes(post.thumbnailImageId)
          ) {
            this.logger.log(
              `[PostUpdater] Clearing orphan thumbnailImageId for postId=${id}, thumbnailImageId=${post.thumbnailImageId}`,
            );
            post.thumbnailImageId = null;
            await manager.save(post);
          }
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

        // 14. 라이프사이클 이벤트 버퍼 (커밋 후 발행)
        let publishStateChanged: "published" | "unpublished" | null = null;
        if (!wasPublished && willBePublished) {
          publishStateChanged = "published";
        } else if (wasPublished && !willBePublished) {
          publishStateChanged = "unpublished";
        }

        eventBuffer.add(PostLifecycleEvents.UPDATED, {
          postId: updatedPost.id,
          blogId: post.blogId,
          blogSlug: post.blog?.slug,
          authorId: user.id,
          publishStateChanged,
          title: updatedPost.title,
          tags: updatedPost.tags,
          category: updatedPost.category,
        } as PostLifecyclePayload);

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
        }

        return finalPost || updatedPost;
      })
      .catch((error) => {
        eventBuffer.clear();
        if (error instanceof OptimisticLockVersionMismatchError) {
          throw new ConflictException(
            "포스트가 다른 사용자에 의해 수정되었습니다. 새로고침 후 다시 시도해주세요.",
          );
        }
        throw error;
      });

    // 수정 직후 stale 상세/피드가 재노출되지 않도록 응답 전에 핵심 캐시를 선제 무효화한다.
    try {
      await Promise.all([
        this.cacheService.del(CacheKeys.POST_CORE(result.id)),
        this.cacheService.del(CacheKeys.POST_BY_SLUG(result.slug)),
      ]);

      if (result.isPublished) {
        await this.cacheService.invalidatePostCache(
          result.id,
          result.blog?.slug,
        );
        if (result.blog?.id) {
          await this.cacheService.deletePattern(
            `feed:blog:${result.blog.id}:page:*`,
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[PostUpdater] Synchronous cache invalidation failed: ${message}`,
      );
    }

    // 트랜잭션 커밋 성공 후 이벤트 발행 (best-effort)
    eventBuffer.flush(this.eventEmitter, this.logger);
    return result;
  }

  private async loadFilesByIds(
    fileIds: string[],
    userId: string,
    manager: EntityManager,
  ): Promise<File[]> {
    const requestedIds = Array.from(
      new Set((fileIds || []).filter((id): id is string => Boolean(id))),
    );

    if (requestedIds.length === 0) {
      return [];
    }

    const files = await manager.find(File, {
      where: {
        id: In(requestedIds),
        userId,
      },
    });

    if (files.length !== requestedIds.length) {
      const foundIds = new Set(files.map((file) => file.id));
      const missingIds = requestedIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `${missingIds.length}개의 파일을 찾을 수 없거나 권한이 없습니다.`,
      );
    }

    return files;
  }

  /**
   * Editor's Pick 설정 (관리자용)
   */
  async setEditorPick(
    postId: string,
    isEditorPick: boolean,
    user: User,
  ): Promise<void> {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        "관리자만 Editor's Pick을 설정할 수 있습니다.",
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const post = await queryRunner.manager.findOne(Post, {
        where: { id: postId },
      });
      if (!post) {
        throw new NotFoundException("포스트를 찾을 수 없습니다.");
      }

      // 1. PostMetadata 엔티티 업데이트
      let metadata = await queryRunner.manager.findOne(PostMetadata, {
        where: { postId },
      });

      if (!metadata) {
        metadata = queryRunner.manager.create(PostMetadata, {
          postId,
          isEditorPick,
          editorPickedAt: isEditorPick ? new Date() : null,
        });
        await queryRunner.manager.save(metadata);
      } else {
        await queryRunner.manager.update(
          PostMetadata,
          { postId },
          {
            isEditorPick: isEditorPick,
            editorPickedAt: isEditorPick ? new Date() : null,
          },
        );
      }

      // 2. Post 엔티티 업데이트 (동기화)
      await queryRunner.manager.update(
        Post,
        { id: postId },
        {
          isEditorPick: isEditorPick,
          editorPickedAt: isEditorPick ? new Date() : null,
        },
      );

      // 3. FIFO: Editor's Pick 제한 (최대 5개)
      if (isEditorPick) {
        const currentPicks = await queryRunner.manager.find(PostMetadata, {
          where: { isEditorPick: true },
          order: { editorPickedAt: "DESC" },
        });

        if (currentPicks.length > 5) {
          const picksToRemove = currentPicks.slice(5);
          for (const pick of picksToRemove) {
            await queryRunner.manager.update(
              PostMetadata,
              { postId: pick.postId },
              {
                isEditorPick: false,
                editorPickedAt: null,
              },
            );
            await queryRunner.manager.update(
              Post,
              { id: pick.postId },
              {
                isEditorPick: false,
                editorPickedAt: null,
              },
            );
            this.logger.log(
              `Removed oldest Editor's Pick: ${pick.postId} (limit exceeded)`,
            );
          }
        }
      }

      await queryRunner.commitTransaction();

      // Editor's Pick 캐시 무효화 이벤트 발행
      this.eventEmitter.emit(CacheInvalidationEvents.POST_EDITOR_PICK_TOGGLED, {
        postId,
        isPicked: isEditorPick,
      });

      // POST_EDITOR_PICK_TOGGLED 이벤트가 이미 발행되므로 별도 캐시 무효화 불필요
      // (CacheInvalidationListener + PostCacheService에서 처리)

      this.logger.log(
        `Set Editor's Pick for post: ${postId} to ${isEditorPick}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to set editor pick for post ${postId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Editor's Pick 순서 업데이트 (관리자용)
   */
  async updateEditorPicksOrder(
    orderedIds: string[],
    user: User,
  ): Promise<void> {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        "관리자만 Editor's Pick 순서를 변경할 수 있습니다.",
      );
    }

    const uniqueIds = Array.from(new Set(orderedIds));
    if (uniqueIds.length === 0 || uniqueIds.length > 5) {
      throw new BadRequestException(
        "Editor's Pick 순서는 1~5개 범위로 설정해야 합니다.",
      );
    }

    const metadataList = await this.postMetadataRepository.find({
      where: { postId: In(uniqueIds), isEditorPick: true },
    });

    if (metadataList.length !== uniqueIds.length) {
      throw new BadRequestException(
        "Editor's Pick 상태가 아닌 포스트가 포함되어 있습니다.",
      );
    }

    const metadataMap = new Map(
      metadataList.map((metadata) => [metadata.postId, metadata]),
    );
    const baseTime = Date.now();

    const updatedMetadata = uniqueIds.map((postId, index) => {
      const metadata = metadataMap.get(postId);
      if (!metadata) {
        throw new NotFoundException("포스트 메타데이터를 찾을 수 없습니다.");
      }
      metadata.editorPickedAt = new Date(baseTime - index * 1000);
      return metadata;
    });

    await this.postMetadataRepository.save(updatedMetadata);
    await this.postCacheService.invalidateEditorPicksCache();

    this.logger.log(
      `Updated Editor's Pick order for ${uniqueIds.length} posts`,
    );
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

    // 캐시 무효화
    this.eventEmitter.emit(CacheInvalidationEvents.POST_UPDATED, {
      postId,
      changes: { content: true },
    });

    return result;
  }
}
