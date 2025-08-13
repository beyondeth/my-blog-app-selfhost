import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CommentLike, LikeType } from './entities/comment-like.entity';
import { User } from '../users/entities/user.entity';
import { PostsService } from '../posts/posts.service';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private commentsRepository: Repository<Comment>,
    @InjectRepository(CommentLike)
    private commentLikesRepository: Repository<CommentLike>,
    private postsService: PostsService,
  ) {}

  async create(createCommentDto: any, user: User): Promise<Comment> {
    const { postId, parentCommentId, ...commentData } = createCommentDto;
    
    // 게시글 존재 확인
    await this.postsService.findOne(postId);

    const comment = this.commentsRepository.create({
      ...commentData,
      author: user,
      post: { id: postId },
      parentComment: parentCommentId ? { id: parentCommentId } : null,
    });

    const savedComment = await this.commentsRepository.save(comment) as unknown as Comment;
    
    // 댓글 수 증가 - 답글도 포함
    await this.postsService.incrementCommentCount(postId);
    
    return savedComment;
  }

  async findAllByPost(postId: string, user?: User): Promise<Comment[]> {
    // 모든 댓글을 가져온 후 프론트엔드에서 트리 구조로 변환하는 방식
    // 더 깊은 중첩과 무제한 답글을 지원
    const allComments = await this.commentsRepository.find({
      where: { post: { id: postId }, isDeleted: false },
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });

    // 사용자의 좋아요/싫어요 상태를 가져오기
    let userLikes: { [commentId: string]: 'like' | 'dislike' } = {};
    if (user) {
      const likes = await this.commentLikesRepository.find({
        where: {
          userId: user.id,
          commentId: In(allComments.map(c => c.id))
        }
      });
      userLikes = likes.reduce((acc, like) => {
        acc[like.commentId] = like.type;
        return acc;
      }, {});
    }

    // 트리 구조로 변환하면서 사용자 상태 포함
    const buildTree = (comments: Comment[], parentId: string | null = null): Comment[] => {
      return comments
        .filter(comment => comment.parentCommentId === parentId)
        .map(comment => ({
          ...comment,
          userLiked: userLikes[comment.id] === 'like',
          userDisliked: userLikes[comment.id] === 'dislike',
          replies: buildTree(comments, comment.id)
        }));
    };

    return buildTree(allComments);
  }

  async findOne(id: string): Promise<Comment> {
    const comment = await this.commentsRepository.findOne({
      where: { id },
      relations: ['author', 'post'],
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    return comment;
  }

  async update(id: string, updateCommentDto: any, user: User): Promise<Comment> {
    const comment = await this.findOne(id);

    if (comment.author.id !== user.id) {
      throw new ForbiddenException('You can only update your own comments');
    }

    Object.assign(comment, updateCommentDto);
    return this.commentsRepository.save(comment);
  }

  async remove(id: string, user: User): Promise<void> {
    const comment = await this.findOne(id);

    if (comment.author.id !== user.id) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    comment.isDeleted = true;
    await this.commentsRepository.save(comment);
    
    // 댓글 수 감소
    await this.postsService.decrementCommentCount(comment.post.id);
  }

  async findAllComments(): Promise<Comment[]> {
    return this.commentsRepository.find({
      where: { isDeleted: false },
      relations: ['author', 'post'],
      order: { createdAt: 'DESC' },
    });
  }

  async toggleLike(commentId: string, user: User): Promise<{ liked: boolean; likesCount: number; dislikesCount: number }> {
    const comment = await this.findOne(commentId);
    
    // 기존 좋아요/싫어요 확인
    const existingLike = await this.commentLikesRepository.findOne({
      where: { commentId, userId: user.id },
    });

    if (existingLike) {
      if (existingLike.type === LikeType.LIKE) {
        // 좋아요 취소
        await this.commentLikesRepository.remove(existingLike);
        comment.likesCount = Math.max(0, comment.likesCount - 1);
        await this.commentsRepository.save(comment);
        return { liked: false, likesCount: comment.likesCount, dislikesCount: comment.dislikesCount };
      } else {
        // 싫어요 -> 좋아요로 변경
        existingLike.type = LikeType.LIKE;
        await this.commentLikesRepository.save(existingLike);
        comment.likesCount = comment.likesCount + 1;
        comment.dislikesCount = Math.max(0, comment.dislikesCount - 1);
        await this.commentsRepository.save(comment);
        return { liked: true, likesCount: comment.likesCount, dislikesCount: comment.dislikesCount };
      }
    } else {
      // 새 좋아요 추가
      const newLike = this.commentLikesRepository.create({
        userId: user.id,
        commentId,
        type: LikeType.LIKE,
      });
      await this.commentLikesRepository.save(newLike);
      comment.likesCount = comment.likesCount + 1;
      await this.commentsRepository.save(comment);
      return { liked: true, likesCount: comment.likesCount, dislikesCount: comment.dislikesCount };
    }
  }

  async toggleDislike(commentId: string, user: User): Promise<{ disliked: boolean; likesCount: number; dislikesCount: number }> {
    const comment = await this.findOne(commentId);
    
    // 기존 좋아요/싫어요 확인
    const existingLike = await this.commentLikesRepository.findOne({
      where: { commentId, userId: user.id },
    });

    if (existingLike) {
      if (existingLike.type === LikeType.DISLIKE) {
        // 싫어요 취소
        await this.commentLikesRepository.remove(existingLike);
        comment.dislikesCount = Math.max(0, comment.dislikesCount - 1);
        await this.commentsRepository.save(comment);
        return { disliked: false, likesCount: comment.likesCount, dislikesCount: comment.dislikesCount };
      } else {
        // 좋아요 -> 싫어요로 변경
        existingLike.type = LikeType.DISLIKE;
        await this.commentLikesRepository.save(existingLike);
        comment.dislikesCount = comment.dislikesCount + 1;
        comment.likesCount = Math.max(0, comment.likesCount - 1);
        await this.commentsRepository.save(comment);
        return { disliked: true, likesCount: comment.likesCount, dislikesCount: comment.dislikesCount };
      }
    } else {
      // 새 싫어요 추가
      const newDislike = this.commentLikesRepository.create({
        userId: user.id,
        commentId,
        type: LikeType.DISLIKE,
      });
      await this.commentLikesRepository.save(newDislike);
      comment.dislikesCount = comment.dislikesCount + 1;
      await this.commentsRepository.save(comment);
      return { disliked: true, likesCount: comment.likesCount, dislikesCount: comment.dislikesCount };
    }
  }
} 