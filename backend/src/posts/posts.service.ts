import { Injectable, NotFoundException, ForbiddenException, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, SelectQueryBuilder, MoreThan, DataSource, EntityManager, OptimisticLockVersionMismatchError } from 'typeorm';
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
import { SetThumbnailDto } from './dto/set-thumbnail.dto';
import { GetPostsCursorDto } from './dto/get-posts-cursor.dto';
import { CursorPaginatedPostsDto } from './dto/cursor-paginated-posts.dto';
import { FilesService } from '../files/files.service';
import { CdnService } from '../files/services/cdn.service';
// TagsService removed - using JSONB tags
import { extractImageUrlsFromContent, extractS3KeyFromUrl, generateSlug } from './utils/post.utils';
import { MarkdownRendererService } from '../common/services/markdown-renderer.service';
import { ContentProcessingService } from '../content-processing/services/content-processing.service';
import { plainToInstance } from 'class-transformer';
import { PostResponseDto } from './dto/post-response.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { BlogResponseDto } from '../blogs/dto/blog-response.dto';
import { CacheService, CacheKeys, CacheTTL } from '../cache/cache.service';
import { CacheMetricsService } from '../metrics/cache-metrics.service';
import { BookmarksService } from '../bookmarks/bookmarks.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { POST_PROCESSING_QUEUE, PostProcessingJobData } from './queues/post-processing.queue';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisLockService } from '../redis/redis-lock.service';

/**
 * 포스트 Core 데이터 타입 (실시간 카운트/상태 제외)
 * 캐시에 저장되는 정적 데이터만 포함
 */
type PostCoreData = Omit<PostResponseDto, 'viewCount' | 'likeCount' | 'commentCount' | 'liked' | 'bookmarked'>;

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);
  private readonly MAX_POST_TOTAL_SIZE = 30 * 1024 * 1024; // 30MB
  private readonly MAX_FILES_PER_POST = 10; // Maximum 10 files per post

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
    private dataSource: DataSource,
    private cacheService: CacheService,
    private cacheMetricsService: CacheMetricsService,
    private bookmarksService: BookmarksService,
    @InjectQueue(POST_PROCESSING_QUEUE)
    private postProcessingQueue: Queue<PostProcessingJobData>,
    private readonly eventEmitter: EventEmitter2,
    private readonly redisLockService: RedisLockService,
  ) {}

  /**
   * DTO 변환 헬퍼 메서드들
   * @description
   * Entity를 Response DTO로 안전하게 변환
   * spread operator 사용 금지로 lazy loading 방지
   * class-transformer의 plainToInstance 활용
   */

  /**
   * Post Entity를 PostResponseDto로 변환
   * @param post - Post 엔티티
   * @param options - 추가 옵션 (liked 상태, tags 등)
   * @returns PostResponseDto
   */
  private toPostDto(
    post: Post,
    options?: {
      liked?: boolean;
      bookmarked?: boolean;
      user?: User;
      blog?: Blog;
    }
  ): PostResponseDto {
    // plainToInstance로 자동 변환 (@Expose 필드만 포함됨)
    const dto = plainToInstance(PostResponseDto, post, {
      excludeExtraneousValues: true, // @Expose가 없는 필드 제외
    });

    // 추가 필드 설정
    if (options) {
      if (options.liked !== undefined) {
        dto.liked = options.liked;
      }
      if (options.bookmarked !== undefined) {
        dto.bookmarked = options.bookmarked;
      }
      if (options.user) {
        dto.author = this.toUserDto(options.user);
      }
      if (options.blog) {
        dto.blog = this.toBlogDto(options.blog);
      }
    }

    // 날짜는 TypeORM이 자동으로 ISO 8601 문자열로 직렬화
    // formatDate() 제거 - 시간 정보 보존을 위해 ISO 문자열 그대로 반환

    // 태그 필드 호환성
    if (post.tags) {
      dto.tags = post.tags;
    }

    // 썸네일 URL 최적화
    if (dto.thumbnail) {
      dto.thumbnail = this.optimizeImageUrl(dto.thumbnail);
    }

    return dto;
  }

  /**
   * User Entity를 UserResponseDto로 변환
   * @param user - User 엔티티
   * @returns UserResponseDto
   */
  private toUserDto(user: User): UserResponseDto {
    if (!user) return null;

    // 포맷된 author 데이터 사용 (profile 평탄화 및 CDN URL 변환 적용)
    const formattedUser = this.formatAuthorData(user);

    const dto = plainToInstance(UserResponseDto, formattedUser, {
      excludeExtraneousValues: true,
    });

    return dto;
  }

  /**
   * Blog Entity를 BlogResponseDto로 변환
   * @param blog - Blog 엔티티
   * @returns BlogResponseDto
   */
  private toBlogDto(blog: Blog): BlogResponseDto {
    if (!blog) return null;

    const dto = plainToInstance(BlogResponseDto, blog, {
      excludeExtraneousValues: true,
    });

    // Manually assign alias to ensure it's included
    dto.alias = blog.alias; // <--- ADD THIS LINE

    return dto;
  }

  /**
   * 포스트의 실시간 Counts + liked/bookmarked 조회
   * 최적화: 단일 쿼리로 합침 (DB Round Trip 감소)
   */
  private async getPostCounts(postId: string, user?: User): Promise<{
    viewCount: number;
    likeCount: number;
    commentCount: number;
    liked: boolean;
    bookmarked: boolean;
  }> {
    if (!user) {
      // 비로그인 유저: Counts만 조회
      const post = await this.postsRepository.findOne({
        where: { id: postId },
        select: ['viewCount', 'likeCount', 'commentCount']
      });

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      return {
        viewCount: post.viewCount,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        liked: false,
        bookmarked: false,
      };
    }

    // 로그인 유저: 단일 쿼리로 모든 정보 조회
    const result = await this.postsRepository
      .createQueryBuilder('post')
      .select([
        'post.viewCount',
        'post.likeCount',
        'post.commentCount',
      ])
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(1)')
          .from('post_likes', 'pl')
          .where('pl.postId = :postId', { postId })
          .andWhere('pl.userId = :userId', { userId: user.id });
      }, 'userLiked')
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(1)')
          .from('bookmarks', 'b')
          .where('b.post_id = :postId', { postId })
          .andWhere('b.user_id = :userId', { userId: user.id });
      }, 'userBookmarked')
      .where('post.id = :postId', { postId })
      .getRawOne();

    if (!result) {
      throw new NotFoundException('Post not found');
    }

    return {
      viewCount: result.post_viewCount,
      likeCount: result.post_likeCount,
      commentCount: result.post_commentCount,
      liked: Number(result.userLiked) > 0,
      bookmarked: Number(result.userBookmarked) > 0,
    };
  }

  /**
   * UTC 시간을 로컬 timezone으로 해석되는 Date 객체 생성
   *
   * timestamp without time zone 컬럼에 UTC 시간을 저장하기 위한 헬퍼 메서드
   * PostgreSQL의 timestamp without time zone은 timezone 정보 없이 저장하므로,
   * pg 라이브러리가 로컬 시간을 그대로 저장함
   *
   * 예: UTC 12:07을 DB에 저장하려면, Date 객체의 로컬 표현이 12:07이어야 함
   *
   * @returns UTC 시간을 로컬 timezone으로 표현한 Date 객체
   */
  private getUtcAsLocalDate(): Date {
    const now = new Date();
    return new Date(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds()
    );
  }

  /**
   * 게시글 썸네일 설정/제거
   */
  async setThumbnail(postId: string, userId: string, setThumbnailDto: SetThumbnailDto) {
    const { thumbnailFileId } = setThumbnailDto;

    try {
      // 게시글 소유권 확인
      const post = await this.postsRepository.findOne({
        where: { id: postId, authorId: userId },
        relations: ['thumbnailImage'],
      });

      if (!post) {
        throw new NotFoundException('게시글을 찾을 수 없거나 권한이 없습니다.');
      }

      // 썸네일 제거
      if (!thumbnailFileId || thumbnailFileId === null) {
        post.thumbnailImageId = null;
        await this.postsRepository.save(post);
        
        this.logger.log(`Thumbnail removed for post ${postId}`);
        return {
          message: '썸네일이 제거되었습니다.',
          postId,
          thumbnailImageId: null,
        };
      }

      // 썸네일 파일 존재 및 소유권 확인
      const thumbnailFile = await this.filesRepository.findOne({
        where: { id: thumbnailFileId, userId },
      });

      if (!thumbnailFile) {
        throw new NotFoundException('썸네일 파일을 찾을 수 없거나 권한이 없습니다.');
      }

      // 이미지 파일인지 확인
      if (!thumbnailFile.mimeType.startsWith('image/')) {
        throw new BadRequestException('썸네일은 이미지 파일만 설정할 수 있습니다.');
      }

      // 썸네일 설정
      post.thumbnailImageId = thumbnailFileId;
      await this.postsRepository.save(post);

      this.logger.log(`Thumbnail set for post ${postId}, file: ${thumbnailFileId}`);
      
      return {
        message: '썸네일이 설정되었습니다.',
        postId,
        thumbnailImageId: thumbnailFileId,
        thumbnailFile: {
          id: thumbnailFile.id,
          fileName: thumbnailFile.fileName,
          fileKey: thumbnailFile.fileKey,
          mimeType: thumbnailFile.mimeType,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to set thumbnail: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 게시글의 이미지 목록 조회 (순서 포함)
   */
  async getPostImages(postId: string) {
    try {
      // 게시글이 존재하는지 확인
      const post = await this.postsRepository.findOne({ where: { id: postId } });
      if (!post) {
        throw new NotFoundException('게시글을 찾을 수 없습니다.');
      }

      // 게시글에 연결된 이미지 파일들을 순서대로 조회
      const images = await this.filesRepository
        .createQueryBuilder('file')
        .innerJoin('post_files', 'pf', 'pf."fileId" = file.id')
        .where('pf."postId" = :postId', { postId })
        .andWhere('file.mimeType LIKE :imageType', { imageType: 'image/%' })
        .select([
          'file.id',
          'file.fileName', 
          'file.originalName',
          'file.fileKey',
          'file.mimeType',
          'file.fileSize',
          'file.createdAt',
          'pf.image_order as imageOrder',
        ])
        .orderBy('COALESCE(pf.image_order, 999)', 'ASC') // 순서가 없는 경우 마지막에 배치
        .addOrderBy('pf.created_at', 'ASC') // 동일 순서인 경우 생성 순서
        .getRawMany();

      // 각 이미지에 대해 액세스 URL 생성 - Temporarily disabled
      const imagesWithUrls = await Promise.all(
        images.map(async (image) => {
          try {
            // Temporarily disabled FilesService
            // const accessUrl = await this.filesService.getDownloadUrl(image.file_id);
            const accessUrl = null; // Disabled for now
            return {
              id: image.file_id,
              fileName: image.file_fileName,
              originalName: image.file_originalName,
              fileKey: image.file_fileKey,
              mimeType: image.file_mimeType,
              fileSize: image.file_fileSize,
              imageOrder: image.imageorder || null,
              accessUrl,
              createdAt: image.file_createdAt,
            };
          } catch (error) {
            this.logger.warn(`Failed to generate access URL for image ${image.file_id}: ${error.message}`);
            return {
              id: image.file_id,
              fileName: image.file_fileName,
              originalName: image.file_originalName,
              fileKey: image.file_fileKey,
              mimeType: image.file_mimeType,
              fileSize: image.file_fileSize,
              imageOrder: image.imageorder || null,
              accessUrl: null,
              createdAt: image.file_createdAt,
            };
          }
        })
      );

      this.logger.log(`Retrieved ${imagesWithUrls.length} images for post ${postId}`);
      
      return imagesWithUrls;
    } catch (error) {
      this.logger.error(`Failed to get post images: ${error.message}`, error.stack);
      throw error;
    }
  }

  async create(createPostDto: CreatePostDto, user: User): Promise<any> {
    // Redis Lock 먼저 획득 (동일 사용자의 중복 요청 직렬화)
    const lockKey = `post:create:${user.id}`;
    const lockId = await this.redisLockService.acquireLock(lockKey, 10000);

    if (!lockId) {
      throw new ConflictException('포스트 생성 요청이 처리 중입니다. 잠시 후 다시 시도해주세요.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 중복 포스트 체크 (10초 이내 동일 제목 방지)
      const existingPost = await queryRunner.manager.findOne(Post, {
        where: {
          authorId: user.id,
          title: createPostDto.title,
          createdAt: MoreThan(new Date(Date.now() - 10000)),
          isDeleted: false,
        },
      });

      if (existingPost) {
        throw new ConflictException('동일한 포스트가 최근에 생성되었습니다. 잠시 후 다시 시도해주세요.');
      }

      // 사용자의 블로그를 찾음 (한 사용자당 하나의 블로그)
      const blog = await queryRunner.manager.findOne(Blog, {
        where: { userId: user.id },
      });

      if (!blog) {
        throw new BadRequestException('블로그를 먼저 생성해주세요.');
      }

        // 하이브리드 저장 시스템: 마크다운과 HTML 모두 저장
        let processedContent = createPostDto.content;
        let markdownContent = null;
        let contentType: 'markdown' | 'html' = 'html';

        // 마크다운 콘텐츠인지 확인 (MCP에서 오는 경우)
        if (createPostDto.content_markdown) {
          // MCP에서 content_markdown만 보낸 경우
          markdownContent = createPostDto.content_markdown;
          let htmlContent = this.markdownRenderer.convertToHtml(markdownContent);
          // 첫 H1 제거 (제목은 post.title에 이미 있으므로 본문에서 중복 방지)
          htmlContent = htmlContent.replace(/<h1[^>]*>.*?<\/h1>\s*/i, '').trim();
          // 백엔드에서 콘텐츠 처리 파이프라인 적용
          const processed = await this.contentProcessing.processMarkdownHtml(htmlContent, {
            sanitize: true,
            processCode: true,
            processImages: true,
            preserveMermaid: true,
          });
          processedContent = processed.html;
          contentType = 'markdown';
        } else if (createPostDto.content && this.isMarkdownContent(createPostDto.content)) {
          // content가 마크다운인 경우
          markdownContent = createPostDto.content;
          let htmlContent = this.markdownRenderer.convertToHtml(markdownContent);
          // 첫 H1 제거 (제목은 post.title에 이미 있으므로 본문에서 중복 방지)
          htmlContent = htmlContent.replace(/<h1[^>]*>.*?<\/h1>\s*/i, '').trim();
          // 백엔드에서 콘텐츠 처리 파이프라인 적용
          const processed = await this.contentProcessing.processMarkdownHtml(htmlContent, {
            sanitize: true,
            processCode: true,
            processImages: true,
            preserveMermaid: true,
          });
          processedContent = processed.html;
          contentType = 'markdown';
        } else if (!createPostDto.content && !createPostDto.content_markdown) {
          // content와 content_markdown 둘 다 없는 경우
          throw new BadRequestException('게시글 내용이 필요합니다.');
        }

        // 태그를 JSONB로 저장
        const tags = createPostDto.tags || [];

        // excerpt 생성 (HTML에서 태그 제거 후 200자 추출)
        let excerpt = '';
        if (processedContent) {
          // HTML 태그 제거 및 공백 정리
          const textContent = processedContent
            .replace(/<[^>]+>/g, '') // HTML 태그 제거
            .replace(/\s+/g, ' ') // 연속된 공백을 하나로
            .trim();

          // 첫 200자 추출
          excerpt = textContent.length > 200
            ? textContent.substring(0, 200)
            : textContent;
        }

      // spread 연산자 대신 명시적 필드 설정
      const post = queryRunner.manager.create(Post, {
        title: createPostDto.title,
        category: createPostDto.category,
        content: processedContent, // HTML 버전 (디스플레이용)
        content_markdown: markdownContent, // 마크다운 원본 (편집용)
        excerpt: excerpt, // 포스트 요약 (목록 표시용) - 호환성 유지
        content_type: contentType,
        content_rendered_at: contentType === 'markdown' ? new Date() : null,
        thumbnail: createPostDto.thumbnail, // YouTube 썸네일 또는 일반 이미지 URL
        author: user,
        blog: blog,
        blogId: blog.id,
        isPublished: true, // Multi-user blog system - all posts are published
        publishedAt: new Date(), // 현재 시간 (TypeORM이 자동으로 처리)
        tags: tags, // JSONB 태그 배열 저장 - 호환성 유지
        qualityScore: createPostDto.qualityScore || null, // 품질 점수 (선택적) - 호환성 유지
        version: 1, // 포스트 버전 (낙관적 락킹용)

        // Phase 1-2-3 리팩토링: PostStats 초기화 (cascade: true로 자동 저장)
        stats: queryRunner.manager.create(PostStats, {
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
          qualityScore: createPostDto.qualityScore || null,
          version: 0, // PostStats의 낙관적 락킹 버전
        }),

        // Phase 1-2-3 리팩토링: PostMetadata 초기화 (cascade: true로 자동 저장)
        metadata: queryRunner.manager.create(PostMetadata, {
          excerpt: excerpt,
          tags: tags,
          category: createPostDto.category,
          content_type: contentType,
          content_rendered_at: contentType === 'markdown' ? new Date() : null,
          publishedAt: new Date(),
          isEditorPick: false,
          editorPickedAt: null,
          processingError: null,
          processingCompletedAt: new Date(), // 동기 처리이므로 즉시 완료
          searchVector: null, // 검색 벡터는 트리거나 배치로 생성
          indexedAt: null,
        }),
      });

      // Entity의 @BeforeInsert에서 UUID로 고유 slug 생성됨
      await queryRunner.manager.save(post);

      let attachedFiles: File[] = [];
      if (createPostDto.attachedFileIds?.length) {
        // 파일 개수 검증
        if (createPostDto.attachedFileIds.length > this.MAX_FILES_PER_POST) {
          throw new BadRequestException(`포스트당 최대 ${this.MAX_FILES_PER_POST}개의 파일만 업로드할 수 있습니다.`);
        }

        attachedFiles = await queryRunner.manager.find(File, {
          where: { id: In(createPostDto.attachedFileIds), userId: user.id },
        });

        // 포스트당 총 파일 용량 검증
        await this.validatePostTotalSize(attachedFiles);

        post.attachedFiles = attachedFiles;
        await queryRunner.manager.save(post);
      }

      // 트랜잭션 커밋
      await queryRunner.commitTransaction();

      // ★ 커밋 후 Redis Lock 해제 (중요: 커밋이 완료된 후에 해제!)
      await this.redisLockService.releaseLock(lockKey, lockId);

      // 트랜잭션 밖에서 후처리 (비차단)
      // Lazy loading 방지: user.id를 직접 전달
      await this.linkFilesFromContent(post, user.id);

      // 포스트 생성 이벤트 발행 (캐시 무효화용)
      this.eventEmitter.emit('post.created', {
        postId: post.id,
        blogSlug: blog.slug,
      });

      /**
       * DTO 변환으로 spread operator 제거
       * lazy loading 방지 및 성능 최적화
       */
      return this.toPostDto(post, {
        user: user,
        blog: blog,
      });
    } catch (error) {
      // 에러 발생 시 롤백 및 락 해제
      await queryRunner.rollbackTransaction();
      await this.redisLockService.releaseLock(lockKey, lockId);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Fast Path 포스트 생성 (MCP 최적화용)
   *
   * 목표: 150-200ms 응답 시간으로 즉시 응답 반환
   * 전략: 최소 처리 + 백그라운드 Queue 사용
   *
   * 처리 흐름:
   * 1. 최소 검증 (블로그 존재, 컨텐츠 비어있지 않음)
   * 2. 포스트 생성 (status='processing', 원본 markdown만 저장)
   * 3. 백그라운드 Job Queue에 추가
   * 4. 즉시 202 Accepted 응답 반환
   *
   * 백그라운드 Worker가 처리:
   * - Markdown → HTML 변환
   * - Content 처리 (HTML sanitization, code highlighting, image processing)
   * - File link 처리 (S3 key 추출, FileContext 업데이트)
   * - Search vector 생성
   * - Status 업데이트 ('processing' → 'published' 또는 'failed')
   *
   * @param createPostDto - 포스트 생성 DTO
   * @param user - 작성자 정보
   * @returns 생성된 포스트 정보 (status='processing' 상태)
   */
  async createFast(createPostDto: CreatePostDto, user: User): Promise<any> {
    const startTime = Date.now();

    // 1. 블로그 존재 확인 (필수)
    const blog = await this.blogsRepository.findOne({
      where: { userId: user.id },
    });

    if (!blog) {
      throw new BadRequestException('블로그를 먼저 생성해주세요.');
    }

    // 2. 컨텐츠 검증 (content_markdown 또는 content 필수)
    const markdownContent = createPostDto.content_markdown || createPostDto.content;
    if (!markdownContent) {
      throw new BadRequestException('게시글 내용이 필요합니다.');
    }

    // 3. 태그 처리
    const tags = createPostDto.tags || [];

    // 4. 간단한 excerpt 생성 (제목 기반, 빠른 처리)
    // Worker에서 content 기반 excerpt로 교체됨
    const quickExcerpt = createPostDto.title.substring(0, 200);

    // 5. 포스트 생성 (status='processing')
    const post = this.postsRepository.create({
      title: createPostDto.title,
      category: createPostDto.category,
      content: '', // 임시 빈 문자열 (Worker에서 렌더링된 HTML로 교체)
      content_markdown: markdownContent, // 원본 저장
      excerpt: quickExcerpt, // 임시 excerpt (Worker에서 교체) - 호환성 유지
      content_type: 'markdown',
      content_rendered_at: null, // Worker에서 설정
      thumbnail: createPostDto.thumbnail,
      author: user,
      blog: blog,
      blogId: blog.id,
      isPublished: true, // 공개 상태 (하지만 status='processing'이므로 목록에 안 보임)
      publishedAt: new Date(), // 현재 시간 (TypeORM이 자동으로 처리)
      tags: tags, // 호환성 유지
      qualityScore: createPostDto.qualityScore || null, // 호환성 유지
      version: 1, // 포스트 버전 (낙관적 락킹용) - NOT NULL 제약조건 충족
      status: 'processing', // 핵심: 백그라운드 처리 대기 중
      processingError: null,
      processingCompletedAt: null,

      // Phase 1-2-3 리팩토링: PostStats 초기화 (cascade: true로 자동 저장)
      stats: this.postsRepository.manager.create(PostStats, {
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        qualityScore: createPostDto.qualityScore || null,
        version: 0,
      }),

      // Phase 1-2-3 리팩토링: PostMetadata 초기화 (cascade: true로 자동 저장)
      // Worker가 완료되면 업데이트됨
      metadata: this.postsRepository.manager.create(PostMetadata, {
        excerpt: quickExcerpt, // 임시 (Worker에서 교체)
        tags: tags,
        category: createPostDto.category,
        content_type: 'markdown',
        content_rendered_at: null, // Worker에서 설정
        publishedAt: new Date(),
        isEditorPick: false,
        editorPickedAt: null,
        processingError: null,
        processingCompletedAt: null, // Worker에서 설정
        searchVector: null, // Worker에서 생성
        indexedAt: null, // Worker에서 설정
      }),
    });

    // 6. DB 저장 (빠른 저장, content 처리 스킵)
    await this.postsRepository.save(post);

    // 7. 백그라운드 Job Queue에 추가
    await this.postProcessingQueue.add('process-post', {
      postId: post.id,
      userId: user.id,
      blogId: blog.id,
      title: post.title,
      content: markdownContent,
      tags: tags,
      category: post.category,
    });

    const processingTime = Date.now() - startTime;
    this.logger.log(`✅ Fast Path 완료: ${post.id} (${processingTime}ms) - Worker 처리 대기 중`);

    // 포스트 생성 이벤트 발행 (캐시 무효화용)
    this.eventEmitter.emit('post.created', {
      postId: post.id,
      blogSlug: blog.slug,
    });

    // 8. 202 Accepted 응답 반환 (즉시 응답)
    return {
      ...this.toPostDto(post, {
        user: user,
        blog: blog,
      }),
      // 추가 메타데이터
      _meta: {
        processingStatus: 'queued',
        message: '포스트가 생성되었습니다. 백그라운드에서 처리 중입니다.',
        estimatedCompletion: '2-3초 후 완료 예상',
        processingTime: `${processingTime}ms`,
      },
    };
  }

  private async findPostById(id: string): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author', 'attachedFiles', 'blog'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    category?: string,
    blogId?: string,
    user?: User,
    isPublished?: boolean,
    isForCache: boolean = false
  ): Promise<{ posts: any[]; total: number; page: number; totalPages: number }> {
    // 서비스 레이어에서도 이중 검증 (보안 강화)
    const safeLimit = Math.min(Math.max(limit, 1), 20); // 최대 20개
    const safePage = Math.max(page, 1);

    /**
     * 홈화면/블로그 피드 쿼리 최적화
     * - content, content_markdown 제외 (목록에 불필요한 대용량 필드)
     * - leftJoinAndSelect 대신 select/addSelect 사용으로 데이터 전송량 감소
     * - blog 조인 항상 수행 (프론트엔드 필수, PostgreSQL 조인 성능 우수)
     */
    const query = this.postsRepository.createQueryBuilder('post')
      .select([
        'post.id',
        'post.title',
        'post.slug',
        'post.excerpt', // 포스트 요약 (목록 표시용)
        // content와 content_markdown 제외 - 목록에서 불필요
        'post.content_type',
        'post.thumbnail',
        'post.isPublished',
        'post.viewCount',
        'post.likeCount',
        'post.commentCount',
        'post.qualityScore',
        'post.tags',
        'post.category',
        'post.blogId',
        'post.authorId',
        'post.createdAt',
        'post.updatedAt',
        'post.publishedAt',
        'post.version',
        'post.isEditorPick', // Editor's Pick 여부
        'post.editorPickedAt', // Editor's Pick 선정 시간
      ])
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('author.profile', 'profile')
      .addSelect([
        'blog.id',
        'blog.slug',
        'blog.name',
        'blog.isPublic',
        'blog.alias',
      ])
      .leftJoin('post.blog', 'blog') // 항상 blog 조인 (프론트엔드 필수)
      // Phase 1-2-3 리팩토링: PostStats, PostMetadata LEFT JOIN
      // 목록 조회에서는 기존 posts 테이블 컬럼도 유지하므로 LEFT JOIN으로 점진적 전환
      .leftJoin('post.stats', 'stats')
      .leftJoin('post.metadata', 'metadata');

    // 삭제된 포스트 제외 (기본 필터)
    query.where('post.isDeleted = :isDeleted', { isDeleted: false });

    // 캐시용이면 비공개 블로그 제외
    if (isForCache) {
      query.andWhere('blog.isPublic = :isPublic', { isPublic: true })
        .andWhere('post.isPublished = :isPublished', { isPublished: true })
        .andWhere('post.status = :status', { status: 'published' });
    } else {
      // Admin can see all posts, regular users only see published posts
      if (user?.role === Role.ADMIN) {
        // Admin: filter by isPublished only if explicitly requested
        if (isPublished !== undefined) {
          query.andWhere('post.isPublished = :isPublished', { isPublished });
        }
      } else {
        // Regular users: always show only published posts
        query.andWhere('post.isPublished = :isPublished AND post.status = :status', {
          isPublished: true,
          status: 'published'
        });
      }
    }

    if (blogId) {
      query.andWhere('post.blogId = :blogId', { blogId });
    }

    // 카테고리 필터링 - 정확한 매칭
    if (category) {
      query.andWhere('post.category = :category', { category });
    }

    // 검색어 필터링 - Full-Text Search 사용
    if (search) {
      // 검색어 전처리: 특수문자 이스케이프 및 공백 처리
      const searchTerms = search.trim()
        .split(/\s+/) // 공백으로 분리
        .filter(term => term.length > 0) // 빈 문자열 제거
        .map(term => term.replace(/[:'"\\]/g, '')) // 콜론을 포함한 특수문자 제거
        .join(' & '); // AND 연산자로 결합 (모든 단어가 포함되어야 함)

      if (searchTerms) {
        // 전문 검색 쿼리 - ts_rank로 관련성 점수 계산
        query
          .addSelect(
            `ts_rank(post.search_vector, to_tsquery('simple', :searchQuery))`,
            'search_rank'
          )
          .andWhere(
            `post.search_vector @@ to_tsquery('simple', :searchQuery)`,
            { searchQuery: searchTerms }
          );

        // 검색 결과가 있을 때만 관련성 순으로 정렬 우선
        // 나중에 다른 정렬 조건이 추가될 수 있으므로 여기서는 설정하지 않음
      }
    }

    // 캐시용이 아니고 유저가 있으면 좋아요 상태를 서브쿼리로 확인 (최적화)
    // leftJoin 대신 서브쿼리를 사용하여 N+1 문제와 UUID IN 절 문제 해결
    if (!isForCache && user) {
      // likedBy 조인 대신 서브쿼리로 좋아요 상태 확인
      query.addSelect((subQuery) => {
        return subQuery
          .select('COUNT(1)')
          .from('post_likes', 'pl')
          .where('pl.postId = post.id')
          .andWhere('pl.userId = :userId', { userId: user.id });
      }, 'userLikedCount');
    }

    // 정렬: 검색 시 관련성순, 일반 목록은 최신순
    if (search) {
      // 검색 결과는 관련성 점수로 먼저 정렬, 같은 점수면 최신순
      query.orderBy('search_rank', 'DESC').addOrderBy('post.publishedAt', 'DESC');
    } else {
      // 일반 목록은 최신순 정렬
      query.orderBy('post.publishedAt', 'DESC');
    }

    const [posts, total] = await query
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    /**
     * 응답 데이터 최적화
     * - content, content_markdown 제외 (목록에서 불필요)
     * - author.email 제외 (보안)
     */
    const postsWithFormattedDates = posts.map(post => {
      // 중요: ...post 스프레드 연산자를 사용하면 lazy loading이 발생하므로
      // 필요한 필드만 명시적으로 선택
      const result: any = {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt, // 포스트 요약 (목록 표시용)
        // content와 content_markdown 제외 - 목록에서 불필요
        content_type: post.content_type,
        isPublished: post.isPublished,
        category: post.category,
        blogId: post.blogId,
        authorId: post.authorId,
        qualityScore: post.qualityScore,
        version: post.version,
        // 날짜는 TypeORM이 자동으로 ISO 8601 문자열로 직렬화
        publishedAt: post.publishedAt,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        // Editor's Pick 필드 추가
        isEditorPick: post.isEditorPick || false,
        editorPickedAt: post.editorPickedAt,
        // 카운트 필드들
        commentCount: post.commentCount || 0,
        likeCount: post.likeCount || 0,
        viewCount: post.viewCount || 0,
        // 태그 필드 추가 (프론트엔드 호환성)
        tags: post.tags || [],
        // thumbnail 필드 명시적으로 포함 (YouTube 썸네일 지원) - 최적화 적용
        thumbnail: this.optimizeImageUrl(post.thumbnail),
        // 블로그 정보 (있으면)
        blog: post.blog || null,
        // 작성자 정보는 필요한 필드만 선택 (email 제외)
        author: post.author ? this.formatAuthorData(post.author) : null,
        // 이미지 파일 정보는 별도 로드 시에만 포함
        images: [],
      };

      // 캐시용이 아니고 유저가 있으면 liked 필드 추가
      // 서브쿼리로 가져온 좋아요 상태 확인
      if (!isForCache && user) {
        // userLikedCount 서브쿼리 결과로 좋아요 여부 판단
        const userLikedCount = (post as any).userLikedCount;
        result.liked = userLikedCount > 0;
      } else {
        result.liked = false;
      }

      // 중요: likedBy, attachedFiles 같은 lazy loading 대상 속성은 절대 접근하지 않음
      // delete result.likedBy; // ❌ 이렇게 하면 lazy loading 발생
      // delete result.attachedFiles; // ❌ 이것도 lazy loading 발생

      // userLikedCount는 서브쿼리 결과이므로 안전하게 제거 가능
      if ('userLikedCount' in result) {
        delete (result as any).userLikedCount;
      }

      return result;
    });

    const totalPages = Math.ceil(total / safeLimit);

    return { 
      posts: postsWithFormattedDates, 
      total,
      page: safePage,
      totalPages 
    };
  }

  async findPopularPosts(
    period: 'daily' | 'weekly' | 'monthly',
    limit: number = 5
  ): Promise<any> {
    // 서비스 레이어에서도 이중 검증
    const safeLimit = Math.min(Math.max(limit, 1), 10); // 인기 게시글은 최대 10개

    // Redis 캐시 체크
    const cacheKey = CacheKeys.FEED_POPULAR(period, safeLimit);

    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for popular posts: ${cacheKey}`);
      return cached;
    }

    /**
     * 최적화된 쿼리 빌더
     * - 필요한 필드만 선택 (select/addSelect)
     * - 민감한 정보 제외 (password, refreshToken, email)
     * - content 필드 제외 (목록에 불필요)
     */
    const query = this.postsRepository.createQueryBuilder('post')
      // post의 필수 필드만 선택 (content, content_markdown 제외)
      .select([
        'post.id',
        'post.title',
        'post.slug',
        'post.thumbnail',
        'post.category',
        'post.isPublished',
        'post.viewCount',
        'post.likeCount',
        'post.commentCount',
        'post.tags',
        'post.publishedAt',
        'post.createdAt',
        'post.updatedAt',
        'post.blogId',
        'post.authorId'
      ])
      // author 관계 설정 (필드 선택 안 함)
      .leftJoin('post.author', 'author')
      // author의 공개 필드만 추가 (email, password 제외)
      .addSelect([
        'author.id',
        'author.username',
        'author.role'
      ])
      // author의 profile 관계 설정 (Phase 1-2-3: profileImage, bio는 profiles 테이블로 이동)
      .leftJoin('author.profile', 'profile')
      .addSelect([
        'profile.profileImage',
        'profile.bio'
      ])
      // blog 관계 설정
      .leftJoin('post.blog', 'blog')
      // blog의 필수 필드만 추가
      .addSelect([
        'blog.id',
        'blog.slug',
        'blog.name',
        'blog.isPublic'
      ])
      .where('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.status = :status', { status: 'published' })
      .andWhere('blog.isPublic = :isPublic', { isPublic: true });

    // 기간별 필터링
    const now = new Date();
    let dateFilter: Date;
    let ttl: number; // 캐시 TTL (초 단위)

    switch (period) {
      case 'daily':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        ttl = 3600; // 1시간
        break;
      case 'weekly':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        ttl = 10800; // 3시간
        break;
      case 'monthly':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        ttl = 21600; // 6시간
        break;
    }

    query.andWhere('post.publishedAt >= :dateFilter', { dateFilter });

    // 인기도 점수 계산 (viewCount + likeCount*3 + commentCount*2)
    query
      .addSelect('(post.viewCount + post.likeCount * 3 + post.commentCount * 2)', 'popularity_score')
      .orderBy('popularity_score', 'DESC')
      .addOrderBy('post.publishedAt', 'DESC')
      .limit(safeLimit);

    const posts = await query.getMany();

    /**
     * 최적화된 응답 매핑
     * - content, content_markdown 제외 (목록에 불필요한 대용량 필드)
     * - email 제외 (보안)
     * - 필요한 필드만 포함
     */
    const postsWithFormattedData = posts.map(post => ({
      // post 필수 필드만 (content 제외)
      id: post.id,
      title: post.title,
      slug: post.slug,
      // content와 content_markdown 제외 - 목록에서 불필요
      isPublished: post.isPublished,
      category: post.category,
      blogId: post.blogId,
      authorId: post.authorId,
      viewCount: post.viewCount || 0,
      likeCount: post.likeCount || 0,
      commentCount: post.commentCount || 0,
      // 날짜는 TypeORM이 자동으로 ISO 8601 문자열로 직렬화
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      publishedAt: post.publishedAt,
      // 태그와 썸네일
      tags: post.tags || [],
      thumbnail: this.optimizeImageUrl(post.thumbnail), // 이미지 URL 최적화
      // 블로그 정보
      blog: post.blog || null,
      // 작성자 프로필 (email 제외)
      author: post.author ? this.formatAuthorData(post.author) : null,
      // 인기도 점수 포함
      popularityScore: post.viewCount + (post.likeCount * 3) + (post.commentCount * 2)
    }));

    const result = {
      posts: postsWithFormattedData,
      period,
      count: posts.length
    };

    // Redis 캐시 저장 (TTL 활용)
    await this.cacheService.set(cacheKey, result, ttl);
    this.logger.debug(`Cached popular posts: ${cacheKey} with TTL: ${ttl}s`);

    return result;
  }

  async findOne(id: string, user?: User): Promise<any> {
    this.logger.log(`Finding post by ID: ${id}`);

    // 1. Core 데이터 캐시 확인
    const cacheKey = CacheKeys.POST_CORE(id);
    const lockKey = CacheKeys.POST_REBUILDING(id);

    const cachedCore = await this.cacheService.get<PostCoreData>(cacheKey);

    if (cachedCore) {
      this.logger.debug(`✅ Cache HIT: post core ${id}`);
      this.cacheMetricsService.recordPostCacheHit();

      // 2. 실시간 Counts + liked/bookmarked 조회
      const counts = await this.getPostCounts(id, user);

      return {
        ...cachedCore,
        ...counts
      };
    }

    this.logger.debug(`❌ Cache MISS: post core ${id}`);
    this.cacheMetricsService.recordPostCacheMiss();

    // 3. Cache Stampede 방지: 분산 락 획득
    const lockAcquired = await this.cacheService.acquireLock(lockKey, 5);

    if (!lockAcquired) {
      // 다른 요청이 캐시 리빌딩 중 → 대기 후 재조회
      this.logger.debug(`⏳ Waiting for cache rebuild: ${id}`);
      await this.cacheService.waitForLock(lockKey, 5000);

      // 락 해제 후 캐시 재확인
      const rebuiltCache = await this.cacheService.get<PostCoreData>(cacheKey);
      if (rebuiltCache) {
        const counts = await this.getPostCounts(id, user);
        return { ...rebuiltCache, ...counts };
      }

      // 캐시 리빌드 실패 시 폴백: DB 직접 조회
      this.logger.warn(`Cache rebuild failed, falling back to DB: ${id}`);
    }

    try {
      // 4. 기존 DB 조회 로직
      // QueryBuilder로 필요한 컬럼만 select, 사용자 좋아요 상태도 포함
      const qb = this.postsRepository.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('author.profile', 'profile') // Phase 1-2-3: profileImage, bio는 profiles 테이블로 이동
      .leftJoinAndSelect('post.attachedFiles', 'file')
      .leftJoinAndSelect('post.blog', 'blog')
      // Phase 1-2-3 리팩토링: PostStats, PostMetadata LEFT JOIN
      .leftJoinAndSelect('post.stats', 'stats')
      .leftJoinAndSelect('post.metadata', 'metadata')
      // likedBy JOIN을 제거하고 서브쿼리로 대체
      .select([
        'post.id', 'post.title', 'post.slug', 'post.content', 'post.thumbnail',
        'post.isPublished', 'post.viewCount', 'post.likeCount', 'post.commentCount', 'post.tags', 'post.category',
        'post.publishedAt', 'post.createdAt', 'post.updatedAt',
        'post.isEditorPick', 'post.editorPickedAt', // Editor's Pick 필드 추가
        'author.id', 'author.username', 'author.role',
        'profile.profileImage', 'profile.bio', // Phase 1-2-3: profiles 테이블로 이동
        'file.id', 'file.fileName', 'file.originalName', 'file.fileSize', 'file.fileUrl', 'file.fileType',
        'blog.id', 'blog.slug', 'blog.name', 'blog.isPublic', 'blog.userId', 'blog.allowComments',
      ])
      .where('post.id = :id', { id })
      .andWhere('post.isDeleted = :isDeleted', { isDeleted: false }); // 삭제된 포스트 제외

    // 사용자가 있는 경우에만 좋아요 상태와 북마크 상태를 서브쿼리로 확인
    if (user) {
      qb.addSelect((subQuery) => {
        return subQuery
          .select('COUNT(1)')
          .from('post_likes', 'pl')
          .where('pl.postId = post.id')
          .andWhere('pl.userId = :userId', { userId: user.id });
      }, 'userLikedCount');

      qb.addSelect((subQuery) => {
        return subQuery
          .select('COUNT(1)')
          .from('bookmarks', 'b')
          .where('b.post_id = post.id')
          .andWhere('b.user_id = :userId', { userId: user.id });
      }, 'userBookmarkedCount');
    }
    const post = await qb.getOne();
    if (!post) {
      this.logger.warn(`Post not found for ID: ${id}`);
      throw new NotFoundException('Post not found');
    }
    
    // 블로그가 비공개인 경우, 소유자가 아니면 특별한 응답 반환
    if (!post.blog.isPublic) {
      this.logger.log(`Private blog check - User ID: ${user?.id}, Blog userId: ${post.blog.userId}, Post Author ID: ${post.author?.id}`);
      // 블로그 소유자 또는 포스트 작성자인 경우 접근 허용
      const isOwner = user && (String(user.id) === String(post.blog.userId) || String(user.id) === String(post.author?.id));
      if (!isOwner) {
        this.logger.log(`Access denied to private blog for user ${user?.id}`);
        return {
          isPrivate: true,
          message: '비공개 블로그입니다'
        };
      }
      this.logger.log(`Access granted to private blog for owner/author ${user?.id}`);
    }
    
    // 사용자 좋아요 상태 확인 (서브쿼리 결과 사용)
    const liked = user && post['userLikedCount'] ? Number(post['userLikedCount']) > 0 : false;

    // 사용자 북마크 상태 확인 (서브쿼리 결과 사용)
    const bookmarked = user && post['userBookmarkedCount'] ? Number(post['userBookmarkedCount']) > 0 : false;

    /**
     * DTO 변환으로 spread operator 제거
     * lazy loading 방지 및 성능 최적화
     */
    const result = this.toPostDto(post, {
      liked: liked,
      bookmarked: bookmarked,
      user: post.author,
      blog: post.blog,
    });

    // 조회수 증가 반영 (기존 로직 유지)
    result.viewCount = post.viewCount;

    // 5. Core 데이터만 캐시 저장 (counts/liked 제외)
    const coreData = {
      id: result.id,
      title: result.title,
      slug: result.slug,
      content: result.content,
      thumbnail: result.thumbnail,
      isPublished: result.isPublished,
      tags: result.tags,
      category: result.category,
      publishedAt: result.publishedAt,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      isEditorPick: result.isEditorPick,
      editorPickedAt: result.editorPickedAt,
      author: result.author,
      blog: result.blog,
      attachedFiles: result.attachedFiles,
    };

    await this.cacheService.set(cacheKey, coreData, CacheTTL.POST_CORE);
    this.logger.debug(`💾 Cached post core: ${id}`);

    this.logger.log(`Returning post data with ${post.attachedFiles?.length || 0} attached files`);
    return result;
    } finally {
      // 6. 락 해제 (반드시 실행)
      if (lockAcquired) {
        await this.cacheService.releaseLock(lockKey);
      }
    }
  }

  async findBySlug(slug: string, user?: User): Promise<any> {
    // QueryBuilder로 필요한 컬럼만 select, 사용자 좋아요 상태도 포함
    const qb = this.postsRepository.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('author.profile', 'profile') // Phase 1-2-3: profileImage, bio는 profiles 테이블로 이동
      .leftJoinAndSelect('post.attachedFiles', 'file')
      .leftJoinAndSelect('post.blog', 'blog')
      // Phase 1-2-3 리팩토링: PostStats, PostMetadata LEFT JOIN
      .leftJoinAndSelect('post.stats', 'stats')
      .leftJoinAndSelect('post.metadata', 'metadata')
      // likedBy JOIN을 제거하고 서브쿼리로 대체
      .select([
        'post.id', 'post.title', 'post.slug', 'post.content', 'post.thumbnail',
        'post.isPublished', 'post.viewCount', 'post.likeCount', 'post.commentCount', 'post.tags', 'post.category',
        'post.publishedAt', 'post.createdAt', 'post.updatedAt',
        'post.isEditorPick', 'post.editorPickedAt', // Editor's Pick 필드 추가
        'author.id', 'author.username', 'author.role',
        'profile.profileImage', 'profile.bio', // Phase 1-2-3: profiles 테이블로 이동
        'file.id', 'file.fileName', 'file.originalName', 'file.fileSize', 'file.fileUrl', 'file.fileType',
        'blog.id', 'blog.slug', 'blog.name', 'blog.isPublic', 'blog.userId', 'blog.allowComments',
      ])
      .where('post.slug = :slug', { slug })
      .andWhere('post.isDeleted = :isDeleted', { isDeleted: false }) // 삭제된 포스트 제외
      .andWhere('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.status = :status', { status: 'published' });

    // 사용자가 있는 경우에만 좋아요 상태와 북마크 상태를 서브쿼리로 확인
    if (user) {
      qb.addSelect((subQuery) => {
        return subQuery
          .select('COUNT(1)')
          .from('post_likes', 'pl')
          .where('pl.postId = post.id')
          .andWhere('pl.userId = :userId', { userId: user.id });
      }, 'userLikedCount');

      qb.addSelect((subQuery) => {
        return subQuery
          .select('COUNT(1)')
          .from('bookmarks', 'b')
          .where('b.post_id = post.id')
          .andWhere('b.user_id = :userId', { userId: user.id });
      }, 'userBookmarkedCount');
    }
    const post = await qb.getOne();
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    
    // 블로그가 비공개인 경우, 소유자가 아니면 특별한 응답 반환
    if (!post.blog.isPublic) {
      this.logger.log(`Private blog check - User ID: ${user?.id}, Blog userId: ${post.blog.userId}, Post Author ID: ${post.author?.id}`);
      // 블로그 소유자 또는 포스트 작성자인 경우 접근 허용
      const isOwner = user && (String(user.id) === String(post.blog.userId) || String(user.id) === String(post.author?.id));
      if (!isOwner) {
        this.logger.log(`Access denied to private blog for user ${user?.id}`);
        return {
          isPrivate: true,
          message: '비공개 블로그입니다'
        };
      }
      this.logger.log(`Access granted to private blog for owner/author ${user?.id}`);
    }
    
    // 조회수 증가 (모든 사용자)
    await this.incrementViewCountForAll(post.id);
    
    // 사용자 좋아요 상태 확인 (서브쿼리 결과 사용)
    const liked = user && post['userLikedCount'] ? Number(post['userLikedCount']) > 0 : false;

    // 사용자 북마크 상태 확인 (서브쿼리 결과 사용)
    const bookmarked = user && post['userBookmarkedCount'] ? Number(post['userBookmarkedCount']) > 0 : false;

    // DTO 변환으로 안전하게 처리 (spread 연산자 사용 금지)
    // 날짜 포맷팅은 DTO 변환 후 별도 처리
    const postDto = this.toPostDto(post, {
      liked: liked,
      bookmarked: bookmarked,
      user: post.author,
      blog: post.blog
    });

    // 추가 필드 설정
    postDto.liked = liked; // 사용자 좋아요 상태
    postDto.tags = post.tags || []; // 태그 필드 추가 (프론트엔드 호환성)
    postDto.viewCount = post.viewCount + 1; // 증가된 조회수 반영

    // 날짜는 TypeORM이 자동으로 ISO 8601 문자열로 직렬화 (formatDate 제거)

    return postDto;
  }

  async update(id: string, updatePostDto: any, user: User): Promise<any> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author', 'attachedFiles', 'blog'],
    });

    if (!post) throw new NotFoundException('Post not found');
    if (post.author.id !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You can only update your own posts');
    }

    // 하이브리드 저장 시스템: 마크다운 업데이트 처리
    let processedContent = updatePostDto.content;
    let markdownContent = updatePostDto.content_markdown;
    
    // 마크다운이 업데이트된 경우
    if (updatePostDto.content_markdown && updatePostDto.content_markdown !== post.content_markdown) {
      markdownContent = updatePostDto.content_markdown;
      let htmlContent = this.markdownRenderer.convertToHtml(markdownContent);
      // 첫 H1 제거 (제목은 post.title에 이미 있으므로 본문에서 중복 방지)
      htmlContent = htmlContent.replace(/<h1[^>]*>.*?<\/h1>\s*/i, '').trim();
      // 백엔드에서 콘텐츠 처리 파이프라인 적용
      const processed = await this.contentProcessing.processMarkdownHtml(htmlContent, {
        sanitize: true,
        processCode: true,
        processImages: true,
        preserveMermaid: true,
      });
      processedContent = processed.html;
      post.content_type = 'markdown';
      post.content_rendered_at = new Date();
    }
    // HTML이 직접 업데이트된 경우
    else if (updatePostDto.content && updatePostDto.content !== post.content) {
      processedContent = updatePostDto.content;
      // 마크다운 원본이 없고 HTML이 변경된 경우, content_type을 html로 설정
      if (!post.content_markdown) {
        post.content_type = 'html';
      }
    }

    if (processedContent && processedContent !== post.content) {
      await this.cleanupUnusedImages(post.id, post.content, processedContent, user.id);
    }

    // 태그 업데이트 (JSONB로 단순 저장)
    const newTagList = updatePostDto.tags || post.tags || [];

    // tags는 DTO에서 온 것이므로 별도로 처리

    // 업데이트 적용 (spread 연산자 대신 명시적 필드 설정)
    // updatePostDto의 필드들을 명시적으로 설정 (tags 제외)
    if (updatePostDto.title !== undefined) post.title = updatePostDto.title;
    if (updatePostDto.isPublished !== undefined) post.isPublished = updatePostDto.isPublished;
    if (updatePostDto.category !== undefined) post.category = updatePostDto.category;
    if (updatePostDto.qualityScore !== undefined) post.qualityScore = updatePostDto.qualityScore;

    // 컨텐츠 관련 필드 업데이트
    post.content = processedContent;
    post.content_markdown = markdownContent;

    // excerpt 재생성 (content가 변경된 경우)
    if (processedContent) {
      // HTML 태그 제거 및 공백 정리
      const textContent = processedContent
        .replace(/<[^>]+>/g, '') // HTML 태그 제거
        .replace(/\s+/g, ' ') // 연속된 공백을 하나로
        .trim();

      // 첫 200자 추출
      post.excerpt = textContent.length > 200
        ? textContent.substring(0, 200)
        : textContent;
    }

    post.tags = newTagList; // JSONB 태그 배열 업데이트

    // Title 변경 시 slug는 변경하지 않음 (이미 고유한 UUID 포함)
    // SEO를 위해 기존 slug 유지가 더 좋음

    // thumbnail이 명시적으로 제공된 경우 사용, 그렇지 않으면 content에서 추출
    if (updatePostDto.thumbnail !== undefined) {
      this.logger.log(`[UPDATE] Post ${id} - Updating thumbnail to: ${updatePostDto.thumbnail}`);
      post.thumbnail = updatePostDto.thumbnail;
    } else if (processedContent) {
      const extractedThumbnail = this.extractThumbnailFromContent(processedContent);
      this.logger.log(`[UPDATE] Post ${id} - Extracted thumbnail from content: ${extractedThumbnail}`);
      post.thumbnail = extractedThumbnail;
    }

    await this.postsRepository.save(post);

    if (updatePostDto.attachedFileIds !== undefined) {
      // 파일 개수 검증
      if (updatePostDto.attachedFileIds.length > this.MAX_FILES_PER_POST) {
        throw new BadRequestException(`포스트당 최대 ${this.MAX_FILES_PER_POST}개의 파일만 업로드할 수 있습니다.`);
      }
      
      const files = await this.filesRepository.find({
        where: { id: In(updatePostDto.attachedFileIds), userId: user.id },
      });
      
      // 포스트당 총 파일 용량 검증
      await this.validatePostTotalSize(files, post.id);
      
      post.attachedFiles = files;
      await this.postsRepository.save(post);
    }

    // Lazy loading 방지: user.id를 직접 전달
    await this.linkFilesFromContent(post, user.id);

    // 이벤트 발행 (캐시 무효화는 리스너가 처리)
    this.eventEmitter.emit('post.updated', {
      postId: id,
      blogSlug: post.blog?.slug,
    });

    return this.toPostDto(post, {
      user: post.author,
      blog: post.blog,
      // attachedFiles는 이미 post에 포함되어 있음
    });
  }

  async remove(id: string, user: User): Promise<void> {
    const post = await this.findPostById(id);

    if (post.author.id !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    // 삭제 전 블로그 정보 백업 (이벤트 발행용)
    const blogSlug = post.blog?.slug;

    // JSONB 기반 태그는 카운트 관리가 불필요함
    // 태그 통계는 필요시 집계 쿼리로 처리

    // 포스트 삭제 (CASCADE로 관련 데이터 자동 삭제)
    // post_tags, post_likes, post_files는 @JoinTable로 자동 처리됨
    await this.postsRepository.remove(post);

    // 이벤트 발행 (캐시 무효화는 리스너가 처리)
    this.eventEmitter.emit('post.deleted', {
      postId: id,
      blogSlug: blogSlug,
    });

    this.logger.log(`Post ${id} and all related data successfully deleted`);
  }

  // 관리자용 메소드들
  async findAllForAdmin(page: number = 1, limit: number = 10, search?: string): Promise<{ posts: Post[]; total: number }> {
    const query = this.postsRepository.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author');

    // 관리자 페이지에서도 Full-Text Search 사용
    if (search) {
      const searchTerms = search.trim()
        .split(/\s+/)
        .filter(term => term.length > 0)
        .map(term => term.replace(/['"\\]/g, ''))
        .join(' & ');

      if (searchTerms) {
        query
          .addSelect(
            `ts_rank(post.search_vector, to_tsquery('simple', :searchQuery))`,
            'search_rank'
          )
          .where(
            `post.search_vector @@ to_tsquery('simple', :searchQuery)`,
            { searchQuery: searchTerms }
          )
          .orderBy('search_rank', 'DESC');
      }
    }

    const [posts, total] = await query
      .orderBy('post.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { posts, total };
  }

  async publish(id: string): Promise<Post> {
    const post = await this.findPostById(id);
    post.isPublished = true;
    post.publishedAt = new Date(); // 현재 시간 (TypeORM이 자동으로 처리)
    return this.postsRepository.save(post);
  }

  async unpublish(id: string): Promise<Post> {
    const post = await this.findPostById(id);
    post.isPublished = false;
    post.publishedAt = null;
    return this.postsRepository.save(post);
  }

  async getStats(): Promise<any> {
    const totalPosts = await this.postsRepository.count();
    const publishedPosts = await this.postsRepository.count({
      where: {
        isPublished: true,
        status: 'published'
      }
    });
    const draftPosts = totalPosts - publishedPosts;

    const topCategories = await this.postsRepository
      .createQueryBuilder('post')
      .select('post.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.status = :status', { status: 'published' })
      .andWhere('post.category IS NOT NULL')
      .groupBy('post.category')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    return {
      totalPosts,
      publishedPosts,
      draftPosts,
      topCategories,
    };
  }

  private async attachFiles(postId: string, fileIds: string[], userId: string): Promise<void> {
    const files = await this.filesRepository.find({
      where: { id: In(fileIds), userId: userId },
    });
    await this.postsRepository.update(postId, { attachedFiles: files });
  }

  private async updateAttachedFiles(postId: string, fileIds: string[], userId: string): Promise<void> {
    const files = fileIds && fileIds.length > 0
      ? await this.filesRepository.find({ where: { id: In(fileIds), userId: userId } })
      : [];
    await this.postsRepository.update(postId, { attachedFiles: files });
  }

  private async linkFilesFromContent(post: Post, userId?: string): Promise<void> {
    try {
      const imageUrls = this.extractImageUrlsFromContent(post.content);
      if (imageUrls.length === 0) return;
      const s3Keys = imageUrls.map(url => this.extractS3KeyFromUrl(url)).filter(Boolean) as string[];
      if (s3Keys.length === 0) return;
      // Lazy loading 방지: userId를 직접 받거나 post.authorId 사용
      const authorUserId = userId || post.authorId;
      const files = await this.filesRepository.find({ where: { fileKey: In(s3Keys), userId: authorUserId } });
      if (files.length > 0) {
        const existingFileIds = post.attachedFiles?.map(f => f.id) || [];
        const newFiles = files.filter(f => !existingFileIds.includes(f.id));
        if (newFiles.length > 0) {
          // 임시 context를 POST context로 변환
          for (const file of newFiles) {
            if (file.contextId) {
              const context = await this.fileContextRepository.findOne({
                where: { id: file.contextId }
              });

              if (context && context.contextId.startsWith('temp_')) {
                // 임시 context를 POST context로 변환
                context.contextType = FileContextType.POST;
                context.contextId = post.id;
                context.purpose = FilePurpose.CONTENT;
                await this.fileContextRepository.save(context);

                this.logger.log(`Converted temporary context ${context.id} to POST context for post ${post.id}`);
              }
            }
          }

          post.attachedFiles = [...(post.attachedFiles || []), ...newFiles];
          await this.postsRepository.save(post);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to link files from content for post ${post.id}:`, error.message);
    }
  }

  // UUID 기반 S3 키 추출 개선
  private extractS3KeyFromUrl(url: string): string | null {
    if (!url) return null;
    
    try {
      // 이미 S3 키인 경우 (uploads/로 시작)
      if (url.startsWith('uploads/')) {
        return url;
      }
      
      // 프록시 URL인 경우 (/api/v1/files/proxy/ 포함)
      if (url.includes('/api/v1/files/proxy/')) {
        const proxyMatch = url.match(/\/api\/v1\/files\/proxy\/(.+)/);
        if (proxyMatch) {
          const s3Key = proxyMatch[1].split('?')[0]; // 쿼리 파라미터 제거
          this.logger.log(`Extracted S3 key from proxy URL: ${url} -> ${s3Key}`);
          return s3Key;
        }
      }
      
      // S3 직접 URL인 경우 (UUID 파일명 포함)
      const s3Pattern = /https:\/\/[^\/]+\.s3\.[^\/]+\.amazonaws\.com\/(.+)/;
      const match = url.match(s3Pattern);
      if (match) {
        const s3Key = match[1].split('?')[0]; // 쿼리 파라미터 제거 (presigned URL의 경우)
        this.logger.log(`Extracted S3 key from S3 URL: ${url} -> ${s3Key}`);
        return s3Key;
      }
      
      // localhost 프록시 URL 처리 (개발 환경)
      if (url.includes('localhost:3000/api/v1/files/proxy/')) {
        const proxyMatch = url.match(/localhost:3000\/api\/v1\/files\/proxy\/(.+)/);
        if (proxyMatch) {
          const s3Key = proxyMatch[1].split('?')[0];
          this.logger.log(`Extracted S3 key from localhost proxy URL: ${url} -> ${s3Key}`);
          return s3Key;
        }
      }
      
      this.logger.warn(`Could not extract S3 key from URL: ${url}`);
      return null;
    } catch (error) {
      this.logger.error('Error extracting S3 key from URL:', error);
      return null;
    }
  }

  /**
   * 작성자 데이터 포맷팅 (프로필 평탄화 및 CDN URL 변환)
   * users.service.ts와 동일한 패턴 적용
   */
  private formatAuthorData(author: any): any {
    let profileImage: string | null = null;

    // 디버그 로그 추가
    this.logger.debug(`[formatAuthorData] Input author:`, {
      id: author.id,
      username: author.username,
      hasProfile: !!author.profile,
      profile: author.profile
    });

    // Phase 1 리팩토링: profiles 테이블 필드를 User 객체에 flatten (Frontend 호환성)
    if (author.profile) {
      profileImage = author.profile.profileImage;
      this.logger.debug(`[formatAuthorData] Profile image from profile table:`, profileImage);
    } else {
      // profile이 없는 경우 author 객체 자체에 있는지 확인
      profileImage = author.profileImage;
      this.logger.debug(`[formatAuthorData] Profile image from author object:`, profileImage);
    }

    // 프로필 이미지를 CDN URL로 변환 (v2/, uploads/ 모두 처리)
    if (profileImage) {
      if (profileImage.startsWith('v2/') || profileImage.startsWith('uploads/')) {
        // CDN 서비스 활성화 - S3 키를 CDN URL로 변환
        profileImage = this.cdnService.generateCdnUrlFromKey(profileImage);
        this.logger.debug(`[formatAuthorData] CDN URL converted:`, profileImage);
      }
    } else {
      this.logger.debug(`[formatAuthorData] No profile image found for user:`, author.id);
    }

    // 필요한 필드만 선택하여 반환 (email 제외)
    const result = {
      id: author.id,
      username: author.username,
      bio: author.bio || null,
      role: author.role,
      profileImage: profileImage, // optimizeImageUrl 제거 - CDN URL이 이미 최적화됨
    };

    this.logger.debug(`[formatAuthorData] Final result:`, {
      id: result.id,
      profileImage: result.profileImage
    });

    return result;
  }

  // 좋아요 토글 (최적화된 원자적 업데이트)
  async toggleLike(id: string, user: User | null): Promise<{ liked: boolean }> {
    if (!user?.id) throw new ForbiddenException('로그인한 유저만 좋아요를 누를 수 있습니다.');
    
    // 1. 현재 좋아요 상태 확인 (트랜잭션 없이)
    const existingLike = await this.postsRepository.manager
      .query(
        'SELECT 1 FROM post_likes WHERE "postId" = $1 AND "userId" = $2',
        [id, user.id]
      );

    const isLiked = existingLike.length > 0;

    // 2. 한 번의 트랜잭션으로 원자적 처리
    await this.postsRepository.manager.transaction(async manager => {
      if (isLiked) {
        // 좋아요 취소
        await manager.query(
          'DELETE FROM post_likes WHERE "postId" = $1 AND "userId" = $2',
          [id, user.id]
        );
        await manager.query(
          'UPDATE posts SET "likeCount" = GREATEST(0, "likeCount" - 1), version = version + 1 WHERE id = $1',
          [id]
        );
      } else {
        // 좋아요 추가 (ON CONFLICT로 중복 방지)
        const insertResult = await manager.query(
          'INSERT INTO post_likes ("postId", "userId") VALUES ($1, $2) ON CONFLICT ("postId", "userId") DO NOTHING RETURNING *',
          [id, user.id]
        );
        
        // 실제로 삽입되었을 때만 카운트 증가
        if (insertResult.length > 0) {
          await manager.query(
            'UPDATE posts SET "likeCount" = "likeCount" + 1, version = version + 1 WHERE id = $1',
            [id]
          );
        }
      }
    });

    return { liked: !isLiked };
  }

  /**
   * 배치로 좋아요 처리 (Queue 시스템용)
   *
   * @param likes - 큐에서 가져온 좋아요 요청 배열
   * @returns 처리된 요청 수
   *
   * 동작:
   * 1. user-post 조합으로 중복 제거 (마지막 액션만 유효)
   * 2. 한 트랜잭션으로 모든 요청 처리
   * 3. post_likes 테이블 INSERT/DELETE
   * 4. posts.likeCount 원자적 업데이트
   */
  async processBatchLikes(likes: Array<{
    id: string;
    postId: string;
    userId: string;
    action: 'like' | 'unlike';
  }>): Promise<number> {
    if (likes.length === 0) return 0;

    // 1. 중복 제거: 같은 user-post 조합은 마지막 요청만 처리
    const uniqueLikes = new Map<string, typeof likes[0]>();
    for (const like of likes) {
      const key = `${like.userId}:${like.postId}`;
      uniqueLikes.set(key, like);
    }

    const processedLikes = Array.from(uniqueLikes.values());
    this.logger.log(
      `배치 처리: ${likes.length}개 요청 → ${processedLikes.length}개 유니크 요청`,
    );

    // 2. 포스트별로 그룹화 (likeCount 업데이트 최적화)
    const postGroups = new Map<string, typeof processedLikes>();
    for (const like of processedLikes) {
      if (!postGroups.has(like.postId)) {
        postGroups.set(like.postId, []);
      }
      postGroups.get(like.postId).push(like);
    }

    // 3. 트랜잭션으로 일괄 처리
    await this.postsRepository.manager.transaction(async (manager) => {
      for (const [postId, postLikes] of postGroups.entries()) {
        // 각 포스트의 현재 좋아요 상태 확인
        const existingLikes = await manager.query(
          'SELECT "userId" FROM post_likes WHERE "postId" = $1 AND "userId" = ANY($2)',
          [postId, postLikes.map(l => l.userId)],
        );

        const existingUserIds = new Set(existingLikes.map(row => row.userId));
        let likeCountChange = 0;

        // 각 요청 처리
        for (const like of postLikes) {
          const isCurrentlyLiked = existingUserIds.has(like.userId);

          if (like.action === 'like' && !isCurrentlyLiked) {
            // 좋아요 추가
            await manager.query(
              'INSERT INTO post_likes ("postId", "userId") VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [postId, like.userId],
            );
            likeCountChange++;
          } else if (like.action === 'unlike' && isCurrentlyLiked) {
            // 좋아요 취소
            await manager.query(
              'DELETE FROM post_likes WHERE "postId" = $1 AND "userId" = $2',
              [postId, like.userId],
            );
            likeCountChange--;
          }
        }

        // likeCount 업데이트 (변경이 있을 때만)
        if (likeCountChange !== 0) {
          if (likeCountChange > 0) {
            await manager.query(
              'UPDATE posts SET "likeCount" = "likeCount" + $1, version = version + 1 WHERE id = $2',
              [likeCountChange, postId],
            );
          } else {
            await manager.query(
              'UPDATE posts SET "likeCount" = GREATEST(0, "likeCount" + $1), version = version + 1 WHERE id = $2',
              [likeCountChange, postId],
            );
          }
        }
      }
    });

    // 4. 좋아요 처리 후 인기 포스트 캐시 무효화
    // 인기 순위 산정에 likeCount가 포함되므로 무효화 필요
    // popularity_score = viewCount + (likeCount × 3) + (commentCount × 2)
    // 이벤트 발행으로 캐시 무효화 (CacheInvalidationListener가 처리)
    if (processedLikes.length > 0) {
      // 영향받은 모든 포스트에 대해 이벤트 발행
      const affectedPostIds = new Set(processedLikes.map(like => like.postId));
      for (const postId of affectedPostIds) {
        this.eventEmitter.emit('post.popularity.updated', { postId });
      }
    }

    return processedLikes.length;
  }


  // 조회수 증가 (로그인 유저만)
  private async incrementViewCountForUser(post: Post, user: User) {
    if (!user?.id) return;
    post.viewCount = (post.viewCount || 0) + 1;
    await this.postsRepository.save(post);
  }

  // 조회수 증가 (모든 사용자)
  private async incrementViewCountForAll(postId: string): Promise<void> {
    await this.postsRepository.increment({ id: postId }, 'viewCount', 1);
  }

  // 공개 API: 조회수 증가 (모든 사용자)
  async incrementViewCount(postId: string): Promise<void> {
    const post = await this.postsRepository.findOne({
      where: { id: postId, isPublished: true }
    });
    
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    
    await this.incrementViewCountForAll(postId);
  }

  async getCategories(): Promise<string[]> {
    const categories = await this.postsRepository
      .createQueryBuilder('post')
      .select('DISTINCT post.category', 'category')
      .where('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.status = :status', { status: 'published' })
      .andWhere('post.category IS NOT NULL')
      .getRawMany();

    return categories.map(cat => cat.category);
  }

  async getPostsByCategory(category: string, page: number = 1, limit: number = 10): Promise<{ posts: Post[]; total: number }> {
    // 서비스 레이어에서도 이중 검증
    const safeLimit = Math.min(Math.max(limit, 1), 20); // 최대 20개
    const safePage = Math.max(page, 1);
    const query = this.postsRepository.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.status = :status', { status: 'published' })
      .andWhere('post.category = :category', { category });

    const [posts, total] = await query
      .orderBy('post.publishedAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    return { posts, total };
  }

  // 댓글 수 증가
  async incrementCommentCount(postId: string): Promise<void> {
    await this.postsRepository.increment({ id: postId }, 'commentCount', 1);
  }

  // 댓글 수 감소
  async decrementCommentCount(postId: string): Promise<void> {
    await this.postsRepository.decrement({ id: postId }, 'commentCount', 1);
  }

  // ===================================================
  // Optimistic Locking 메서드들 (Phase 2)
  // ===================================================

  /**
   * 낙관적 잠금을 사용한 댓글 수 증가
   *
   * @description
   * - version 컬럼으로 동시성 제어
   * - 충돌 시 최대 3회 재시도
   * - Lost Update 방지
   *
   * @동작원리
   * 1. PostStats 조회 (version 포함)
   * 2. commentCount 증가
   * 3. save() 시 TypeORM이 자동으로 WHERE version = oldVersion 추가
   * 4. 충돌 시 OptimisticLockVersionMismatchError 발생 → 재시도
   *
   * @param postId - 포스트 ID
   * @param maxRetries - 최대 재시도 횟수 (기본: 3)
   * @returns 업데이트된 PostStats
   */
  async incrementCommentCountWithOptimisticLock(
    postId: string,
    maxRetries: number = 3,
  ): Promise<void> {
    let retries = 0;

    while (retries < maxRetries) {
      try {
        // 1. 현재 stats 조회 (version 포함)
        const stats = await this.postStatsRepository.findOne({
          where: { postId },
        });

        if (!stats) {
          this.logger.error(`PostStats not found for post ${postId}`);
          return; // 댓글 수는 중요도가 낮으므로 무시
        }

        // 2. 댓글 수 증가
        stats.incrementCommentCount();

        // 3. 저장 (TypeORM이 자동으로 version 체크)
        // UPDATE post_stats SET commentCount = ?, version = version + 1
        // WHERE postId = ? AND version = ?
        await this.postStatsRepository.save(stats);

        this.logger.debug(
          `Comment count incremented for post ${postId}, version ${stats.version} → ${stats.version + 1}`,
        );

        return;
      } catch (error) {
        // OptimisticLockVersionMismatchError 감지
        if (error instanceof OptimisticLockVersionMismatchError) {
          retries++;
          this.logger.warn(
            `Optimistic lock conflict for post ${postId}, retry ${retries}/${maxRetries}`,
          );

          if (retries >= maxRetries) {
            this.logger.error(
              `Failed to increment comment count for post ${postId} after ${maxRetries} retries`,
            );
            return; // 댓글 수는 중요도가 낮으므로 무시
          }

          // 재시도 전 짧은 대기 (지수 백오프: 10ms, 20ms, 40ms)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, retries) * 10),
          );
          continue;
        }

        // 다른 에러는 그대로 throw
        throw error;
      }
    }
  }

  /**
   * 낙관적 잠금을 사용한 댓글 수 감소
   */
  async decrementCommentCountWithOptimisticLock(
    postId: string,
    maxRetries: number = 3,
  ): Promise<void> {
    let retries = 0;

    while (retries < maxRetries) {
      try {
        const stats = await this.postStatsRepository.findOne({
          where: { postId },
        });

        if (!stats) {
          this.logger.error(`PostStats not found for post ${postId}`);
          return;
        }

        // 댓글 수 감소 (0 이하로 내려가지 않도록 보호)
        stats.decrementCommentCount();

        await this.postStatsRepository.save(stats);

        this.logger.debug(
          `Comment count decremented for post ${postId}, version ${stats.version} → ${stats.version + 1}`,
        );

        return;
      } catch (error) {
        if (error instanceof OptimisticLockVersionMismatchError) {
          retries++;
          this.logger.warn(
            `Optimistic lock conflict for post ${postId}, retry ${retries}/${maxRetries}`,
          );

          if (retries >= maxRetries) {
            this.logger.error(
              `Failed to decrement comment count for post ${postId} after ${maxRetries} retries`,
            );
            return;
          }

          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, retries) * 10),
          );
          continue;
        }

        throw error;
      }
    }
  }

  /**
   * 낙관적 잠금을 사용한 좋아요 수 증가
   *
   * @description
   * 동시에 여러 사용자가 좋아요를 클릭해도 Lost Update 방지
   *
   * @param postId - 포스트 ID
   * @param maxRetries - 최대 재시도 횟수 (기본: 3)
   * @returns 업데이트된 PostStats
   */
  async incrementLikeCountWithOptimisticLock(
    postId: string,
    maxRetries: number = 3,
  ): Promise<PostStats> {
    let retries = 0;

    while (retries < maxRetries) {
      try {
        // 1. 현재 stats 조회 (version 포함)
        const stats = await this.postStatsRepository.findOne({
          where: { postId },
        });

        if (!stats) {
          throw new NotFoundException(
            `PostStats not found for post ${postId}`,
          );
        }

        // 2. 좋아요 수 증가
        stats.incrementLikeCount();

        // 3. 저장 (TypeORM이 자동으로 version 체크)
        const updatedStats = await this.postStatsRepository.save(stats);

        this.logger.debug(
          `Like count incremented for post ${postId}, version ${stats.version} → ${updatedStats.version}`,
        );

        return updatedStats;
      } catch (error) {
        // OptimisticLockVersionMismatchError 감지
        if (error instanceof OptimisticLockVersionMismatchError) {
          retries++;
          this.logger.warn(
            `Optimistic lock conflict for post ${postId}, retry ${retries}/${maxRetries}`,
          );

          if (retries >= maxRetries) {
            // 최대 재시도 초과
            // OptimisticLockVersionMismatchError는 version 정보를 직접 제공하지 않음
            // 에러 메시지에서 파싱하거나 0으로 전달
            throw new OptimisticLockException(
              'PostStats',
              postId,
              0, // expectedVersion - TypeORM에서 제공하지 않음
              0, // actualVersion - TypeORM에서 제공하지 않음
            );
          }

          // 재시도 전 짧은 대기 (지수 백오프)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, retries) * 10),
          );
          continue;
        }

        // 다른 에러는 그대로 throw
        throw error;
      }
    }
  }

  /**
   * 낙관적 잠금을 사용한 좋아요 수 감소
   */
  async decrementLikeCountWithOptimisticLock(
    postId: string,
    maxRetries: number = 3,
  ): Promise<PostStats> {
    let retries = 0;

    while (retries < maxRetries) {
      try {
        const stats = await this.postStatsRepository.findOne({
          where: { postId },
        });

        if (!stats) {
          throw new NotFoundException(
            `PostStats not found for post ${postId}`,
          );
        }

        // 좋아요 수 감소 (0 이하로 내려가지 않도록 보호)
        stats.decrementLikeCount();

        const updatedStats = await this.postStatsRepository.save(stats);

        this.logger.debug(
          `Like count decremented for post ${postId}, version ${stats.version} → ${updatedStats.version}`,
        );

        return updatedStats;
      } catch (error) {
        if (error instanceof OptimisticLockVersionMismatchError) {
          retries++;
          this.logger.warn(
            `Optimistic lock conflict for post ${postId}, retry ${retries}/${maxRetries}`,
          );

          if (retries >= maxRetries) {
            // OptimisticLockVersionMismatchError는 version 정보를 직접 제공하지 않음
            throw new OptimisticLockException(
              'PostStats',
              postId,
              0, // expectedVersion - TypeORM에서 제공하지 않음
              0, // actualVersion - TypeORM에서 제공하지 않음
            );
          }

          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, retries) * 10),
          );
          continue;
        }

        throw error;
      }
    }
  }

  /**
   * 조회수 배치 업데이트 (낙관적 잠금)
   *
   * @description
   * Redis에 쌓인 조회수를 DB에 동기화
   * 여러 사용자의 조회수를 한 번에 업데이트하므로 낙관적 잠금 필수
   *
   * @param postId - 포스트 ID
   * @param incrementBy - 증가할 조회수
   */
  async batchIncrementViewCount(
    postId: string,
    incrementBy: number,
    maxRetries: number = 3,
  ): Promise<PostStats> {
    let retries = 0;

    while (retries < maxRetries) {
      try {
        const stats = await this.postStatsRepository.findOne({
          where: { postId },
        });

        if (!stats) {
          throw new NotFoundException(
            `PostStats not found for post ${postId}`,
          );
        }

        // 조회수 배치 증가
        stats.incrementViewCount(incrementBy);

        const updatedStats = await this.postStatsRepository.save(stats);

        this.logger.debug(
          `View count batch updated for post ${postId}: +${incrementBy}, version ${stats.version} → ${updatedStats.version}`,
        );

        return updatedStats;
      } catch (error) {
        if (error instanceof OptimisticLockVersionMismatchError) {
          retries++;
          this.logger.warn(
            `Optimistic lock conflict for post ${postId}, retry ${retries}/${maxRetries}`,
          );

          if (retries >= maxRetries) {
            // 조회수는 중요도가 낮으므로 에러 로깅만 하고 기존 stats 반환
            this.logger.error(
              `Failed to update view count for post ${postId} after ${maxRetries} retries`,
            );
            const stats = await this.postStatsRepository.findOne({
              where: { postId },
            });
            return stats; // 업데이트 실패해도 기존 stats 반환
          }

          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, retries) * 10),
          );
          continue;
        }

        throw error;
      }
    }
  }

  // ❌ DEPRECATED: Entity의 @BeforeInsert에서 UUID로 고유성 보장
  // 이 메소드는 더 이상 사용되지 않음 (DB 부하 방지)
  // private async ensureUniqueSlug(post: Post): Promise<void> {}

  async generateMissingSlugs(): Promise<void> {
    const postsWithoutSlugs = await this.postsRepository.find({
      where: { slug: null },
    });

    for (const post of postsWithoutSlugs) {
      const baseSlug = post.title
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 100);
      
      // 날짜 추가로 고유성 보장 (생성일 기준)
      const date = post.createdAt.toISOString().split('T')[0];
      const slug = `${date}-${baseSlug}`;
      
      // 중복 체크
      let finalSlug = slug;
      let counter = 1;
      while (await this.postsRepository.findOne({ where: { slug: finalSlug } })) {
        finalSlug = `${slug}-${counter}`;
        counter++;
      }
      
      post.slug = finalSlug;
      await this.postsRepository.save(post);
    }
  }

  // 포스트 ID로 블로그 정보 가져오기
  async getBlogByPostId(postId: string): Promise<any> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ['blog'],
    });
    
    if (!post || !post.blog) {
      throw new NotFoundException('Post or blog not found');
    }
    
    return post.blog;
  }

  // 기존 게시글들의 파일 연결 재처리 (UUID 기반)
  async relinkContentFiles(): Promise<void> {
    const posts = await this.postsRepository.find({
      // author relation 제거 - authorId 직접 사용
    });

    this.logger.log(`Starting to relink content files for ${posts.length} posts`);

    for (const post of posts) {
      try {
        // Lazy loading 방지: authorId 직접 사용
        await this.linkFilesFromContent(post, post.authorId);
        this.logger.log(`✅ Relinked files for post: ${post.title}`);
      } catch (error) {
        this.logger.error(`❌ Failed to relink files for post ${post.id}:`, error.message);
      }
    }

    this.logger.log('Finished relinking content files');
  }

  // 사용되지 않는 이미지 파일 정리 (S3 + DB)
  // @deprecated 자동 삭제 비활성화 - 사용자가 수동으로 관리하도록 변경
  private async cleanupUnusedImages(postId: string, oldContent: string, newContent: string, userId: string): Promise<void> {
    // 자동 이미지 삭제 비활성화
    // 이유: 사용자가 나중에 재사용할 수 있는 이미지를 보존하기 위함
    // 추후 사용자 대시보드에서 수동 관리 기능 제공 예정
    this.logger.log('[Image Cleanup] Auto-cleanup disabled - preserving all uploaded images');
    
    // 분석용 로깅만 수행 (실제 삭제는 하지 않음)
    try {
      const oldImageUrls = this.extractImageUrlsFromContent(oldContent);
      const newImageUrls = this.extractImageUrlsFromContent(newContent);
      const removedImageUrls = oldImageUrls.filter(url => !newImageUrls.includes(url));
      
      if (removedImageUrls.length > 0) {
        this.logger.log(`[Image Cleanup] ${removedImageUrls.length} images removed from post ${postId} (not deleted):`, removedImageUrls);
      }
    } catch (error) {
      this.logger.error('[Image Cleanup] Analysis failed:', error.message);
    }
    
    return;
  }

  // 콘텐츠에서 이미지 URL 추출 (img 태그의 src 속성)
  private extractImageUrlsFromContent(content: string): string[] {
    if (!content) return [];

    const imgRegex = /<img[^>]+src="([^">]+)"/gi;
    const urls: string[] = [];
    let match;

    while ((match = imgRegex.exec(content)) !== null) {
      if (match[1]) {
        // 쿼리 파라미터 제거
        const cleanUrl = match[1].split('?')[0];
        urls.push(cleanUrl);
      }
    }

    return urls;
  }

  // 콘텐츠에서 썸네일 URL 추출
  private extractThumbnailFromContent(content: string): string | null {
    if (!content) return null;

    // HTML에서 첫 번째 img 태그의 src 추출
    const imgRegex = /<img[^>]+src="([^">]+)"/i;
    const match = content.match(imgRegex);
    
    if (match && match[1]) {
      return match[1];
    }

    return null;
  }

  /**
   * 포스트당 총 파일 용량 검증
   * @param files 업로드할 파일들
   * @param existingPostId 기존 포스트 ID (수정 시)
   */
  async validatePostTotalSize(files: File[], existingPostId?: string): Promise<void> {
    let totalSize = 0;

    // 신규 파일들의 총 크기 계산
    for (const file of files) {
      totalSize += file.fileSize || 0;
    }

    // 기존 포스트 수정인 경우, 이미 업로드된 파일들의 크기도 포함
    if (existingPostId) {
      // Post와 연관된 파일들을 찾기 위해 FileContext를 통해 조회
      const existingPost = await this.postsRepository.findOne({
        where: { id: existingPostId },
        relations: ['attachedFiles'],
      });
      
      if (existingPost?.attachedFiles) {
        for (const existingFile of existingPost.attachedFiles) {
          // 새로 추가되는 파일과 중복되지 않는 경우만 계산
          if (!files.some(f => f.id === existingFile.id)) {
            totalSize += existingFile.fileSize || 0;
          }
        }
      }
    }

    // 30MB 제한 체크
    if (totalSize > this.MAX_POST_TOTAL_SIZE) {
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      const limitMB = (this.MAX_POST_TOTAL_SIZE / (1024 * 1024)).toFixed(0);
      
      throw new BadRequestException({
        error: 'POST_SIZE_LIMIT_EXCEEDED',
        message: `포스트당 최대 ${limitMB}MB까지 업로드 가능합니다. 현재 크기: ${totalSizeMB}MB`,
        current: totalSize,
        limit: this.MAX_POST_TOTAL_SIZE,
      });
    }
  }

  /**
   * 신규 파일 업로드 시 포스트 용량 체크
   */
  async validateNewFileForPost(postId: string, newFileSize: number): Promise<void> {
    // Post와 연관된 파일들을 찾기
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ['attachedFiles'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existingFiles = post.attachedFiles || [];
    const totalSize = existingFiles.reduce((sum, file) => sum + (file.fileSize || 0), 0);

    if (totalSize + newFileSize > this.MAX_POST_TOTAL_SIZE) {
      const currentSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      const newSizeMB = (newFileSize / (1024 * 1024)).toFixed(2);
      const limitMB = (this.MAX_POST_TOTAL_SIZE / (1024 * 1024)).toFixed(0);
      
      throw new BadRequestException({
        error: 'POST_SIZE_LIMIT_EXCEEDED',
        message: `포스트당 최대 ${limitMB}MB까지 업로드 가능합니다. 현재: ${currentSizeMB}MB, 추가하려는 파일: ${newSizeMB}MB`,
        current: totalSize,
        limit: this.MAX_POST_TOTAL_SIZE,
        requested: newFileSize,
      });
    }
  }

  // 마크다운 콘텐츠인지 확인하는 헬퍼 메소드
  private isMarkdownContent(content: string): boolean {
    if (!content) return false;
    
    // 마크다운 패턴 검사
    const markdownPatterns = [
      /^#{1,6}\s+/m, // 헤딩
      /\*\*.*\*\*/, // 굵은 글씨
      /\*.*\*/, // 기울임
      /^\s*[-*+]\s+/m, // 리스트
      /^\s*\d+\.\s+/m, // 번호 리스트
      /```[\s\S]*?```/, // 코드 블록
      /`[^`]+`/, // 인라인 코드
      /\[.*?\]\(.*?\)/, // 링크
      /!\[.*?\]\(.*?\)/, // 이미지
      /^---$/m, // 수평선
      /^>\s+/m, // 인용문
    ];
    
    return markdownPatterns.some(pattern => pattern.test(content));
  }

  // 마크다운 재렌더링 (필요시 호출)
  async rerenderMarkdown(postId: string): Promise<void> {
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post || !post.content_markdown) {
      throw new NotFoundException('Post with markdown content not found');
    }
    
    const htmlContent = this.markdownRenderer.convertToHtml(post.content_markdown);
    // 백엔드에서 콘텐츠 처리 파이프라인 적용
    const processed = await this.contentProcessing.processMarkdownHtml(htmlContent, {
      sanitize: true,
      processCode: true,
      processImages: true,
      preserveMermaid: true,
    });
    post.content = processed.html;
    post.content_rendered_at = new Date();
    post.thumbnail = this.extractThumbnailFromContent(post.content);
    
    await this.postsRepository.save(post);
  }

  /**
   * 이미지 URL 최적화 (캐싱으로 성능 개선)
   * - YouTube 썸네일은 그대로 반환 (외부 CDN 활용)
   * - S3 URL은 CloudFront CDN URL로 변환 (있는 경우)
   * - 나머지는 프록시 URL 유지
   *
   * 성능 최적화:
   * - 빠른 실패: null/YouTube 체크를 먼저 수행
   * - 불필요한 문자열 연산 최소화
   */
  /**
   * 이미지 URL 최적화 (CDN 사용)
   * @param url - 원본 이미지 URL 또는 S3 키
   * @returns CDN URL 또는 원본 URL
   */
  private optimizeImageUrl(url: string | null): string | null {
    // 빠른 실패: null 체크
    if (!url) return null;

    // 빠른 실패: YouTube 썸네일은 YouTube CDN 활용
    if (url.indexOf('youtube.com') !== -1 || url.indexOf('ytimg.com') !== -1) {
      return url;
    }

    // CDN URL이 이미 있으면 그대로 반환
    if (url.indexOf('cdn.codebase.blog') !== -1) {
      return url;
    }

    // 외부 HTTP/HTTPS URL은 그대로 반환
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // S3 키 (uploads/, v2/ 등)는 CDN URL로 변환
    if (url.startsWith('uploads/') || url.startsWith('v2/')) {
      // Temporarily disabled CDN service
      // return this.cdnService.generateCdnUrlFromKey(url);
      return url; // Return original URL for now
    }

    return url;
  }

  /**
   * 인기 태그 조회 (JSONB 컬럼에서 집계)
   * 캐시를 통해 성능 최적화 (1시간)
   */
  async getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    // PostgreSQL JSONB 배열을 풀어서 집계하는 쿼리
    const result = await this.postsRepository
      .createQueryBuilder('post')
      .select('jsonb_array_elements_text(post.tags) as tag')
      .addSelect('COUNT(*)', 'count')
      .where('post.isPublished = true')
      .andWhere('post.status = :status', { status: 'published' })
      .andWhere('jsonb_array_length(post.tags) > 0')
      .groupBy('tag')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    // 결과 포맷팅
    return result.map(row => ({
      tag: row.tag,
      count: parseInt(row.count, 10),
    }));
  }

  /**
   * Editor's Pick 토글 (Admin 전용)
   * @description 관리자가 특정 포스트를 Editor's Pick으로 지정하거나 해제
   * @param postId - 포스트 ID
   * @param user - 관리자 사용자 정보
   * @returns 업데이트된 포스트 정보
   */
  async toggleEditorPick(postId: string, user: User): Promise<{ message: string; isEditorPick: boolean }> {
    // Admin 권한 확인
    this.logger.debug(`[toggleEditorPick] User role: "${user.role}", Role.ADMIN: "${Role.ADMIN}", Match: ${user.role === Role.ADMIN}`);

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Editor\'s Pick 권한이 없습니다.');
    }

    // 포스트 조회
    const post = await this.postsRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    // Editor's Pick 토글
    post.isEditorPick = !post.isEditorPick;
    post.editorPickedAt = post.isEditorPick ? new Date() : null;

    await this.postsRepository.save(post);

    this.logger.log(`Editor's Pick ${post.isEditorPick ? 'enabled' : 'disabled'} for post ${postId} by admin ${user.id}`);

    // Editor's Pick 토글 이벤트 발행 (캐시 무효화용)
    this.eventEmitter.emit('post.editorPick.toggled', {
      postId: post.id,
      isPicked: post.isEditorPick,
    });

    return {
      message: post.isEditorPick ? 'Editor\'s Pick으로 선정되었습니다.' : 'Editor\'s Pick에서 해제되었습니다.',
      isEditorPick: post.isEditorPick,
    };
  }

  /**
   * Editor's Pick 목록 조회
   * @description 관리자가 선정한 추천 포스트 목록 (최신 순)
   * @param limit - 조회할 개수 (기본: 5, 최대: 10)
   * @returns Editor's Pick 포스트 목록
   *
   * 최적화:
   * - content, content_markdown 제외 (목록에 불필요한 대용량 필드)
   * - leftJoin + select/addSelect로 필요한 필드만 선택
   * - 민감한 정보 제외 (password, refreshToken, email)
   * - 복합 인덱스 활용 (isEditorPick, editorPickedAt DESC)
   */
  async findEditorPicks(limit: number = 5): Promise<{ posts: PostResponseDto[], total: number }> {
    // limit 제한 (최대 10개)
    const safeLimit = Math.min(Math.max(1, limit), 10);

    // 최적화된 쿼리 빌더
    // findAll 메서드와 동일한 패턴 사용
    const query = this.postsRepository.createQueryBuilder('post')
      .select([
        'post.id',
        'post.title',
        'post.slug',
        'post.excerpt', // 포스트 요약 (목록 표시용)
        // content와 content_markdown 제외 - 목록에서 불필요
        'post.content_type',
        'post.thumbnail',
        'post.isPublished',
        'post.viewCount',
        'post.likeCount',
        'post.commentCount',
        'post.qualityScore',
        'post.tags',
        'post.category',
        'post.blogId',
        'post.authorId',
        'post.createdAt',
        'post.updatedAt',
        'post.publishedAt',
        'post.version',
        'post.isEditorPick', // Editor's Pick 여부
        'post.editorPickedAt', // Editor's Pick 선정 시간
      ])
      .addSelect([
        'author.id',
        'author.username',
        // author.email 제외 - 보안상 제거
        'author.role',
      ])
      // author의 profile 관계 설정 (Phase 1-2-3: profileImage, bio는 profiles 테이블로 이동)
      .leftJoin('post.author', 'author')
      .leftJoin('author.profile', 'profile')
      .addSelect([
        'profile.profileImage',
        'profile.bio',
      ])
      .addSelect([
        'blog.id',
        'blog.slug',
        'blog.name',
        'blog.isPublic',
      ])
      .leftJoin('post.blog', 'blog')
      .where('post.isEditorPick = :isEditorPick', { isEditorPick: true })
      .andWhere('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.status = :status', { status: 'published' })
      .orderBy('post.editorPickedAt', 'DESC') // 최신 Pick 순
      .take(safeLimit);

    const [posts, total] = await query.getManyAndCount();

    // DTO 변환
    const postDtos = posts.map(post =>
      this.toPostDto(post, {
        user: post.author,
        blog: post.blog,
      })
    );

    return {
      posts: postDtos,
      total,
    };
  }

  /**
   * 사용자의 모든 카테고리 목록 조회 (자동완성용)
   *
   * @param userId - 사용자 ID
   * @returns 카테고리 목록 (사용 빈도순 정렬)
   */
  async getUserCategories(userId: string): Promise<string[]> {
    const result = await this.postsRepository
      .createQueryBuilder('post')
      .select('post.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('post.authorId = :userId', { userId })
      .andWhere('post.category IS NOT NULL')
      .groupBy('post.category')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map(row => row.category);
  }

  /**
   * 특정 블로그의 카테고리별 포스트 개수 조회
   *
   * @param blogSlug - 블로그 슬러그
   * @returns 카테고리별 포스트 개수 (내림차순)
   */
  async getBlogCategoriesWithCount(blogSlug: string): Promise<Array<{ category: string; count: number }>> {
    const result = await this.postsRepository
      .createQueryBuilder('post')
      .select('post.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .leftJoin('post.blog', 'blog')
      .where('blog.slug = :blogSlug', { blogSlug })
      .andWhere('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.category IS NOT NULL')
      .groupBy('post.category')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map(row => ({
      category: row.category,
      count: parseInt(row.count, 10),
    }));
  }

  /**
   * Sitemap 생성을 위한 모든 발행된 포스트 조회
   *
   * @description
   * SEO 최적화를 위해 sitemap.xml 생성 시 사용됩니다.
   * - 발행된 포스트(isPublished = true)만 조회
   * - 공개 블로그의 포스트만 포함
   * - 성능을 위해 최소 필드만 SELECT (slug, blogSlug, updatedAt)
   * - relations 없이 조회하여 쿼리 최적화
   * - 페이지네이션 없이 전체 데이터 반환
   *
   * @returns 발행된 포스트의 slug, blogSlug, updatedAt 배열
   */
  async getAllPublishedPostsForSitemap(): Promise<Array<{ slug: string; blogSlug: string; updatedAt: Date }>> {
    const posts = await this.postsRepository
      .createQueryBuilder('post')
      .select(['post.slug', 'post.updatedAt'])
      .addSelect('blog.slug', 'blogSlug')
      .leftJoin('post.blog', 'blog')
      .where('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('blog.isPublic = :isPublic', { isPublic: true })
      .orderBy('post.updatedAt', 'DESC')
      .getRawMany();

    this.logger.debug(`[Sitemap] Found ${posts.length} published posts`);

    return posts.map(row => ({
      slug: row.post_slug,
      blogSlug: row.blogSlug,
      updatedAt: row.post_updatedAt
    }));
  }

  /**
   * Cursor Pagination으로 포스트 조회
   *
   * @description
   * 대규모 데이터셋에서 일정한 성능을 보장하는 커서 기반 페이지네이션
   *
   * @성능_비교
   * - OFFSET 10만번째: SELECT * FROM posts OFFSET 99999 LIMIT 20 → 28ms (99,999개 스캔)
   * - CURSOR 10만번째: SELECT * FROM posts WHERE (publishedAt, id) < cursor LIMIT 20 → 3ms (인덱스 직접 접근)
   *
   * @동작원리
   * 1. cursor 디코딩: Base64 → "2025-01-20T12:00:00.000Z|abc123" → [publishedAt, id]
   * 2. WHERE 조건: (publishedAt < cursor_date) OR (publishedAt = cursor_date AND id < cursor_id)
   * 3. ORDER BY publishedAt DESC, id DESC (복합 인덱스 사용)
   * 4. LIMIT+1 조회로 hasMore 판단
   * 5. nextCursor 생성: 마지막 아이템의 [publishedAt, id] → Base64
   *
   * @인덱스_요구사항
   * - idx_posts_home_feed_covering (isPublished, publishedAt DESC, id DESC) INCLUDE (...)
   *
   * @param dto - GetPostsCursorDto (cursor, limit, sort, filters)
   * @param user - 현재 사용자 (liked/bookmarked 상태 확인용)
   * @returns CursorPaginatedPostsDto (posts, nextCursor, hasMore, count)
   */
  async getPostsCursor(
    dto: GetPostsCursorDto,
    user?: User,
  ): Promise<CursorPaginatedPostsDto> {
    const limit = dto.limit || 20;
    const sort = dto.sort || 'recent';

    // Cursor 디코딩 (Base64 → publishedAt|id)
    let cursorPublishedAt: Date | null = null;
    let cursorId: string | null = null;

    if (dto.cursor) {
      try {
        const decoded = Buffer.from(dto.cursor, 'base64').toString('utf-8');
        const [dateStr, id] = decoded.split('|');
        cursorPublishedAt = new Date(dateStr);
        cursorId = id;

        this.logger.debug(`[Cursor Decoded] publishedAt=${cursorPublishedAt.toISOString()}, id=${cursorId}`);
      } catch (error) {
        this.logger.error(`[Cursor Decode Failed] ${error.message}`);
        throw new BadRequestException('Invalid cursor format');
      }
    }

    // QueryBuilder 생성 (findAll과 동일한 SELECT 필드)
    const query = this.postsRepository.createQueryBuilder('post')
      .select([
        'post.id',
        'post.title',
        'post.slug',
        'post.excerpt',
        'post.content_type',
        'post.thumbnail',
        'post.isPublished',
        'post.viewCount',
        'post.likeCount',
        'post.commentCount',
        'post.qualityScore',
        'post.tags',
        'post.category',
        'post.blogId',
        'post.authorId',
        'post.createdAt',
        'post.updatedAt',
        'post.publishedAt',
        'post.version',
        'post.isEditorPick',
        'post.editorPickedAt',
      ])
      .addSelect([
        'author.id',
        'author.username',
        'author.role',
      ])
      .leftJoin('post.author', 'author')
      .leftJoin('author.profile', 'profile')
      .addSelect([
        'profile.profileImage',
        'profile.bio',
      ])
      .addSelect([
        'blog.id',
        'blog.slug',
        'blog.name',
        'blog.isPublic',
      ])
      .leftJoin('post.blog', 'blog')
      .leftJoin('post.stats', 'stats')
      .leftJoin('post.metadata', 'metadata');

    // 기본 필터: 삭제되지 않은 발행된 포스트만
    query.where('post.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.status = :status', { status: 'published' })
      .andWhere('blog.isPublic = :isPublic', { isPublic: true });

    // 필터: 카테고리
    if (dto.category) {
      query.andWhere('post.category = :category', { category: dto.category });
    }

    // 필터: 블로그
    if (dto.blogSlug) {
      query.andWhere('blog.slug = :blogSlug', { blogSlug: dto.blogSlug });
    }

    // 필터: 검색 (제목, 태그)
    if (dto.search) {
      // 검색어 정리 및 길이 제한 (보안 강화)
      const sanitizedSearch = dto.search
        .trim()
        .slice(0, 100) // 최대 100자 제한
        .replace(/[<>\"'%;()&+]/g, ''); // 위험 문자 제거

      if (sanitizedSearch) {
        query.andWhere(
          '(post.title ILIKE :search OR post.tags::text ILIKE :search)',
          { search: `%${sanitizedSearch}%` }
        );
      }
    }

    // Cursor 조건 추가 (정렬 방식별)
    if (sort === 'recent') {
      // 최신순: publishedAt DESC, id DESC
      if (cursorPublishedAt && cursorId) {
        query.andWhere(
          '(post.publishedAt < :cursorDate OR (post.publishedAt = :cursorDate AND post.id < :cursorId))',
          { cursorDate: cursorPublishedAt, cursorId }
        );
      }
      query.orderBy('post.publishedAt', 'DESC')
        .addOrderBy('post.id', 'DESC');

    } else if (sort === 'popular') {
      // 인기순: popularity_score DESC
      // popularity_score = viewCount + (likeCount × 3) + (commentCount × 2)
      query.addSelect(
        'post.viewCount + (post.likeCount * 3) + (post.commentCount * 2)',
        'popularity_score'
      );

      if (cursorPublishedAt && cursorId) {
        // popular 정렬에서는 popularity_score와 id를 cursor로 사용
        // cursor 형식: score|id
        const decoded = Buffer.from(dto.cursor!, 'base64').toString('utf-8');
        const [scoreStr, id] = decoded.split('|');
        const cursorScore = parseInt(scoreStr, 10);

        query.andWhere(
          '(post.viewCount + (post.likeCount * 3) + (post.commentCount * 2) < :cursorScore OR ' +
          '(post.viewCount + (post.likeCount * 3) + (post.commentCount * 2) = :cursorScore AND post.id < :cursorId))',
          { cursorScore, cursorId: id }
        );
      }

      query.orderBy('popularity_score', 'DESC')
        .addOrderBy('post.id', 'DESC');

    } else if (sort === 'trending') {
      // 트렌딩: 최근 7일 내 인기순
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      query.andWhere('post.publishedAt >= :sevenDaysAgo', { sevenDaysAgo });
      query.addSelect(
        'post.viewCount + (post.likeCount * 3) + (post.commentCount * 2)',
        'trending_score'
      );

      if (cursorPublishedAt && cursorId) {
        const decoded = Buffer.from(dto.cursor!, 'base64').toString('utf-8');
        const [scoreStr, id] = decoded.split('|');
        const cursorScore = parseInt(scoreStr, 10);

        query.andWhere(
          '(post.viewCount + (post.likeCount * 3) + (post.commentCount * 2) < :cursorScore OR ' +
          '(post.viewCount + (post.likeCount * 3) + (post.commentCount * 2) = :cursorScore AND post.id < :cursorId))',
          { cursorScore, cursorId: id }
        );
      }

      query.orderBy('trending_score', 'DESC')
        .addOrderBy('post.id', 'DESC');
    }

    // LIMIT+1 조회 (hasMore 판단용)
    const posts = await query.limit(limit + 1).getMany();

    // hasMore 판단
    const hasMore = posts.length > limit;
    if (hasMore) {
      posts.pop(); // 마지막 아이템 제거
    }

    // nextCursor 생성
    let nextCursor: string | null = null;
    if (hasMore && posts.length > 0) {
      const lastPost = posts[posts.length - 1];

      if (sort === 'recent') {
        // cursor 형식: publishedAt|id
        const cursorStr = `${lastPost.publishedAt.toISOString()}|${lastPost.id}`;
        nextCursor = Buffer.from(cursorStr).toString('base64');
      } else if (sort === 'popular' || sort === 'trending') {
        // cursor 형식: score|id
        const score = lastPost.viewCount + (lastPost.likeCount * 3) + (lastPost.commentCount * 2);
        const cursorStr = `${score}|${lastPost.id}`;
        nextCursor = Buffer.from(cursorStr).toString('base64');
      }
    }

    // liked, bookmarked 상태 확인 (로그인 사용자만)
    let postDtos: PostResponseDto[];
    if (user) {
      const postIds = posts.map(p => p.id);
      const [likedMap, bookmarkedMap] = await Promise.all([
        this.getLikedStatusMap(postIds, user.id),
        this.bookmarksService.areBookmarked(user.id, postIds),
      ]);

      postDtos = posts.map(post =>
        this.toPostDto(post, {
          user: post.author,
          blog: post.blog,
          liked: likedMap.get(post.id) || false,
          bookmarked: bookmarkedMap.get(post.id) || false,
        })
      );
    } else {
      postDtos = posts.map(post =>
        this.toPostDto(post, {
          user: post.author,
          blog: post.blog,
        })
      );
    }

    this.logger.debug(`[Cursor Pagination] Returned ${posts.length} posts, hasMore=${hasMore}`);

    return {
      posts: postDtos,
      nextCursor,
      hasMore,
      count: posts.length,
    };
  }

  /**
   * 사용자가 좋아요한 포스트 ID Map 조회
   * @private
   */
  private async getLikedStatusMap(postIds: string[], userId: string): Promise<Map<string, boolean>> {
    const likedPosts = await this.dataSource.query(
      `SELECT "postId" FROM post_likes WHERE "postId" = ANY($1) AND "userId" = $2`,
      [postIds, userId]
    );

    const likedMap = new Map<string, boolean>();
    likedPosts.forEach((row: any) => {
      likedMap.set(row.postId, true);
    });

    return likedMap;
  }
} 