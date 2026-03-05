import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Comment } from "../entities/comment.entity";
import { CommentResponseDto } from "../dto/comment-response.dto";
import { GetCommentsDto } from "../dto/get-comments-query.dto";
import { GetRepliesDto } from "../dto/get-replies.dto";
import { PaginatedCommentsDto } from "../dto/paginated-comments.dto";
import { User } from "../../users/entities/user.entity";
import { CommentsReadRepository } from "../repositories/comments-read.repository";
import { CommentsCacheService } from "./comments-cache.service";
import { CommentsMapperService } from "./comments-mapper.service";
import { CacheKeys, CacheTTL } from "../../cache/cache.service";
import { BlogResolverService } from "../../common/services/blog-resolver.service";
import { Post } from "../../posts/entities/post.entity";
import { PostAccessPolicyService } from "../../posts/services/post-access-policy.service";

@Injectable()
export class CommentsQueryService {
  private readonly logger = new Logger(CommentsQueryService.name);

  constructor(
    @InjectRepository(Comment)
    private commentsRepository: Repository<Comment>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly commentsReadRepository: CommentsReadRepository,
    private readonly commentsCacheService: CommentsCacheService,
    private readonly commentsMapperService: CommentsMapperService,
    private readonly blogResolverService: BlogResolverService,
    private readonly postAccessPolicyService: PostAccessPolicyService,
  ) {}

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

  async findAllByPost(
    postId: string,
    user?: User,
  ): Promise<CommentResponseDto[]> {
    // 비공개 블로그 포스트 댓글 접근 차단
    await this.validatePostAccess(postId, user);

    const allComments = await this.commentsReadRepository.findAllByPost(
      postId,
      user?.id,
    );

    const userLikes: { [commentId: string]: "like" | "dislike" } = {};
    if (user) {
      allComments.forEach((comment) => {
        const userLike = comment.commentLikes?.find(
          (like) => like.userId === user.id,
        );
        if (userLike) {
          userLikes[comment.id] = userLike.type;
        }
      });
    }

    const buildTree = (
      comments: Comment[],
      parentId: string | null = null,
    ): CommentResponseDto[] => {
      return comments
        .filter((comment) => comment.parentCommentId === parentId)
        .map((comment) => {
          const dto = this.commentsMapperService.toCommentDto(comment, {
            userLiked: userLikes[comment.id] === "like",
            userDisliked: userLikes[comment.id] === "dislike",
          });
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

  async findAllComments(): Promise<Comment[]> {
    return this.commentsRepository.find({
      where: { isDeleted: false },
      relations: ["author", "post"],
      order: { createdAt: "DESC" },
    });
  }

  async getParentCommentsPaginated(
    postId: string,
    dto: GetCommentsDto,
    user?: User,
  ): Promise<PaginatedCommentsDto> {
    const { cursor, limit = 20, sort = "recent", snapshotTimestamp } = dto;

    // 비공개 블로그 포스트 댓글 접근 차단
    await this.validatePostAccess(postId, user);

    const isFirstPage = !cursor;
    const cacheKey = isFirstPage
      ? CacheKeys.COMMENTS_PAGE_FIRST(postId, sort)
      : null;

    if (cacheKey) {
      const cached =
        await this.commentsCacheService.getCachedFirstPage<PaginatedCommentsDto>(
          cacheKey,
        );
      if (cached) return cached;
    }

    const decodedCursor = cursor ? this.decodeCursor(cursor) : null;
    let effectiveSnapshot: Date | null = null;
    if (sort === "popular") {
      if (snapshotTimestamp) {
        effectiveSnapshot = new Date(snapshotTimestamp);
      } else if (isFirstPage) {
        effectiveSnapshot = new Date();
      }
    }

    const comments =
      await this.commentsReadRepository.getParentCommentsPaginated(
        postId,
        limit,
        decodedCursor,
        effectiveSnapshot,
        sort,
        user?.id,
      );

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

    const hasNextPage = comments.length > limit;
    const sliced = hasNextPage ? comments.slice(0, -1) : comments;

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

    const commentDtos = sliced.map((comment) =>
      this.commentsMapperService.toCommentDto(comment, {
        userLiked: userLikes[comment.id] === "like",
        userDisliked: userLikes[comment.id] === "dislike",
      }),
    );

    const response: PaginatedCommentsDto = {
      comments: commentDtos,
      nextCursor,
      hasNextPage,
    };

    if (isFirstPage) {
      response.totalCount =
        await this.commentsReadRepository.countParentComments(postId);
      if (effectiveSnapshot) {
        response.snapshotTimestamp = effectiveSnapshot.toISOString();
      }
    }

    if (cacheKey) {
      await this.commentsCacheService.setCachedFirstPage(
        cacheKey,
        response,
        CacheTTL.VERY_SHORT,
      );
    }

    return response;
  }

  async getRepliesPaginated(
    parentCommentId: string,
    dto: GetRepliesDto,
    user?: User,
  ): Promise<PaginatedCommentsDto> {
    const { cursor, limit = 10 } = dto;
    const isFirstPage = !cursor;
    const cacheKey = isFirstPage
      ? CacheKeys.COMMENT_REPLIES_FIRST(parentCommentId)
      : null;

    if (cacheKey) {
      const cached =
        await this.commentsCacheService.getCachedFirstPage<PaginatedCommentsDto>(
          cacheKey,
        );
      if (cached) return cached;
    }

    const decodedCursor = cursor ? this.decodeCursor(cursor) : null;

    // 대댓글 우회 차단 방어 로직 (부모 댓글의 postId 추출 및 검증)
    const parentComment = await this.commentsRepository.findOne({
      where: { id: parentCommentId, isDeleted: false },
      select: ["id", "postId"],
    });
    if (!parentComment) {
      throw new NotFoundException("부모 댓글을 찾을 수 없습니다.");
    }
    await this.validatePostAccess(parentComment.postId, user);

    const {
      comments: rawComments,
      hasMore,
      totalCount,
    } = await this.commentsReadRepository.getRepliesPaginated(
      parentCommentId,
      limit,
      decodedCursor,
      user?.id,
    );

    const nextCursor =
      hasMore && rawComments.length > 0
        ? this.encodeCursor({
            createdAt: rawComments[rawComments.length - 1].createdAt,
            id: rawComments[rawComments.length - 1].id,
          })
        : null;

    let commentsWithLikeStatus = rawComments;
    if (user) {
      const commentIds = rawComments.map((c) => c.id);
      const likes = await this.commentsReadRepository.getUserLikes(
        commentIds,
        user.id,
      );

      const userLikes: { [commentId: string]: "like" | "dislike" } = {};
      likes.forEach((like) => {
        userLikes[like.commentId] = like.type;
      });

      commentsWithLikeStatus = rawComments.map((comment) =>
        this.commentsMapperService.toCommentDto(comment, {
          userLiked: userLikes[comment.id] === "like",
          userDisliked: userLikes[comment.id] === "dislike",
        }),
      ) as any; // Type override since we already map to DTO here
    } else {
      commentsWithLikeStatus = rawComments.map((comment) =>
        this.commentsMapperService.toCommentDto(comment, {
          userLiked: false,
          userDisliked: false,
        }),
      ) as any;
    }

    const response: PaginatedCommentsDto = {
      comments: commentsWithLikeStatus as any,
      nextCursor,
      hasNextPage: hasMore,
      totalCount,
    };

    if (cacheKey) {
      await this.commentsCacheService.setCachedFirstPage(
        cacheKey,
        response,
        CacheTTL.VERY_SHORT,
      );
    }

    return response;
  }

  /**
   * 포스트의 블로그 공개 상태를 검증
   * 비공개 블로그 포스트의 댓글은 소유자/작성자만 조회 가능
   */
  private async validatePostAccess(postId: string, user?: User): Promise<void> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      select: ["id", "blogId", "authorId", "isPublished", "isDeleted", "visibility"],
    });

    if (!post) {
      throw new NotFoundException("포스트를 찾을 수 없습니다.");
    }

    const blog = post.blogId
      ? await this.blogResolverService.findBlogById(post.blogId)
      : null;

    const canRead = this.postAccessPolicyService.canReadPost(post, blog, user);

    if (!canRead) {
      // 접근 제어는 404로 은닉
      throw new NotFoundException("포스트를 찾을 수 없습니다.");
    }
  }
}
