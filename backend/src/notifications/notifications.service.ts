import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager } from "typeorm";
import { Notification, NotificationType } from "./entities/notification.entity";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";

export interface CreateNotificationDto {
  recipientId: string;
  issuerId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  blogId?: string;
  message?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly unreadHashKey = "notifications:unread";

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async create(data: CreateNotificationDto): Promise<Notification> {
    // Don't create notification if issuer and recipient are the same
    if (data.recipientId === data.issuerId) {
      return null;
    }

    const notification = this.notificationRepository.create(data);
    const saved = await this.notificationRepository.save(notification);
    await this.incrementUnreadCount(data.recipientId);
    return saved;
  }

  async createWithTransaction(
    manager: EntityManager,
    data: CreateNotificationDto,
  ): Promise<Notification> {
    // Don't create notification if issuer and recipient are the same
    if (data.recipientId === data.issuerId) {
      return null;
    }

    const notification = manager.create(Notification, data);
    const saved = await manager.save(notification);
    await this.incrementUnreadCount(data.recipientId);
    return saved;
  }

  async getNotifications(userId: string, page = 1, limit = 20) {
    const [notifications, total] =
      await this.notificationRepository.findAndCount({
        where: { recipientId: userId },
        relations: ["issuer", "issuer.blog", "post", "comment"],
        order: { createdAt: "DESC" },
        skip: (page - 1) * limit,
        take: limit,
      });

    return {
      data: notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const cached = await this.redis.hget(this.unreadHashKey, userId);
    if (cached !== null) {
      const value = Number(cached);
      if (!Number.isNaN(value)) {
        return value;
      }
    }

    return this.refreshUnreadCount(userId);
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, recipientId: userId },
      select: ["id", "read"],
    });

    if (!notification || notification.read) {
      return;
    }

    await this.notificationRepository.update(
      {
        id: notificationId,
        recipientId: userId,
      },
      {
        read: true,
      },
    );
    await this.incrementUnreadCount(userId, -1);
  }

  async markAllAsRead(userId: string): Promise<void> {
    const unreadCount = await this.notificationRepository.count({
      where: {
        recipientId: userId,
        read: false,
      },
    });

    if (!unreadCount) {
      return;
    }

    await this.notificationRepository.update(
      {
        recipientId: userId,
        read: false,
      },
      {
        read: true,
      },
    );
    await this.setUnreadCount(userId, 0);
  }

  async delete(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, recipientId: userId },
      select: ["id", "read"],
    });

    if (!notification) {
      return;
    }

    await this.notificationRepository.delete({
      id: notificationId,
      recipientId: userId,
    });

    if (!notification.read) {
      await this.incrementUnreadCount(userId, -1);
    }
  }

  async deleteAll(userId: string): Promise<void> {
    await this.notificationRepository.delete({
      recipientId: userId,
    });
    await this.redis.hdel(this.unreadHashKey, userId);
  }

  async createPostLikeNotification(
    postId: string,
    postAuthorId: string,
    likerId: string,
  ): Promise<Notification> {
    return this.create({
      recipientId: postAuthorId,
      issuerId: likerId,
      type: NotificationType.POST_LIKE,
      postId,
    });
  }

  async createCommentNotification(
    commentId: string,
    postId: string,
    postAuthorId: string,
    commenterId: string,
  ): Promise<Notification> {
    return this.create({
      recipientId: postAuthorId,
      issuerId: commenterId,
      type: NotificationType.COMMENT,
      postId,
      commentId,
    });
  }

  async createFollowNotification(
    followedUserId: string,
    followerId: string,
  ): Promise<Notification> {
    return this.create({
      recipientId: followedUserId,
      issuerId: followerId,
      type: NotificationType.FOLLOW,
    });
  }

  private async refreshUnreadCount(userId: string): Promise<number> {
    const count = await this.notificationRepository.count({
      where: {
        recipientId: userId,
        read: false,
      },
    });
    await this.redis.hset(this.unreadHashKey, userId, count);
    return count;
  }

  private async incrementUnreadCount(userId: string, delta = 1): Promise<void> {
    if (!userId || delta === 0) {
      return;
    }
    try {
      const result = await this.redis.hincrby(
        this.unreadHashKey,
        userId,
        delta,
      );
      if (result <= 0) {
        await this.redis.hdel(this.unreadHashKey, userId);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to update unread notification count (userId=${userId})`,
        error as Error,
      );
    }
  }

  private async setUnreadCount(userId: string, value: number): Promise<void> {
    if (value <= 0) {
      await this.redis.hdel(this.unreadHashKey, userId);
      return;
    }
    await this.redis.hset(this.unreadHashKey, userId, value);
  }
}
