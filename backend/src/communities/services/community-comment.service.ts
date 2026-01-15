import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, IsNull, Brackets } from "typeorm";
import { plainToInstance } from "class-transformer";
import { Community } from "../entities/community.entity";
import { CommunityComment } from "../entities/community-comment.entity";
import {
  CommunityCommentLike,
  CommentLikeType,
} from "../entities/community-comment-like.entity";
import { CommunityPost } from "../entities/community-post.entity";
import { CommunityMember } from "../entities/community-member.entity";
import { CommunityModLog } from "../entities/community-mod-log.entity";
import {
  CommunityRole,
  CommunityPostStatus,
  ModAction,
  isModeratorOrAbove,
} from "../enums";
import { CreateCommunityCommentDto, UpdateCommunityCommentDto } from "../dto";
import { CacheService, CacheTTL } from "../../cache/cache.service";
import { CommentResponseDto } from "../../comments/dto/comment-response.dto";
import { PaginatedCommentsDto } from "../../comments/dto/paginated-comments.dto";
import { GetCommentsDto } from "../../comments/dto/get-comments-query.dto";
import { GetRepliesDto } from "../../comments/dto/get-replies.dto";
import { CdnService } from "../../files/services/cdn.service";
import { UserResponseDto } from "../../users/dto/user-response.dto";

/**
 * 댓글 캐시 키 상수
 */
const CommentCacheKeys = {
  PARENT_FIRST_PAGE: (postId: string, sort: string) =>
    `community:post:${postId}:comments:first:${sort}`,
  REPLIES_FIRST_PAGE: (commentId: string) =>
    `community:comment:${commentId}:replies:first`,
  TOTAL_COUNT: (postId: string) => `community:post:${postId}:comments:total`,
};

/**
 * 커뮤니티 댓글 서비스
 *
 * @description 커뮤니티 게시물 댓글 CRUD 담당
 *
 * **설계 원칙:**
 * - 대댓글은 제한된 깊이(depth ≤ 2)까지만 지원
 * - 삭제 시 isDeleted 플래그 (대댓글 있으면 보존)
 * - 모더레이터는 모든 댓글 삭제 가능
 */
@Injectable()
export class CommunityCommentService {
  private readonly logger = new Logger(CommunityCommentService.name);

  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityComment)
    private readonly commentRepository: Repository<CommunityComment>,
    @InjectRepository(CommunityCommentLike)
    private readonly commentLikeRepository: Repository<CommunityCommentLike>,
    @InjectRepository(CommunityPost)
    private readonly postRepository: Repository<CommunityPost>,
    @InjectRepository(CommunityMember)
    private readonly memberRepository: Repository<CommunityMember>,
    @InjectRepository(CommunityModLog)
    private readonly modLogRepository: Repository<CommunityModLog>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    private readonly cdnService: CdnService,
  ) {}

  /**
   * 커서 인코딩 (Base64 JSON)
   */
  private encodeCursor(cursor: {
    likeCount?: number;
    createdAt: Date;
    id: string;
  }): string {
    const payload = {
      likeCount: cursor.likeCount,
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    };
    return Buffer.from(JSON.stringify(payload)).toString("base64");
  }

  /**
   * 커서 디코딩
   */
  private decodeCursor(
    cursor?: string,
  ): { likeCount?: number; createdAt: string; id: string } | null {
    if (!cursor) return null;
    try {
      const decoded = Buffer.from(cursor, "base64").toString("utf-8");
      return JSON.parse(decoded);
    } catch (error) {
      this.logger.warn(`Cursor decode 실패: ${cursor}`, error as Error);
      return null;
    }
  }

  /**
   * CommunityComment를 CommentResponseDto로 변환
   */
  private toCommentDto(
    comment: CommunityComment,
    additionalData?: Partial<CommentResponseDto>,
  ): CommentResponseDto {
    const base = {
      id: comment.id,
      content: comment.content,
      postId: comment.postId,
      authorId: comment.authorId,
      parentCommentId: comment.parentCommentId,
      likesCount: comment.likeCount,
      dislikesCount: comment.dislikeCount,
      repliesCount: comment.replyCount,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: comment.author,
    };

    const dto = plainToInstance(CommentResponseDto, base, {
      excludeExtraneousValues: true,
    });

    // 작성자 정보 변환 (CDN URL 포함)
    if (comment.author) {
      if (comment.author instanceof UserResponseDto) {
        dto.author = comment.author;
      } else {
        let profileImage: string | null = null;
        if ((comment.author as any).profile?.profileImage) {
          profileImage = (comment.author as any).profile.profileImage;
        }
        if (!profileImage && (comment.author as any).profileImage) {
          profileImage = (comment.author as any).profileImage;
        }
        if (
          profileImage &&
          (profileImage.startsWith("v2/") ||
            profileImage.startsWith("uploads/"))
        ) {
          profileImage = this.cdnService.generateCdnUrlFromKey(profileImage);
        }

        dto.author = plainToInstance(UserResponseDto, {
          ...comment.author,
          profileImage,
        });
      }
    }

    Object.assign(dto, {
      isDeleted: comment.isDeleted,
    });

    if (additionalData) {
      Object.assign(dto, additionalData);
    }

    return dto;
  }

  // =========================================================================
  // 댓글 CRUD
  // =========================================================================

  /**
   * 댓글 생성
   */
  async create(
    postId: string,
    dto: CreateCommunityCommentDto,
    authorId: string,
  ): Promise<CommentResponseDto> {
    // 게시물 확인
    const post = await this.postRepository.findOne({
      where: { id: postId, status: CommunityPostStatus.PUBLISHED },
      select: ["id", "communityId"],
    });

    if (!post) {
      throw new NotFoundException("게시물을 찾을 수 없습니다");
    }

    // 대댓글인 경우 부모 댓글 확인
    let parentComment: CommunityComment | null = null;
    let parentCommentId = dto.parentCommentId?.trim() || null;
    if (parentCommentId) {
      parentComment = await this.commentRepository.findOne({
        where: { id: parentCommentId, postId },
        select: ["id", "parentCommentId"],
      });

      if (!parentComment) {
        throw new NotFoundException("부모 댓글을 찾을 수 없습니다");
      }

      // 답글의 답글인 경우 최상위 부모로 연결
      if (parentComment.parentCommentId) {
        parentCommentId = parentComment.parentCommentId;
        parentComment = await this.commentRepository.findOne({
          where: { id: parentCommentId, postId },
          select: ["id", "parentCommentId"],
        });

        if (!parentComment) {
          throw new NotFoundException("부모 댓글을 찾을 수 없습니다");
        }
      }
    }

    const community = await this.communityRepository.findOne({
      where: { id: post.communityId },
      select: ["id", "isLocked"],
    });

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    if (community.isLocked) {
      throw new ForbiddenException(
        "현재 커뮤니티가 잠겨 있어 댓글을 작성할 수 없습니다.",
      );
    }

    // 트랜잭션으로 댓글 생성 + 카운트 업데이트
    return await this.dataSource.transaction(async (manager) => {
      // 댓글 생성
      const comment = manager.create(CommunityComment, {
        postId,
        authorId,
        content: dto.content,
        parentCommentId,
        communityId: post.communityId, // Added optimization field
      });

      const saved = await manager.save(CommunityComment, comment);

      // 게시물 댓글 수 증가
      await manager.increment(CommunityPost, { id: postId }, "commentCount", 1);

      // 부모 댓글의 대댓글 수 증가
      if (parentCommentId) {
        await manager.increment(
          CommunityComment,
          { id: parentCommentId },
          "replyCount",
          1,
        );
      }

      // 캐시 무효화
      await this.invalidateCommentCache(postId, parentCommentId || undefined);

      const savedWithAuthor = await manager.findOne(CommunityComment, {
        where: { id: saved.id },
        relations: ["author", "author.profile"],
      });

      return this.toCommentDto(savedWithAuthor ?? saved);
    });
  }

  /**
   * 부모 댓글 페이지네이션 (커서 기반)
   */
  async getParentCommentsPaginated(
    postId: string,
    query: GetCommentsDto,
    userId?: string,
  ): Promise<PaginatedCommentsDto> {
    const { cursor, limit = 20, sort = "recent", snapshotTimestamp } = query;
    const decodedCursor = this.decodeCursor(cursor);
    const isFirstPage = !cursor;
    const cacheKey = isFirstPage
      ? CommentCacheKeys.PARENT_FIRST_PAGE(postId, sort)
      : null;

    if (cacheKey) {
      const cached =
        await this.cacheService.get<PaginatedCommentsDto>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    let effectiveSnapshot: Date | null = null;
    if (sort === "popular") {
      if (snapshotTimestamp) {
        effectiveSnapshot = new Date(snapshotTimestamp);
      } else if (isFirstPage) {
        effectiveSnapshot = new Date();
      }
    }

    const queryBuilder = this.commentRepository
      .createQueryBuilder("comment")
      .leftJoinAndSelect("comment.author", "author")
      .leftJoinAndSelect("author.profile", "authorProfile")
      .where("comment.postId = :postId", { postId })
      .andWhere("comment.parentCommentId IS NULL")
      .andWhere("comment.isDeleted = :isDeleted", { isDeleted: false });

    if (effectiveSnapshot) {
      queryBuilder.andWhere("comment.createdAt <= :snapshot", {
        snapshot: effectiveSnapshot,
      });
    }

    if (sort === "popular") {
      queryBuilder
        .orderBy("comment.likeCount", "DESC")
        .addOrderBy("comment.createdAt", "DESC")
        .addOrderBy("comment.id", "DESC");

      if (decodedCursor) {
        queryBuilder.andWhere(
          new Brackets((qb) => {
            qb.where("comment.likeCount < :likeCount", {
              likeCount: decodedCursor.likeCount || 0,
            })
              .orWhere(
                new Brackets((qb2) => {
                  qb2
                    .where("comment.likeCount = :likeCount", {
                      likeCount: decodedCursor.likeCount || 0,
                    })
                    .andWhere("comment.createdAt < :createdAt", {
                      createdAt: decodedCursor.createdAt,
                    });
                }),
              )
              .orWhere(
                new Brackets((qb3) => {
                  qb3
                    .where("comment.likeCount = :likeCount", {
                      likeCount: decodedCursor.likeCount || 0,
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
      queryBuilder
        .orderBy("comment.createdAt", "DESC")
        .addOrderBy("comment.id", "DESC");

      if (decodedCursor) {
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

    queryBuilder.take(limit + 1);

    const comments = await queryBuilder.getMany();

    let userLikes: Record<string, CommentLikeType | null> = {};
    if (userId && comments.length > 0) {
      const commentIds = comments.map((c) => c.id);
      userLikes = await this.getUserLikes(commentIds, userId);
    }

    const hasNextPage = comments.length > limit;
    const sliced = hasNextPage ? comments.slice(0, -1) : comments;

    const nextCursor =
      hasNextPage && sliced.length > 0
        ? this.encodeCursor({
            likeCount:
              sort === "popular"
                ? sliced[sliced.length - 1].likeCount
                : undefined,
            createdAt: sliced[sliced.length - 1].createdAt,
            id: sliced[sliced.length - 1].id,
          })
        : null;

    const commentDtos = sliced.map((comment) =>
      this.toCommentDto(comment, {
        userLiked: userLikes[comment.id] === CommentLikeType.LIKE,
        userDisliked: userLikes[comment.id] === CommentLikeType.DISLIKE,
      }),
    );

    const response: PaginatedCommentsDto = {
      comments: commentDtos,
      nextCursor,
      hasNextPage,
    };

    if (isFirstPage) {
      const totalCount = await this.commentRepository.count({
        where: { postId, parentCommentId: IsNull(), isDeleted: false },
      });
      response.totalCount = totalCount;

      if (effectiveSnapshot) {
        response.snapshotTimestamp = effectiveSnapshot.toISOString();
      }

      if (cacheKey) {
        await this.cacheService.set(cacheKey, response, CacheTTL.VERY_SHORT);
      }
    }

    return response;
  }

  /**
   * 대댓글 페이지네이션
   */
  async getRepliesPaginated(
    commentId: string,
    query: GetRepliesDto,
    userId?: string,
  ): Promise<PaginatedCommentsDto> {
    const { cursor, limit = 10 } = query;
    const decodedCursor = this.decodeCursor(cursor);
    const isFirstPage = !cursor;
    const cacheKey = isFirstPage
      ? CommentCacheKeys.REPLIES_FIRST_PAGE(commentId)
      : null;

    if (cacheKey) {
      const cached =
        await this.cacheService.get<PaginatedCommentsDto>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const queryBuilder = this.commentRepository
      .createQueryBuilder("comment")
      .leftJoinAndSelect("comment.author", "author")
      .leftJoinAndSelect("author.profile", "authorProfile")
      .where("comment.parentCommentId = :parentId", { parentId: commentId })
      .andWhere("comment.isDeleted = :isDeleted", { isDeleted: false })
      .orderBy("comment.createdAt", "ASC")
      .addOrderBy("comment.id", "ASC");

    if (decodedCursor) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("comment.createdAt > :createdAt", {
            createdAt: decodedCursor.createdAt,
          }).orWhere(
            new Brackets((qb2) => {
              qb2
                .where("comment.createdAt = :createdAt", {
                  createdAt: decodedCursor.createdAt,
                })
                .andWhere("comment.id > :id", { id: decodedCursor.id });
            }),
          );
        }),
      );
    }

    queryBuilder.take(limit + 1);

    const comments = await queryBuilder.getMany();

    let userLikes: Record<string, CommentLikeType | null> = {};
    if (userId && comments.length > 0) {
      const commentIds = comments.map((c) => c.id);
      userLikes = await this.getUserLikes(commentIds, userId);
    }

    const hasNextPage = comments.length > limit;
    const sliced = hasNextPage ? comments.slice(0, -1) : comments;

    const nextCursor =
      hasNextPage && sliced.length > 0
        ? this.encodeCursor({
            createdAt: sliced[sliced.length - 1].createdAt,
            id: sliced[sliced.length - 1].id,
          })
        : null;

    const commentDtos = sliced.map((comment) =>
      this.toCommentDto(comment, {
        userLiked: userLikes[comment.id] === CommentLikeType.LIKE,
        userDisliked: userLikes[comment.id] === CommentLikeType.DISLIKE,
      }),
    );

    const response: PaginatedCommentsDto = {
      comments: commentDtos,
      nextCursor,
      hasNextPage,
    };

    if (cacheKey) {
      await this.cacheService.set(cacheKey, response, CacheTTL.VERY_SHORT);
    }

    return response;
  }

  /**
   * 댓글 수정
   */
  async update(
    commentId: string,
    dto: UpdateCommunityCommentDto,
    userId: string,
  ): Promise<CommentResponseDto> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException("댓글을 찾을 수 없습니다");
    }

    // 작성자만 수정 가능
    if (comment.authorId !== userId) {
      throw new ForbiddenException("댓글을 수정할 권한이 없습니다");
    }

    // 삭제된 댓글은 수정 불가
    if (comment.isDeleted) {
      throw new ForbiddenException("삭제된 댓글은 수정할 수 없습니다");
    }

    comment.content = dto.content;
    const updated = await this.commentRepository.save(comment);

    // 캐시 무효화
    await this.invalidateCommentCache(
      comment.postId,
      comment.parentCommentId || undefined,
    );

    const hydrated = await this.commentRepository.findOne({
      where: { id: updated.id },
      relations: ["author", "author.profile"],
    });

    return this.toCommentDto(hydrated ?? updated);
  }

  /**
   * 댓글 삭제
   */
  async delete(
    commentId: string,
    userId: string,
    userRole?: CommunityRole,
  ): Promise<void> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException("댓글을 찾을 수 없습니다");
    }

    const isAuthor = comment.authorId === userId;
    const isModerator = userRole && isModeratorOrAbove(userRole);

    if (!isAuthor && !isModerator) {
      throw new ForbiddenException("댓글을 삭제할 권한이 없습니다");
    }

    await this.dataSource.transaction(async (manager) => {
      // 대댓글이 있는 경우 소프트 삭제
      if (comment.replyCount > 0) {
        comment.isDeleted = true;
        comment.content = "삭제된 댓글입니다.";
        await manager.save(CommunityComment, comment);
      } else {
        // 대댓글이 없으면 완전 삭제
        await manager.remove(CommunityComment, comment);

        // 부모 댓글의 대댓글 수 감소
        if (comment.parentCommentId) {
          await manager
            .createQueryBuilder()
            .update(CommunityComment)
            .set({ replyCount: () => 'GREATEST(0, "replyCount" - 1)' })
            .where("id = :id", { id: comment.parentCommentId })
            .execute();
        }
      }

      // 게시물 댓글 수 감소
      await manager
        .createQueryBuilder()
        .update(CommunityPost)
        .set({ commentCount: () => 'GREATEST(0, "commentCount" - 1)' })
        .where("id = :id", { id: comment.postId })
        .execute();

      // 모더레이터 삭제 시 로그
      if (isModerator && !isAuthor) {
        await manager.save(CommunityModLog, {
          communityId: comment.communityId,
          moderatorId: userId,
          action: ModAction.REMOVE_COMMENT,
          targetUserId: comment.authorId,
          metadata: { commentId },
        });
      }
    });

    // 캐시 무효화
    await this.invalidateCommentCache(
      comment.postId,
      comment.parentCommentId || undefined,
    );

    this.logger.log(`댓글 삭제: ${commentId}`);
  }

  // =========================================================================
  // 좋아요/싫어요 (Like/Dislike)
  // =========================================================================

  /**
   * 댓글 좋아요 토글
   *
   * @description Reddit 스타일 상호배타 로직
   * - 좋아요 클릭 → 새로 좋아요 추가
   * - 좋아요 다시 클릭 → 좋아요 취소
   * - 싫어요 상태에서 좋아요 → 싫어요 제거 + 좋아요 추가
   *
   * @param commentId 댓글 ID
   * @param userId 사용자 ID
   * @returns 좋아요 상태 및 카운트
   */
  async toggleLike(
    commentId: string,
    userId: string,
  ): Promise<{ liked: boolean; likeCount: number; dislikeCount: number }> {
    // 트랜잭션으로 원자성 보장
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 행 잠금으로 동시성 문제 방지
      const comment = await queryRunner.manager
        .createQueryBuilder(CommunityComment, "comment")
        .where("comment.id = :id", { id: commentId })
        .setLock("pessimistic_write")
        .getOne();

      if (!comment) {
        throw new NotFoundException("댓글을 찾을 수 없습니다");
      }

      // 기존 좋아요/싫어요 확인
      const existingLike = await queryRunner.manager.findOne(
        CommunityCommentLike,
        {
          where: { commentId, userId },
        },
      );

      let liked = false;

      if (existingLike) {
        if (existingLike.type === CommentLikeType.LIKE) {
          // 좋아요 취소
          await queryRunner.manager.remove(existingLike);
          comment.likeCount = Math.max(0, comment.likeCount - 1);
          liked = false;
        } else {
          // 싫어요 → 좋아요로 변경
          existingLike.type = CommentLikeType.LIKE;
          await queryRunner.manager.save(existingLike);
          comment.likeCount = comment.likeCount + 1;
          comment.dislikeCount = Math.max(0, comment.dislikeCount - 1);
          liked = true;
        }
      } else {
        // 새 좋아요 추가
        const newLike = queryRunner.manager.create(CommunityCommentLike, {
          userId,
          commentId,
          type: CommentLikeType.LIKE,
        });
        await queryRunner.manager.save(newLike);
        comment.likeCount = comment.likeCount + 1;
        liked = true;
      }

      await queryRunner.manager.save(comment);
      await queryRunner.commitTransaction();

      // 캐시 무효화
      await this.invalidateCommentCache(
        comment.postId,
        comment.parentCommentId || undefined,
      );

      return {
        liked,
        likeCount: comment.likeCount,
        dislikeCount: comment.dislikeCount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 댓글 싫어요 토글
   *
   * @description Reddit 스타일 상호배타 로직
   * - 싫어요 클릭 → 새로 싫어요 추가
   * - 싫어요 다시 클릭 → 싫어요 취소
   * - 좋아요 상태에서 싫어요 → 좋아요 제거 + 싫어요 추가
   *
   * @param commentId 댓글 ID
   * @param userId 사용자 ID
   * @returns 싫어요 상태 및 카운트
   */
  async toggleDislike(
    commentId: string,
    userId: string,
  ): Promise<{ disliked: boolean; likeCount: number; dislikeCount: number }> {
    // 트랜잭션으로 원자성 보장
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 행 잠금으로 동시성 문제 방지
      const comment = await queryRunner.manager
        .createQueryBuilder(CommunityComment, "comment")
        .where("comment.id = :id", { id: commentId })
        .setLock("pessimistic_write")
        .getOne();

      if (!comment) {
        throw new NotFoundException("댓글을 찾을 수 없습니다");
      }

      // 기존 좋아요/싫어요 확인
      const existingLike = await queryRunner.manager.findOne(
        CommunityCommentLike,
        {
          where: { commentId, userId },
        },
      );

      let disliked = false;

      if (existingLike) {
        if (existingLike.type === CommentLikeType.DISLIKE) {
          // 싫어요 취소
          await queryRunner.manager.remove(existingLike);
          comment.dislikeCount = Math.max(0, comment.dislikeCount - 1);
          disliked = false;
        } else {
          // 좋아요 → 싫어요로 변경
          existingLike.type = CommentLikeType.DISLIKE;
          await queryRunner.manager.save(existingLike);
          comment.dislikeCount = comment.dislikeCount + 1;
          comment.likeCount = Math.max(0, comment.likeCount - 1);
          disliked = true;
        }
      } else {
        // 새 싫어요 추가
        const newDislike = queryRunner.manager.create(CommunityCommentLike, {
          userId,
          commentId,
          type: CommentLikeType.DISLIKE,
        });
        await queryRunner.manager.save(newDislike);
        comment.dislikeCount = comment.dislikeCount + 1;
        disliked = true;
      }

      await queryRunner.manager.save(comment);
      await queryRunner.commitTransaction();

      // 캐시 무효화
      await this.invalidateCommentCache(
        comment.postId,
        comment.parentCommentId || undefined,
      );

      return {
        disliked,
        likeCount: comment.likeCount,
        dislikeCount: comment.dislikeCount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 여러 댓글에 대한 사용자 좋아요/싫어요 상태 조회
   *
   * @param commentIds 댓글 ID 배열
   * @param userId 사용자 ID
   * @returns { [commentId]: 'like' | 'dislike' | null }
   */
  async getUserLikes(
    commentIds: string[],
    userId: string,
  ): Promise<Record<string, CommentLikeType | null>> {
    if (!commentIds.length || !userId) {
      return {};
    }

    const likes = await this.commentLikeRepository.find({
      where: commentIds.map((commentId) => ({ commentId, userId })),
      select: ["commentId", "type"],
    });

    const result: Record<string, CommentLikeType | null> = {};
    commentIds.forEach((id) => {
      result[id] = null;
    });

    likes.forEach((like) => {
      result[like.commentId] = like.type;
    });

    return result;
  }

  // =========================================================================
  // 캐시 유틸리티
  // =========================================================================

  /**
   * 댓글 캐시 무효화
   */
  private async invalidateCommentCache(
    postId: string,
    parentCommentId?: string,
  ): Promise<void> {
    const tasks: Promise<void>[] = [
      this.cacheService.del(
        CommentCacheKeys.PARENT_FIRST_PAGE(postId, "recent"),
      ),
      this.cacheService.del(
        CommentCacheKeys.PARENT_FIRST_PAGE(postId, "popular"),
      ),
      this.cacheService.del(CommentCacheKeys.TOTAL_COUNT(postId)),
      this.cacheService.deletePattern(`community:post:${postId}:comments:*`),
    ];

    if (parentCommentId) {
      tasks.push(
        this.cacheService.del(
          CommentCacheKeys.REPLIES_FIRST_PAGE(parentCommentId),
        ),
      );
    }

    await Promise.all(tasks);
  }

  /**
   * 댓글 깊이 계산
   *
   * @description 루트 댓글은 0, 직접 답글은 1, 그 다음은 2 ...
   */
  private async getCommentDepth(
    comment: Pick<CommunityComment, "parentCommentId">,
  ): Promise<number> {
    let depth = 0;
    let currentParentId = comment.parentCommentId;

    while (currentParentId) {
      depth += 1;
      const parent = await this.commentRepository.findOne({
        where: { id: currentParentId },
        select: ["parentCommentId"],
      });

      if (!parent) {
        break;
      }

      currentParentId = parent.parentCommentId;
    }

    return depth;
  }
}
