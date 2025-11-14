import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PostLike } from '../entities/post-like.entity';

/**
 * 포스트 좋아요 상태 조회 서비스
 *
 * N+1 쿼리 문제 해결을 위한 배치 조회 전용 서비스
 */
@Injectable()
export class PostLikeStatusService {
  private readonly logger = new Logger(PostLikeStatusService.name);

  constructor(
    @InjectRepository(PostLike)
    private readonly postLikeRepository: Repository<PostLike>,
  ) {}

  /**
   * 여러 포스트의 좋아요 상태를 한 번에 조회
   *
   * @param postIds 포스트 ID 목록
   * @param userId 사용자 ID
   * @returns Map<postId, likedStatus> 형태의 좋아요 상태 맵
   */
  async getMultipleLikeStatuses(
    postIds: string[],
    userId: string,
  ): Promise<Map<string, boolean>> {
    if (!postIds.length || !userId) {
      return new Map();
    }

    // 한 번의 쿼리로 여러 포스트의 좋아요 상태 조회
    const likes = await this.postLikeRepository.find({
      where: {
        postId: In(postIds), // TypeORM의 In 연산자 사용
        userId,
      },
      select: ['postId'], // 필요한 필드만 선택
    });

    // 결과를 Map으로 변환
    const likedMap = new Map<string, boolean>();

    // 모든 포스트 ID를 false로 초기화
    postIds.forEach(postId => {
      likedMap.set(postId, false);
    });

    // 좋아요한 포스트만 true로 설정
    likes.forEach(like => {
      if (like.postId) {
        likedMap.set(like.postId, true);
      }
    });

    this.logger.debug(`[getMultipleLikeStatuses] User ${userId}: ${likes.length}/${postIds.length} posts liked`);

    return likedMap;
  }

  /**
   * 단일 포스트의 좋아요 상태 조회
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @returns 좋아요 여부
   */
  async getLikeStatus(postId: string, userId: string): Promise<boolean> {
    if (!postId || !userId) {
      return false;
    }

    const count = await this.postLikeRepository.count({
      where: {
        postId,
        userId,
      },
    });

    return count > 0;
  }

  /**
   * 사용자가 좋아요한 모든 포스트 ID 조회
   *
   * @param userId 사용자 ID
   * @param limit 조회 제한
   * @returns 포스트 ID 배열
   */
  async getUserLikedPostIds(
    userId: string,
    limit: number = 1000,
  ): Promise<string[]> {
    const likes = await this.postLikeRepository.find({
      where: { userId },
      select: ['postId'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return likes.map(like => like.postId).filter(Boolean);
  }
}