import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Follow } from './entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { FollowInfoDto, PaginatedResponseDto } from './dto';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private followRepository: Repository<Follow>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private notificationsService: NotificationsService,
    private dataSource: DataSource,
  ) {}

  async follow(followerId: string, followingId: string): Promise<void> {
    // 팔로우 시도 로그 제거 - 너무 빈번함

    // Check if user is trying to follow themselves
    if (followerId === followingId) {
      // 자기 자신 팔로우 시도는 중요한 오류이므로 로그 유지
      console.error('[FollowService] Error: User trying to follow themselves');
      throw new BadRequestException('You cannot follow yourself');
    }

    // Use transaction for atomic operation
    await this.dataSource.transaction(async (manager: EntityManager) => {
      // Check if both users exist using exist() for better performance
      const [followerExists, followingExists] = await Promise.all([
        manager.exists(User, { where: { id: followerId } }),
        manager.exists(User, { where: { id: followingId } }),
      ]);

      // 사용자 존재 확인 로그 제거 - 너무 빈번함

      if (!followerExists || !followingExists) {
        // 사용자 미발견은 중요한 오류이므로 로그 유지
        console.error('[FollowService] Error: User not found');
        throw new NotFoundException('User not found');
      }

      // Check if already following with lock to prevent race conditions
      const existingFollow = await manager.findOne(Follow, {
        where: {
          followerId,
          followingId,
        },
        lock: { mode: 'pessimistic_write' },
      });

      // 기존 팔로우 확인 로그 제거 - 너무 빈번함

      if (existingFollow) {
        // 중복 팔로우는 일반적인 상황이므로 로그 제거
        throw new BadRequestException('You are already following this user');
      }

      // Create follow relationship
      const follow = manager.create(Follow, {
        followerId,
        followingId,
      });

      const savedFollow = await manager.save(Follow, follow);
      // 팔로우 생성 성공 로그 제거 - 너무 빈번함

      // 검증 로그 제거 - 개발 환경에서만 필요
      if (process.env.NODE_ENV === 'development' && process.env.DEBUG_FOLLOW === 'true') {
        const verifyFollow = await manager.findOne(Follow, {
          where: { id: savedFollow.id }
        });
        console.log(`[FollowService] Follow verification:`, verifyFollow ? 'Success' : 'Failed');
      }

      // Create notification within the same transaction
      try {
        await this.notificationsService.createWithTransaction(
          manager,
          {
            recipientId: followingId,
            issuerId: followerId,
            type: NotificationType.FOLLOW,
          },
        );
        // 알림 생성 성공 로그 제거 - 너무 빈번함
      } catch (error) {
        // 알림 생성 실패는 중요한 문제이므로 로그 유지
        console.error('[FollowService] Error creating notification:', error);
        // Don't throw - notification is not critical for follow operation
      }
    });

    // 팔로우 완료 로그 제거 - 너무 빈번함
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    // 언팔로우 시도 로그 제거 - 너무 빈번함

    await this.dataSource.transaction(async (manager: EntityManager) => {
      const follow = await manager.findOne(Follow, {
        where: {
          followerId,
          followingId,
        },
        lock: { mode: 'pessimistic_write' },
      });

      // 팔로우 관계 검색 결과 로그 제거 - 너무 빈번함

      if (!follow) {
        // 팔로우 관계 미발견은 일반적인 상황이므로 로그 제거
        throw new NotFoundException('Follow relationship not found');
      }

      await manager.remove(follow);
      // 팔로우 제거 성공 로그 제거 - 너무 빈번함
    });

    // 언팔로우 완료 로그 제거 - 너무 빈번함
  }

  async getFollowers(userId: string, page = 1, limit = 20): Promise<PaginatedResponseDto<User>> {
    const [followers, total] = await this.followRepository.findAndCount({
      where: { followingId: userId },
      relations: ['follower'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: followers.map(f => f.follower),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFollowing(userId: string, page = 1, limit = 20): Promise<PaginatedResponseDto<User>> {
    const [following, total] = await this.followRepository.findAndCount({
      where: { followerId: userId },
      relations: ['following'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: following.map(f => f.following),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFollowInfo(userId: string, currentUserId?: string): Promise<FollowInfoDto> {
    // 팔로우 정보 조회 로그 제거 - 매 요청마다 출력되어 너무 많음

    // 디버깅용 raw query 제거 - 개발 환경에서만 필요
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_FOLLOW === 'true') {
      if (currentUserId && currentUserId !== userId) {
        const rawResult = await this.followRepository.query(
          `SELECT * FROM follows WHERE follower_id = $1 AND following_id = $2`,
          [currentUserId, userId]
        );
        console.log(`[FollowService] Debug - Raw query result:`, rawResult);
      }
    }
    
    const [followersCount, followingCount] = await Promise.all([
      this.followRepository.count({ where: { followingId: userId } }),
      this.followRepository.count({ where: { followerId: userId } }),
    ]);

    // 팔로우 카운트 로그 제거 - 너무 빈번함

    let isFollowedByUser = false;
    if (currentUserId && currentUserId !== userId) {
      // Use more explicit query
      const queryBuilder = this.followRepository
        .createQueryBuilder('follow')
        .where('follow.followerId = :followerId', { followerId: currentUserId })
        .andWhere('follow.followingId = :followingId', { followingId: userId });

      // SQL 로그 제거 - 개발 환경에서만 필요
      if (process.env.NODE_ENV === 'development' && process.env.DEBUG_FOLLOW === 'true') {
        const sql = queryBuilder.getSql();
        console.log(`[FollowService] Debug - Query SQL:`, sql);
      }

      const follow = await queryBuilder.getOne();

      isFollowedByUser = !!follow;
      // 팔로우 상태 확인 로그 제거 - 너무 빈번함
    }

    const result = {
      followersCount,
      followingCount,
      isFollowedByUser,
    };

    // 결과 반환 로그 제거 - 너무 빈번함
    return result;
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    // 팔로우 확인 로그 제거 - 매 요청마다 출력되어 너무 많음

    const follow = await this.followRepository.findOne({
      where: {
        followerId,
        followingId,
      },
    });

    const result = !!follow;
    // 결과 로그 제거 - 너무 빈번함
    return result;
  }
}