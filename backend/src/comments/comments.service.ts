import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, Brackets } from "typeorm";
import { plainToInstance } from "class-transformer";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Comment } from "./entities/comment.entity";
import { CommentLike, LikeType } from "./entities/comment-like.entity";
import { CommentResponseDto } from "./dto/comment-response.dto";
import { GetCommentsDto } from "./dto/get-comments-query.dto";
import { GetRepliesDto } from "./dto/get-replies.dto";
import { PaginatedCommentsDto } from "./dto/paginated-comments.dto";
import { User } from "../users/entities/user.entity";
import { UserResponseDto } from "../users/dto/user-response.dto";
import { PostsService } from "../posts/posts.service";
import { BlogResolverService } from "../common/services/blog-resolver.service";
import { CacheService, CacheKeys, CacheTTL } from "../cache/cache.service";
import { CacheMetricsService } from "../metrics/cache-metrics.service";
import { CdnService } from "../files/services/cdn.service";
import { IpSecurityService } from "../common/services/ip-security.service";

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(Comment)
    private commentsRepository: Repository<Comment>,
    @InjectRepository(CommentLike)
    private commentLikesRepository: Repository<CommentLike>,
    private postsService: PostsService,
    private blogResolverService: BlogResolverService,
    private cacheService: CacheService,
    private cacheMetricsService: CacheMetricsService,
    private eventEmitter: EventEmitter2,
    private cdnService: CdnService,
    private ipSecurityService: IpSecurityService,
  ) {}

  /**
   * Comment Entity를 CommentResponseDto로 변환
   *
   * @description
   * Entity spread 연산자로 인한 lazy loading 방지를 위해
   * plainToInstance를 사용하여 안전하게 DTO로 변환
   *
   * @param comment - 변환할 Comment entity
   * @param additionalData - 추가로 설정할 필드들
   * @returns CommentResponseDto 인스턴스
   */
  private toCommentDto(
    comment: Comment,
    additionalData?: Partial<CommentResponseDto>,
  ): CommentResponseDto {
    const dto = plainToInstance(CommentResponseDto, comment, {
      excludeExtraneousValues: true, // @Expose가 없는 필드 제외
    });

    // author가 있는 경우 처리
    if (comment.author) {
      let profileImage: string | null = null;

      // author가 이미 UserResponseDto 타입이면 그대로 사용 (Raw SQL 조회한 답글의 경우)
      if (comment.author instanceof UserResponseDto) {
        dto.author = comment.author;
      }
      // User 엔티티인 경우
      else {
        // profile 테이블에서 profileImage 가져오기
        if (comment.author.profile) {
          profileImage = comment.author.profile.profileImage;
        }
        // profileImage가 있으면 CDN URL로 변환
        if (profileImage) {
          if (
            profileImage.startsWith("v2/") ||
            profileImage.startsWith("uploads/")
          ) {
            profileImage = this.cdnService.generateCdnUrlFromKey(profileImage);
            this.logger.debug(`Profile image CDN URL: ${profileImage}`);
          }
        }

        dto.author = plainToInstance(UserResponseDto, {
          ...comment.author,
          profileImage: profileImage,
        });
      }
    }

    // 추가 데이터가 있으면 설정
    if (additionalData) {
      Object.assign(dto, additionalData);
    }

    return dto;
  }

  async create(createCommentDto: any, user: User, ip?: string): Promise<CommentResponseDto> {
    const { postId, parentCommentId, ...commentData } = createCommentDto;

    // 게시글 존재 확인 및 블로그 정보 가져오기
    const post = await this.postsService.findOne(postId);
    if (!post) {
      throw new NotFoundException("포스트를 찾을 수 없습니다.");
    }

    // 블로그의 댓글 허용 여부 확인
    const blog = await this.blogResolverService.findBlogById(post.blogId);
    if (!blog.allowComments) {
      throw new ForbiddenException("이 블로그는 댓글을 허용하지 않습니다.");
    }

    // YouTube 스타일 2단계 강제: 답글의 답글은 최상위 부모에게 달림
    let actualParentCommentId = parentCommentId;
    if (parentCommentId) {
      const parentComment = await this.commentsRepository.findOne({
        where: { id: parentCommentId },
        select: ["id", "parentCommentId"],
      });
      if (parentComment && parentComment.parentCommentId) {
        // 부모의 부모가 있으면 최상위 부모로 변경
        actualParentCommentId = parentComment.parentCommentId;
        this.logger.debug(
          `답글의 답글 감지: ${parentCommentId} → ${actualParentCommentId}로 변경`,
        );
      }
    }

    const comment = this.commentsRepository.create({
      ...commentData,
      author: user,
      post: { id: postId },
      parentComment: actualParentCommentId
        ? { id: actualParentCommentId }
        : null,
      ipAddress: this.ipSecurityService.encrypt(ip), // 암호화하여 저장
      userAgent: "Unknown",
      blogId: post.blogId, // Added optimization field
    });

    const savedComment = (await this.commentsRepository.save(
      comment,
    )) as unknown as Comment;

    // 댓글 수 증가 - 답글도 포함
    await this.postsService.incrementCommentCount(postId);

    // 답글인 경우 부모 댓글의 답글 수 증가
    if (actualParentCommentId) {
      await this.incrementRepliesCount(actualParentCommentId);
    }

    // 페이지네이션 캐시 무효화
    await this.invalidateCommentsPaginationCache(postId, actualParentCommentId);

    // 작성된 댓글을 author와 profile 관계를 포함하여 다시 조회
    const commentWithAuthor = await this.commentsRepository.findOne({
      where: { id: savedComment.id },
      relations: ["author", "author.profile"],
    });

    if (!commentWithAuthor) {
      throw new NotFoundException("작성된 댓글을 찾을 수 없습니다.");
    }

    // 평판 시스템용 이벤트 발행 (COMMENT_ADDED)
    this.eventEmitter.emit("post.comment.added", {
      commentId: savedComment.id,
      postId,
      authorId: user.id,
      content: commentData.content,
      timestamp: new Date(),
    });

    // CommentResponseDto로 변환하여 반환
    return this.toCommentDto(commentWithAuthor);
  }

  async findAllByPost(
    postId: string,
    user?: User,
  ): Promise<CommentResponseDto[]> {
    // 최적화: 2개 쿼리 (comments + likes) → 1개 쿼리 (LEFT JOIN 사용)
    // QueryBuilder를 사용하여 댓글과 사용자 좋아요 상태를 한 번에 조회
    const queryBuilder = this.commentsRepository
      .createQueryBuilder("comment")
      .leftJoinAndSelect("comment.author", "author")
      .where("comment.postId = :postId", { postId })
      .andWhere("comment.isDeleted = :isDeleted", { isDeleted: false })
      .orderBy("comment.createdAt", "ASC");

    // 사용자가 있는 경우, 해당 사용자의 좋아요/싫어요 상태를 LEFT JOIN으로 함께 조회
    if (user) {
      queryBuilder.leftJoinAndSelect(
        "comment.commentLikes",
        "userLike",
        "userLike.userId = :userId",
        { userId: user.id },
      );
    }

    const allComments = await queryBuilder.getMany();

    // 사용자의 좋아요/싫어요 상태를 맵으로 변환
    const userLikes: { [commentId: string]: "like" | "dislike" } = {};
    if (user) {
      allComments.forEach((comment) => {
        // LEFT JOIN으로 가져온 commentLikes 배열에서 사용자의 좋아요 찾기
        const userLike = comment.commentLikes?.find(
          (like) => like.userId === user.id,
        );
        if (userLike) {
          userLikes[comment.id] = userLike.type;
        }
      });
    }

    // 트리 구조로 변환하면서 사용자 상태 포함 (spread 연산자 사용 금지)
    const buildTree = (
      comments: Comment[],
      parentId: string | null = null,
    ): CommentResponseDto[] => {
      return comments
        .filter((comment) => comment.parentCommentId === parentId)
        .map((comment) => {
          // DTO로 변환하면서 추가 필드 설정
          const dto = this.toCommentDto(comment, {
            userLiked: userLikes[comment.id] === "like",
            userDisliked: userLikes[comment.id] === "dislike",
          });

          // 재귀적으로 답글 트리 구성
          dto.replies = buildTree(comments, comment.id);

          return dto;
        });
    };

    return buildTree(allComments);
  }

  async findOne(id: string): Promise<Comment> {
    const comment = await this.commentsRepository.findOne({
      where: { id },
      relations: ["author", "post"],
    });

    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    return comment;
  }

  async update(
    id: string,
    updateCommentDto: any,
    user: User,
  ): Promise<Comment> {
    const comment = await this.commentsRepository.findOne({
      where: { id },
      relations: ["author"],
    });

    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    if (comment.author.id !== user.id) {
      throw new ForbiddenException("You can only update your own comments");
    }

    Object.assign(comment, updateCommentDto);
    return this.commentsRepository.save(comment);
  }

  async remove(id: string, user: User): Promise<void> {
    const comment = await this.commentsRepository.findOne({
      where: { id },
      relations: ["author"],
    });

    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    if (comment.author.id !== user.id) {
      throw new ForbiddenException("You can only delete your own comments");
    }

    comment.isDeleted = true;
    await this.commentsRepository.save(comment);

    // 댓글 수 감소
    await this.postsService.decrementCommentCount(comment.postId);

    // 답글인 경우 부모 댓글의 답글 수 감소
    if (comment.parentCommentId) {
      await this.decrementRepliesCount(comment.parentCommentId);
    }

    // 페이지네이션 캐시 무효화
    await this.invalidateCommentsPaginationCache(
      comment.postId,
      comment.parentCommentId,
    );
  }

  async findAllComments(): Promise<Comment[]> {
    return this.commentsRepository.find({
      where: { isDeleted: false },
      relations: ["author", "post"],
      order: { createdAt: "DESC" },
    });
  }

  async toggleLike(
    commentId: string,
    user: User,
  ): Promise<{ liked: boolean; likesCount: number; dislikesCount: number }> {
    // 트랜잭션으로 원자성 보장
    const queryRunner =
      this.commentsRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 행 잠금으로 동시성 문제 방지
      const comment = await queryRunner.manager
        .createQueryBuilder(Comment, "comment")
        .where("comment.id = :id", { id: commentId })
        .setLock("pessimistic_write")
        .getOne();

      if (!comment) {
        throw new NotFoundException("Comment not found");
      }

      // 기존 좋아요/싫어요 확인
      const existingLike = await queryRunner.manager.findOne(CommentLike, {
        where: { commentId, userId: user.id },
      });

      let liked = false;

      if (existingLike) {
        if (existingLike.type === LikeType.LIKE) {
          // 좋아요 취소
          await queryRunner.manager.remove(existingLike);
          comment.likesCount = Math.max(0, comment.likesCount - 1);
          liked = false;
        } else {
          // 싫어요 -> 좋아요로 변경
          existingLike.type = LikeType.LIKE;
          await queryRunner.manager.save(existingLike);
          comment.likesCount = comment.likesCount + 1;
          comment.dislikesCount = Math.max(0, comment.dislikesCount - 1);
          liked = true;
        }
      } else {
        // 새 좋아요 추가
        const newLike = queryRunner.manager.create(CommentLike, {
          userId: user.id,
          commentId,
          type: LikeType.LIKE,
        });
        await queryRunner.manager.save(newLike);
        comment.likesCount = comment.likesCount + 1;
        liked = true;
      }

      await queryRunner.manager.save(comment);
      await queryRunner.commitTransaction();

      // 인기순 정렬 캐시 무효화 (좋아요 수 변경)
      await this.invalidateCommentsPaginationCache(comment.postId);

      return {
        liked,
        likesCount: comment.likesCount,
        dislikesCount: comment.dislikesCount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async toggleDislike(
    commentId: string,
    user: User,
  ): Promise<{ disliked: boolean; likesCount: number; dislikesCount: number }> {
    // 트랜잭션으로 원자성 보장
    const queryRunner =
      this.commentsRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 행 잠금으로 동시성 문제 방지
      const comment = await queryRunner.manager
        .createQueryBuilder(Comment, "comment")
        .where("comment.id = :id", { id: commentId })
        .setLock("pessimistic_write")
        .getOne();

      if (!comment) {
        throw new NotFoundException("Comment not found");
      }

      // 기존 좋아요/싫어요 확인
      const existingLike = await queryRunner.manager.findOne(CommentLike, {
        where: { commentId, userId: user.id },
      });

      let disliked = false;

      if (existingLike) {
        if (existingLike.type === LikeType.DISLIKE) {
          // 싫어요 취소
          await queryRunner.manager.remove(existingLike);
          comment.dislikesCount = Math.max(0, comment.dislikesCount - 1);
          disliked = false;
        } else {
          // 좋아요 -> 싫어요로 변경
          existingLike.type = LikeType.DISLIKE;
          await queryRunner.manager.save(existingLike);
          comment.dislikesCount = comment.dislikesCount + 1;
          comment.likesCount = Math.max(0, comment.likesCount - 1);
          disliked = true;
        }
      } else {
        // 새 싫어요 추가
        const newDislike = queryRunner.manager.create(CommentLike, {
          userId: user.id,
          commentId,
          type: LikeType.DISLIKE,
        });
        await queryRunner.manager.save(newDislike);
        comment.dislikesCount = comment.dislikesCount + 1;
        disliked = true;
      }

      await queryRunner.manager.save(comment);
      await queryRunner.commitTransaction();

      // 인기순 정렬 캐시 무효화 (싫어요 수 변경)
      await this.invalidateCommentsPaginationCache(comment.postId);

      return {
        disliked,
        likesCount: comment.likesCount,
        dislikesCount: comment.dislikesCount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ============================================================
  // 페이지네이션 메서드 (5,000명+ 커뮤니티 최적화)
  // ============================================================

  /**
   * 커서 인코딩 (Base64 JSON)
   *
   * @description
   * 커서 정보를 Base64 인코딩하여 URL-safe 문자열로 변환
   *
   * @param cursor - 커서 객체 { likesCount?, createdAt, id }
   * @returns Base64 인코딩된 문자열
   */
  private encodeCursor(cursor: {
    likesCount?: number;
    createdAt: Date;
    id: string;
  }): string {
    const cursorData = {
      likesCount: cursor.likesCount,
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    };
    return Buffer.from(JSON.stringify(cursorData)).toString("base64");
  }

  /**
   * 커서 디코딩 (Base64 JSON)
   *
   * @param cursor - Base64 인코딩된 커서 문자열
   * @returns 디코딩된 커서 객체
   */
  private decodeCursor(
    cursor: string,
  ): { likesCount?: number; createdAt: string; id: string } | null {
    try {
      const decoded = Buffer.from(cursor, "base64").toString("utf-8");
      return JSON.parse(decoded);
    } catch (error) {
      this.logger.error(`Failed to decode cursor: ${cursor}`, error);
      return null;
    }
  }

  /**
   * 부모 댓글 페이지네이션 조회 (최신순/인기순 정렬)
   *
   * @description
   * - 부모 댓글만 조회 (parentCommentId IS NULL)
   * - 커서 기반 페이지네이션 (createdAt + id 복합 커서)
   * - 인기순 정렬 시 스냅샷 타임스탬프로 중복/누락 방지
   * - 첫 페이지만 Redis 캐싱 (TTL 10초)
   *
   * @최적화_전략
   * 1. 복합 인덱스 활용 (idx_comments_recent_parent, idx_comments_popular_parent)
   * 2. WHERE 절에서 커서 기준 필터링 (LIMIT + 1로 다음 페이지 존재 확인)
   * 3. 첫 페이지 캐싱으로 DB 부하 감소
   * 4. 스냅샷 방식으로 인기순 정렬 안정성 확보
   *
   * @param postId - 게시글 ID
   * @param dto - 페이지네이션 옵션
   * @param user - 현재 사용자 (좋아요 상태 확인용)
   * @returns 페이지네이션된 댓글 목록
   */
  async getParentCommentsPaginated(
    postId: string,
    dto: GetCommentsDto,
    user?: User,
  ): Promise<PaginatedCommentsDto> {
    const { cursor, limit = 20, sort = "recent", snapshotTimestamp } = dto;

    // 캐시 키 생성 (첫 페이지만)
    const isFirstPage = !cursor;
    const cacheKey = isFirstPage
      ? CacheKeys.COMMENTS_PAGE_FIRST(postId, sort)
      : null;

    // 첫 페이지 캐시 확인
    if (cacheKey) {
      const cached =
        await this.cacheService.get<PaginatedCommentsDto>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache HIT: ${cacheKey}`);
        this.cacheMetricsService.recordCommentsCacheHit();
        return cached;
      }
      this.logger.debug(`Cache MISS: ${cacheKey}`);
      this.cacheMetricsService.recordCommentsCacheMiss();
    }

    // 커서 디코딩
    const decodedCursor = cursor ? this.decodeCursor(cursor) : null;

    // 스냅샷 타임스탬프 설정 (인기순 정렬 시)
    let effectiveSnapshot: Date | null = null;
    if (sort === "popular") {
      if (snapshotTimestamp) {
        effectiveSnapshot = new Date(snapshotTimestamp);
      } else if (isFirstPage) {
        effectiveSnapshot = new Date(); // 첫 페이지 요청 시 현재 시간을 스냅샷으로 사용
      }
    }

    // QueryBuilder 구성
    const queryBuilder = this.commentsRepository
      .createQueryBuilder("comment")
      .leftJoinAndSelect("comment.author", "author")
      .leftJoinAndSelect("author.profile", "profile") // Profile 테이블 조인 추가
      .where("comment.postId = :postId", { postId })
      .andWhere("comment.parentCommentId IS NULL")
      .andWhere("comment.isDeleted = :isDeleted", { isDeleted: false });

    // 스냅샷 타임스탬프 적용 (인기순 정렬 시)
    if (effectiveSnapshot) {
      queryBuilder.andWhere("comment.createdAt <= :snapshot", {
        snapshot: effectiveSnapshot,
      });
    }

    // 사용자 좋아요 상태 JOIN
    if (user) {
      queryBuilder.leftJoinAndSelect(
        "comment.commentLikes",
        "userLike",
        "userLike.userId = :userId",
        { userId: user.id },
      );
    }

    // 정렬 및 커서 필터링
    if (sort === "popular") {
      // 인기순: likesCount DESC, createdAt DESC, id DESC
      queryBuilder
        .orderBy("comment.likesCount", "DESC")
        .addOrderBy("comment.createdAt", "DESC")
        .addOrderBy("comment.id", "DESC");

      if (decodedCursor) {
        // 복합 커서 필터링 (likesCount, createdAt, id)
        queryBuilder.andWhere(
          new Brackets((qb) => {
            qb.where("comment.likesCount < :likesCount", {
              likesCount: decodedCursor.likesCount || 0,
            })
              .orWhere(
                new Brackets((qb2) => {
                  qb2
                    .where("comment.likesCount = :likesCount", {
                      likesCount: decodedCursor.likesCount || 0,
                    })
                    .andWhere("comment.createdAt < :createdAt", {
                      createdAt: decodedCursor.createdAt,
                    });
                }),
              )
              .orWhere(
                new Brackets((qb3) => {
                  qb3
                    .where("comment.likesCount = :likesCount", {
                      likesCount: decodedCursor.likesCount || 0,
                    })
                    .andWhere("comment.createdAt = :createdAt", {
                      createdAt: decodedCursor.createdAt,
                    })
                    .andWhere("comment.id < :id", { id: decodedCursor.id });
                }),
              );
          }),
        );
      }
    } else {
      // 최신순: createdAt DESC, id DESC
      queryBuilder
        .orderBy("comment.createdAt", "DESC")
        .addOrderBy("comment.id", "DESC");

      if (decodedCursor) {
        // 커서 필터링 (createdAt, id)
        queryBuilder.andWhere(
          new Brackets((qb) => {
            qb.where("comment.createdAt < :createdAt", {
              createdAt: decodedCursor.createdAt,
            }).orWhere(
              new Brackets((qb2) => {
                qb2
                  .where("comment.createdAt = :createdAt", {
                    createdAt: decodedCursor.createdAt,
                  })
                  .andWhere("comment.id < :id", { id: decodedCursor.id });
              }),
            );
          }),
        );
      }
    }

    // LIMIT + 1로 다음 페이지 존재 확인
    queryBuilder.take(limit + 1);

    const comments = await queryBuilder.getMany();

    // 사용자 좋아요 상태 맵 생성
    const userLikes: { [commentId: string]: "like" | "dislike" } = {};
    if (user) {
      comments.forEach((comment) => {
        const userLike = comment.commentLikes?.find(
          (like) => like.userId === user.id,
        );
        if (userLike) {
          userLikes[comment.id] = userLike.type;
        }
      });
    }

    // 다음 페이지 존재 확인
    const hasNextPage = comments.length > limit;
    const sliced = hasNextPage ? comments.slice(0, -1) : comments;

    // 다음 커서 생성
    const nextCursor =
      hasNextPage && sliced.length > 0
        ? this.encodeCursor({
            likesCount:
              sort === "popular"
                ? sliced[sliced.length - 1].likesCount
                : undefined,
            createdAt: sliced[sliced.length - 1].createdAt,
            id: sliced[sliced.length - 1].id,
          })
        : null;

    // DTO 변환
    const commentDtos = sliced.map((comment) =>
      this.toCommentDto(comment, {
        userLiked: userLikes[comment.id] === "like",
        userDisliked: userLikes[comment.id] === "dislike",
      }),
    );

    // 응답 구성
    const response: PaginatedCommentsDto = {
      comments: commentDtos,
      nextCursor,
      hasNextPage,
    };

    // 첫 페이지에만 총 개수 포함
    if (isFirstPage) {
      const totalCount = await this.commentsRepository.count({
        where: {
          postId,
          parentCommentId: null,
          isDeleted: false,
        },
      });
      response.totalCount = totalCount;

      // 스냅샷 타임스탬프 반환 (인기순 정렬 시)
      if (effectiveSnapshot) {
        response.snapshotTimestamp = effectiveSnapshot.toISOString();
      }
    }

    // 첫 페이지 캐싱
    if (cacheKey) {
      await this.cacheService.set(cacheKey, response, CacheTTL.VERY_SHORT);
      this.logger.debug(`Cache SET: ${cacheKey}`);
    }

    return response;
  }

  /**
   * 답글 페이지네이션 조회 (특정 부모 댓글의 답글)
   *
   * @description
   * - 특정 부모 댓글의 답글만 조회
   * - 오래된 순서대로 정렬 (스레드 형태 유지)
   * - 첫 페이지만 Redis 캐싱 (TTL 10초)
   *
   * @param parentCommentId - 부모 댓글 ID
   * @param dto - 페이지네이션 옵션
   * @param user - 현재 사용자
   * @returns 페이지네이션된 답글 목록
   */
  async getRepliesPaginated(
    parentCommentId: string,
    dto: GetRepliesDto,
    user?: User,
  ): Promise<PaginatedCommentsDto> {
    const { cursor, limit = 10 } = dto;

    // 캐시 키 생성 (첫 페이지만)
    const isFirstPage = !cursor;
    const cacheKey = isFirstPage
      ? CacheKeys.COMMENT_REPLIES_FIRST(parentCommentId)
      : null;

    // 첫 페이지 캐시 확인
    if (cacheKey) {
      const cached =
        await this.cacheService.get<PaginatedCommentsDto>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache HIT: ${cacheKey}`);
        this.cacheMetricsService.recordCommentsCacheHit();
        return cached;
      }
      this.logger.debug(`Cache MISS: ${cacheKey}`);
      this.cacheMetricsService.recordCommentsCacheMiss();
    }

    // 커서 디코딩
    const decodedCursor = cursor ? this.decodeCursor(cursor) : null;

    // Raw SQL 쿼리로 재귀적 댓글 가져오기 (플랫 구조)
    // PostgreSQL의 Recursive CTE 사용
    const queryParams: any[] = [parentCommentId];
    let cursorWhereClause = "";
    let paramIndex = 2;

    if (decodedCursor) {
      cursorWhereClause = `AND (ct."createdAt" > $${paramIndex} OR (ct."createdAt" = $${paramIndex} AND ct.id > $${paramIndex + 1}))`;
      queryParams.push(decodedCursor.createdAt);
      queryParams.push(decodedCursor.id);
      paramIndex += 2;
    }

    const rawQuery = `
      WITH RECURSIVE comment_tree AS (
        -- 직계 자식 댓글
        SELECT c.*, 0 as depth
        FROM comments c
        WHERE c."parentCommentId" = $1 AND c."isDeleted" = false
        ${cursorWhereClause}

        UNION ALL

        -- 재귀적으로 모든 하위 댓글 (기존 데이터 호환성 위해 충분한 depth)
        SELECT c.*, ct.depth + 1
        FROM comments c
        INNER JOIN comment_tree ct ON c."parentCommentId" = ct.id
        WHERE c."isDeleted" = false AND ct.depth < 10
      )
      SELECT
        ct.*,
        u.id as author_id,
        u.username as author_username,
        u.email as author_email,
        p."profileImage" as author_profileImage
      FROM comment_tree ct
      LEFT JOIN users u ON ct."authorId" = u.id
      LEFT JOIN profiles p ON u.id = p."userId"
      ORDER BY ct."createdAt" ASC, ct.id ASC
      LIMIT ${limit + 1}
    `;

    const rawResults = await this.commentsRepository.query(
      rawQuery,
      queryParams,
    );

    // Raw 결과를 Comment 엔티티로 변환
    const comments = rawResults.slice(0, limit).map((row) => {
      const comment = new Comment();
      comment.id = row.id;
      comment.content = row.content;
      comment.postId = row.postId || row.postid; // PostgreSQL은 소문자로 반환할 수 있음
      comment.authorId = row.authorId || row.authorid;
      comment.parentCommentId = row.parentCommentId || row.parentcommentid;
      comment.likesCount = parseInt(
        row.likesCount || row.likescount || "0",
        10,
      );
      comment.dislikesCount = parseInt(
        row.dislikesCount || row.dislikescount || "0",
        10,
      );
      comment.repliesCount = parseInt(
        row.repliesCount || row.repliescount || "0",
        10,
      );
      comment.isDeleted = row.isDeleted || row.isdeleted;
      comment.createdAt = row.createdAt || row.createdat;
      comment.updatedAt = row.updatedAt || row.updatedat;

      // ProfileImage CDN URL 변환
      let profileImage = row.author_profileImage || row.author_profileimage;
      if (
        profileImage &&
        (profileImage.startsWith("v2/") || profileImage.startsWith("uploads/"))
      ) {
        profileImage = this.cdnService.generateCdnUrlFromKey(profileImage);
      }

      // Author 정보 설정 - UserResponseDto를 사용하여 @Expose() 데코레이터 적용
      comment.author = plainToInstance(UserResponseDto, {
        id: row.author_id,
        username: row.author_username,
        profileImage: profileImage,
        email: row.author_email,
      }) as any;

      return comment;
    });

    const hasMore = rawResults.length > limit;
    const nextCursor =
      hasMore && comments.length > 0
        ? this.encodeCursor({
            createdAt: comments[comments.length - 1].createdAt,
            id: comments[comments.length - 1].id,
          })
        : null;

    // 사용자 좋아요/싫어요 상태 추가
    let commentsWithLikeStatus = comments;
    if (user) {
      const commentIds = comments.map((c) => c.id);
      const likes = await this.commentLikesRepository.find({
        where: {
          commentId: In(commentIds),
          userId: user.id,
        },
      });

      const userLikes: { [commentId: string]: "like" | "dislike" } = {};
      likes.forEach((like) => {
        userLikes[like.commentId] = like.type;
      });

      commentsWithLikeStatus = comments.map((comment) =>
        this.toCommentDto(comment, {
          userLiked: userLikes[comment.id] === "like",
          userDisliked: userLikes[comment.id] === "dislike",
        }),
      );
    } else {
      commentsWithLikeStatus = comments.map((comment) =>
        this.toCommentDto(comment, {
          userLiked: false,
          userDisliked: false,
        }),
      );
    }

    // 재귀적으로 모든 하위 댓글 수 카운트
    const totalCountQuery = `
      WITH RECURSIVE comment_tree AS (
        SELECT id FROM comments
        WHERE "parentCommentId" = $1 AND "isDeleted" = false

        UNION ALL

        SELECT c.id FROM comments c
        INNER JOIN comment_tree ct ON c."parentCommentId" = ct.id
        WHERE c."isDeleted" = false
      )
      SELECT COUNT(*) as count FROM comment_tree
    `;

    const countResult = await this.commentsRepository.query(totalCountQuery, [
      parentCommentId,
    ]);
    const totalCount = parseInt(countResult[0]?.count || "0", 10);

    const result: PaginatedCommentsDto = {
      comments: commentsWithLikeStatus,
      nextCursor,
      hasNextPage: hasMore,
      totalCount,
    };

    // 캐싱은 하지 않음 (자식 댓글은 선택적으로 보기 때문)
    return result;
  }

  /**
   * 부모 댓글의 답글 수 증가
   *
   * @param commentId - 부모 댓글 ID
   * @description 최상위 부모 댓글의 카운트만 증가
   */
  async incrementRepliesCount(commentId: string): Promise<void> {
    // 최상위 부모 찾기
    let currentComment = await this.commentsRepository.findOne({
      where: { id: commentId },
      select: ["id", "parentCommentId"],
    });

    if (!currentComment) return;

    // 재귀적으로 최상위 부모 찾기
    let rootParentId = currentComment.id;
    while (currentComment.parentCommentId) {
      const parentComment = await this.commentsRepository.findOne({
        where: { id: currentComment.parentCommentId },
        select: ["id", "parentCommentId"],
      });

      if (!parentComment) break;
      rootParentId = parentComment.id;
      currentComment = parentComment;
    }

    // 최상위 부모 댓글의 카운트만 증가
    await this.commentsRepository.increment(
      { id: rootParentId },
      "repliesCount",
      1,
    );
  }

  /**
   * 부모 댓글의 답글 수 감소
   *
   * @param commentId - 부모 댓글 ID
   * @description 최상위 부모 댓글의 카운트만 감소
   */
  async decrementRepliesCount(commentId: string): Promise<void> {
    // 최상위 부모 찾기
    let currentComment = await this.commentsRepository.findOne({
      where: { id: commentId },
      select: ["id", "parentCommentId"],
    });

    if (!currentComment) return;

    // 재귀적으로 최상위 부모 찾기
    let rootParentId = currentComment.id;
    while (currentComment.parentCommentId) {
      const parentComment = await this.commentsRepository.findOne({
        where: { id: currentComment.parentCommentId },
        select: ["id", "parentCommentId"],
      });

      if (!parentComment) break;
      rootParentId = parentComment.id;
      currentComment = parentComment;
    }

    // 최상위 부모 댓글의 카운트만 감소
    await this.commentsRepository.decrement(
      { id: rootParentId },
      "repliesCount",
      1,
    );
  }

  /**
   * 댓글 페이지네이션 캐시 무효화
   *
   * @description
   * 댓글 작성/삭제/수정 시 호출하여 캐시 무효화
   *
   * @param postId - 게시글 ID
   * @param parentCommentId - 부모 댓글 ID (답글인 경우)
   */
  async invalidateCommentsPaginationCache(
    postId: string,
    parentCommentId?: string,
  ): Promise<void> {
    // 부모 댓글 캐시 무효화 (최신순 + 인기순)
    await this.cacheService.del(
      CacheKeys.COMMENTS_PAGE_FIRST(postId, "recent"),
    );
    await this.cacheService.del(
      CacheKeys.COMMENTS_PAGE_FIRST(postId, "popular"),
    );

    // 답글 캐시 무효화
    if (parentCommentId) {
      await this.cacheService.del(
        CacheKeys.COMMENT_REPLIES_FIRST(parentCommentId),
      );
    }

    // 인기 포스트 캐시 무효화
    // 댓글 수 변경으로 인기 순위가 달라질 수 있음
    // popularity_score = viewCount + (likeCount × 3) + (commentCount × 2)
    this.eventEmitter.emit("post.popularity.updated", { postId });

    this.logger.debug(`Invalidated pagination cache for postId: ${postId}`);
  }
}
