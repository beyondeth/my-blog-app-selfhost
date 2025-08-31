import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';

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
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  async create(data: CreateNotificationDto): Promise<Notification> {
    // Don't create notification if issuer and recipient are the same
    if (data.recipientId === data.issuerId) {
      return null;
    }

    const notification = this.notificationRepository.create(data);
    return this.notificationRepository.save(notification);
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
    return manager.save(notification);
  }

  async getNotifications(userId: string, page = 1, limit = 20) {
    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: { recipientId: userId },
      relations: ['issuer', 'issuer.blog', 'post', 'comment'],
      order: { createdAt: 'DESC' },
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
    return this.notificationRepository.count({
      where: {
        recipientId: userId,
        read: false,
      },
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepository.update(
      {
        id: notificationId,
        recipientId: userId,
      },
      {
        read: true,
      },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      {
        recipientId: userId,
        read: false,
      },
      {
        read: true,
      },
    );
  }

  async delete(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepository.delete({
      id: notificationId,
      recipientId: userId,
    });
  }

  async deleteAll(userId: string): Promise<void> {
    await this.notificationRepository.delete({
      recipientId: userId,
    });
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
}