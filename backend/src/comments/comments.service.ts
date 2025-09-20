import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Comment } from './entities/comment.entity';
import { CommentLike, LikeType } from './entities/comment-like.entity';
import { CommentResponseDto } from './dto/comment-response.dto';
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
  private toCommentDto(comment: Comment, additionalData?: Partial<CommentResponseDto>): CommentResponseDto {
    const dto = plainToInstance(CommentResponseDto, comment, {
      excludeExtraneousValues: true, // @Expose가 없는 필드 제외
    });

    // 추가 데이터가 있으면 설정
    if (additionalData) {
      Object.assign(dto, additionalData);
    }

    return dto;
  }

  async create(createCommentDto: any, user: User): Promise<Comment> {
    const { postId, parentCommentId, ...commentData } = createCommentDto;
    
    // 게시글 존재 확인 및 블로그 정보 가져오기
    const post = await this.postsService.findOne(postId);
    
    // 블로그의 댓글 허용 여부 확인
    const blog = await this.postsService.getBlogByPostId(postId);
    if (!blog.allowComments) {
      throw new ForbiddenException('이 블로그는 댓글을 허용하지 않습니다.');
    }

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

  async findAllByPost(postId: string, user?: User): Promise<CommentResponseDto[]> {
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

    // 트리 구조로 변환하면서 사용자 상태 포함 (spread 연산자 사용 금지)
    const buildTree = (comments: Comment[], parentId: string | null = null): CommentResponseDto[] => {
      return comments
        .filter(comment => comment.parentCommentId === parentId)
        .map(comment => {
          // DTO로 변환하면서 추가 필드 설정
          const dto = this.toCommentDto(comment, {
            userLiked: userLikes[comment.id] === 'like',
            userDisliked: userLikes[comment.id] === 'dislike',
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
    // 트랜잭션으로 원자성 보장
    const queryRunner = this.commentsRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      // 행 잠금으로 동시성 문제 방지
      const comment = await queryRunner.manager
        .createQueryBuilder(Comment, 'comment')
        .where('comment.id = :id', { id: commentId })
        .setLock('pessimistic_write')
        .getOne();
        
      if (!comment) {
        throw new NotFoundException('Comment not found');
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
      
      return { liked, likesCount: comment.likesCount, dislikesCount: comment.dislikesCount };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async toggleDislike(commentId: string, user: User): Promise<{ disliked: boolean; likesCount: number; dislikesCount: number }> {
    // 트랜잭션으로 원자성 보장
    const queryRunner = this.commentsRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      // 행 잠금으로 동시성 문제 방지
      const comment = await queryRunner.manager
        .createQueryBuilder(Comment, 'comment')
        .where('comment.id = :id', { id: commentId })
        .setLock('pessimistic_write')
        .getOne();
        
      if (!comment) {
        throw new NotFoundException('Comment not found');
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
      
      return { disliked, likesCount: comment.likesCount, dislikesCount: comment.dislikesCount };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
} 