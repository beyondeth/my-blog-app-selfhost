import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Comment } from './entities/comment.entity';
import { CommentLike, LikeType } from './entities/comment-like.entity';
import { CommentResponseDto } from './dto/comment-response.dto';
import { GetCommentsDto } from './dto/get-comments-query.dto';
import { GetRepliesDto } from './dto/get-replies.dto';
import { PaginatedCommentsDto } from './dto/paginated-comments.dto';
import { User } from '../users/entities/user.entity';
import { PostsService } from '../posts/posts.service';
import { CacheService, CacheKeys, CacheTTL } from '../cache/cache.service';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(Comment)
    private commentsRepository: Repository<Comment>,
    @InjectRepository(CommentLike)
    private commentLikesRepository: Repository<CommentLike>,
    private postsService: PostsService,
    private cacheService: CacheService,
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

    // 페이지네이션 캐시 무효화
    await this.invalidateCommentsPaginationCache(postId, parentCommentId);

    return savedComment;
  }

  async findAllByPost(postId: string, user?: User): Promise<CommentResponseDto[]> {
    // 최적화: 2개 쿼리 (comments + likes) → 1개 쿼리 (LEFT JOIN 사용)
    // QueryBuilder를 사용하여 댓글과 사용자 좋아요 상태를 한 번에 조회
    const queryBuilder = this.commentsRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .where('comment.postId = :postId', { postId })
      .andWhere('comment.isDeleted = :isDeleted', { isDeleted: false })
      .orderBy('comment.createdAt', 'ASC');

    // 사용자가 있는 경우, 해당 사용자의 좋아요/싫어요 상태를 LEFT JOIN으로 함께 조회
    if (user) {
      queryBuilder.leftJoinAndSelect(
        'comment.commentLikes',
        'userLike',
        'userLike.userId = :userId',
        { userId: user.id }
      );
    }

    const allComments = await queryBuilder.getMany();

    // 사용자의 좋아요/싫어요 상태를 맵으로 변환
    let userLikes: { [commentId: string]: 'like' | 'dislike' } = {};
    if (user) {
      allComments.forEach(comment => {
        // LEFT JOIN으로 가져온 commentLikes 배열에서 사용자의 좋아요 찾기
        const userLike = comment.commentLikes?.find(like => like.userId === user.id);
        if (userLike) {
          userLikes[comment.id] = userLike.type;
        }
      });
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

    // 페이지네이션 캐시 무효화
    await this.invalidateCommentsPaginationCache(comment.post.id, comment.parentCommentId);
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

      // 인기순 정렬 캐시 무효화 (좋아요 수 변경)
      await this.invalidateCommentsPaginationCache(comment.postId);

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

      // 인기순 정렬 캐시 무효화 (싫어요 수 변경)
      await this.invalidateCommentsPaginationCache(comment.postId);

      return { disliked, likesCount: comment.likesCount, dislikesCount: comment.dislikesCount };
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
  private encodeCursor(cursor: { likesCount?: number; createdAt: Date; id: string }): string {
    const cursorData = {
      likesCount: cursor.likesCount,
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    };
    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  /**
   * 커서 디코딩 (Base64 JSON)
   *
   * @param cursor - Base64 인코딩된 커서 문자열
   * @returns 디코딩된 커서 객체
   */
  private decodeCursor(cursor: string): { likesCount?: number; createdAt: string; id: string } | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
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
    const { cursor, limit = 20, sort = 'recent', snapshotTimestamp } = dto;

    // 캐시 키 생성 (첫 페이지만)
    const isFirstPage = !cursor;
    const cacheKey = isFirstPage
      ? CacheKeys.COMMENTS_PAGE_FIRST(postId, sort)
      : null;

    // 첫 페이지 캐시 확인
    if (cacheKey) {
      const cached = await this.cacheService.get<PaginatedCommentsDto>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache HIT: ${cacheKey}`);
        return cached;
      }
    }

    // 커서 디코딩
    const decodedCursor = cursor ? this.decodeCursor(cursor) : null;

    // 스냅샷 타임스탬프 설정 (인기순 정렬 시)
    let effectiveSnapshot: Date | null = null;
    if (sort === 'popular') {
      if (snapshotTimestamp) {
        effectiveSnapshot = new Date(snapshotTimestamp);
      } else if (isFirstPage) {
        effectiveSnapshot = new Date(); // 첫 페이지 요청 시 현재 시간을 스냅샷으로 사용
      }
    }

    // QueryBuilder 구성
    const queryBuilder = this.commentsRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .where('comment.postId = :postId', { postId })
      .andWhere('comment.parentCommentId IS NULL')
      .andWhere('comment.isDeleted = :isDeleted', { isDeleted: false });

    // 스냅샷 타임스탬프 적용 (인기순 정렬 시)
    if (effectiveSnapshot) {
      queryBuilder.andWhere('comment.createdAt <= :snapshot', {
        snapshot: effectiveSnapshot,
      });
    }

    // 사용자 좋아요 상태 JOIN
    if (user) {
      queryBuilder.leftJoinAndSelect(
        'comment.commentLikes',
        'userLike',
        'userLike.userId = :userId',
        { userId: user.id },
      );
    }

    // 정렬 및 커서 필터링
    if (sort === 'popular') {
      // 인기순: likesCount DESC, createdAt DESC, id DESC
      queryBuilder.orderBy('comment.likesCount', 'DESC')
        .addOrderBy('comment.createdAt', 'DESC')
        .addOrderBy('comment.id', 'DESC');

      if (decodedCursor) {
        // 복합 커서 필터링 (likesCount, createdAt, id)
        queryBuilder.andWhere(
          new Brackets((qb) => {
            qb.where('comment.likesCount < :likesCount', {
              likesCount: decodedCursor.likesCount || 0,
            })
              .orWhere(
                new Brackets((qb2) => {
                  qb2
                    .where('comment.likesCount = :likesCount', {
                      likesCount: decodedCursor.likesCount || 0,
                    })
                    .andWhere('comment.createdAt < :createdAt', {
                      createdAt: decodedCursor.createdAt,
                    });
                }),
              )
              .orWhere(
                new Brackets((qb3) => {
                  qb3
                    .where('comment.likesCount = :likesCount', {
                      likesCount: decodedCursor.likesCount || 0,
                    })
                    .andWhere('comment.createdAt = :createdAt', {
                      createdAt: decodedCursor.createdAt,
                    })
                    .andWhere('comment.id < :id', { id: decodedCursor.id });
                }),
              );
          }),
        );
      }
    } else {
      // 최신순: createdAt DESC, id DESC
      queryBuilder.orderBy('comment.createdAt', 'DESC')
        .addOrderBy('comment.id', 'DESC');

      if (decodedCursor) {
        // 커서 필터링 (createdAt, id)
        queryBuilder.andWhere(
          new Brackets((qb) => {
            qb.where('comment.createdAt < :createdAt', {
              createdAt: decodedCursor.createdAt,
            })
              .orWhere(
                new Brackets((qb2) => {
                  qb2
                    .where('comment.createdAt = :createdAt', {
                      createdAt: decodedCursor.createdAt,
                    })
                    .andWhere('comment.id < :id', { id: decodedCursor.id });
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
    const userLikes: { [commentId: string]: 'like' | 'dislike' } = {};
    if (user) {
      comments.forEach((comment) => {
        const userLike = comment.commentLikes?.find((like) => like.userId === user.id);
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
            likesCount: sort === 'popular' ? sliced[sliced.length - 1].likesCount : undefined,
            createdAt: sliced[sliced.length - 1].createdAt,
            id: sliced[sliced.length - 1].id,
          })
        : null;

    // DTO 변환
    const commentDtos = sliced.map((comment) =>
      this.toCommentDto(comment, {
        userLiked: userLikes[comment.id] === 'like',
        userDisliked: userLikes[comment.id] === 'dislike',
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
      const cached = await this.cacheService.get<PaginatedCommentsDto>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache HIT: ${cacheKey}`);
        return cached;
      }
    }

    // 커서 디코딩
    const decodedCursor = cursor ? this.decodeCursor(cursor) : null;

    // QueryBuilder 구성
    const queryBuilder = this.commentsRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .where('comment.parentCommentId = :parentCommentId', { parentCommentId })
      .andWhere('comment.isDeleted = :isDeleted', { isDeleted: false });

    // 사용자 좋아요 상태 JOIN
    if (user) {
      queryBuilder.leftJoinAndSelect(
        'comment.commentLikes',
        'userLike',
        'userLike.userId = :userId',
        { userId: user.id },
      );
    }

    // 정렬: createdAt ASC (오래된 것부터)
    queryBuilder.orderBy('comment.createdAt', 'ASC')
      .addOrderBy('comment.id', 'ASC');

    // 커서 필터링
    if (decodedCursor) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('comment.createdAt > :createdAt', {
            createdAt: decodedCursor.createdAt,
          })
            .orWhere(
              new Brackets((qb2) => {
                qb2
                  .where('comment.createdAt = :createdAt', {
                    createdAt: decodedCursor.createdAt,
                  })
                  .andWhere('comment.id > :id', { id: decodedCursor.id });
              }),
            );
        }),
      );
    }

    // LIMIT + 1
    queryBuilder.take(limit + 1);

    const replies = await queryBuilder.getMany();

    // 사용자 좋아요 상태 맵
    const userLikes: { [commentId: string]: 'like' | 'dislike' } = {};
    if (user) {
      replies.forEach((reply) => {
        const userLike = reply.commentLikes?.find((like) => like.userId === user.id);
        if (userLike) {
          userLikes[reply.id] = userLike.type;
        }
      });
    }

    // 다음 페이지 확인
    const hasNextPage = replies.length > limit;
    const sliced = hasNextPage ? replies.slice(0, -1) : replies;

    // 다음 커서 생성
    const nextCursor =
      hasNextPage && sliced.length > 0
        ? this.encodeCursor({
            createdAt: sliced[sliced.length - 1].createdAt,
            id: sliced[sliced.length - 1].id,
          })
        : null;

    // DTO 변환
    const replyDtos = sliced.map((reply) =>
      this.toCommentDto(reply, {
        userLiked: userLikes[reply.id] === 'like',
        userDisliked: userLikes[reply.id] === 'dislike',
      }),
    );

    // 응답 구성
    const response: PaginatedCommentsDto = {
      comments: replyDtos,
      nextCursor,
      hasNextPage,
    };

    // 첫 페이지에만 총 개수 포함
    if (isFirstPage) {
      const totalCount = await this.commentsRepository.count({
        where: {
          parentCommentId,
          isDeleted: false,
        },
      });
      response.totalCount = totalCount;
    }

    // 첫 페이지 캐싱
    if (cacheKey) {
      await this.cacheService.set(cacheKey, response, CacheTTL.VERY_SHORT);
      this.logger.debug(`Cache SET: ${cacheKey}`);
    }

    return response;
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
  async invalidateCommentsPaginationCache(postId: string, parentCommentId?: string): Promise<void> {
    // 부모 댓글 캐시 무효화 (최신순 + 인기순)
    await this.cacheService.del(CacheKeys.COMMENTS_PAGE_FIRST(postId, 'recent'));
    await this.cacheService.del(CacheKeys.COMMENTS_PAGE_FIRST(postId, 'popular'));

    // 답글 캐시 무효화
    if (parentCommentId) {
      await this.cacheService.del(CacheKeys.COMMENT_REPLIES_FIRST(parentCommentId));
    }

    // 인기 포스트 캐시 무효화
    // 댓글 수 변경으로 인기 순위가 달라질 수 있음
    // popularity_score = viewCount + (likeCount × 3) + (commentCount × 2)
    await this.invalidatePopularPostsCache();

    this.logger.debug(`Invalidated pagination cache for postId: ${postId}`);
  }

  /**
   * 인기 포스트 캐시 무효화
   * @description 댓글 생성/삭제로 인기 순위가 달라질 수 있으므로 인기 포스트 캐시 무효화
   */
  private async invalidatePopularPostsCache(): Promise<void> {
    const popularPeriods = ['daily', 'weekly', 'monthly'];
    const limits = [5, 10];

    try {
      const invalidationPromises = [];

      for (const period of popularPeriods) {
        for (const limit of limits) {
          const cacheKey = `popular:posts:${period}:${limit}`;
          invalidationPromises.push(
            this.cacheService.delete(cacheKey).catch(err => {
              this.logger.error(`Failed to invalidate cache key ${cacheKey}:`, err);
            })
          );
        }
      }

      await Promise.all(invalidationPromises);
      this.logger.debug('✅ Invalidated popular posts cache after comment update');
    } catch (error) {
      this.logger.error('❌ Failed to invalidate popular posts cache:', error);
    }
  }
} 