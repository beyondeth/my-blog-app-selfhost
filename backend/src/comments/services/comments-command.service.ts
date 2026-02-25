import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Comment } from "../entities/comment.entity";
import { CommentLike, LikeType } from "../entities/comment-like.entity";
import { CommentResponseDto } from "../dto/comment-response.dto";
import { User } from "../../users/entities/user.entity";
import { PostsService } from "../../posts/posts.service";
import { BlogResolverService } from "../../common/services/blog-resolver.service";
import { IpSecurityService } from "../../common/services/ip-security.service";
import { CommentsCacheService } from "./comments-cache.service";
import { CommentsMapperService } from "./comments-mapper.service";

@Injectable()
export class CommentsCommandService {
  private readonly logger = new Logger(CommentsCommandService.name);

  constructor(
    @InjectRepository(Comment)
    private commentsRepository: Repository<Comment>,
    @InjectRepository(CommentLike)
    private commentLikesRepository: Repository<CommentLike>,
    private postsService: PostsService,
    private blogResolverService: BlogResolverService,
    private eventEmitter: EventEmitter2,
    private ipSecurityService: IpSecurityService,
    private commentsCacheService: CommentsCacheService,
    private commentsMapperService: CommentsMapperService,
  ) {}

  async create(
    createCommentDto: any,
    user: User,
    ip?: string,
  ): Promise<CommentResponseDto> {
    const { postId, parentCommentId, ...commentData } = createCommentDto;

    const post = await this.postsService.findOne(postId);
    if (!post) {
      throw new NotFoundException("포스트를 찾을 수 없습니다.");
    }

    const blog = await this.blogResolverService.findBlogById(post.blogId);
    if (!blog.allowComments) {
      throw new ForbiddenException("이 블로그는 댓글을 허용하지 않습니다.");
    }

    let actualParentCommentId = parentCommentId;
    if (parentCommentId) {
      const parentComment = await this.commentsRepository.findOne({
        where: { id: parentCommentId },
        select: ["id", "parentCommentId"],
      });
      if (parentComment && parentComment.parentCommentId) {
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
      ipAddress: this.ipSecurityService.encrypt(ip),
      userAgent: "Unknown",
      blogId: post.blogId,
    });

    const savedComment = (await this.commentsRepository.save(
      comment,
    )) as unknown as Comment;

    await this.postsService.incrementCommentCount(postId);

    if (actualParentCommentId) {
      await this.incrementRepliesCount(actualParentCommentId);
    }

    await this.commentsCacheService.invalidateCommentsPaginationCache(
      postId,
      actualParentCommentId,
    );

    const commentWithAuthor = await this.commentsRepository.findOne({
      where: { id: savedComment.id },
      relations: ["author", "author.profile"],
    });

    if (!commentWithAuthor) {
      throw new NotFoundException("작성된 댓글을 찾을 수 없습니다.");
    }

    this.eventEmitter.emit("post.comment.added", {
      commentId: savedComment.id,
      postId,
      authorId: user.id,
      content: commentData.content,
      timestamp: new Date(),
    });

    return this.commentsMapperService.toCommentDto(commentWithAuthor);
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

    await this.postsService.decrementCommentCount(comment.postId);

    if (comment.parentCommentId) {
      await this.decrementRepliesCount(comment.parentCommentId);
    }

    await this.commentsCacheService.invalidateCommentsPaginationCache(
      comment.postId,
      comment.parentCommentId,
    );
  }

  async toggleLike(
    commentId: string,
    user: User,
  ): Promise<{ liked: boolean; likesCount: number; dislikesCount: number }> {
    const queryRunner =
      this.commentsRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const comment = await queryRunner.manager
        .createQueryBuilder(Comment, "comment")
        .where("comment.id = :id", { id: commentId })
        .setLock("pessimistic_write")
        .getOne();

      if (!comment) throw new NotFoundException("Comment not found");

      const existingLike = await queryRunner.manager.findOne(CommentLike, {
        where: { commentId, userId: user.id },
      });

      let liked = false;

      if (existingLike) {
        if (existingLike.type === LikeType.LIKE) {
          await queryRunner.manager.remove(existingLike);
          comment.likesCount = Math.max(0, comment.likesCount - 1);
          liked = false;
        } else {
          existingLike.type = LikeType.LIKE;
          await queryRunner.manager.save(existingLike);
          comment.likesCount = comment.likesCount + 1;
          comment.dislikesCount = Math.max(0, comment.dislikesCount - 1);
          liked = true;
        }
      } else {
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

      await this.commentsCacheService.invalidateCommentsPaginationCache(
        comment.postId,
      );

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
    const queryRunner =
      this.commentsRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const comment = await queryRunner.manager
        .createQueryBuilder(Comment, "comment")
        .where("comment.id = :id", { id: commentId })
        .setLock("pessimistic_write")
        .getOne();

      if (!comment) throw new NotFoundException("Comment not found");

      const existingLike = await queryRunner.manager.findOne(CommentLike, {
        where: { commentId, userId: user.id },
      });

      let disliked = false;

      if (existingLike) {
        if (existingLike.type === LikeType.DISLIKE) {
          await queryRunner.manager.remove(existingLike);
          comment.dislikesCount = Math.max(0, comment.dislikesCount - 1);
          disliked = false;
        } else {
          existingLike.type = LikeType.DISLIKE;
          await queryRunner.manager.save(existingLike);
          comment.dislikesCount = comment.dislikesCount + 1;
          comment.likesCount = Math.max(0, comment.likesCount - 1);
          disliked = true;
        }
      } else {
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

      await this.commentsCacheService.invalidateCommentsPaginationCache(
        comment.postId,
      );

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

  async incrementRepliesCount(commentId: string): Promise<void> {
    let currentComment = await this.commentsRepository.findOne({
      where: { id: commentId },
      select: ["id", "parentCommentId"],
    });

    if (!currentComment) return;

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

    await this.commentsRepository.increment(
      { id: rootParentId },
      "repliesCount",
      1,
    );
  }

  async decrementRepliesCount(commentId: string): Promise<void> {
    let currentComment = await this.commentsRepository.findOne({
      where: { id: commentId },
      select: ["id", "parentCommentId"],
    });

    if (!currentComment) return;

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

    await this.commentsRepository.decrement(
      { id: rootParentId },
      "repliesCount",
      1,
    );
  }
}
