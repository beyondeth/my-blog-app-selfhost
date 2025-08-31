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
    console.log(`[FollowService] Attempting to follow - followerId: ${followerId}, followingId: ${followingId}`);
    
    // Check if user is trying to follow themselves
    if (followerId === followingId) {
      console.log('[FollowService] Error: User trying to follow themselves');
      throw new BadRequestException('You cannot follow yourself');
    }

    // Use transaction for atomic operation
    await this.dataSource.transaction(async (manager: EntityManager) => {
      // Check if both users exist using exist() for better performance
      const [followerExists, followingExists] = await Promise.all([
        manager.exists(User, { where: { id: followerId } }),
        manager.exists(User, { where: { id: followingId } }),
      ]);

      console.log(`[FollowService] User existence check - follower: ${followerExists}, following: ${followingExists}`);

      if (!followerExists || !followingExists) {
        console.log('[FollowService] Error: User not found');
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

      console.log(`[FollowService] Existing follow check: ${existingFollow ? 'Found' : 'Not found'}`);

      if (existingFollow) {
        console.log('[FollowService] Error: Already following this user');
        throw new BadRequestException('You are already following this user');
      }

      // Create follow relationship
      const follow = manager.create(Follow, {
        followerId,
        followingId,
      });

      const savedFollow = await manager.save(Follow, follow);
      console.log(`[FollowService] Follow created successfully with id: ${savedFollow.id}`);
      
      // Verify the follow was actually saved
      const verifyFollow = await manager.findOne(Follow, {
        where: { id: savedFollow.id }
      });
      console.log(`[FollowService] Verification - Follow exists in DB:`, verifyFollow ? 'Yes' : 'No');
      if (verifyFollow) {
        console.log(`[FollowService] Saved follow details:`, {
          id: verifyFollow.id,
          followerId: verifyFollow.followerId,
          followingId: verifyFollow.followingId,
          createdAt: verifyFollow.createdAt
        });
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
        console.log('[FollowService] Notification created successfully');
      } catch (error) {
        console.error('[FollowService] Error creating notification:', error);
        // Don't throw - notification is not critical for follow operation
      }
    });

    console.log('[FollowService] Follow operation completed successfully');
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    console.log(`[FollowService] Attempting to unfollow - followerId: ${followerId}, followingId: ${followingId}`);
    
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const follow = await manager.findOne(Follow, {
        where: {
          followerId,
          followingId,
        },
        lock: { mode: 'pessimistic_write' },
      });

      console.log(`[FollowService] Follow relationship search result: ${follow ? `Found (id: ${follow.id})` : 'Not found'}`);

      if (!follow) {
        console.log('[FollowService] Error: Follow relationship not found');
        throw new NotFoundException('Follow relationship not found');
      }

      await manager.remove(follow);
      console.log('[FollowService] Follow relationship removed successfully');
    });

    console.log('[FollowService] Unfollow operation completed successfully');
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
    console.log(`[FollowService] Getting follow info - userId: ${userId}, currentUserId: ${currentUserId || 'none'}`);
    
    // Add raw query for debugging
    if (currentUserId && currentUserId !== userId) {
      const rawResult = await this.followRepository.query(
        `SELECT * FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [currentUserId, userId]
      );
      console.log(`[FollowService] Raw query result:`, rawResult);
    }
    
    const [followersCount, followingCount] = await Promise.all([
      this.followRepository.count({ where: { followingId: userId } }),
      this.followRepository.count({ where: { followerId: userId } }),
    ]);

    console.log(`[FollowService] Counts - followers: ${followersCount}, following: ${followingCount}`);

    let isFollowedByUser = false;
    if (currentUserId && currentUserId !== userId) {
      // Use more explicit query with logging
      const queryBuilder = this.followRepository
        .createQueryBuilder('follow')
        .where('follow.followerId = :followerId', { followerId: currentUserId })
        .andWhere('follow.followingId = :followingId', { followingId: userId });
      
      const sql = queryBuilder.getSql();
      console.log(`[FollowService] Query SQL:`, sql);
      console.log(`[FollowService] Query params:`, { followerId: currentUserId, followingId: userId });
      
      const follow = await queryBuilder.getOne();
      
      isFollowedByUser = !!follow;
      console.log(`[FollowService] Is ${currentUserId} following ${userId}? ${isFollowedByUser}`);
      console.log(`[FollowService] Follow record:`, follow ? { 
        id: follow.id, 
        followerId: follow.followerId, 
        followingId: follow.followingId,
        createdAt: follow.createdAt 
      } : 'not found');
    } else {
      console.log(`[FollowService] Not checking follow status - currentUserId: ${currentUserId}, userId: ${userId}`);
      if (currentUserId === userId) {
        console.log(`[FollowService] Reason: User cannot follow themselves`);
      }
    }

    const result = {
      followersCount,
      followingCount,
      isFollowedByUser,
    };
    
    console.log('[FollowService] Returning follow info:', JSON.stringify(result));
    return result;
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    console.log(`[FollowService] Checking if ${followerId} is following ${followingId}`);
    
    const follow = await this.followRepository.findOne({
      where: {
        followerId,
        followingId,
      },
    });
    
    const result = !!follow;
    console.log(`[FollowService] Result: ${result} (follow record: ${follow ? `exists (id: ${follow.id})` : 'not found'})`);
    return result;
  }
}