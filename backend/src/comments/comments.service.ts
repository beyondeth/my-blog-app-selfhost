import { Injectable, Logger } from "@nestjs/common";
import { CommentResponseDto } from "./dto/comment-response.dto";
import { GetCommentsDto } from "./dto/get-comments-query.dto";
import { GetRepliesDto } from "./dto/get-replies.dto";
import { PaginatedCommentsDto } from "./dto/paginated-comments.dto";
import { User } from "../users/entities/user.entity";
import { Comment } from "./entities/comment.entity";
import { CommentsQueryService } from "./services/comments-query.service";
import { CommentsCommandService } from "./services/comments-command.service";

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly commentsQueryService: CommentsQueryService,
    private readonly commentsCommandService: CommentsCommandService,
  ) {}

  async create(
    createCommentDto: any,
    user: User,
    ip?: string,
  ): Promise<CommentResponseDto> {
    return this.commentsCommandService.create(createCommentDto, user, ip);
  }

  async findAllByPost(
    postId: string,
    user?: User,
  ): Promise<CommentResponseDto[]> {
    return this.commentsQueryService.findAllByPost(postId, user);
  }

  async findOne(id: string): Promise<Comment> {
    return this.commentsQueryService.findOne(id);
  }

  async update(
    id: string,
    updateCommentDto: any,
    user: User,
  ): Promise<Comment> {
    return this.commentsCommandService.update(id, updateCommentDto, user);
  }

  async remove(id: string, user: User): Promise<void> {
    return this.commentsCommandService.remove(id, user);
  }

  async findAllComments(): Promise<Comment[]> {
    return this.commentsQueryService.findAllComments();
  }

  async toggleLike(
    commentId: string,
    user: User,
  ): Promise<{ liked: boolean; likesCount: number; dislikesCount: number }> {
    return this.commentsCommandService.toggleLike(commentId, user);
  }

  async toggleDislike(
    commentId: string,
    user: User,
  ): Promise<{ disliked: boolean; likesCount: number; dislikesCount: number }> {
    return this.commentsCommandService.toggleDislike(commentId, user);
  }

  async getParentCommentsPaginated(
    postId: string,
    dto: GetCommentsDto,
    user?: User,
  ): Promise<PaginatedCommentsDto> {
    return this.commentsQueryService.getParentCommentsPaginated(
      postId,
      dto,
      user,
    );
  }

  async getRepliesPaginated(
    parentCommentId: string,
    dto: GetRepliesDto,
    user?: User,
  ): Promise<PaginatedCommentsDto> {
    return this.commentsQueryService.getRepliesPaginated(
      parentCommentId,
      dto,
      user,
    );
  }

  async incrementRepliesCount(commentId: string): Promise<void> {
    return this.commentsCommandService.incrementRepliesCount(commentId);
  }

  async decrementRepliesCount(commentId: string): Promise<void> {
    return this.commentsCommandService.decrementRepliesCount(commentId);
  }
}
