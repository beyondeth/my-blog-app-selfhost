import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository, InjectDataSource } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder, Like, In, DataSource } from "typeorm";
import { Post } from "../entities/post.entity";
import { PostStats } from "../entities/post-stats.entity";
import { User } from "../../users/entities/user.entity";
import { Profile } from "../../users/entities/profile.entity";
import { Blog } from "../../blogs/entities/blog.entity";
import { PostMapperService } from "./post-mapper.service";
import {
  PostsReadRepository,
  ReadPolicy,
} from "../repositories/posts-read.repository";
import { MaterializedViewService } from "../../common/services/materialized-view.service";
import {
  PostInteractionStatusService,
  PostInteractionStatus,
} from "./post-interaction-status.service";
import { GetPostsCursorDto } from "../dto/get-posts-cursor.dto";
import { CursorPaginatedPostsDto } from "../dto/cursor-paginated-posts.dto";
import { CacheService, CacheKeys, CacheTTL } from "../../cache/cache.service";
import { PostAccessPolicyService } from "./post-access-policy.service";

/**
 * 포스트 조회 및 검색 서비스
 *
 * 책임:
 * - 포스트 조회 (단건, 리스트, 커서 기반 페이징)
 * - 검색 (전문 검색, 태그 검색)
 * - 정렬 및 필터링
 * - 인기 포스트 조회
 */
@Injectable()
export class PostReadService {
  private readonly logger = new Logger(PostReadService.name);
  private readonly detailCacheTtl = CacheTTL.SHORT;
  private readonly detailLockTtlSeconds = 5;
  private readonly detailLockWaitMs = 700;
  private readonly canonicalDetailRelations = new Set([
    "author",
    "author.profile",
    "blog",
    "thumbnailImage",
    "attachedFiles",
    "stats",
    "metadata",
  ]);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(PostStats)
    private readonly postStatsRepository: Repository<PostStats>,
    @InjectRepository(Blog)
    private readonly blogsRepository: Repository<Blog>,
    private readonly postsReadRepository: PostsReadRepository,
    private readonly postMapperService: PostMapperService,
    private readonly materializedViewService: MaterializedViewService,
    private readonly postInteractionStatusService: PostInteractionStatusService,
    private readonly cacheService: CacheService,
    private readonly postAccessPolicyService: PostAccessPolicyService =
      new PostAccessPolicyService(),
    @InjectDataSource()
    private readonly dataSource: DataSource = undefined as any,
  ) {}

  async findMyPublishedPosts(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      search?: string;
      category?: string;
      tag?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<{ posts: Post[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(50, Math.max(1, options?.limit || 20));
    const queryBuilder = this.postsRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.blog", "blog")
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("author.profile", "profile")
      .leftJoinAndSelect("post.stats", "stats")
      .leftJoin("post.metadata", "metadata")
      .addSelect([
        "metadata.readingTimeMinutes",
        "metadata.wordCount",
        "metadata.lastEditedAt",
      ])
      .where("post.authorId = :userId", { userId })
      .andWhere("post.isPublished = true")
      .andWhere("post.status = :status", { status: "published" })
      .andWhere("post.isDeleted = false");

    if (options?.category) {
      queryBuilder.andWhere("post.category = :category", {
        category: options.category,
      });
    }

    if (options?.tag) {
      queryBuilder.andWhere("post.tags @> :tag", {
        tag: JSON.stringify([options.tag]),
      });
    }

    if (options?.dateFrom) {
      queryBuilder.andWhere(`post.publishedAt >= :dateFrom`, {
        dateFrom: options.dateFrom,
      });
    }

    if (options?.dateTo) {
      queryBuilder.andWhere(`post.publishedAt <= :dateTo`, {
        dateTo: options.dateTo,
      });
    }

    const sanitizedSearch = options?.search
      ?.trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
      .replace(/\s+/g, " ");

    if (sanitizedSearch) {
      queryBuilder
        .addSelect(
          `ts_rank(post.search_vector, plainto_tsquery('simple', :searchQuery))`,
          "search_rank",
        )
        .andWhere(
          `(post.search_vector @@ plainto_tsquery('simple', :searchQuery)
            OR post.title ILIKE :searchLike
            OR post.excerpt ILIKE :searchLike
            OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(post.tags) AS tag
              WHERE tag ILIKE :searchLike
            ))`,
          {
            searchQuery: sanitizedSearch,
            searchLike: `%${sanitizedSearch}%`,
          },
        )
        .orderBy("search_rank", "DESC")
        .addOrderBy("post.publishedAt", "DESC");
    } else {
      queryBuilder.orderBy("post.publishedAt", "DESC");
    }

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [posts, total] = await queryBuilder.getManyAndCount();
    return { posts, total, page, limit };
  }

  async findMyPublishedPostById(userId: string, postId: string): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: {
        id: postId,
        authorId: userId,
        isPublished: true,
        status: "published",
        isDeleted: false,
      },
      relations: [
        "blog",
        "author",
        "author.profile",
        "stats",
        "metadata",
        "thumbnailImage",
        "attachedFiles",
      ],
    });

    if (!post) {
      throw new NotFoundException("발행된 포스트를 찾을 수 없습니다.");
    }

    return post;
  }

  /**
   * 연관 포스트 추천 (Relevance + Popularity)
   *
   * @param postId 기준 포스트 ID
   * @param limit 반환할 개수 (default: 6)
   * @returns 추천 포스트 목록
   */
  async getRelatedPosts(
    postId: string,
    limit: number = 6,
    user?: User,
  ): Promise<Post[]> {
    // 1. 기준 포스트 정보 조회 (Category, Tags, BlogId)
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ["blog"],
      select: ["id", "category", "tags", "blogId", "authorId"],
    });

    if (!post || !post.blogId) {
      return [];
    }

    const isOwnerOrAdmin = this.postAccessPolicyService.isOwnerOrAdmin(user, {
      authorId: post.authorId,
      blogOwnerId: post.blog?.userId,
    });

    const { blogId, category, tags } = post;
    const relevanceLimit = Math.ceil(limit * 0.7); // 70% 연관성

    // 2. 연관성 기반 조회 (같은 카테고리 OR 태그 겹침)
    // 최신순 정렬
    const relevanceQuery = this.postsRepository
      .createQueryBuilder("post");
    if (typeof (relevanceQuery as any).innerJoin === "function") {
      (relevanceQuery as any).innerJoin("post.blog", "blog");
    }
    relevanceQuery
      .leftJoinAndSelect("post.thumbnailImage", "thumbnailImage")
      .leftJoinAndSelect("post.stats", "stats") // 조회수, 좋아요 표시용
      .leftJoin("post.metadata", "metadata") // 메타데이터 조건용
      .addSelect(["metadata.excerpt", "metadata.readingTimeMinutes"]) // 필요한 필드만
      .where("post.blogId = :blogId", { blogId })
      .andWhere("post.id != :postId", { postId }) // 현재 포스트 제외
      .andWhere("post.isPublished = true")
      .andWhere("post.isDeleted = false");

    if (!isOwnerOrAdmin) {
      relevanceQuery
        .andWhere("post.visibility = :publicVisibility", {
          publicVisibility:
            this.postAccessPolicyService.getPublicVisibilityQueryValue(),
        })
        .andWhere("blog.isPublic = true");
    }

    // 카테고리 또는 태그 조건 (OR 로직)
    const conditions: string[] = [];
    const params: any = {};

    if (category) {
      conditions.push("post.category = :category");
      params.category = category;
    }

    // JSONB 태그 배열 교집합 확인 (PostgreSQL operator)
    if (tags && tags.length > 0) {
      // tags 컬럼이 jsonb라고 가정 (Post 엔티티 확인됨)
      // post.tags ?| :tags -> tags 배열 중 하나라도 포함되면 true
      conditions.push(
        "jsonb_exists_any(post.tags, ARRAY[:...tags]::text[])",
      );
      params.tags = tags;
    }

    if (conditions.length > 0) {
      relevanceQuery.andWhere(`(${conditions.join(" OR ")})`, params);
    }

    const relatedPosts = await relevanceQuery
      .orderBy("post.publishedAt", "DESC") // 최신 연관글 우선
      .take(relevanceLimit)
      .getMany();

    // 3. 인기 기반 조회 (조회수 높은 순)
    // 이미 뽑힌 relatedPosts 제외
    const excludedIds = [postId, ...relatedPosts.map((p) => p.id)];

    // 부족한 개수만큼 인기글로 채움
    const remainingLimit = limit - relatedPosts.length;

    let popularPosts: Post[] = [];
    if (remainingLimit > 0) {
      const popularityQuery = this.postsRepository
        .createQueryBuilder("post");
      if (typeof (popularityQuery as any).innerJoin === "function") {
        (popularityQuery as any).innerJoin("post.blog", "blog");
      }
      popularityQuery
        .leftJoinAndSelect("post.thumbnailImage", "thumbnailImage")
        .leftJoinAndSelect("post.stats", "stats")
        .leftJoin("post.metadata", "metadata")
        .addSelect(["metadata.excerpt", "metadata.readingTimeMinutes"])
        .where("post.blogId = :blogId", { blogId })
        .andWhere("post.id NOT IN (:...excludedIds)", { excludedIds })
        .andWhere("post.isPublished = true")
        .andWhere("post.isDeleted = false");

      if (!isOwnerOrAdmin) {
        popularityQuery
          .andWhere("post.visibility = :publicVisibility", {
            publicVisibility:
              this.postAccessPolicyService.getPublicVisibilityQueryValue(),
          })
          .andWhere("blog.isPublic = true");
      }

      // PostStats와 조인하여 viewCount 정렬 (Index 활용 확인 필요하지만 일단 기능 구현)
      // Note: Post 엔티티에 viewCount 컬럼(역정규화)이 있다면 그것을 쓰는게 빠름.
      // Post 엔티티에 viewCount가 있으므로 그것을 사용.
      popularPosts = await popularityQuery
        .orderBy("post.viewCount", "DESC")
        .take(remainingLimit)
        .getMany();
    }

    // 4. 병합 (연관성 우선 + 인기순)
    return [...relatedPosts, ...popularPosts];
  }

  /**
   * 포스트를 ID로 조회
   *
   * @param id 포스트 ID
   * @param relations 로드할 관계 데이터
   * @param user 사용자 정보 (썸네일, 좋아요 상태 확인용)
   * @returns 포스트 응답 DTO
   */
  async findById(
    id: string,
    relations: string[] = [],
    user?: User,
  ): Promise<any> {
    const canUseReadCache = !user && this.canUseCanonicalDetailCache(relations);
    const cacheKey = CacheKeys.POST_CORE(id);
    const lockKey = `post:detail:lock:id:${id}`;
    let lockAcquired = false;

    if (canUseReadCache) {
      const cached = await this.cacheService.get<any>(cacheKey);
      if (cached && this.canAccessCachedPost(cached, user)) {
        return this.applyInteractionToDto(cached, user);
      }

      lockAcquired = await this.cacheService.acquireLock(
        lockKey,
        this.detailLockTtlSeconds,
      );

      if (!lockAcquired) {
        await this.cacheService.waitForLock(lockKey, this.detailLockWaitMs);
        const waitedCached = await this.cacheService.get<any>(cacheKey);
        if (waitedCached && this.canAccessCachedPost(waitedCached, user)) {
          return this.applyInteractionToDto(waitedCached, user);
        }
      }
    }

    // 쿼리 빌더 최적화 로직은 Repository로 위임
    try {
      // V4: ReadPolicy.Replica (기본 지연 일관성 채택)
      const post = await this.postsReadRepository.findByIdWithRelations(
        id,
        relations,
        ReadPolicy.Replica,
      );

      if (!post) {
        throw new NotFoundException("포스트를 찾을 수 없습니다.");
      }

      const isOwnerOrAdmin = this.postAccessPolicyService.isOwnerOrAdmin(user, {
        authorId: post.authorId,
        blogOwnerId: post.blog?.userId,
      });

      // 게시글이 비공개인 경우
      if (!post.isPublished) {
        this.logger.debug(
          `[findById] Post ${id} is not published. Checking permissions. User: ${user?.id}, Author: ${post.authorId}, BlogOwner: ${post.blog?.userId}`,
        );

        // 작성자 본인 또는 블로그 소유자만 접근 가능
        if (!user) {
          this.logger.warn(
            `[findById] Unauthorized access attempt to draft post ${id}`,
          );
          throw new UnauthorizedException("로그인이 필요합니다.");
        }

        if (!isOwnerOrAdmin) {
          this.logger.warn(
            `[findById] Forbidden access attempt by user ${user.id} to draft post ${id}`,
          );
          throw new ForbiddenException("접근 권한이 없습니다.");
        }
      }

      // 포스트가 비공개인 경우 (소유자/관리자만 접근 가능)
      if (
        this.postAccessPolicyService.normalizeVisibility(post.visibility) ===
          this.postAccessPolicyService.PRIVATE_VISIBILITY &&
        !isOwnerOrAdmin
      ) {
        throw new NotFoundException("게시글을 찾을 수 없습니다.");
      }

      // 블로그가 비공개인 경우 (소유자/관리자만 접근 가능)
      if (post.blog && !post.blog.isPublic && !isOwnerOrAdmin) {
        throw new NotFoundException("게시글을 찾을 수 없습니다.");
      }

      const baseDto = await this.toBaseDetailDto(post);

      if (
        canUseReadCache &&
        this.postAccessPolicyService.isPubliclyReadablePost(post, post.blog)
      ) {
        await this.cachePublishedDetail(post, baseDto);
      }

      if (user) {
        const viewerDto = await this.toViewerDetailDto(post, user);
        return this.applyInteractionToDto(viewerDto, user);
      }

      return this.applyInteractionToDto(baseDto, user);
    } finally {
      if (lockAcquired) {
        await this.cacheService.releaseLock(lockKey);
      }
    }
  }

  /**
   * 포스트를 slug로 조회
   *
   * @param slug 포스트 slug
   * @param user 사용자 정보 (인증 상태 확인용)
   * @returns 포스트 상세 정보
   */
  async findBySlug(
    slug: string,
    user?: User,
    options?: { bypassCache?: boolean },
  ): Promise<any> {
    const shouldBypassCache = options?.bypassCache === true;
    const canUseReadCache = !user && !shouldBypassCache;
    this.logger.log(
      `[findBySlug] Looking up slug: ${slug}${shouldBypassCache ? " (bypass-cache)" : ""}`,
    );

    const cacheKey = CacheKeys.POST_BY_SLUG(slug);
    const lockKey = `post:detail:lock:slug:${slug}`;
    let lockAcquired = false;

    if (canUseReadCache) {
      const cachedSlugEntry = await this.cacheService.get<any>(cacheKey);
      if (cachedSlugEntry) {
        if (typeof cachedSlugEntry === "string") {
          const cachedById = await this.cacheService.get<any>(
            CacheKeys.POST_CORE(cachedSlugEntry),
          );
          if (cachedById && this.canAccessCachedPost(cachedById, user)) {
            return this.applyInteractionToDto(cachedById, user);
          }
        } else if (
          cachedSlugEntry?.id &&
          this.canAccessCachedPost(cachedSlugEntry, user)
        ) {
          // 이전 버전 호환: slug 키에 DTO가 저장되어 있던 경우
          return this.applyInteractionToDto(cachedSlugEntry, user);
        }
      }

      lockAcquired = await this.cacheService.acquireLock(
        lockKey,
        this.detailLockTtlSeconds,
      );

      if (!lockAcquired) {
        await this.cacheService.waitForLock(lockKey, this.detailLockWaitMs);
        const waitedSlugEntry = await this.cacheService.get<any>(cacheKey);
        if (waitedSlugEntry) {
          if (typeof waitedSlugEntry === "string") {
            const waitedById = await this.cacheService.get<any>(
              CacheKeys.POST_CORE(waitedSlugEntry),
            );
            if (waitedById && this.canAccessCachedPost(waitedById, user)) {
              return this.applyInteractionToDto(waitedById, user);
            }
          } else if (
            waitedSlugEntry?.id &&
            this.canAccessCachedPost(waitedSlugEntry, user)
          ) {
            return this.applyInteractionToDto(waitedSlugEntry, user);
          }
        }
      }
    }

    try {
      // V4: Repository 위임 및 기본 Replica 동작
      const post = await this.postsReadRepository.findBySlugWithRelations(
        slug,
        ReadPolicy.Replica,
      );

      if (!post) {
        throw new NotFoundException("게시글을 찾을 수 없습니다.");
      }

      const isOwnerOrAdmin = this.postAccessPolicyService.isOwnerOrAdmin(user, {
        authorId: post.authorId,
        blogOwnerId: post.blog?.userId,
      });

      // 게시글이 비공개인 경우
      if (!post.isPublished) {
        // 작성자 본인 또는 블로그 소유자만 접근 가능
        if (!user || !isOwnerOrAdmin) {
          throw new NotFoundException("게시글을 찾을 수 없습니다.");
        }
      }

      // 포스트가 비공개인 경우 (소유자/관리자만 접근 가능)
      if (
        this.postAccessPolicyService.normalizeVisibility(post.visibility) ===
          this.postAccessPolicyService.PRIVATE_VISIBILITY &&
        !isOwnerOrAdmin
      ) {
        throw new NotFoundException("게시글을 찾을 수 없습니다.");
      }

      // 블로그가 비공개인 경우 (소유자/관리자만 접근 가능)
      if (post.blog && !post.blog.isPublic && !isOwnerOrAdmin) {
        throw new NotFoundException("게시글을 찾을 수 없습니다.");
      }

      const baseDto = await this.toBaseDetailDto(post);

      if (
        canUseReadCache &&
        this.postAccessPolicyService.isPubliclyReadablePost(post, post.blog)
      ) {
        await this.cachePublishedDetail(post, baseDto);
      }

      if (user) {
        const viewerDto = await this.toViewerDetailDto(post, user);
        return this.applyInteractionToDto(viewerDto, user);
      }

      return this.applyInteractionToDto(baseDto, user);
    } finally {
      if (lockAcquired) {
        await this.cacheService.releaseLock(lockKey);
      }
    }
  }

  private canUseCanonicalDetailCache(relations: string[]): boolean {
    return relations.every((relation) =>
      this.canonicalDetailRelations.has(relation),
    );
  }

  private canAccessCachedPost(cachedPost: any, user?: User): boolean {
    const authorId = cachedPost?.author?.id ?? cachedPost?.authorId;
    const blogOwnerId = cachedPost?.blog?.userId;
    const isOwnerOrAdmin = this.postAccessPolicyService.isOwnerOrAdmin(user, {
      authorId,
      blogOwnerId,
    });

    if (isOwnerOrAdmin) {
      return true;
    }

    const normalizedVisibility =
      this.postAccessPolicyService.normalizeVisibility(cachedPost?.visibility);

    return (
      cachedPost?.isPublished !== false &&
      cachedPost?.isDeleted !== true &&
      normalizedVisibility ===
        this.postAccessPolicyService.getPublicVisibilityQueryValue() &&
      cachedPost?.blog?.isPublic !== false
    );
  }

  private async toBaseDetailDto(post: Post): Promise<any> {
    return this.postMapperService.toPostDto(post, {
      user: post.author,
      blog: post.blog,
      bookmarked: false,
      liked: false,
      userVote: null,
    });
  }

  private async toViewerDetailDto(post: Post, viewer: User): Promise<any> {
    return this.postMapperService.toPostDto(post, {
      user: post.author,
      viewer,
      blog: post.blog,
      bookmarked: false,
      liked: false,
      userVote: null,
      exposeGithubResourceUrl: true,
    });
  }

  private async cachePublishedDetail(post: Post, dto: any): Promise<void> {
    await Promise.all([
      this.cacheService.set(
        CacheKeys.POST_CORE(post.id),
        dto,
        this.detailCacheTtl,
      ),
      this.cacheService.set(
        CacheKeys.POST_BY_SLUG(post.slug),
        post.id,
        this.detailCacheTtl,
      ),
    ]);
  }

  private async applyInteractionToDto(dto: any, user?: User): Promise<any> {
    const responseDto = { ...dto };

    if (!user) {
      return responseDto;
    }

    const interactionStatuses =
      await this.postInteractionStatusService.getMultipleInteractionStatuses(
        [dto.id],
        user.id,
      );
    const interaction = interactionStatuses.get(dto.id) || {
      bookmarked: false,
      liked: false,
      userVote: null,
    };

    responseDto.bookmarked = interaction.bookmarked;
    responseDto.liked = interaction.liked;
    responseDto.userVote = interaction.userVote;

    return responseDto;
  }

  /**
   * 커서 기반 페이징으로 포스트 목록 조회
   *
   * @param dto 조회 조건 DTO
   * @param user 사용자 정보
   * @returns 커서 기반 페이징된 포스트 목록
   */
  async getPostsCursor(
    dto: GetPostsCursorDto,
    user?: User,
  ): Promise<CursorPaginatedPostsDto> {
    this.logger.debug(`[getPostsCursor] Query: ${JSON.stringify(dto)}`);

    // 쿼리 빌더 최적화 로직은 Repository로 위임
    // V4: ReadPolicy.Replica (기본 지연 일관성 채택)
    const queryBuilder =
      this.postsReadRepository.getCursorPaginatedQueryBuilder(
        dto,
        user,
        ReadPolicy.Replica,
      );

    if (dto.search) {
      const sanitizedSearch = this.sanitizeSearchTerm(dto.search);
      if (!sanitizedSearch) {
        throw new BadRequestException(
          "검색어에 허용되지 않는 문자가 포함되어 있습니다.",
        );
      }

      const hasMultipleTerms = sanitizedSearch.includes(" ");
      const tsQueryInput = hasMultipleTerms
        ? sanitizedSearch.split(" ").join(" & ")
        : sanitizedSearch;

      try {
        if (hasMultipleTerms) {
          queryBuilder
            .addSelect(
              `ts_rank(post.search_vector, to_tsquery('simple', :searchQuery))`,
              "search_rank",
            )
            .andWhere(
              `post.search_vector @@ to_tsquery('simple', :searchQuery)`,
              { searchQuery: tsQueryInput },
            );
        } else {
          queryBuilder
            .addSelect(
              `ts_rank(post.search_vector, plainto_tsquery('simple', :searchQuery))`,
              "search_rank",
            )
            .andWhere(
              `post.search_vector @@ plainto_tsquery('simple', :searchQuery)`,
              { searchQuery: tsQueryInput },
            );
        }
      } catch (error) {
        this.logger.warn(
          `[Search] Full-text search failed, falling back to ILIKE: ${error instanceof Error ? error.message : String(error)}`,
        );
        queryBuilder.andWhere(
          `EXISTS (SELECT 1 FROM jsonb_array_elements_text(post.tags) as tag WHERE tag ILIKE :searchTerm)`,
          { searchTerm: `%${sanitizedSearch}%` },
        );
      }
    }

    const effectiveSortBy: NonNullable<GetPostsCursorDto["sortBy"]> = (() => {
      if (dto.sort && (!dto.sortBy || dto.sortBy === "recent")) {
        switch (dto.sort) {
          case "popular":
            return "likes";
          case "trending":
            return "views";
          default:
            return "recent";
        }
      }

      if (!dto.sortBy) {
        return "recent";
      }

      if (dto.sortBy === "popular") {
        return "likes";
      }

      if (dto.sortBy === "trending") {
        return "views";
      }

      return dto.sortBy;
    })();
    const sortOrder = dto.sortOrder || "DESC";

    switch (effectiveSortBy) {
      case "recent":
        if (dto.search) {
          queryBuilder
            .orderBy("search_rank", "DESC")
            .addOrderBy("post.publishedAt", "DESC");
        } else {
          queryBuilder.orderBy("post.publishedAt", "DESC");
        }
        break;
      case "published":
        queryBuilder.orderBy("post.publishedAt", sortOrder);
        break;
      case "views":
        queryBuilder.orderBy("post.viewCount", sortOrder);
        break;
      case "likes":
        queryBuilder.orderBy("post.likeCount", sortOrder);
        break;
      case "comments":
        queryBuilder.orderBy("post.commentCount", sortOrder);
        break;
      case "title":
        queryBuilder.orderBy(
          "post.title",
          sortOrder === "ASC" ? "ASC" : "DESC",
        );
        break;
      case "editorPicks":
        queryBuilder
          .orderBy("post.isEditorPick", "DESC")
          .addOrderBy("post.publishedAt", "DESC");
        break;
      default:
        queryBuilder.orderBy("post.publishedAt", "DESC");
    }

    if (dto.cursor) {
      const cursorDirection = sortOrder === "ASC" ? ">" : "<";
      if (dto.search) {
        queryBuilder.andWhere(
          `(search_rank, post.publishedAt) ${cursorDirection} (:searchRank, :cursor)`,
          {
            searchRank: dto.cursorRank || 0,
            cursor: dto.cursor,
          },
        );
      } else {
        const sortField =
          effectiveSortBy === "editorPicks"
            ? "post.isEditorPick"
            : "post.publishedAt";
        queryBuilder.andWhere(`${sortField} ${cursorDirection} :cursor`, {
          cursor: dto.cursor,
        });
      }
    }

    // 결과 수 제한
    const limit = Math.min(dto.limit || 20, 100);
    queryBuilder.limit(limit + 1); // +1 for hasNext check

    // 쿼리 실행
    let posts: Post[];
    try {
      posts = await queryBuilder.getMany();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes("tsquery")
      ) {
        this.logger.warn(
          `[Search] Invalid tsquery input detected: ${error.message}`,
        );
        throw new BadRequestException("검색어 형식이 올바르지 않습니다.");
      }
      throw error;
    }

    // 포스트 ID 목록 추출 (배치 조회용)
    const postIds = posts.map((post) => post.id);

    // 한 번에 사용자 상호작용 상태 조회
    const interactionStatuses = user
      ? await this.postInteractionStatusService.getMultipleInteractionStatuses(
          postIds,
          user.id,
        )
      : new Map<string, PostInteractionStatus>();

    // 응답 데이터 병렬 변환 (성능 최적화)
    const transformedPosts = await Promise.all(
      posts.map(async (post) => {
        const interaction = interactionStatuses.get(post.id);
        const postDto = await this.postMapperService.toPostDto(post, {
          user: post.author,
          blog: post.blog,
          bookmarked: interaction?.bookmarked || false,
          liked: interaction?.liked || false,
          userVote: interaction?.userVote ?? null,
        });

        // 검색 랭크 추가 (검색인 경우)
        if (dto.search && (post as any).search_rank) {
          (postDto as any).searchRank = (post as any).search_rank;
        }

        return postDto;
      }),
    );

    // hasNext 확인
    const hasNext = posts.length > limit;
    if (hasNext) {
      transformedPosts.pop(); // 제거된 마지막 항목은 다음 페이지 확인용
    }

    // 다음 커서 설정
    let nextCursor = null;
    let nextCursorRank = null;
    if (hasNext && posts.length > 0) {
      const lastPost = posts[posts.length - 1];
      nextCursor = lastPost.publishedAt.toISOString();

      if (dto.search && (lastPost as any).search_rank) {
        nextCursorRank = (lastPost as any).search_rank;
      }
    }

    return {
      posts: transformedPosts,
      nextCursor,
      nextCursorRank,
      hasMore: hasNext,
      count: transformedPosts.length,
    };
  }

  /**
   * 인기 포스트 목록 조회 (Materialized View 사용)
   *
   * @param period 기간 (daily, weekly, monthly, all)
   * @param limit 조회 개수
   * @returns 인기 포스트 목록
   */
  async findPopularPosts(
    period: "daily" | "weekly" | "monthly" | "all" = "weekly",
    limit: number = 10,
  ): Promise<Post[]> {
    this.logger.debug(`[findPopularPosts] Period: ${period}, Limit: ${limit}`);

    // Materialized View에서 모든 데이터 조회 (author, blog 정보 포함)
    // 더 이상 재조회 불필요!
    const popularPosts = await this.materializedViewService.getPopularPosts(
      limit * 2,
    ); // 날짜 필터링 고려하여 여유있게 조회

    if (popularPosts.length === 0) {
      return [];
    }

    // 기간 필터링 (메모리에서 처리)
    let filteredPosts = popularPosts;

    if (period !== "all") {
      const now = new Date();
      let dateFrom: Date;

      switch (period) {
        case "daily":
          // 오늘 0시 (KST 기준)
          dateFrom = new Date(now);
          dateFrom.setHours(0, 0, 0, 0);
          break;
        case "weekly":
          // 7일 전
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "monthly":
          // 30일 전
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      // 날짜 필터링
      filteredPosts = popularPosts.filter((post) => {
        const publishedAt = new Date(post.publishedAt);
        return publishedAt >= dateFrom;
      });
    }

    // limit 적용
    const limitedPosts = filteredPosts.slice(0, limit);

    const authorIds = Array.from(
      new Set(
        limitedPosts
          .map((post) => post.authorId)
          .filter((id): id is string => typeof id === "string"),
      ),
    );

    let authorProfileImages = new Map<string, string | null>();
    if (authorIds.length > 0) {
      const profiles = await this.dataSource
        .getRepository(Profile)
        .createQueryBuilder("profile")
        .select(["profile.userId", "profile.profileImage"])
        .where("profile.userId IN (:...authorIds)", { authorIds })
        .getMany();

      authorProfileImages = new Map(
        profiles.map((profile) => [profile.userId, profile.profileImage]),
      );
    }

    // MV 데이터를 Post 엔티티 형식으로 변환
    return limitedPosts.map((mvPost) => {
      // Post 엔티티로 매핑
      const post = new Post();
      post.id = mvPost.id;
      post.title = mvPost.title;
      post.slug = mvPost.slug;
      post.excerpt = mvPost.excerpt;
      post.publishedAt = new Date(mvPost.publishedAt);
      post.createdAt = new Date(mvPost.createdAt);

      // 최소 Author 정보 매핑 (username만)
      const user = new User();
      user.id = mvPost.authorId;
      user.username = mvPost.authorUsername;
      const authorProfileImage = authorProfileImages.get(mvPost.authorId);
      if (authorProfileImage) {
        const profile = new Profile();
        profile.userId = mvPost.authorId;
        profile.profileImage = authorProfileImage;
        user.profile = profile;
      }
      post.author = user;

      // 최소 Blog 정보 매핑 (slug만 - URL 생성용)
      if (mvPost.blogId) {
        const blog = {
          id: mvPost.blogId,
          slug: mvPost.blogSlug,
        };
        post.blog = blog as any;
      }

      // Thumbnail 정보 매핑
      if (mvPost.thumbnail) {
        post.thumbnailImage = {
          id: mvPost.thumbnailImageId,
          fileUrl: mvPost.thumbnail,
        } as any;
      }

      // Stats 정보 매핑
      post.stats = {
        viewCount: mvPost.viewCount || 0,
        likeCount: mvPost.likeCount || 0,
        commentCount: mvPost.commentCount || 0,
      } as any;

      return post;
    });
  }

  /**
   * Editor's Pick 포스트 목록 조회
   *
   * @param limit 조회 개수
   * @returns Editor's Pick 포스트 목록
   */
  async getEditorPicks(limit: number = 5): Promise<Post[]> {
    // 쿼리 빌더로 최적화 - 필요한 컬럼만 선택
    const query = this.postsRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("author.profile", "profile")
      .leftJoinAndSelect("post.blog", "blog")
      .leftJoinAndSelect("post.thumbnailImage", "thumbnailImage")
      .leftJoinAndSelect("post.stats", "stats")
      // metadata에서 필요한 컬럼만 선택
      .leftJoin("post.metadata", "metadata")
      .addSelect([
        "metadata.excerpt",
        "metadata.tags",
        "metadata.category",
        "metadata.isEditorPick",
        "metadata.editorPickedAt",
      ])
      .where("post.isPublished = :isPublished", { isPublished: true })
      .andWhere("post.isDeleted = :isDeleted", { isDeleted: false })
      .andWhere("post.visibility = :postVisibility", {
        postVisibility:
          this.postAccessPolicyService.getPublicVisibilityQueryValue(),
      })
      .andWhere("blog.isPublic = true")
      .andWhere("metadata.isEditorPick = :isEditorPick", { isEditorPick: true })
      .orderBy("metadata.editorPickedAt", "DESC")
      .addOrderBy("post.publishedAt", "DESC")
      .take(limit);

    return query.getMany();
  }

  /**
   * Editor's Pick 포스트 목록 조회 (관리자용)
   *
   * @param limit 조회 개수
   * @returns Editor's Pick 포스트 목록 (비공개/미발행 포함)
   */
  async getEditorPicksAdmin(limit: number = 10): Promise<Post[]> {
    const query = this.postsRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("author.profile", "profile")
      .leftJoinAndSelect("post.blog", "blog")
      .leftJoinAndSelect("post.thumbnailImage", "thumbnailImage")
      .leftJoinAndSelect("post.stats", "stats")
      .leftJoin("post.metadata", "metadata")
      .addSelect([
        "metadata.excerpt",
        "metadata.tags",
        "metadata.category",
        "metadata.isEditorPick",
        "metadata.editorPickedAt",
      ])
      .where("post.isDeleted = :isDeleted", { isDeleted: false })
      .andWhere("metadata.isEditorPick = :isEditorPick", { isEditorPick: true })
      .orderBy("metadata.editorPickedAt", "DESC")
      .addOrderBy("post.updatedAt", "DESC")
      .take(limit);

    return query.getMany();
  }

  /**
   * 모든 카테고리 목록 조회
   *
   * @returns 카테고리 목록
   */
  async getCategories(): Promise<string[]> {
    const result = await this.postsRepository
      .createQueryBuilder("post")
      .innerJoin("post.blog", "blog")
      .select("DISTINCT post.category", "category")
      .where("post.isPublished = true")
      .andWhere("post.isDeleted = false")
      .andWhere("post.status = :status", { status: "published" })
      .andWhere("post.visibility = :postVisibility", {
        postVisibility:
          this.postAccessPolicyService.getPublicVisibilityQueryValue(),
      })
      .andWhere("blog.isPublic = true")
      .andWhere("post.category IS NOT NULL")
      .andWhere("post.category != ''")
      .orderBy("category", "ASC")
      .getRawMany();

    return result.map((row) => row.category);
  }

  /**
   * 특정 카테고리의 포스트 목록 조회
   *
   * @param category 카테고리
   * @param page 페이지 번호
   * @param limit 페이지당 개수
   * @returns 포스트 목록과 총 개수
   */
  async getPostsByCategory(
    category: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ posts: Post[]; total: number }> {
    // 쿼리 빌더로 최적화
    const query = this.postsRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("author.profile", "profile")
      .leftJoinAndSelect("post.blog", "blog")
      .leftJoinAndSelect("post.thumbnailImage", "thumbnailImage")
      .leftJoinAndSelect("post.stats", "stats")
      // metadata에서 필요한 컬럼만 선택
      .leftJoin("post.metadata", "metadata")
      .addSelect(["metadata.excerpt", "metadata.tags", "metadata.category"])
      .where("post.isPublished = :isPublished", { isPublished: true })
      .andWhere("post.isDeleted = :isDeleted", { isDeleted: false })
      .andWhere("post.status = :status", { status: "published" })
      .andWhere("post.visibility = :postVisibility", {
        postVisibility:
          this.postAccessPolicyService.getPublicVisibilityQueryValue(),
      })
      .andWhere("blog.isPublic = true")
      .andWhere("post.category = :category", { category })
      .orderBy("post.publishedAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    const posts = await query.getMany();

    // 전체 개수는 간단히 카운트
    const total = await this.postsRepository
      .createQueryBuilder("post")
      .innerJoin("post.blog", "blog")
      .where("post.isPublished = :isPublished", { isPublished: true })
      .andWhere("post.isDeleted = :isDeleted", { isDeleted: false })
      .andWhere("post.status = :status", { status: "published" })
      .andWhere("post.visibility = :postVisibility", {
        postVisibility:
          this.postAccessPolicyService.getPublicVisibilityQueryValue(),
      })
      .andWhere("blog.isPublic = true")
      .andWhere("post.category = :category", { category })
      .getCount();

    return { posts, total };
  }

  /**
   * 인기 태그 조회
   *
   * @param limit 조회 개수
   * @returns 태그와 사용 횟수 목록
   */
  async getPopularTags(
    limit: number = 20,
  ): Promise<{ tag: string; count: number }[]> {
    // PostgreSQL JSONB 배열을 풀어서 집계하는 쿼리
    const result = await this.postsRepository
      .createQueryBuilder("post")
      .innerJoin("post.blog", "blog")
      .select("jsonb_array_elements_text(post.tags) as tag")
      .addSelect("COUNT(*)", "count")
      .where("post.isPublished = true")
      .andWhere("post.isDeleted = false")
      .andWhere("post.status = :status", { status: "published" })
      .andWhere("post.visibility = :postVisibility", {
        postVisibility:
          this.postAccessPolicyService.getPublicVisibilityQueryValue(),
      })
      .andWhere("blog.isPublic = true")
      .andWhere("jsonb_array_length(post.tags) > 0")
      .groupBy("tag")
      .orderBy("count", "DESC")
      .limit(limit)
      .getRawMany();

    // 결과 포맷팅
    return result.map((row) => ({
      tag: row.tag,
      count: parseInt(row.count, 10),
    }));
  }

  /**
   * 관리자용 모든 포스트 목록 조회
   *
   * @param page 페이지 번호
   * @param limit 페이지당 개수
   * @param search 검색어
   * @returns 포스트 목록과 총 개수
   */
  async findAllForAdmin(
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<{ posts: Post[]; total: number }> {
    const query = this.postsRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("post.blog", "blog");

    if (search) {
      const sanitizedSearch = this.sanitizeSearchTerm(search);
      if (!sanitizedSearch) {
        throw new BadRequestException(
          "검색어에 허용되지 않는 문자가 포함되어 있습니다.",
        );
      }

      const tsQueryInput = sanitizedSearch.split(" ").join(" & ");

      query
        .addSelect(
          `ts_rank(post.search_vector, to_tsquery('simple', :searchQuery))`,
          "search_rank",
        )
        .where(`post.search_vector @@ to_tsquery('simple', :searchQuery)`, {
          searchQuery: tsQueryInput,
        })
        .orderBy("search_rank", "DESC");
    }

    const [posts, total] = await query
      .orderBy("post.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { posts, total };
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
    const query = this.postStatsRepository
      .createQueryBuilder("stats")
      .leftJoin("stats.post", "post")
      .where("post.isDeleted = :isDeleted", { isDeleted: false });

    if (options?.startDate) {
      query.andWhere("post.createdAt >= :startDate", {
        startDate: options.startDate,
      });
    }

    if (options?.endDate) {
      query.andWhere("post.createdAt <= :endDate", {
        endDate: options.endDate,
      });
    }

    if (options?.blogId) {
      query.andWhere("post.blogId = :blogId", { blogId: options.blogId });
    }

    const result = await query
      .select("COUNT(DISTINCT post.id)", "totalPosts")
      .addSelect(
        "COUNT(CASE WHEN post.isPublished = true THEN 1 END)",
        "publishedPosts",
      )
      .addSelect(
        "COUNT(CASE WHEN post.isPublished = false THEN 1 END)",
        "draftPosts",
      )
      .addSelect("SUM(stats.viewCount)", "totalViews")
      .addSelect("SUM(stats.likeCount)", "totalLikes")
      .addSelect("SUM(stats.commentCount)", "totalComments")
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

  private encodePostsCursor(payload: {
    v: 1;
    sortBy: string;
    sortOrder: "ASC" | "DESC";
    values: unknown[];
    id: string | null;
  }): string {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  }

  private decodePostsCursor(
    cursor: string,
    sortBy: string,
    sortOrder: "ASC" | "DESC",
  ): { values: unknown[]; id: string | null } {
    // 이전 API가 발급한 recent/published ISO 커서는 잠시 호환한다.
    if (/^\d{4}-\d{2}-\d{2}T/.test(cursor)) {
      return { values: [cursor], id: null };
    }

    if (typeof cursor !== "string" || cursor.length > 2048) {
      throw new BadRequestException("커서가 유효하지 않습니다.");
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    } catch {
      throw new BadRequestException("커서가 유효하지 않습니다.");
    }

    if (
      !decoded ||
      typeof decoded !== "object" ||
      (decoded as any).v !== 1 ||
      (decoded as any).sortBy !== sortBy ||
      (decoded as any).sortOrder !== sortOrder ||
      !Array.isArray((decoded as any).values) ||
      ((decoded as any).id !== null && typeof (decoded as any).id !== "string")
    ) {
      throw new BadRequestException("커서가 현재 정렬 조건과 일치하지 않습니다.");
    }

    return {
      values: (decoded as any).values,
      id: (decoded as any).id,
    };
  }

  /**
   * 사용자 입력 검색어를 안전하게 정규화
   */
  private sanitizeSearchTerm(term: string): string {
    if (!term) {
      return "";
    }

    const normalized = term.normalize("NFKC");
    if (/[^\p{L}\p{N}\s]/u.test(normalized)) {
      return "";
    }

    return normalized.replace(/\s+/g, " ").trim().slice(0, 100);
  }
}
