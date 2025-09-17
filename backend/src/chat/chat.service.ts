import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { UserBlock } from './entities/user-block.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(UserBlock)
    private userBlockRepository: Repository<UserBlock>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getOrCreateConversation(
    currentUserId: string,
    targetUserId: string,
  ): Promise<Conversation> {
    console.log('[ChatService] getOrCreateConversation called:', { currentUserId, targetUserId });

    if (currentUserId === targetUserId) {
      console.log('[ChatService] Error: Trying to start conversation with self');
      throw new BadRequestException('Cannot start conversation with yourself');
    }

    // Check if blocked
    const isBlocked = await this.checkBlock(currentUserId, targetUserId);
    console.log('[ChatService] Block check result:', isBlocked);
    if (isBlocked) {
      console.log('[ChatService] Error: User is blocked');
      throw new ForbiddenException('User is blocked');
    }

    // Order user IDs to ensure consistency
    const [user1Id, user2Id] = [currentUserId, targetUserId].sort();

    // Use upsert to avoid race condition
    await this.conversationRepository
      .createQueryBuilder()
      .insert()
      .into(Conversation)
      .values({ user1Id, user2Id })
      .orIgnore() // PostgreSQL: ON CONFLICT DO NOTHING
      .execute();

    // Now safely fetch the conversation with relations
    const conversation = await this.conversationRepository.findOne({
      where: { user1Id, user2Id },
      relations: ['user1', 'user2'],
    });

    if (!conversation) {
      throw new Error('Failed to create or find conversation');
    }

    return conversation;
  }

  async getConversationById(conversationId: string): Promise<Conversation | null> {
    return this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['user1', 'user2'],
    });
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    const conversations = await this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.user1', 'user1')
      .leftJoinAndSelect('conversation.user2', 'user2')
      .where('conversation.user1Id = :userId', { userId })
      .orWhere('conversation.user2Id = :userId', { userId })
      .andWhere('conversation.user1DeletedAt IS NULL OR conversation.user2DeletedAt IS NULL')
      .orderBy('conversation.lastMessageAt', 'DESC', 'NULLS LAST')
      .getMany();

    return conversations;
  }

  async getMessages(
    conversationId: string,
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    // Verify user is part of conversation
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Convert to string for comparison to handle potential type mismatches
    const user1IdStr = String(conversation.user1Id);
    const user2IdStr = String(conversation.user2Id);
    const userIdStr = String(userId);

    if (user1IdStr !== userIdStr && user2IdStr !== userIdStr) {
      console.error('Authorization failed:', {
        conversationId,
        user1Id: conversation.user1Id,
        user2Id: conversation.user2Id,
        userId,
        user1IdStr,
        user2IdStr,
        userIdStr,
      });
      throw new ForbiddenException('Not authorized to view this conversation');
    }

    // Get messages with pagination
    const [messages, total] = await this.messageRepository.findAndCount({
      where: { conversationId, isDeleted: false },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Cache recent messages (first page only)
    if (page === 1) {
      await this.cacheManager.set(
        `conversation:${conversationId}:messages`,
        messages,
        300, // 5 minutes
      );
    }

    return {
      messages: messages.reverse(), // Return in chronological order
      hasMore: total > page * limit,
    };
  }

  async sendMessage(
    senderId: string,
    dto: CreateMessageDto,
  ): Promise<Message> {
    // Verify conversation exists and user is part of it
    const conversation = await this.conversationRepository.findOne({
      where: { id: dto.conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.user1Id !== senderId && conversation.user2Id !== senderId) {
      throw new ForbiddenException('Not authorized to send message in this conversation');
    }

    // Check if blocked
    const recipientId = conversation.user1Id === senderId
      ? conversation.user2Id
      : conversation.user1Id;

    const isBlocked = await this.checkBlock(senderId, recipientId);
    if (isBlocked) {
      throw new ForbiddenException('Cannot send message to blocked user');
    }

    // Create and save message
    const message = await this.messageRepository.save({
      conversationId: dto.conversationId,
      senderId,
      content: dto.content,
    });

    // Update conversation's last message time
    await this.conversationRepository.update(
      dto.conversationId,
      { lastMessageAt: new Date() }
    );

    // Get message with sender info
    const fullMessage = await this.messageRepository.findOne({
      where: { id: message.id },
      relations: ['sender'],
    });

    // Clear cache
    await this.cacheManager.del(`conversation:${dto.conversationId}:messages`);

    return fullMessage;
  }

  async markAsRead(
    messageId: string,
    userId: string,
  ): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['conversation'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only recipient can mark as read
    if (message.senderId === userId) {
      return; // Sender's own message
    }

    // Verify user is part of conversation
    const conversation = message.conversation;
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    // Update read status
    await this.messageRepository.update(messageId, {
      isRead: true,
      readAt: new Date(),
    });
  }

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }

    // Check if already blocked
    const existing = await this.userBlockRepository.findOne({
      where: { blockerId, blockedId },
    });

    if (existing) {
      throw new BadRequestException('User is already blocked');
    }

    // Create block
    await this.userBlockRepository.save({
      blockerId,
      blockedId,
    });

    // Clear cache
    await this.cacheManager.del(`blocks:${blockerId}:${blockedId}`);
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const block = await this.userBlockRepository.findOne({
      where: { blockerId, blockedId },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    await this.userBlockRepository.remove(block);

    // Clear cache
    await this.cacheManager.del(`blocks:${blockerId}:${blockedId}`);
  }

  async getBlockedUsers(userId: string): Promise<UserBlock[]> {
    return this.userBlockRepository.find({
      where: { blockerId: userId },
      relations: ['blockedUser'],
    });
  }

  async checkBlock(user1Id: string, user2Id: string): Promise<boolean> {
    console.log('[ChatService] checkBlock called:', { user1Id, user2Id });

    // Check cache first - 양방향 캐시 키 모두 확인
    const cacheKey1 = `blocks:${user1Id}:${user2Id}`;
    const cacheKey2 = `blocks:${user2Id}:${user1Id}`;

    // 먼저 캐시 삭제 (디버깅을 위해)
    await this.cacheManager.del(cacheKey1);
    await this.cacheManager.del(cacheKey2);

    console.log('[ChatService] Cache cleared for debugging');

    // Check if either user has blocked the other
    const block = await this.userBlockRepository.findOne({
      where: [
        { blockerId: user1Id, blockedId: user2Id },
        { blockerId: user2Id, blockedId: user1Id },
      ],
    });

    console.log('[ChatService] Database block check:', block);
    const result = !!block;

    // 캐시 사용 안함 (문제 해결 후 다시 활성화)
    // await this.cacheManager.set(cacheKey1, result, 600); // 10 minutes
    // await this.cacheManager.set(cacheKey2, result, 600); // 10 minutes
    console.log('[ChatService] Block status (no cache):', result);

    return result;
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('Can only delete your own messages');
    }

    // Soft delete
    await this.messageRepository.update(messageId, {
      isDeleted: true,
      deletedAt: new Date(),
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    const count = await this.messageRepository
      .createQueryBuilder('message')
      .innerJoin('message.conversation', 'conversation')
      .where('message.isRead = :isRead', { isRead: false })
      .andWhere('message.senderId != :userId', { userId })
      .andWhere(
        '(conversation.user1Id = :userId OR conversation.user2Id = :userId)',
        { userId }
      )
      .getCount();

    return count;
  }

  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check if user is part of the conversation
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('Not authorized to delete this conversation');
    }

    // Soft delete for the user (mark as deleted)
    if (conversation.user1Id === userId) {
      await this.conversationRepository.update(conversationId, {
        user1DeletedAt: new Date(),
      });
    } else {
      await this.conversationRepository.update(conversationId, {
        user2DeletedAt: new Date(),
      });
    }
  }
}