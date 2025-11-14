import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, OptimisticLockVersionMismatchError } from 'typeorm';
import { Post } from '../entities/post.entity';
import { PostStats } from '../entities/post-stats.entity';
import { PostMetadata } from '../entities/post-metadata.entity';
import { User } from '../../users/entities/user.entity';
import { Blog } from '../../blogs/entities/blog.entity';
import { File } from '../../files/entities/file.entity';
import { Role } from '../../common/enums/role.enum';
import { CreatePostDto } from '../dto/create-post.dto';
import { UpdatePostDto } from '../dto/update-post.dto';
// import { extractImageUrlsFromContent } from '../utils/post.utils'; // 사용하지 않음
import { PostContentService } from './post-content.service';
import { PostFileService } from './post-file.service';
import { PostCacheService } from './post-cache.service';
// import { CacheInvalidationEvents } from '../../common/events/cache.events'; // 사용하지 않음
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { POST_PROCESSING_QUEUE, PostProcessingJobData } from '../queues/post-processing.queue';
import { BlogStatsService } from '../../common/services/blog-stats.service';

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
  ) {}

  /**
   * 새 포스트 생성
   *
   * @param createPostDto 생성 데이터
   * @param author 작성자
   * @param files 첨부 파일들
   * @returns 생성된 포스트
   */
  async create(
    createPostDto: CreatePostDto,
    author: User,
    files?: File[]
  ): Promise<Post> {
    // CreatePostDto의 isPublished 값 사용 (기본값: true - 자동 발행)
    // isPublished 값이 명시적으로 전달되지 않으면 true로 처리
    const isPublished = createPostDto.isPublished !== false;
    return await this.createPost(createPostDto, author, files, isPublished);
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
    isPublished: boolean = false
  ): Promise<Post> {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      this.logger.log(`Creating new post for user: ${author.id}`);

      // 1. 블로그 확인
      const blog = await manager.findOne(Blog, {
        where: { userId: author.id },
      });

      if (!blog) {
        throw new NotFoundException('블로그를 찾을 수 없습니다.');
      }

      // 2. slug은 Post 엔티티의 @BeforeInsert 훅에서 자동 생성됨

      // 3. 포스트 콘텐츠 처리
      // content_markdown을 우선적으로 사용, 없으면 content 사용
      const rawContent = createPostDto.content_markdown || createPostDto.content || '';

      // Debug: 콘텐츠 처리 로깅
      this.logger.debug(`[Post Content Processing]`, {
        postId: 'pending',
        hasContent_markdown: !!createPostDto.content_markdown,
        hasContent: !!createPostDto.content,
        rawContentLength: rawContent.length,
        contentType: createPostDto.content_markdown ? 'markdown' : 'html'
      });

      const processedContent = await this.postContentService.processContent(
        rawContent,
        {
          sanitize: true,
          processCode: true,
          processImages: true,
          preserveMermaid: true,
        }
      );

      // 4. 썸네일 추출
      const thumbnail = this.postContentService.extractThumbnail(processedContent.html);

      // 5. 포스트 엔티티 생성
      const post = manager.create(Post, {
        title: createPostDto.title,
        // slug는 @BeforeInsert 훅에서 자동 생성됨
        content: processedContent.html,  // 처리된 HTML 콘텐츠 저장
        contentMarkdown: createPostDto.content_markdown,  // 원본 마크다운 저장
        excerpt: this.postContentService.extractExcerpt(rawContent),
        thumbnail: thumbnail || createPostDto.thumbnail,
        thumbnailImageId: createPostDto.thumbnailImageId,
        category: createPostDto.category,
        tags: createPostDto.tags || [],
        isPublished: isPublished,  // 파라미터로 받은 값 사용
        authorId: author.id,
        blogId: blog.id,
        contentType: createPostDto.content_markdown ? 'markdown' : 'html',
        version: 1,  // 명시적으로 초기 버전 설정
      });

      // 6. 발행 시간 설정
      if (isPublished) {
        post.publishedAt = new Date();
        post.status = 'published';
      } else {
        post.publishedAt = null;
        post.status = 'draft';
      }

      // 6. 포스트 저장 (search_vector는 null로 초기화)
      post.search_vector = null; // 트리거 방지를 위해 명시적으로 null 설정
      const savedPost = await manager.save(post);

      // Debug: 저장된 포스트의 태그 확인
      this.logger.debug(`[PostCreationService] Post saved - ID: ${savedPost.id}, Tags: ${JSON.stringify(savedPost.tags)}, Input Tags: ${JSON.stringify(createPostDto.tags)}`);

      // 6.1. 검색 벡터 업데이트 (트리거 없이 직접 처리)
      if (savedPost.title || savedPost.content) {
        const searchText = `${savedPost.title || ''} ${savedPost.content || ''}`.trim();
        if (searchText) {
          await manager.query(
            `UPDATE posts SET search_vector = to_tsvector('simple', $1) WHERE id = $2`,
            [searchText, savedPost.id]
          );
          this.logger.debug(`[PostCreationService] Search vector updated for post: ${savedPost.id}`);
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
      const contentForStats = createPostDto.content_markdown || createPostDto.content || '';
      const readingStats = this.postContentService.calculateReadingTime(contentForStats);
      const excerpt = this.postContentService.extractExcerpt(contentForStats);

      // Debug: PostMetadata 생성 데이터 로깅
      this.logger.debug(`[PostMetadata Creation]`, {
        postId: savedPost.id,
        category: createPostDto.category,
        tags: createPostDto.tags,
        excerptLength: excerpt.length,
        wordCount: readingStats.wordCount,
        readingTime: readingStats.readingTimeMinutes
      });

      const metadata = manager.create(PostMetadata, {
        postId: savedPost.id,
        category: createPostDto.category,  // 카테고리 저장
        tags: createPostDto.tags || [],  // 태그 저장
        excerpt: excerpt,  // 요약문 저장
        wordCount: readingStats.wordCount,
        readingTimeMinutes: readingStats.readingTimeMinutes,
        lastEditedAt: new Date(),
        editCount: 0,
      });
      await manager.save(metadata);

      // Debug: 저장된 메타데이터의 태그 확인
      this.logger.debug(`[PostCreationService] Metadata saved - PostId: ${savedPost.id}, Metadata Tags: ${JSON.stringify(metadata.tags)}`);

      // 9. 파일 연결 (있는 경우)
      if (files && files.length > 0) {
        await this.postFileService.linkFilesFromContent(savedPost, author.id);
      }

      // 10. 비동기 처리 작업 큐에 추가 (발행된 경우만)
      if (isPublished) {
        await this.postProcessingQueue.add(
          'process-published-post',
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
          }
        );
      }

      // 11. 블로그 통계 업데이트 (발행된 경우만)
      if (isPublished) {
        await this.blogStatsService.incrementPostCount(blog.id);
      }

      // 12. 캐시 무효화
      this.eventEmitter.emit('cache.posts.invalidate', {
        postId: savedPost.id,
        blogId: blog.id,
        isPublished: isPublished,
      });

      this.logger.log(`Post created successfully: ${savedPost.id} (slug: ${savedPost.slug}, published: ${isPublished})`);

      // blog 관계 로드 (MCP와 같은 API에서 blog 정보가 필요한 경우)
      const postWithBlog = await manager.findOne(Post, {
        where: { id: savedPost.id },
        relations: ['blog']
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
    files?: File[]
  ): Promise<Post> {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      this.logger.log(`Updating post: ${id} by user: ${user.id}`);

      // 1. 포스트 조회 (잠금 포함)
      const post = await manager.findOne(Post, {
        where: { id },
        relations: ['blog', 'stats', 'metadata'],
        lock: { mode: 'optimistic', version: updatePostDto.version },
      });

      if (!post) {
        throw new NotFoundException('포스트를 찾을 수 없습니다.');
      }

      // 2. 권한 확인
      if (post.authorId !== user.id && post.blog.userId !== user.id && user.role !== Role.ADMIN) {
        throw new ForbiddenException('수정 권한이 없습니다.');
      }

      // 3. 발행 상태 변경 처리
      const wasPublished = post.isPublished;
      const willBePublished = updatePostDto.isPublished !== undefined
        ? updatePostDto.isPublished
        : post.isPublished;

      // 4. 콘텐츠 업데이트
      if (updatePostDto.content !== undefined) {
        const processedContent = await this.postContentService.processContent(
          updatePostDto.content,
          {
            sanitize: true,
            processCode: true,
            processImages: true,
            preserveMermaid: true,
          }
        );

        const thumbnail = this.postContentService.extractThumbnail(processedContent.html);

        post.content = updatePostDto.content;
        post.thumbnail = thumbnail || post.thumbnail;
        post.excerpt = this.postContentService.extractExcerpt(updatePostDto.content);

        // 메타데이터 업데이트
        if (post.metadata) {
          const readingTime = this.postContentService.calculateReadingTime(updatePostDto.content);
          post.metadata.wordCount = readingTime.wordCount;
          post.metadata.readingTimeMinutes = readingTime.readingTimeMinutes;
          post.metadata.lastEditedAt = new Date();
          post.metadata.editCount = (post.metadata.editCount || 0) + 1;
          await manager.save(post.metadata);
        }
      }

      // 5. 기본 정보 업데이트
      if (updatePostDto.title !== undefined) {
        post.title = updatePostDto.title;
        // 제목이 변경되고 slug가 없거나 draft로 시작하는 경우만 새로 생성
        // 실제 slug는 @BeforeUpdate 훅에서 생성됨
      }

      if (updatePostDto.category !== undefined) {
        post.category = updatePostDto.category;
      }

      if (updatePostDto.tags !== undefined) {
        post.tags = updatePostDto.tags;
      }

      // 6. 발행 상태 변경
      if (updatePostDto.isPublished !== undefined && updatePostDto.isPublished !== post.isPublished) {
        post.isPublished = updatePostDto.isPublished;
        if (updatePostDto.isPublished && !post.publishedAt) {
          post.publishedAt = new Date();
          post.status = 'published';
        }
      }

      // 7. 썸네일 명시적 설정
      if (updatePostDto.thumbnail !== undefined) {
        post.thumbnail = updatePostDto.thumbnail;
      }

      // 8. Editor's Pick (관리자만)
      if (updatePostDto.isEditorPick !== undefined && user.role === Role.ADMIN) {
        post.isEditorPick = updatePostDto.isEditorPick;
        if (updatePostDto.isEditorPick) {
          post.editorPickedAt = new Date();
        } else {
          post.editorPickedAt = null;
        }
      }

      // 9. 버전 증가
      post.version = (post.version || 0) + 1;
      post.updatedAt = new Date();

      // 10. 저장
      const updatedPost = await manager.save(post);

      // 11. 파일 처리
      if (files) {
        const fileIds = files.map(f => f.id);
        await this.postFileService.unlinkUnusedFiles(id, user.id, fileIds);
        await this.postFileService.linkFilesFromContent(updatedPost, user.id);
      }

      // 12. 캐시 무효화
      this.eventEmitter.emit('cache.posts.invalidate', {
        postId: updatedPost.id,
        blogId: post.blogId,
        isPublished: updatedPost.isPublished,
      });

      // 13. 발행 상태 변경 이벤트
      if (!wasPublished && willBePublished) {
        await this.postProcessingQueue.add(
          'process-published-post',
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
          }
        );

        // 블로그 통계 업데이트
        await this.blogStatsService.incrementPostCount(post.blogId);
      } else if (wasPublished && !willBePublished) {
        // 발행 취소 시 통계 감소
        await this.blogStatsService.decrementPostCount(post.blogId);
      }

      this.logger.log(`Post updated successfully: ${updatedPost.id}`);
      return updatedPost;
    }).catch(error => {
      if (error instanceof OptimisticLockVersionMismatchError) {
        throw new ConflictException('포스트가 다른 사용자에 의해 수정되었습니다. 새로고침 후 다시 시도해주세요.');
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
        relations: ['blog', 'stats'],
      });

      if (!post) {
        throw new NotFoundException('포스트를 찾을 수 없습니다.');
      }

      // 2. 권한 확인
      if (post.authorId !== user.id && post.blog.userId !== user.id && user.role !== Role.ADMIN) {
        throw new ForbiddenException('삭제 권한이 없습니다.');
      }

      // 3. 이미 삭제된 포스트 확인
      if (post.isDeleted) {
        throw new BadRequestException('이미 삭제된 포스트입니다.');
      }

      // 4. 소프트 삭제
      await manager.update(Post, id, {
        isDeleted: true,
        deletedAt: new Date(),
        slug: `deleted-${post.slug}-${Date.now()}`, // slug 중복 방지
      });

      // 5. 블로그 통계 업데이트
      if (post.isPublished) {
        await this.blogStatsService.decrementPostCount(post.blogId);
      }

      // 6. 캐시 무효화
      this.eventEmitter.emit('cache.posts.invalidate', {
        postId: id,
        blogId: post.blogId,
        isPublished: post.isPublished,
        isDeleted: true,
      });

      // 7. 비동기 정리 작업
      await this.postProcessingQueue.add(
        'cleanup-deleted-post',
        {
          postId: id,
          blogId: post.blogId,
        } as PostProcessingJobData,
        {
          delay: 60000, // 1분 후 실행
          attempts: 1,
        }
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
        relations: ['blog'],
      });

      if (!post) {
        throw new NotFoundException('삭제된 포스트를 찾을 수 없습니다.');
      }

      // 2. 권한 확인
      if (post.authorId !== user.id && post.blog.userId !== user.id && user.role !== Role.ADMIN) {
        throw new ForbiddenException('복원 권한이 없습니다.');
      }

      // 3. slug 복원 (중복 확인)
      const originalSlug = post.slug.replace(/^deleted-/, '').split('-').slice(0, -1).join('-');
      const slugExists = await manager.findOne(Post, {
        where: { slug: originalSlug, isDeleted: false },
        select: ['id'],
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
      this.eventEmitter.emit('cache.posts.invalidate', {
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
      throw new ForbiddenException('관리자만 영구 삭제할 수 있습니다.');
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
  async saveDraft(
    createPostDto: CreatePostDto,
    author: User
  ): Promise<Post> {
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
      relations: ['blog'],
    });

    if (!post) {
      throw new NotFoundException('포스트를 찾을 수 없습니다.');
    }

    if (post.authorId !== user.id && post.blog.userId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('발행 권한이 없습니다.');
    }

    if (post.isPublished) {
      throw new BadRequestException('이미 발행된 포스트입니다.');
    }

    return this.update(
      id,
      { isPublished: true, version: post.version },
      user
    );
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
      relations: ['blog'],
    });

    if (!post) {
      throw new NotFoundException('포스트를 찾을 수 없습니다.');
    }

    if (post.authorId !== user.id && post.blog.userId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('발행 취소 권한이 없습니다.');
    }

    if (!post.isPublished) {
      throw new BadRequestException('발행되지 않은 포스트입니다.');
    }

    return this.update(
      id,
      { isPublished: false, version: post.version },
      user
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
    thumbnailFileId?: string
  ): Promise<{ success: boolean; thumbnailUrl?: string }> {
    return this.postFileService.setThumbnail(postId, userId, { thumbnailFileId });
  }

  /**
   * 포스트 내용 재렌더링
   *
   * @param postId 포스트 ID
   * @param user 사용자
   * @returns 재렌더링 결과
   */
  async rerenderContent(postId: string, user: User): Promise<{
    html: string;
    thumbnail: string | null;
  }> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      select: ['content', 'authorId'],
    });

    if (!post) {
      throw new NotFoundException('포스트를 찾을 수 없습니다.');
    }

    if (post.authorId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('권한이 없습니다.');
    }

    const result = await this.postContentService.rerenderMarkdown(postId, post.content);

    // 썸네일 업데이트
    if (result.thumbnail !== null) {
      await this.postsRepository.update(postId, {
        thumbnail: result.thumbnail,
      });
    }

    // 캐시 무효화
    this.eventEmitter.emit('cache.posts.invalidate', {
      postId,
    });

    return result;
  }
}