import { Injectable, NotFoundException, ForbiddenException, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, SelectQueryBuilder, MoreThan } from 'typeorm';
import { OptimisticLockException } from '../common/exceptions/optimistic-lock.exception';
import { Post } from './entities/post.entity';
import { PostStats } from './entities/post-stats.entity';
import { PostMetadata } from './entities/post-metadata.entity';
import { User } from '../users/entities/user.entity';
import { File } from '../files/entities/file.entity';
import { FileContext, FileContextType, FilePurpose } from '../files/entities/file-context.entity';
import { Blog } from '../blogs/entities/blog.entity';
import { Role } from '../common/enums/role.enum';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { SetThumbnailDto } from './dto/set-thumbnail.dto';
import { GetPostsCursorDto } from './dto/get-posts-cursor.dto';
import { CursorPaginatedPostsDto } from './dto/cursor-paginated-posts.dto';
import { FilesService } from '../files/files.service';
import { CdnService } from '../files/services/cdn.service';
import { extractImageUrlsFromContent, extractS3KeyFromUrl, generateSlug } from './utils/post.utils';
import { MarkdownRendererService } from '../common/services/markdown-renderer.service';
import { ContentProcessingService } from '../content-processing/services/content-processing.service';
import { PostResponseDto } from './dto/post-response.dto';
import { CacheService, CacheKeys, CacheTTL } from '../cache/cache.service';
import { CacheMetricsService } from '../metrics/cache-metrics.service';
import { BookmarksService } from '../bookmarks/bookmarks.service';
import { LikeService } from './services/like.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { POST_PROCESSING_QUEUE, PostProcessingJobData } from './queues/post-processing.queue';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisLockService } from '../redis/redis-lock.service';
import { CacheInvalidationEvents } from '../common/events/cache.events';
import { PostMapperService } from './services/post-mapper.service';
import { PostCacheService } from './services/post-cache.service';
import { PostFileService } from './services/post-file.service';
import { PostContentService } from './services/post-content.service';
import { PostReadService } from './services/post-read.service';
import { PostInteractionService } from './services/post-interaction.service';
import { PostCreationService } from './services/post-creation.service';

/**
 * PostsService - Facade Pattern
 *
 * 모든 포스트 관련 작업을 적절한 서비스로 위임하는 퍼사드 역할
 * - PostCreationService: 생성, 수정, 삭제
 * - PostReadService: 조회, 검색
 * - PostInteractionService: 좋아요, 북마크, 조회수
 * - PostMapperService: DTO 변환
 * - PostCacheService: 캐시 관리
 * - PostFileService: 파일 관리
 * - PostContentService: 콘텐츠 처리
 */
@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectRepository(Post)
    private postsRepository: Repository<Post>,
    @InjectRepository(PostStats)
    private postStatsRepository: Repository<PostStats>,
    @InjectRepository(File)
    private filesRepository: Repository<File>,
    @InjectRepository(FileContext)
    private fileContextRepository: Repository<FileContext>,
    @InjectRepository(Blog)
    private blogsRepository: Repository<Blog>,
    private filesService: FilesService,
    private cdnService: CdnService,
    private markdownRenderer: MarkdownRendererService,
    private contentProcessing: ContentProcessingService,
    private cacheService: CacheService,
    private cacheMetricsService: CacheMetricsService,
    private bookmarksService: BookmarksService,
    private likeService: LikeService,
    @InjectQueue(POST_PROCESSING_QUEUE)
    private postProcessingQueue: Queue<PostProcessingJobData>,
    private readonly eventEmitter: EventEmitter2,
    private readonly redisLockService: RedisLockService,
    private readonly postMapperService: PostMapperService,
    private readonly postCacheService: PostCacheService,
    private readonly postFileService: PostFileService,
    private readonly postContentService: PostContentService,
    private readonly postReadService: PostReadService,
    private readonly postInteractionService: PostInteractionService,
    private readonly postCreationService: PostCreationService,
  ) {}

  // ========== CRUD Operations (PostCreationService로 위임) ==========

  /**
   * 새 포스트 생성
   */
  async create(createPostDto: CreatePostDto, user: User, files?: File[]): Promise<PostResponseDto> {
    this.logger.log(`Creating post for user: ${user.id}`);

    const post = await this.postCreationService.create(createPostDto, user, files);

    // 생성된 포스트를 DTO로 변환
    return await this.postMapperService.toPostDto(post, {
      user: user,
      blog: post.blog,
    });
  }

  /**
   * 빠른 포스트 생성 (MCP용)
   */
  async createFast(createPostDto: CreatePostDto, user: User): Promise<PostResponseDto> {
    this.logger.log(`Fast creating post for user: ${user.id}`);

    // 기본적으로 create와 동일하지만, 최적화된 경로 사용
    return await this.create(createPostDto, user);
  }

  /**
   * 포스트 수정
   */
  async update(id: string, updatePostDto: UpdatePostDto, user: User, files?: File[]): Promise<PostResponseDto> {
    this.logger.log(`Updating post: ${id} by user: ${user.id}`);

    const post = await this.postCreationService.update(id, updatePostDto, user, files);

    // 수정된 포스트를 DTO로 변환
    return await this.postMapperService.toPostDto(post, {
      user: user,
      blog: post.blog,
    });
  }

  /**
   * 포스트 삭제 (소프트 삭제)
   */
  async delete(id: string, user: User): Promise<void> {
    this.logger.log(`Deleting post: ${id} by user: ${user.id}`);
    return await this.postCreationService.delete(id, user);
  }

  /**
   * 포스트 복원
   */
  async restore(id: string, user: User): Promise<PostResponseDto> {
    this.logger.log(`Restoring post: ${id} by user: ${user.id}`);

    const post = await this.postCreationService.restore(id, user);

    return await this.postMapperService.toPostDto(post, {
      user: user,
      blog: post.blog,
    });
  }

  /**
   * 포스트 발행
   */
  async publish(id: string, user: User): Promise<PostResponseDto> {
    this.logger.log(`Publishing post: ${id} by user: ${user.id}`);

    const post = await this.postCreationService.publish(id, user);

    return await this.postMapperService.toPostDto(post, {
      user: user,
      blog: post.blog,
    });
  }

  /**
   * 발행 취소
   */
  async unpublish(id: string, user: User): Promise<PostResponseDto> {
    this.logger.log(`Unpublishing post: ${id} by user: ${user.id}`);

    const post = await this.postCreationService.unpublish(id, user);

    return await this.postMapperService.toPostDto(post, {
      user: user,
      blog: post.blog,
    });
  }

  /**
   * 초안 저장
   */
  async saveDraft(createPostDto: CreatePostDto, author: User): Promise<PostResponseDto> {
    this.logger.log(`Saving draft for user: ${author.id}`);

    const post = await this.postCreationService.saveDraft(createPostDto, author);

    return await this.postMapperService.toPostDto(post, {
      user: author,
      blog: post.blog,
    });
  }

  // ========== Read Operations (PostReadService로 위임) ==========

  /**
   * slug로 포스트 조회
   */
  async findBySlug(slug: string, user?: User): Promise<PostResponseDto> {
    this.logger.debug(`Finding post by slug: ${slug}`);
    return await this.postReadService.findBySlug(slug, user);
  }

  /**
   * 커서 기반 포스트 목록 조회
   */
  async getPostsCursor(query: GetPostsCursorDto, user?: User): Promise<CursorPaginatedPostsDto> {
    this.logger.debug(`Getting posts cursor with query: ${JSON.stringify(query)}`);
    return await this.postReadService.getPostsCursor(query, user);
  }

  /**
   * 기간별 인기 포스트 조회
   */
  async findPopularPosts(period: 'daily' | 'weekly' | 'monthly' | 'all' = 'weekly', limit: number = 10): Promise<PostResponseDto[]> {
    this.logger.debug(`Finding popular posts by period: ${period}, limit: ${limit}`);

    // 인기 포스트 조회 (Materialized View 사용)
    const posts = await this.postReadService.findPopularPosts(period, limit);

    // Post 엔티티를 DTO로 변환
    const dtos: PostResponseDto[] = [];
    for (const post of posts) {
      const dto = await this.postMapperService.toPostDto(post);
      dtos.push(dto);
    }

    return dtos;
  }

  /**
   * Editor's Pick 포스트 조회
   */
  async findEditorPicks(limit: number = 10): Promise<PostResponseDto[]> {
    this.logger.debug(`Getting Editor's Pick posts, limit: ${limit}`);

    const posts = await this.postReadService.getEditorPicks(limit);

    // PostResponseDto로 변환
    const dtos = await Promise.all(
      posts.map(post => this.postMapperService.toPostDto(post))
    );

    return dtos;
  }

  /**
   * 카테고리 목록 조회
   */
  async getCategories(): Promise<string[]> {
    this.logger.debug(`Getting categories`);
    return await this.postReadService.getCategories();
  }

  /**
   * 인기 태그 조회
   */
  async getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    this.logger.debug(`Getting popular tags, limit: ${limit}`);
    return await this.postReadService.getPopularTags(limit);
  }

  // ========== Interaction Operations (PostInteractionService로 위임) ==========

  /**
   * 좋아요 토글
   */
  async toggleLike(postId: string, user: User): Promise<{ liked: boolean; likeCount: number }> {
    this.logger.debug(`Toggling like for post: ${postId} by user: ${user.id}`);

    // LikeService를 사용하여 좋아요 토글 실행
    return await this.likeService.toggleLike(postId, user.id);
  }

  /**
   * 조회수 증가
   */
  async incrementViewCount(postId: string, user?: User): Promise<void> {
    this.logger.debug(`Incrementing view count for post: ${postId}`);
    await this.postInteractionService.incrementView(postId, user?.id);
  }

  /**
   * 북마크 토글
   */
  async toggleBookmark(postId: string, user: User): Promise<{ bookmarked: boolean }> {
    this.logger.debug(`Toggling bookmark for post: ${postId} by user: ${user.id}`);

    // 현재 북마크 상태 확인
    const currentlyBookmarked = await this.postInteractionService.getUserBookmarkStatus(postId, user.id);

    if (currentlyBookmarked) {
      // 북마크 삭제
      await this.bookmarksService.remove(user.id, postId);
      return { bookmarked: false };
    } else {
      // 북마크 추가
      await this.bookmarksService.toggle(user.id, postId);
      return { bookmarked: true };
    }
  }

  /**
   * 포스트 상호작용 정보 조회
   */
  async getPostInteractions(postId: string, user?: User): Promise<{
    viewCount: number;
    likeCount: number;
    commentCount: number;
    liked?: boolean;
    bookmarked?: boolean;
  }> {
    this.logger.debug(`Getting interactions for post: ${postId}`);

    const stats = await this.postInteractionService.getInteractionStats(postId);
    const result: any = {
      viewCount: stats.totalViews,
      likeCount: stats.totalLikes,
      commentCount: stats.totalComments,
    };

    if (user) {
      result.liked = await this.likeService.isLiked(postId, user.id);
      result.bookmarked = await this.postInteractionService.getUserBookmarkStatus(postId, user.id);
    }

    return result;
  }

  // ========== File Operations (PostFileService로 위임) ==========

  /**
   * 썸네일 설정
   */
  async setThumbnail(postId: string, userIdOrThumbnail: string | User, thumbnailFileId?: string | SetThumbnailDto): Promise<{ success: boolean; thumbnailUrl?: string }> {
    this.logger.debug(`Setting thumbnail for post: ${postId}`);

    // 오버로드 처리: 첫 번째 파라미터가 string이면 userId, User 객체이면 user
    if (typeof userIdOrThumbnail === 'string') {
      // 구래 방식: setThumbnail(postId, userId, thumbnailFileId)
      return await this.postFileService.setThumbnail(postId, userIdOrThumbnail, { thumbnailFileId: thumbnailFileId as string });
    } else {
      // 새 방식: setThumbnail(postId, user, setThumbnailDto)
      const user = userIdOrThumbnail as User;
      const dto = thumbnailFileId as SetThumbnailDto;
      return await this.postFileService.setThumbnail(postId, user.id, { thumbnailFileId: dto.thumbnailFileId });
    }
  }

  /**
   * 포스트 썸네일 제거
   */
  async removeThumbnail(postId: string, user: User): Promise<{ success: boolean }> {
    this.logger.debug(`Removing thumbnail for post: ${postId}`);

    const post = await this.postsRepository.findOne({
      where: { id: postId, authorId: user.id },
    });

    if (!post) {
      throw new NotFoundException('포스트를 찾을 수 없거나 권한이 없습니다.');
    }

    await this.postsRepository.update(postId, {
      thumbnailImageId: null,
      thumbnail: null,
    });

    return { success: true };
  }

  /**
   * 포스트에 연결된 파일 목록 조회
   */
  async getAttachedFiles(postId: string, user?: User): Promise<File[]> {
    this.logger.debug(`Getting attached files for post: ${postId}`);
    return await this.postFileService.getAttachedFiles(postId, user?.id);
  }

  // ========== Content Operations (PostContentService로 위임) ==========

  /**
   * 포스트 내용 재렌더링
   */
  async rerenderContent(postId: string, user: User): Promise<{
    html: string;
    thumbnail: string | null;
  }> {
    this.logger.debug(`Rerendering content for post: ${postId}`);
    return await this.postCreationService.rerenderContent(postId, user);
  }

  /**
   * 콘텐츠 미리보기 생성
   */
  async previewContent(content: string): Promise<{
    html: string;
    excerpt: string;
    thumbnail?: string;
    readingTime: number;
  }> {
    this.logger.debug(`Generating content preview`);
    const result = await this.postContentService.processContent(content, {
      sanitize: true,
      processCode: true,
      processImages: true,
      preserveMermaid: true,
    });

    const excerpt = this.postContentService.extractExcerpt(content);
    const { readingTimeMinutes } = this.postContentService.calculateReadingTime(content);
    const thumbnail = this.postContentService.extractThumbnail(result.html);

    return {
      html: result.html,
      excerpt,
      thumbnail: thumbnail || undefined,
      readingTime: readingTimeMinutes,
    };
  }

  // ========== Additional Methods for Controller Compatibility ==========

  /**
   * 모든 포스트 조회 (페이지네이션)
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    category?: string,
    blogId?: string,
    user?: User,
    isPublished?: boolean,
    isForCache?: boolean,
  ): Promise<any> {
    this.logger.debug(`Finding all posts with pagination: page=${page}, limit=${limit}`);

    const query: GetPostsCursorDto = {
      limit,
      category,
      search,
      blogId, // blogId 그대로 전달
    };

    if (isForCache) {
      // 캐시용은 liked/bookmarked 없이 조회
      return await this.postReadService.getPostsCursor(query);
    } else {
      return await this.postReadService.getPostsCursor(query, user);
    }
  }

  /**
   * 카테고리별 포스트 조회
   */
  async getPostsByCategory(category: string, page: number = 1, limit: number = 10): Promise<any> {
    this.logger.debug(`Getting posts by category: ${category}`);

    const query: GetPostsCursorDto = {
      limit,
      category,
    };

    return await this.postReadService.getPostsCursor(query);
  }

  /**
   * 포스트 이미지 조회
   */
  async getPostImages(postId: string): Promise<File[]> {
    this.logger.debug(`Getting post images for: ${postId}`);
    return await this.postFileService.getAttachedFiles(postId);
  }

  /**
   * 인기 태그 조회 (이미 있음)
   */
  // getPopularTags already implemented above

  /**
   * 포스트 삭제 (remove 메서드 별칭)
   */
  async remove(id: string, user: User): Promise<void> {
    return await this.delete(id, user);
  }

  /**
   * 누락된 slug 생성
   */
  async generateMissingSlugs(): Promise<void> {
    this.logger.log(`Generating missing slugs for posts`);

    // slug가 없는 포스트 조회
    const postsWithoutSlug = await this.postsRepository.find({
      where: { slug: '', isDeleted: false },
    });

    for (const post of postsWithoutSlug) {
      const newSlug = generateSlug(post.title);
      await this.postsRepository.update(post.id, { slug: newSlug });
    }

    this.logger.log(`Generated slugs for ${postsWithoutSlug.length} posts`);
  }

  /**
   * 콘텐츠 파일 재연결
   */
  async relinkContentFiles(): Promise<void> {
    this.logger.log(`Relinking content files for all posts`);

    const posts = await this.postsRepository.find({
      where: { isDeleted: false },
      relations: ['attachedFiles'],
    });

    await this.postFileService.relinkContentFiles(posts);

    this.logger.log(`Relinked content files for ${posts.length} posts`);
  }

  /**
   * Editor's Pick 토글
   */
  async toggleEditorPick(postId: string, user: User): Promise<{ success: boolean; isEditorPick: boolean }> {
    this.logger.log(`Toggling editor pick for post: ${postId}`);

    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('포스트를 찾을 수 없습니다.');
    }

    const newIsEditorPick = !post.isEditorPick;
    await this.setEditorPick(postId, newIsEditorPick, user);

    return { success: true, isEditorPick: newIsEditorPick };
  }

  /**
   * 사용자 카테고리 조회
   */
  async getUserCategories(userId: string): Promise<string[]> {
    this.logger.debug(`Getting categories for user: ${userId}`);

    // 사용자의 블로그 ID 조회
    const blog = await this.blogsRepository.findOne({ where: { userId } });
    if (!blog) {
      return [];
    }

    // 블로그의 카테고리별 포스트 개수 집계
    const result = await this.postsRepository
      .createQueryBuilder('post')
      .select('post.category', 'category')
      .addSelect('COUNT(post.id)', 'count')
      .where('post.blogId = :blogId', { blogId: blog.id })
      .andWhere('post.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('post.category IS NOT NULL')
      .andWhere('post.category != \'\'')
      .groupBy('post.category')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map(row => row.category);
  }

  /**
   * 사이트맵용 모든 발행된 포스트 조회
   */
  async getAllPublishedPostsForSitemap(): Promise<Array<{ slug: string; blogSlug: string; updatedAt: Date }>> {
    this.logger.debug(`Getting all published posts for sitemap`);

    const posts = await this.postsRepository.find({
      where: { isPublished: true, isDeleted: false },
      relations: ['blog'],
      select: ['id', 'slug', 'updatedAt', 'blog'],
      order: { updatedAt: 'DESC' },
    });

    // 필요한 형식으로 변환
    return posts.map(post => ({
      slug: post.slug,
      blogSlug: post.blog.slug,
      updatedAt: post.updatedAt,
    }));
  }

  /**
   * ID로 포스트 조회 (findOne)
   */
  async findOne(id: string, user?: User): Promise<PostResponseDto> {
    this.logger.debug(`Finding post by id: ${id}`);

    const post = await this.postReadService.findById(id, ['author', 'blog', 'stats']);
    if (!post) {
      throw new NotFoundException('포스트를 찾을 수 없습니다.');
    }

    return await this.postMapperService.toPostDto(post, { user });
  }

  /**
   * 댓글 수 증가
   */
  async incrementCommentCount(postId: string): Promise<void> {
    this.logger.debug(`Incrementing comment count for post: ${postId}`);
    // PostStats 테이블의 commentCount 증가
    await this.postStatsRepository.increment({ postId }, 'commentCount', 1);

    // 캐시 무효화
    await this.postCacheService.deletePostCache(postId);
  }

  /**
   * 댓글 수 감소
   */
  async decrementCommentCount(postId: string): Promise<void> {
    this.logger.debug(`Decrementing comment count for post: ${postId}`);
    // PostStats 테이블의 commentCount 감소 (음수 방지)
    await this.postStatsRepository
      .createQueryBuilder()
      .update(PostStats)
      .set({
        commentCount: () => `GREATEST(0, "commentCount" - 1)`
      })
      .where('postId = :postId', { postId })
      .execute();

    // 캐시 무효화
    await this.postCacheService.deletePostCache(postId);
  }

  // ========== Legacy Methods (하위 호환성용) ==========

  /**
   * @deprecated Use PostMapperService.toPostDto instead
   */
  async toPostDto(post: Post, options?: {
    liked?: boolean;
    bookmarked?: boolean;
    user?: User;
    blog?: Blog;
  }): Promise<PostResponseDto> {
    return await this.postMapperService.toPostDto(post, options);
  }

  /**
   * @deprecated Use PostCacheService.invalidateRelatedCache instead
   */
  private async invalidateRelatedCache(blogSlug: string, blogId?: string): Promise<void> {
    return await this.postCacheService.invalidateRelatedCache(blogSlug, blogId);
  }

  /**
   * @deprecated Use PostFileService.validatePostTotalSize instead
   */
  private async validatePostTotalSize(postId: string, userId: string): Promise<void> {
    // Find files attached to post
    const files = await this.postFileService.getAttachedFiles(postId, userId);
    return await this.postFileService.validatePostTotalSize(files, postId);
  }

  // ========== Admin Operations ==========

  /**
   * 포스트 영구 삭제 (관리자용)
   */
  async permanentDelete(id: string, user: User): Promise<void> {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('관리자만 영구 삭제할 수 있습니다.');
    }

    this.logger.log(`Permanently deleting post: ${id} by admin: ${user.id}`);
    return await this.postCreationService.permanentDelete(id, user);
  }

  /**
   * Editor's Pick 설정 (관리자용)
   */
  async setEditorPick(postId: string, isEditorPick: boolean, user: User): Promise<void> {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('관리자만 Editor\'s Pick을 설정할 수 있습니다.');
    }

    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('포스트를 찾을 수 없습니다.');
    }

    await this.postsRepository.update(postId, {
      isEditorPick,
      editorPickedAt: isEditorPick ? new Date() : null,
    });

    // Editor's Pick 캐시 무효화 이벤트 발행
    this.eventEmitter.emit(CacheInvalidationEvents.POST_EDITOR_PICK_TOGGLED, {
      postId,
      isPicked: isEditorPick,
    });

    // 기존 캐시 무효화
    this.eventEmitter.emit('cache.posts.invalidate', {
      postId,
      blogId: post.blogId,
      isPublished: post.isPublished,
    });

    this.logger.log(`Set Editor's Pick for post: ${postId} to ${isEditorPick}`);
  }

  // ========== Utility Methods ==========

  /**
   * 포스트 존재 여부 확인
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.postsRepository.count({ where: { id, isDeleted: false } });
    return count > 0;
  }

  /**
   * 포스트 접근 권한 확인
   */
  async checkAccessPermission(postId: string, user: User): Promise<{
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    isOwner: boolean;
    isAdmin: boolean;
  }> {
    const post = await this.postsRepository.findOne({
      where: { id: postId, isDeleted: false },
      relations: ['blog', 'author'],
    });

    if (!post) {
      return {
        canRead: false,
        canWrite: false,
        canDelete: false,
        isOwner: false,
        isAdmin: user.role === Role.ADMIN,
      };
    }

    const isOwner = post.authorId === user.id || post.blog.userId === user.id;
    const isAdmin = user.role === Role.ADMIN;

    return {
      canRead: true, // TODO: 비공개 포스트 logic 추가
      canWrite: isOwner || isAdmin,
      canDelete: isOwner || isAdmin,
      isOwner,
      isAdmin,
    };
  }

  /**
   * 포스트 통계 조회 (관리자용)
   */
  async getPostStats(options?: {
    startDate?: Date;
    endDate?: Date;
    blogId?: string;
  }): Promise<{
    totalPosts: number;
    publishedPosts: number;
    draftPosts: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
  }> {
    const query = this.postStatsRepository.createQueryBuilder('stats')
      .leftJoin('stats.post', 'post')
      .where('post.isDeleted = :isDeleted', { isDeleted: false });

    if (options?.startDate) {
      query.andWhere('post.createdAt >= :startDate', { startDate: options.startDate });
    }

    if (options?.endDate) {
      query.andWhere('post.createdAt <= :endDate', { endDate: options.endDate });
    }

    if (options?.blogId) {
      query.andWhere('post.blogId = :blogId', { blogId: options.blogId });
    }

    const result = await query
      .select('COUNT(DISTINCT post.id)', 'totalPosts')
      .addSelect('COUNT(CASE WHEN post.isPublished = true THEN 1 END)', 'publishedPosts')
      .addSelect('COUNT(CASE WHEN post.isPublished = false THEN 1 END)', 'draftPosts')
      .addSelect('SUM(stats.viewCount)', 'totalViews')
      .addSelect('SUM(stats.likeCount)', 'totalLikes')
      .addSelect('SUM(stats.commentCount)', 'totalComments')
      .getRawOne();

    return {
      totalPosts: parseInt(result.totalPosts, 10) || 0,
      publishedPosts: parseInt(result.publishedPosts, 10) || 0,
      draftPosts: parseInt(result.draftPosts, 10) || 0,
      totalViews: parseInt(result.totalViews, 10) || 0,
      totalLikes: parseInt(result.totalLikes, 10) || 0,
      totalComments: parseInt(result.totalComments, 10) || 0,
    };
  }
}