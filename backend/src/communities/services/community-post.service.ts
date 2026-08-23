import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, In, SelectQueryBuilder } from "typeorm";
import { Community } from "../entities/community.entity";
import { CommunityPost } from "../entities/community-post.entity";
import { CommunityPostLike } from "../entities/community-post-like.entity";
import { CommunityMember } from "../entities/community-member.entity";
import { CommunityModLog } from "../entities/community-mod-log.entity";
import { CommunityFlair } from "../entities/community-flair.entity";
import {
  CommunityRole,
  CommunityPostStatus,
  ModAction,
  FlairType,
  isModeratorOrAbove,
} from "../enums";
import { VoteType } from "../../posts/enums/vote-type.enum";
import { generateSlug } from "../../posts/utils/post.utils";
import {
  CreateCommunityPostDto,
  UpdateCommunityPostDto,
  GetCommunityPostsQueryDto,
  CommunityPostSortBy,
} from "../dto";
import { CacheService, CacheTTL } from "../../cache/cache.service";
import { RedisLockService } from "../../redis/redis-lock.service";
import { CursorPaginationHelper } from "../../common/dto/pagination.dto";
import { CommunityPostViewService } from "./community-post-view.service";
import { PostContentService } from "../../posts/services/post-content.service";
import { HtmlSanitizerService } from "../../content-processing/services/html-sanitizer.service";

/**
 * 게시물 캐시 키 상수
 */
const PostCacheKeys = {
  POST_BY_SLUG: (communitySlug: string, postSlug: string) =>
    `community:${communitySlug}:post:${postSlug}`,
  POST_BY_ID: (postId: string) => `community:post:${postId}`,
  POST_LIST: (communityId: string, sortBy: string, limit: number) =>
    `community:${communityId}:posts:${sortBy}:limit:${limit}:first`,
  PINNED_POSTS: (communityId: string) => `community:${communityId}:pinned`,
};

interface CommunityPostListCachePayload {
  items: CommunityPost[];
  pinnedPosts?: CommunityPost[];
  hasNext: boolean;
  nextCursor: string | null;
  nextCursorId: string | null;
}

interface CommunityPostCursorPayload {
  id: string;
  createdAt: string;
  sortValue?: number;
}

/**
 * 커뮤니티 게시물 서비스
 *
 * @description 커뮤니티 게시물 CRUD 및 좋아요 기능 담당
 *
 * **설계 원칙:**
 * - 작성자만 수정 가능 (모더레이터는 status, isPinned만 변경 가능)
 * - 좋아요는 분산 락으로 동시성 제어
 * - 조회수는 비동기 업데이트
 */
@Injectable()
export class CommunityPostService {
  private readonly logger = new Logger(CommunityPostService.name);

  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityPost)
    private readonly postRepository: Repository<CommunityPost>,
    @InjectRepository(CommunityPostLike)
    private readonly likeRepository: Repository<CommunityPostLike>,
    @InjectRepository(CommunityMember)
    private readonly memberRepository: Repository<CommunityMember>,
    @InjectRepository(CommunityFlair)
    private readonly flairRepository: Repository<CommunityFlair>,
    @InjectRepository(CommunityModLog)
    private readonly modLogRepository: Repository<CommunityModLog>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    private readonly redisLockService: RedisLockService,
    private readonly communityPostViewService: CommunityPostViewService,
    private readonly htmlSanitizer: HtmlSanitizerService,
    @Optional() private readonly postContentService?: PostContentService,
  ) {}

  // =========================================================================
  // 게시물 CRUD
  // =========================================================================

  /**
   * 게시물 생성
   */
  async create(
    communityId: string,
    dto: CreateCommunityPostDto,
    authorId: string,
  ): Promise<CommunityPost> {
    // 커뮤니티 확인
    const community = await this.communityRepository.findOne({
      where: { id: communityId },
      select: ["id", "slug", "isLocked"],
    });

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    if (community.isLocked) {
      throw new ForbiddenException(
        "현재 커뮤니티가 잠겨 있어 게시물을 작성할 수 없습니다.",
      );
    }

    // 플레어 유효성 검증
    if (dto.flairId) {
      const flair = await this.flairRepository.findOne({
        where: {
          id: dto.flairId,
          communityId,
          type: FlairType.POST,
          isEnabled: true,
        },
      });

      if (!flair) {
        throw new BadRequestException("유효하지 않은 플레어입니다");
      }

      // 모더레이터 전용 플레어 확인
      if (flair.isModOnly) {
        const membership = await this.memberRepository.findOne({
          where: { communityId, userId: authorId },
          select: ["role"],
        });

        if (!membership || !isModeratorOrAbove(membership.role)) {
          throw new ForbiddenException(
            "이 플레어는 모더레이터만 사용할 수 있습니다",
          );
        }
      }
    }

    const canonicalContent = await this.resolveCanonicalContent(
      dto.content,
      dto.contentMarkdown,
    );

    // 게시물 생성
    const post = this.postRepository.create({
      communityId,
      authorId,
      title: this.sanitizeTitleForWrite(dto.title),
      slug: generateSlug(this.sanitizeTitleForWrite(dto.title)), // SEO 친화적 URL
      content: this.sanitizeContent(canonicalContent.html),
      content_markdown: canonicalContent.markdown,
      flairId: dto.flairId,
      thumbnailImageId: dto.thumbnailImageId,
      status: dto.isPublished
        ? CommunityPostStatus.PUBLISHED
        : CommunityPostStatus.DRAFT,
    });

    const saved = await this.postRepository.save(post);

    // PUBLISHED 상태인 경우 postCount 증가
    if (saved.status === CommunityPostStatus.PUBLISHED) {
      await this.communityRepository.increment(
        { id: communityId },
        "postCount",
        1,
      );
      // 커뮤니티 캐시 무효화
      await this.invalidateCommunityCache(communityId, community.slug);
    }

    // 게시물 목록 캐시 무효화
    await this.invalidatePostListCache(communityId);

    this.logger.log(`게시물 생성: ${saved.slug} in ${community.slug}`);

    return saved;
  }

  private applySortingAndCursor(
    qb: SelectQueryBuilder<CommunityPost>,
    sortBy: CommunityPostSortBy,
    cursor: CommunityPostCursorPayload | null,
  ): void {
    const hotScoreExpr = `COALESCE(post.upvoteCount, 0) - COALESCE(post.downvoteCount, 0)`;
    const topScoreExpr = `COALESCE(post.viewCount, 0)`;
    const controversialExpr = `COALESCE(post.commentCount, 0)`;

    const addCursorForScore = (expr: string) => {
      if (!cursor) return;
      qb.andWhere(
        `(${expr} < :cursorScore OR (${expr} = :cursorScore AND (post.createdAt < :cursorCreatedAt OR (post.createdAt = :cursorCreatedAt AND post.id < :cursorId))))`,
        {
          cursorScore: cursor.sortValue ?? 0,
          cursorCreatedAt: cursor.createdAt,
          cursorId: cursor.id,
        },
      );
    };

    const addDefaultCursor = () => {
      if (!cursor) return;
      qb.andWhere(
        `(post.createdAt < :cursorCreatedAt OR (post.createdAt = :cursorCreatedAt AND post.id < :cursorId))`,
        {
          cursorCreatedAt: cursor.createdAt,
          cursorId: cursor.id,
        },
      );
    };

    switch (sortBy) {
      case CommunityPostSortBy.HOT:
        // Generated Column 'hotScore' 활용 (Index Scan)
        qb.orderBy("post.hotScore", "DESC")
          .addOrderBy("post.createdAt", "DESC")
          .addOrderBy("post.id", "DESC");
        addCursorForScore("post.hotScore");
        break;
      case CommunityPostSortBy.TOP:
        qb.addSelect(topScoreExpr, "community_top_score")
          .orderBy("community_top_score", "DESC")
          .addOrderBy("post.createdAt", "DESC")
          .addOrderBy("post.id", "DESC");
        addCursorForScore(topScoreExpr);
        break;
      case CommunityPostSortBy.CONTROVERSIAL:
        qb.addSelect(controversialExpr, "community_controversial_score")
          .orderBy("community_controversial_score", "DESC")
          .addOrderBy("post.createdAt", "DESC")
          .addOrderBy("post.id", "DESC");
        addCursorForScore(controversialExpr);
        break;
      default:
        qb.orderBy("post.createdAt", "DESC").addOrderBy("post.id", "DESC");
        addDefaultCursor();
    }
  }

  private buildCursorPayload(
    post: CommunityPost,
    sortBy: CommunityPostSortBy,
  ): CommunityPostCursorPayload {
    const createdAt =
      post.createdAt instanceof Date
        ? post.createdAt.toISOString()
        : new Date(post.createdAt).toISOString();

    const payload: CommunityPostCursorPayload = {
      id: post.id,
      createdAt,
    };

    const sortValue = this.getSortValue(post, sortBy);
    if (sortValue !== undefined) {
      payload.sortValue = sortValue;
    }

    return payload;
  }

  private getSortValue(
    post: CommunityPost,
    sortBy: CommunityPostSortBy,
  ): number | undefined {
    switch (sortBy) {
      case CommunityPostSortBy.HOT:
        // Use generated column 'hotScore' if available, otherwise calculate fallback
        if (typeof post.hotScore === "number") {
          return post.hotScore;
        }
        return (
          (post.upvoteCount ?? post.likeCount ?? 0) - (post.downvoteCount ?? 0)
        );
      case CommunityPostSortBy.TOP:
        return post.viewCount ?? 0;
      case CommunityPostSortBy.CONTROVERSIAL:
        return post.commentCount ?? 0;
      default:
        return undefined;
    }
  }

  private encodeCursor(payload: CommunityPostCursorPayload): string {
    return Buffer.from(JSON.stringify(payload)).toString("base64");
  }

  private decodeCursor(cursor?: string): CommunityPostCursorPayload | null {
    if (!cursor) {
      return null;
    }

    try {
      const decoded = Buffer.from(cursor, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      if (parsed?.id && parsed?.createdAt) {
        return parsed as CommunityPostCursorPayload;
      }
      return null;
    } catch (error) {
      this.logger.warn(`Invalid community cursor: ${error}`);
      return null;
    }
  }

  /**
   * 게시물 조회 (slug)
   */
  async findBySlug(
    communitySlug: string,
    postSlug: string,
    userId?: string,
  ): Promise<
    CommunityPost & { userLiked?: boolean; userVote?: VoteType | null }
  > {
    // 커뮤니티 조회
    const community = await this.communityRepository.findOne({
      where: { slug: communitySlug },
      select: ["id"],
    });

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    // 캐시 확인
    const cacheKey = PostCacheKeys.POST_BY_SLUG(communitySlug, postSlug);
    let post = await this.cacheService.get<CommunityPost>(cacheKey);

    if (!post) {
      post = await this.postRepository.findOne({
        where: {
          communityId: community.id,
          slug: postSlug,
          status: In([
            CommunityPostStatus.PUBLISHED,
            CommunityPostStatus.DRAFT,
          ]),
        },
        relations: [
          "author",
          "author.profile",
          "flair",
          "community",
          "thumbnailImage",
        ],
      });

      if (!post) {
        throw new NotFoundException("게시물을 찾을 수 없습니다");
      }

      // 비공개 게시물 확인
      if (
        post.status === CommunityPostStatus.DRAFT &&
        post.authorId !== userId
      ) {
        throw new NotFoundException("게시물을 찾을 수 없습니다");
      }

      // 캐시 저장
      await this.cacheService.set(cacheKey, post, CacheTTL.MEDIUM);
    }

    if (post) {
      this.enrichPostMetadata(post);
    }

    // 투표 상태 확인
    const result = post as CommunityPost & {
      userLiked?: boolean;
      userVote?: VoteType | null;
    };

    if (userId) {
      const userVote = await this.getUserVote(post.id, userId);
      result.userVote = userVote;
      result.userLiked = userVote === VoteType.UPVOTE; // 하위 호환성
    }

    this.enrichPostMetadata(result);

    return result;
  }

  /**
   * 게시물 조회 (ID)
   */
  async findById(
    communitySlug: string,
    postId: string,
    userId?: string,
  ): Promise<
    CommunityPost & { userLiked?: boolean; userVote?: VoteType | null }
  > {
    const community = await this.communityRepository.findOne({
      where: { slug: communitySlug },
      select: ["id"],
    });

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    const cacheKey = PostCacheKeys.POST_BY_ID(postId);
    let post = await this.cacheService.get<CommunityPost>(cacheKey);

    if (!post) {
      post = await this.postRepository.findOne({
        where: {
          communityId: community.id,
          id: postId,
          status: In([
            CommunityPostStatus.PUBLISHED,
            CommunityPostStatus.DRAFT,
          ]),
        },
        relations: [
          "author",
          "author.profile",
          "flair",
          "community",
          "thumbnailImage",
        ],
      });

      if (!post) {
        throw new NotFoundException("게시물을 찾을 수 없습니다");
      }

      if (
        post.status === CommunityPostStatus.DRAFT &&
        post.authorId !== userId
      ) {
        throw new NotFoundException("게시물을 찾을 수 없습니다");
      }

      await this.cacheService.set(cacheKey, post, CacheTTL.MEDIUM);
    }

    if (post) {
      this.enrichPostMetadata(post);
    }

    const result = post as CommunityPost & {
      userLiked?: boolean;
      userVote?: VoteType | null;
    };

    if (userId) {
      const userVote = await this.getUserVote(post.id, userId);
      result.userVote = userVote;
      result.userLiked = userVote === VoteType.UPVOTE;
    }

    this.enrichPostMetadata(result);

    return result;
  }

  /**
   * 여러 커뮤니티의 최신 게시글 일괄 조회 (Batch API)
   * N+1 문제 해결용: 각 커뮤니티별 최신 N개 게시글 반환
   */
  async getRecentPostsForCommunities(
    communityIds: string[],
    limitPerCommunity = 3,
  ): Promise<Map<string, CommunityPost[]>> {
    if (!communityIds.length) {
      return new Map();
    }

    // ROW_NUMBER()를 사용하여 커뮤니티별 최신 N개 추출
    // Relation 로딩 편의성을 위해 ID만 먼저 Raw Query로 가져오고, 그 ID로 find 하는 방식 사용
    const rawResult = await this.postRepository.query(
      `
      WITH RankedPosts AS (
        SELECT id, "communityId",
               ROW_NUMBER() OVER (PARTITION BY "communityId" ORDER BY "createdAt" DESC) as rn
        FROM community_posts
        WHERE "communityId" = ANY($1)
          AND status = 'published'
          AND "deletedAt" IS NULL
      )
      SELECT id
      FROM RankedPosts
      WHERE rn <= $2
      `,
      [communityIds, limitPerCommunity],
    );

    const postIds = rawResult.map((row: any) => row.id);

    if (postIds.length === 0) {
      return new Map();
    }

    // ID로 실제 엔티티 조회 (Relation 포함)
    const posts = await this.postRepository.find({
      where: { id: In(postIds) },
      relations: [
        "author",
        "author.profile",
        "flair",
        "thumbnailImage",
        "community",
      ],
      order: { createdAt: "DESC" },
    });

    posts.forEach((post) => this.enrichPostMetadata(post));

    // Map으로 그룹핑
    const result = new Map<string, CommunityPost[]>();
    posts.forEach((post) => {
      const list = result.get(post.communityId) || [];
      list.push(post);
      result.set(post.communityId, list);
    });

    // 각 커뮤니티 리스트 내부 정렬 보장 (createdAt DESC)
    for (const [, list] of result.entries()) {
      list.sort((a, b) => {
        const timeA =
          a.createdAt instanceof Date
            ? a.createdAt.getTime()
            : new Date(a.createdAt).getTime();
        const timeB =
          b.createdAt instanceof Date
            ? b.createdAt.getTime()
            : new Date(b.createdAt).getTime();
        return timeB - timeA;
      });
    }

    return result;
  }

  /**
   * 게시물 목록 조회
   */
  async findAll(
    communityId: string,
    query: GetCommunityPostsQueryDto,
    userId?: string,
  ): Promise<{
    items: CommunityPost[];
    pinnedPosts?: CommunityPost[];
    hasNext: boolean;
    nextCursor: string | null;
    nextCursorId: string | null;
  }> {
    const limit = CursorPaginationHelper.getSafeLimit(query.limit);
    const sortBy = query.sortBy || CommunityPostSortBy.NEWEST;
    const cursorData = this.decodeCursor(query.cursor);

    const cacheEligible =
      !userId &&
      !query.search &&
      !query.flairId &&
      !query.authorId &&
      !query.pinnedOnly &&
      !cursorData;
    const cacheKey = cacheEligible
      ? PostCacheKeys.POST_LIST(communityId, sortBy, limit)
      : null;

    if (cacheKey) {
      const cached =
        await this.cacheService.get<CommunityPostListCachePayload>(cacheKey);
      if (cached) {
        cached.items.forEach((item) => this.enrichPostMetadata(item));
        cached.pinnedPosts?.forEach((item) => this.enrichPostMetadata(item));
        return cached;
      }
    }

    let items: CommunityPost[] = [];
    let usedRanking = false;

    const canUseRanking =
      !cursorData &&
      !query.search &&
      !query.flairId &&
      !query.authorId &&
      !query.pinnedOnly &&
      sortBy === CommunityPostSortBy.TOP;

    if (canUseRanking) {
      const ranked = await this.getRankedCommunityPosts(communityId, limit + 1);
      if (ranked.length > 0) {
        items = ranked;
        usedRanking = true;
      }
    }

    if (!usedRanking) {
      const qb = this.postRepository
        .createQueryBuilder("post")
        .leftJoinAndSelect("post.author", "author")
        .leftJoinAndSelect("author.profile", "authorProfile")
        .leftJoinAndSelect("post.flair", "flair")
        .leftJoinAndSelect("post.thumbnailImage", "thumbnailImage")
        .where("post.communityId = :communityId", { communityId })
        .andWhere("post.status = :status", {
          status: CommunityPostStatus.PUBLISHED,
        });

      if (!query.pinnedOnly) {
        qb.andWhere("post.isPinned = false");
      }

      if (query.flairId) {
        qb.andWhere("post.flairId = :flairId", { flairId: query.flairId });
      }

      if (query.authorId) {
        qb.andWhere("post.authorId = :authorId", { authorId: query.authorId });
      }

      if (query.search) {
        qb.andWhere(
          "(post.title ILIKE :search OR post.content ILIKE :search)",
          {
            search: `%${query.search}%`,
          },
        );
      }

      this.applySortingAndCursor(qb, sortBy, cursorData);
      qb.take(limit + 1);

      items = await qb.getMany();
    }

    items.forEach((item) => this.enrichPostMetadata(item));

    let pinnedPosts: CommunityPost[] | undefined;
    if (!query.pinnedOnly && !cursorData) {
      pinnedPosts = await this.getPinnedPosts(communityId);
      pinnedPosts.forEach((item) => this.enrichPostMetadata(item));
    }

    if (userId && items.length > 0) {
      const postIds = items.map((p) => p.id);
      const voteMap = await this.getMultipleVoteStatus(postIds, userId);

      items.forEach((item: any) => {
        const userVote = voteMap.get(item.id) || null;
        item.userVote = userVote;
        item.userLiked = userVote === VoteType.UPVOTE; // 하위 호환성
      });

      if (pinnedPosts) {
        const pinnedIds = pinnedPosts.map((p) => p.id);
        const pinnedVoteMap = await this.getMultipleVoteStatus(
          pinnedIds,
          userId,
        );

        pinnedPosts.forEach((item: any) => {
          const userVote = pinnedVoteMap.get(item.id) || null;
          item.userVote = userVote;
          item.userLiked = userVote === VoteType.UPVOTE; // 하위 호환성
        });
      }
    }

    const hasNext = items.length > limit;
    let nextCursor: string | null = null;
    let nextCursorId: string | null = null;

    if (hasNext) {
      const lastItem = items.pop()!;
      const cursorPayload = this.buildCursorPayload(lastItem, sortBy);
      nextCursor = this.encodeCursor(cursorPayload);
      nextCursorId = cursorPayload.id;
    }

    const response: CommunityPostListCachePayload = {
      items,
      pinnedPosts,
      hasNext,
      nextCursor,
      nextCursorId,
    };

    if (cacheKey) {
      await this.cacheService.set(cacheKey, response, CacheTTL.SHORT);
    }

    return response;
  }

  /**
   * 고정 게시물 조회
   */
  async getPinnedPosts(communityId: string): Promise<CommunityPost[]> {
    const cacheKey = PostCacheKeys.PINNED_POSTS(communityId);
    const cached = await this.cacheService.get<CommunityPost[]>(cacheKey);

    if (cached) {
      cached.forEach((item) => this.enrichPostMetadata(item));
      return cached;
    }

    const pinnedPosts = await this.postRepository.find({
      where: {
        communityId,
        isPinned: true,
        status: CommunityPostStatus.PUBLISHED,
      },
      relations: ["author", "author.profile", "flair", "thumbnailImage"],
      order: { createdAt: "DESC" },
      take: 5, // 최대 5개
    });

    pinnedPosts.forEach((item) => this.enrichPostMetadata(item));
    await this.cacheService.set(cacheKey, pinnedPosts, CacheTTL.SHORT);

    return pinnedPosts;
  }

  private async getRankedCommunityPosts(
    communityId: string,
    limit: number,
  ): Promise<CommunityPost[]> {
    const ids = await this.communityPostViewService.getTopRankedPostIds(
      communityId,
      limit,
    );
    if (!ids.length) {
      return [];
    }

    const posts = await this.postRepository.find({
      where: { id: In(ids) },
      relations: [
        "author",
        "author.profile",
        "flair",
        "thumbnailImage",
        "community",
      ],
    });

    const postMap = new Map(posts.map((post) => [post.id, post]));
    return ids
      .map((id) => postMap.get(id))
      .filter((post): post is CommunityPost => !!post);
  }

  /**
   * 게시물 수정
   */
  async update(
    postId: string,
    dto: UpdateCommunityPostDto,
    userId: string,
    userRole?: CommunityRole,
  ): Promise<CommunityPost> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ["community"],
    });

    if (!post) {
      throw new NotFoundException("게시물을 찾을 수 없습니다");
    }

    const isAuthor = post.authorId === userId;
    const isModerator = userRole && isModeratorOrAbove(userRole);

    // 권한 확인
    if (!isAuthor && !isModerator) {
      throw new ForbiddenException("게시물을 수정할 권한이 없습니다");
    }

    // 상태 변경 전 상태 저장 (postCount 업데이트용)
    const oldStatus = post.status;

    // 작성자만 수정 가능한 필드
    if (isAuthor) {
      if (dto.title) post.title = this.sanitizeTitleForWrite(dto.title);
      const hasMarkdownUpdate = dto.contentMarkdown !== undefined;
      const hasHtmlUpdate = dto.content !== undefined;
      if (hasMarkdownUpdate || hasHtmlUpdate) {
        const canonicalContent = await this.resolveCanonicalContent(
          dto.content,
          dto.contentMarkdown,
        );
        post.content = this.sanitizeContent(canonicalContent.html);
        post.content_markdown = canonicalContent.markdown;
      }
      if (dto.flairId !== undefined) post.flairId = dto.flairId;
      if (dto.tags !== undefined) post.tags = dto.tags;
      if (dto.isNsfw !== undefined) post.isNsfw = dto.isNsfw;
      if (dto.isSpoiler !== undefined) post.isSpoiler = dto.isSpoiler;
      if (dto.thumbnailImageId !== undefined)
        post.thumbnailImageId = dto.thumbnailImageId;
    }

    // 모더레이터도 수정 가능한 필드
    if (isModerator) {
      if (dto.status !== undefined) {
        post.status = dto.status;

        // 상태 변경에 따른 postCount 업데이트
        if (oldStatus !== dto.status) {
          if (
            oldStatus === CommunityPostStatus.PUBLISHED &&
            dto.status !== CommunityPostStatus.PUBLISHED
          ) {
            // PUBLISHED → 다른 상태: postCount 감소
            await this.communityRepository.decrement(
              { id: post.communityId },
              "postCount",
              1,
            );
            await this.invalidateCommunityCache(
              post.communityId,
              post.community.slug,
            );
          } else if (
            oldStatus !== CommunityPostStatus.PUBLISHED &&
            dto.status === CommunityPostStatus.PUBLISHED
          ) {
            // 다른 상태 → PUBLISHED: postCount 증가
            await this.communityRepository.increment(
              { id: post.communityId },
              "postCount",
              1,
            );
            await this.invalidateCommunityCache(
              post.communityId,
              post.community.slug,
            );
          }
        }

        // 상태 변경 모드 로그
        await this.modLogRepository.save({
          communityId: post.communityId,
          moderatorId: userId,
          action:
            dto.status === CommunityPostStatus.REMOVED
              ? ModAction.REMOVE_POST
              : ModAction.EDIT_POST,
          targetPostId: postId,
          metadata: { newStatus: dto.status },
        });
      }

      if (dto.isPinned !== undefined) {
        const oldPinned = post.isPinned;
        post.isPinned = dto.isPinned;

        if (oldPinned !== dto.isPinned) {
          // 고정 게시물 캐시 무효화
          await this.cacheService.del(
            PostCacheKeys.PINNED_POSTS(post.communityId),
          );

          // 모드 로그
          await this.modLogRepository.save({
            communityId: post.communityId,
            moderatorId: userId,
            action: dto.isPinned ? ModAction.PIN_POST : ModAction.UNPIN_POST,
            targetPostId: postId,
          });
        }
      }

      // 댓글 잠금/해제 처리
      if (dto.isLocked !== undefined) {
        const oldLocked = post.isLocked;
        post.isLocked = dto.isLocked;

        if (oldLocked !== dto.isLocked) {
          // 모드 로그
          await this.modLogRepository.save({
            communityId: post.communityId,
            moderatorId: userId,
            action: dto.isLocked ? ModAction.LOCK_POST : ModAction.UNLOCK_POST,
            targetPostId: postId,
          });
        }
      }
    }

    const updated = await this.postRepository.save(post);

    // 캐시 무효화
    await this.invalidatePostCache(
      post.communityId,
      post.community.slug,
      post.slug,
      updated.id,
    );

    const refetched = await this.postRepository.findOne({
      where: { id: updated.id },
      relations: [
        "author",
        "author.profile",
        "flair",
        "thumbnailImage",
        "community",
      ],
    });

    if (!refetched) {
      throw new NotFoundException("게시물을 찾을 수 없습니다.");
    }

    return refetched;
  }

  private async resolveCanonicalContent(
    htmlContent?: string,
    markdownContent?: string,
  ): Promise<{ html: string; markdown: string | null }> {
    if (markdownContent !== undefined) {
      const processedContent = await this.postContentService!.processContent(
        markdownContent,
        {
          sanitize: true,
          processCode: true,
          processImages: true,
          preserveMermaid: true,
          forceMarkdown: true,
        },
      );

      return {
        html: processedContent.html,
        markdown: markdownContent,
      };
    }

    return {
      html: htmlContent ?? "",
      markdown: null,
    };
  }

  /**
   * 게시물 삭제
   */
  async delete(
    postId: string,
    userId: string,
    userRole?: CommunityRole,
    isPlatformAdmin: boolean = false,
  ): Promise<void> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ["community"],
    });

    if (!post) {
      throw new NotFoundException("게시물을 찾을 수 없습니다");
    }

    const isAuthor = post.authorId === userId;
    const isModerator = !!(userRole && isModeratorOrAbove(userRole));
    const canModerate = isModerator || isPlatformAdmin;

    if (!isAuthor && !canModerate) {
      throw new ForbiddenException("게시물을 삭제할 권한이 없습니다");
    }

    // 삭제 전 상태 확인 (postCount 업데이트용)
    const wasPublished = post.status === CommunityPostStatus.PUBLISHED;

    // 모더레이터가 삭제하는 경우 로그 기록
    if (canModerate && !isAuthor) {
      await this.modLogRepository.save({
        communityId: post.communityId,
        moderatorId: userId,
        action: ModAction.REMOVE_POST,
        targetPostId: postId,
        targetUserId: post.authorId,
        metadata: { title: post.title },
      });
    }

    // 삭제 주체에 따른 처리
    if (canModerate && !isAuthor) {
      // 모더레이터 삭제: 소프트 삭제 (status: REMOVED)
      post.status = CommunityPostStatus.REMOVED;
      post.removedAt = new Date();
      post.removedById = userId;
      await this.postRepository.save(post);
      this.logger.log(`게시물 소프트 삭제 (모더레이터): ${post.slug}`);
    } else {
      // 작성자 본인 삭제: 하드 삭제
      await this.postRepository.remove(post);
      this.logger.log(`게시물 하드 삭제 (작성자): ${post.slug}`);
    }

    // PUBLISHED 상태였던 게시물이 삭제된 경우 postCount 감소
    if (wasPublished) {
      await this.communityRepository.decrement(
        { id: post.communityId },
        "postCount",
        1,
      );
      await this.invalidateCommunityCache(
        post.communityId,
        post.community.slug,
      );
    }

    // 캐시 무효화
    await this.invalidatePostCache(
      post.communityId,
      post.community.slug,
      post.slug,
      post.id,
    );
  }

  // =========================================================================
  // 스팸/승인 관리 (모더레이터)
  // =========================================================================

  /**
   * 게시물 스팸 표시
   *
   * @param postId 게시물 ID
   * @param moderatorId 모더레이터 ID
   */
  async markAsSpam(
    postId: string,
    moderatorId: string,
  ): Promise<CommunityPost> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ["community"],
    });

    if (!post) {
      throw new NotFoundException("게시물을 찾을 수 없습니다");
    }

    if (post.status === CommunityPostStatus.SPAM) {
      throw new BadRequestException("이미 스팸 처리된 게시물입니다");
    }

    // 이전 상태 저장 (postCount 업데이트용)
    const wasPublished = post.status === CommunityPostStatus.PUBLISHED;

    post.status = CommunityPostStatus.SPAM;
    post.removedAt = new Date();
    post.removedById = moderatorId;

    const updated = await this.postRepository.save(post);

    // PUBLISHED → SPAM: postCount 감소
    if (wasPublished) {
      await this.communityRepository.decrement(
        { id: post.communityId },
        "postCount",
        1,
      );
      await this.invalidateCommunityCache(
        post.communityId,
        post.community.slug,
      );
    }

    // 모드 로그 기록
    await this.modLogRepository.save({
      communityId: post.communityId,
      moderatorId,
      action: ModAction.MARK_AS_SPAM,
      targetPostId: postId,
      targetUserId: post.authorId,
      metadata: { title: post.title },
    });

    // 캐시 무효화
    await this.invalidatePostCache(
      post.communityId,
      post.community.slug,
      post.slug,
      post.id,
    );

    this.logger.log(`게시물 스팸 표시: ${post.slug} by ${moderatorId}`);

    return updated;
  }

  /**
   * 게시물 승인 (스팸/삭제 해제)
   *
   * @param postId 게시물 ID
   * @param moderatorId 모더레이터 ID
   */
  async approvePost(
    postId: string,
    moderatorId: string,
  ): Promise<CommunityPost> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ["community"],
    });

    if (!post) {
      throw new NotFoundException("게시물을 찾을 수 없습니다");
    }

    if (post.status === CommunityPostStatus.PUBLISHED) {
      throw new BadRequestException("이미 공개된 게시물입니다");
    }

    const previousStatus = post.status;
    post.status = CommunityPostStatus.PUBLISHED;
    post.removedAt = null;
    post.removedById = null;
    post.removalReason = null;
    post.removalReasonId = null;

    const updated = await this.postRepository.save(post);

    // 다른 상태 → PUBLISHED: postCount 증가
    await this.communityRepository.increment(
      { id: post.communityId },
      "postCount",
      1,
    );
    await this.invalidateCommunityCache(post.communityId, post.community.slug);

    // 모드 로그 기록
    await this.modLogRepository.save({
      communityId: post.communityId,
      moderatorId,
      action: ModAction.APPROVE_POST,
      targetPostId: postId,
      targetUserId: post.authorId,
      metadata: { title: post.title, previousStatus },
    });

    // 캐시 무효화
    await this.invalidatePostCache(
      post.communityId,
      post.community.slug,
      post.slug,
      post.id,
    );

    this.logger.log(`게시물 승인: ${post.slug} by ${moderatorId}`);

    return updated;
  }

  /**
   * 게시물 삭제 (삭제 사유 포함)
   *
   * @param postId 게시물 ID
   * @param moderatorId 모더레이터 ID
   * @param removalReasonId 삭제 사유 템플릿 ID (선택)
   * @param removalReason 직접 입력 삭제 사유 (선택)
   */
  async removePost(
    postId: string,
    moderatorId: string,
    removalReasonId?: string,
    removalReason?: string,
  ): Promise<CommunityPost> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ["community"],
    });

    if (!post) {
      throw new NotFoundException("게시물을 찾을 수 없습니다");
    }

    if (post.status === CommunityPostStatus.REMOVED) {
      throw new BadRequestException("이미 삭제된 게시물입니다");
    }

    // 이전 상태 저장 (postCount 업데이트용)
    const wasPublished = post.status === CommunityPostStatus.PUBLISHED;

    post.status = CommunityPostStatus.REMOVED;
    post.removedAt = new Date();
    post.removedById = moderatorId;
    if (removalReasonId) post.removalReasonId = removalReasonId;
    if (removalReason) post.removalReason = removalReason;

    const updated = await this.postRepository.save(post);

    // PUBLISHED → REMOVED: postCount 감소
    if (wasPublished) {
      await this.communityRepository.decrement(
        { id: post.communityId },
        "postCount",
        1,
      );
      await this.invalidateCommunityCache(
        post.communityId,
        post.community.slug,
      );
    }

    // 모드 로그 기록
    await this.modLogRepository.save({
      communityId: post.communityId,
      moderatorId,
      action: ModAction.REMOVE_POST,
      targetPostId: postId,
      targetUserId: post.authorId,
      reason: removalReason,
      metadata: { title: post.title, removalReasonId },
    });

    // 캐시 무효화
    await this.invalidatePostCache(
      post.communityId,
      post.community.slug,
      post.slug,
      post.id,
    );

    this.logger.log(`게시물 삭제 (모더레이션): ${post.slug} by ${moderatorId}`);

    return updated;
  }

  // =========================================================================
  // 투표 (Upvote/Downvote)
  // =========================================================================

  /**
   * 투표 토글 (핵심 로직)
   *
   * @param postId 게시물 ID
   * @param userId 사용자 ID
   * @param voteType 투표 타입 (upvote/downvote)
   */
  async toggleVote(
    postId: string,
    userId: string,
    voteType: VoteType,
  ): Promise<{
    action: "added" | "removed" | "changed";
    userVote: VoteType | null;
    upvoteCount: number;
    downvoteCount: number;
    score: number;
    liked?: boolean;
    likeCount?: number;
  }> {
    const lockKey = `community:vote:lock:${postId}:${userId}`;

    return await this.redisLockService.withLock(
      lockKey,
      async () => {
        return await this.dataSource.transaction(async (manager) => {
          // 기존 투표 조회
          const existing = await manager.findOne(CommunityPostLike, {
            where: { postId, userId },
          });

          let action: "added" | "removed" | "changed";
          let userVote: VoteType | null;

          if (existing) {
            if (existing.type === voteType) {
              // 같은 타입 클릭 → 투표 취소
              await manager.delete(CommunityPostLike, { id: existing.id });
              await this.updateCommunityVoteCount(
                manager,
                postId,
                voteType,
                -1,
              );
              action = "removed";
              userVote = null;
            } else {
              // 다른 타입 클릭 → 투표 변경
              const oldType = existing.type;
              existing.type = voteType;
              await manager.save(existing);
              await this.updateCommunityVoteCount(manager, postId, oldType, -1);
              await this.updateCommunityVoteCount(
                manager,
                postId,
                voteType,
                +1,
              );
              action = "changed";
              userVote = voteType;
            }
          } else {
            // 새 투표
            const newVote = manager.create(CommunityPostLike, {
              postId,
              userId,
              type: voteType,
            });
            await manager.save(newVote);
            await this.updateCommunityVoteCount(manager, postId, voteType, +1);
            action = "added";
            userVote = voteType;
          }

          // 최종 카운트 조회
          const post = await manager.findOne(CommunityPost, {
            where: { id: postId },
            select: [
              "communityId",
              "upvoteCount",
              "downvoteCount",
              "likeCount",
            ],
          });

          const upvoteCount = post?.upvoteCount || 0;
          const downvoteCount = post?.downvoteCount || 0;

          // 비동기 캐시 무효화
          setImmediate(() => {
            Promise.all([
              this.cacheService.del(PostCacheKeys.POST_BY_ID(postId)),
              this.cacheService.deletePattern("feed:unified:*"),
              ...(post?.communityId
                ? [this.invalidatePostListCache(post.communityId)]
                : []),
            ]).catch(() => {});
          });

          return {
            action,
            userVote,
            upvoteCount,
            downvoteCount,
            score: upvoteCount - downvoteCount,
            // 하위 호환성
            liked: userVote === VoteType.UPVOTE,
            likeCount: upvoteCount,
          };
        });
      },
      { ttl: 5000 },
    );
  }

  /**
   * 투표 카운트 업데이트 (트랜잭션 내부 헬퍼)
   */
  private async updateCommunityVoteCount(
    manager: any,
    postId: string,
    voteType: VoteType,
    delta: number,
  ): Promise<void> {
    const isUpvote = voteType === VoteType.UPVOTE;
    const field = isUpvote ? "upvoteCount" : "downvoteCount";

    await manager
      .createQueryBuilder()
      .update(CommunityPost)
      .set({
        [field]: () => `GREATEST(0, "${field}" + ${delta})`,
        // 업보트 시 likeCount도 동기화 (하위 호환성)
        ...(isUpvote && {
          likeCount: () => `GREATEST(0, "likeCount" + ${delta})`,
        }),
      })
      .where("id = :postId", { postId })
      .execute();
  }

  /**
   * 좋아요 토글 (레거시)
   *
   * @deprecated toggleVote 사용 권장
   */
  async toggleLike(
    postId: string,
    userId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const result = await this.toggleVote(postId, userId, VoteType.UPVOTE);
    return {
      liked: result.userVote === VoteType.UPVOTE,
      likeCount: result.upvoteCount,
    };
  }

  /**
   * 사용자 투표 상태 확인
   */
  async getUserVote(postId: string, userId: string): Promise<VoteType | null> {
    const vote = await this.likeRepository.findOne({
      where: { postId, userId },
      select: ["type"],
    });
    return vote?.type || null;
  }

  /**
   * 좋아요 여부 확인 (레거시)
   *
   * @deprecated getUserVote 사용 권장
   */
  async isLiked(postId: string, userId: string): Promise<boolean> {
    const voteType = await this.getUserVote(postId, userId);
    return voteType === VoteType.UPVOTE;
  }

  /**
   * 여러 게시물 투표 상태 일괄 조회
   */
  async getMultipleVoteStatus(
    postIds: string[],
    userId: string,
  ): Promise<Map<string, VoteType | null>> {
    if (postIds.length === 0) {
      return new Map();
    }

    const votes = await this.likeRepository.find({
      where: { postId: In(postIds), userId },
      select: ["postId", "type"],
    });

    const voteMap = new Map<string, VoteType | null>();
    postIds.forEach((id) => voteMap.set(id, null));
    votes.forEach((vote) => voteMap.set(vote.postId, vote.type));

    return voteMap;
  }

  /**
   * 여러 게시물 좋아요 상태 일괄 조회 (레거시)
   *
   * @deprecated getMultipleVoteStatus 사용 권장
   */
  async getMultipleLikeStatus(
    postIds: string[],
    userId: string,
  ): Promise<Map<string, boolean>> {
    const voteMap = await this.getMultipleVoteStatus(postIds, userId);
    const likedMap = new Map<string, boolean>();
    voteMap.forEach((voteType, postId) => {
      likedMap.set(postId, voteType === VoteType.UPVOTE);
    });
    return likedMap;
  }

  /**
   * 게시물 조회수 증가 (명시적 endpoint 전용)
   */
  async incrementPostView(
    communitySlug: string,
    postId: string,
    userId?: string,
    viewerId?: string,
  ): Promise<void> {
    const post = await this.postRepository
      .createQueryBuilder("post")
      .innerJoin("post.community", "community")
      .select(["post.id"])
      .where("post.id = :postId", { postId })
      .andWhere("community.slug = :communitySlug", { communitySlug })
      .andWhere("post.status = :status", {
        status: CommunityPostStatus.PUBLISHED,
      })
      .getOne();

    if (!post) {
      throw new NotFoundException("게시물을 찾을 수 없습니다");
    }

    await this.incrementViewCount(postId, userId, viewerId);
  }

  // =========================================================================
  // 유틸리티
  // =========================================================================

  /**
   * 조회수 증가 (비동기)
   */
  private async incrementViewCount(
    postId: string,
    userId?: string,
    viewerId?: string,
  ): Promise<void> {
    const dedupeKey = this.buildViewDedupeKey(postId, userId, viewerId);

    if (dedupeKey) {
      const lockKey = `community:view:lock:${postId}`;
      const lock = await this.redisLockService.acquireLock(lockKey, 3000);

      try {
        const alreadyViewed = await this.redisLockService.get(dedupeKey);
        if (alreadyViewed) {
          return;
        }

        await this.redisLockService.set(dedupeKey, "1", CacheTTL.DAY);
      } finally {
        if (lock) {
          await this.redisLockService.releaseLock(lockKey, lock);
        }
      }
    }

    await this.communityPostViewService.bufferView(postId);
  }

  private buildViewDedupeKey(
    postId: string,
    userId?: string,
    viewerId?: string,
  ): string | null {
    if (userId) {
      return `community:post:${postId}:view:user:${userId}`;
    }

    if (viewerId) {
      return `community:post:${postId}:view:viewer:${viewerId}`;
    }

    return null;
  }

  /**
   * DB에서 좋아요 수 조회
   */
  private async getLikeCountFromDB(
    postId: string,
    manager?: any,
  ): Promise<number> {
    const repo = manager
      ? manager.getRepository(CommunityPost)
      : this.postRepository;

    const post = await repo.findOne({
      where: { id: postId },
      select: ["likeCount"],
    });

    return post?.likeCount || 0;
  }

  /**
   * 게시물 캐시 무효화
   */
  private async invalidatePostCache(
    communityId: string,
    communitySlug: string,
    postSlug: string,
    postId?: string,
  ): Promise<void> {
    const postIdCache = postId ? PostCacheKeys.POST_BY_ID(postId) : null;

    await Promise.all([
      this.cacheService.del(
        PostCacheKeys.POST_BY_SLUG(communitySlug, postSlug),
      ),
      ...(postIdCache ? [this.cacheService.del(postIdCache)] : []),
      this.invalidatePostListCache(communityId),
      this.cacheService.del(PostCacheKeys.PINNED_POSTS(communityId)),
    ]);
  }

  /**
   * 게시물 목록 캐시 무효화
   */
  private async invalidatePostListCache(communityId: string): Promise<void> {
    await this.cacheService.deletePattern(`community:${communityId}:posts:*`);
  }

  /**
   * 커뮤니티 캐시 무효화
   * postCount 등 커뮤니티 정보가 변경될 때 호출
   */
  private async invalidateCommunityCache(
    communityId: string,
    slug: string,
  ): Promise<void> {
    await Promise.all([
      this.cacheService.del(`community:id:${communityId}`),
      this.cacheService.del(`community:slug:${slug}`),
    ]);
  }

  /**
   * 작성자/썸네일 정보를 평탄화하여 프런트에서 바로 사용할 수 있도록 보정
   */
  private enrichPostMetadata(post?: CommunityPost) {
    if (!post) return;

    post.title = this.sanitizeTitle(post.title);
    post.content = this.sanitizeContent(post.content);

    if (post.author) {
      const author: any = post.author;
      author.profileImage =
        author.profileImage ?? author.profile?.profileImage ?? null;
    }

    const thumbnailUrl = (post as any).thumbnailImage?.fileUrl ?? null;
    (post as any).thumbnailImageUrl = thumbnailUrl;
    if (!(post as any).thumbnailUrl) {
      (post as any).thumbnailUrl = thumbnailUrl;
    }
  }

  private sanitizeTitleForWrite(title: string): string {
    const sanitized = this.sanitizeTitle(title);
    if (sanitized.length < 2) {
      throw new BadRequestException(
        "제목은 안전한 텍스트를 2자 이상 포함해야 합니다",
      );
    }
    return sanitized;
  }

  private sanitizeTitle(title: string): string {
    return this.htmlSanitizer.extractText(title).trim();
  }

  private sanitizeContent(content: string): string {
    return this.htmlSanitizer.sanitize(content, {
      allowIframes: false,
      allowComments: false,
      preserveMermaid: true,
    });
  }
}
