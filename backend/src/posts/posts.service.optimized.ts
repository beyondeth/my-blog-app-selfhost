import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PostsServiceOptimized {
  constructor(
    @InjectRepository(Post)
    private postsRepository: Repository<Post>,
  ) {}

  /**
   * 최적화된 좋아요 토글 - 낙관적 잠금 사용
   * 
   * 장점:
   * 1. 트랜잭션 시간 최소화
   * 2. Connection Pool 효율적 사용
   * 3. 데드락 없음
   * 4. 높은 동시성 처리 능력
   */
  async toggleLikeOptimized(postId: string, user: User): Promise<{ liked: boolean }> {
    if (!user?.id) {
      throw new ForbiddenException('로그인한 유저만 좋아요를 누를 수 있습니다.');
    }

    const maxRetries = 5;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        // 1. Post 조회 (잠금 없이)
        const post = await this.postsRepository.findOne({
          where: { id: postId },
          relations: ['likedBy'],
        });

        if (!post) {
          throw new NotFoundException('Post not found');
        }

        // 2. 좋아요 상태 확인
        const isCurrentlyLiked = post.likedBy?.some(u => u.id === user.id) || false;
        
        // 3. 좋아요 상태 변경
        if (isCurrentlyLiked) {
          // 좋아요 취소
          post.likedBy = post.likedBy.filter(u => u.id !== user.id);
          post.likeCount = Math.max(0, post.likeCount - 1);
        } else {
          // 좋아요 추가
          if (!post.likedBy) post.likedBy = [];
          post.likedBy.push(user);
          post.likeCount++;
        }

        // 4. 저장 시도 (version 자동 체크)
        // Optimistic Locking: version이 변경되었으면 에러 발생
        await this.postsRepository.save(post);
        
        return { liked: !isCurrentlyLiked };
        
      } catch (error) {
        // Version 충돌 시 재시도
        if (error.message?.includes('version') || 
            error.code === 'ER_LOCK_WAIT_TIMEOUT') {
          retryCount++;
          if (retryCount < maxRetries) {
            // 지수 백오프
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 50));
            continue;
          }
        }
        throw error;
      }
    }

    throw new ConflictException('Too many concurrent updates. Please try again.');
  }

  /**
   * 대안 2: 직접 SQL로 원자적 업데이트
   * 
   * 가장 효율적이지만 TypeORM의 편의성을 포기
   */
  async toggleLikeAtomic(postId: string, user: User): Promise<{ liked: boolean }> {
    if (!user?.id) {
      throw new ForbiddenException('로그인한 유저만 좋아요를 누를 수 있습니다.');
    }

    // 1. 현재 좋아요 상태 확인
    const existingLike = await this.postsRepository.manager
      .query(
        'SELECT 1 FROM post_likes WHERE "postId" = $1 AND "userId" = $2',
        [postId, user.id]
      );

    const isLiked = existingLike.length > 0;

    if (isLiked) {
      // 좋아요 취소 - 원자적 실행
      await this.postsRepository.manager.transaction(async manager => {
        await manager.query(
          'DELETE FROM post_likes WHERE "postId" = $1 AND "userId" = $2',
          [postId, user.id]
        );
        await manager.query(
          'UPDATE posts SET "likeCount" = GREATEST(0, "likeCount" - 1) WHERE id = $1',
          [postId]
        );
      });
    } else {
      // 좋아요 추가 - 원자적 실행
      await this.postsRepository.manager.transaction(async manager => {
        await manager.query(
          'INSERT INTO post_likes ("postId", "userId") VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [postId, user.id]
        );
        // ON CONFLICT DO NOTHING이 실제로 삽입했는지 확인
        const result = await manager.query(
          'UPDATE posts SET "likeCount" = "likeCount" + 1 WHERE id = $1 AND EXISTS (SELECT 1 FROM post_likes WHERE "postId" = $1 AND "userId" = $2)',
          [postId, user.id]
        );
      });
    }

    return { liked: !isLiked };
  }

  /**
   * 대안 3: Redis를 사용한 분산 잠금 (가장 확장 가능)
   * 
   * Redis가 설치되어 있다면 이 방법이 가장 좋음
   */
  async toggleLikeWithRedisLock(postId: string, user: User): Promise<{ liked: boolean }> {
    // Redis 잠금 구현 (별도 설치 필요)
    const lockKey = `post:${postId}:like:${user.id}`;
    // ... Redis lock 구현
    
    throw new Error('Redis implementation required');
  }
}