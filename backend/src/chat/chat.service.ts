import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  forwardRef,
  MessageEvent,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Observable, Subject, filter, map } from 'rxjs';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { UserBlock } from './entities/user-block.entity';
import { User } from '../users/entities/user.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationWithUnread } from './dto/conversation-with-unread.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  private chatGateway: ChatGateway;
  private notificationSubject = new Subject<{ userId: string; data: any }>();

  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(UserBlock)
    private userBlockRepository: Repository<UserBlock>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  setChatGateway(gateway: ChatGateway) {
    this.chatGateway = gateway;
  }

  async getOrCreateConversation(
    currentUserId: string,
    targetUserId: string,
  ): Promise<Conversation> {
    console.log('[ChatService] getOrCreateConversation called:', {
      currentUserId,
      currentUserIdType: typeof currentUserId,
      targetUserId,
      targetUserIdType: typeof targetUserId
    });

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

    // Order user IDs to ensure consistency (always sort to have same order)
    const [user1Id, user2Id] = [currentUserId, targetUserId].sort();

    console.log('[ChatService] Ordered user IDs for conversation:', {
      user1Id,
      user2Id,
      originalCurrentUserId: currentUserId,
      originalTargetUserId: targetUserId
    });

    // First check if conversation already exists
    let conversation = await this.conversationRepository.findOne({
      where: { user1Id, user2Id },
      relations: ['user1', 'user2'],
    });

    // Return existing conversation even if user had left
    // The deletedAt will be reset when they send their first message
    if (conversation) {
      const currentUserLeft =
        (conversation.user1Id === currentUserId && conversation.user1DeletedAt) ||
        (conversation.user2Id === currentUserId && conversation.user2DeletedAt);

      if (currentUserLeft) {
        console.log('[ChatService] User had left this conversation, but returning it (will reset on first message)');
      }

      console.log('[ChatService] Returning existing conversation:', {
        conversationId: conversation.id,
        user1Username: conversation.user1?.username,
        user2Username: conversation.user2?.username,
        currentUserLeft: currentUserLeft
      });
      return conversation;
    }

    // Use upsert to avoid race condition
    try {
      await this.conversationRepository
        .createQueryBuilder()
        .insert()
        .into(Conversation)
        .values({ user1Id, user2Id })
        .orIgnore() // PostgreSQL: ON CONFLICT DO NOTHING
        .execute();

      console.log('[ChatService] New conversation created between:', { user1Id, user2Id });
    } catch (error) {
      console.error('[ChatService] Error creating conversation:', error);
      // Continue to try fetching in case it was created by another request
    }

    // Now safely fetch the conversation with relations
    conversation = await this.conversationRepository.findOne({
      where: { user1Id, user2Id },
      relations: ['user1', 'user2'],
    });

    if (!conversation) {
      console.error('[ChatService] Failed to create or find conversation after insert attempt');
      throw new Error('Failed to create or find conversation');
    }

    console.log('[ChatService] Conversation ready:', {
      conversationId: conversation.id,
      user1Username: conversation.user1?.username,
      user2Username: conversation.user2?.username
    });

    return conversation;
  }

  async getConversationById(conversationId: string): Promise<Conversation | null> {
    return this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['user1', 'user2'],
    });
  }

  async getConversationForUser(conversationId: string, userId: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['user1', 'user2'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // 사용자가 참여한 대화인지 확인
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('Access denied to this conversation');
    }

    // deletedAt과 상관없이 대화방 정보 반환
    // (메시지는 getMessages에서 이미 deletedAt 기준으로 필터링됨)
    return conversation;
  }

  async getConversations(userId: string): Promise<ConversationWithUnread[]> {
    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('[ChatService] getConversations called for userId:', userId);
    }

    // Check cache first
    const cacheKey = `conversations:${userId}`;
    const cached = await this.cacheManager.get<ConversationWithUnread[]>(cacheKey);
    if (cached) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[ChatService] Returning cached conversations for user:', userId);
      }
      return cached;
    }

    // Get all conversations where the user is a participant
    // Include conversations the user has left if there are new messages after they left
    // Using EXISTS subquery for better performance instead of LEFT JOIN
    const conversations = await this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.user1', 'user1')
      .leftJoinAndSelect('conversation.user2', 'user2')
      .where(
        new Brackets((qb) => {
          // User hasn't left the conversation
          qb.where('conversation.user1Id = :userId AND conversation.user1DeletedAt IS NULL')
            .orWhere('conversation.user2Id = :userId AND conversation.user2DeletedAt IS NULL')
          // User left but there are new messages after they left (using EXISTS for better performance)
            .orWhere(
              new Brackets((qb2) => {
                qb2.where('conversation.user1Id = :userId AND conversation.user1DeletedAt IS NOT NULL')
                  .andWhere(
                    'EXISTS (SELECT 1 FROM messages m WHERE m."conversationId" = conversation.id AND m."createdAt" > conversation.user1DeletedAt)'
                  );
              })
            )
            .orWhere(
              new Brackets((qb2) => {
                qb2.where('conversation.user2Id = :userId AND conversation.user2DeletedAt IS NOT NULL')
                  .andWhere(
                    'EXISTS (SELECT 1 FROM messages m WHERE m."conversationId" = conversation.id AND m."createdAt" > conversation.user2DeletedAt)'
                  );
              })
            );
        })
      )
      .setParameters({ userId })
      .orderBy('conversation.lastMessageAt', 'DESC', 'NULLS LAST')
      .getMany();

    // Log each conversation to debug (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[ChatService] Found ${conversations.length} conversations for user ${userId}`);
    }

    // Filter out any conversations where user is not a participant (safety check)
    const validConversations = conversations.filter(conv =>
      conv.user1Id === userId || conv.user2Id === userId
    );

    if (validConversations.length !== conversations.length) {
      console.error(`[ChatService] SECURITY WARNING: Filtered out ${conversations.length - validConversations.length} invalid conversations!`);
    }

    // Get unread count for each conversation
    const conversationsWithUnreadCount = await Promise.all(
      validConversations.map(async (conv) => {
        // Only count messages FROM the OTHER user that current user hasn't read
        const unreadCount = await this.messageRepository
          .createQueryBuilder('message')
          .where('message.conversationId = :conversationId', { conversationId: conv.id })
          .andWhere('message.senderId != :userId', { userId })  // Messages NOT from current user
          .andWhere('message.isRead = false')
          .andWhere('message.isDeleted = false')
          .getCount();

        if (process.env.NODE_ENV === 'development' && unreadCount > 0) {
          console.log('[ChatService] Unread count for conversation:', {
            conversationId: conv.id,
            currentUserId: userId,
            unreadCount,
          });
        }

        // Get last message
        const lastMessage = await this.messageRepository.findOne({
          where: { conversationId: conv.id, isDeleted: false },
          order: { createdAt: 'DESC' },
          relations: ['sender'],
        });

        return {
          ...conv,
          unreadCount,
          lastMessage: lastMessage ? {
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            senderId: lastMessage.senderId,
          } : null,
        };
      })
    );

    // Cache the result for 10 seconds
    await this.cacheManager.set(cacheKey, conversationsWithUnreadCount, 10000);
    if (process.env.NODE_ENV === 'development') {
      console.log('[ChatService] Cached conversations for user:', userId);
    }

    return conversationsWithUnreadCount;
  }

  async getMessages(
    conversationId: string,
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    console.log('[ChatService] getMessages called:', {
      conversationId,
      userId,
      userIdType: typeof userId,
      page,
      limit
    });

    // Verify user is part of conversation
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['user1', 'user2'], // Load user relations for better debugging
    });

    if (!conversation) {
      console.error('[ChatService] Conversation not found for messages:', conversationId);
      throw new NotFoundException('Conversation not found');
    }

    // Convert to string for comparison to handle potential type mismatches
    const user1IdStr = String(conversation.user1Id).toLowerCase();
    const user2IdStr = String(conversation.user2Id).toLowerCase();
    const userIdStr = String(userId).toLowerCase();

    console.log('[ChatService] Message authorization check:', {
      conversationId,
      user1Id: conversation.user1Id,
      user1Username: conversation.user1?.username,
      user2Id: conversation.user2Id,
      user2Username: conversation.user2?.username,
      requestingUserId: userId,
      user1Match: user1IdStr === userIdStr,
      user2Match: user2IdStr === userIdStr
    });

    if (user1IdStr !== userIdStr && user2IdStr !== userIdStr) {
      console.error('[ChatService] Message authorization failed - FORBIDDEN:', {
        conversationId,
        user1IdStr,
        user2IdStr,
        userIdStr,
        user1Username: conversation.user1?.username,
        user2Username: conversation.user2?.username
      });
      throw new ForbiddenException('Not authorized to view this conversation');
    }

    // Check if the user had left the conversation and only show messages after that time
    let deletedAt: Date | null = null;
    if (conversation.user1Id === userId && conversation.user1DeletedAt) {
      deletedAt = conversation.user1DeletedAt;
    } else if (conversation.user2Id === userId && conversation.user2DeletedAt) {
      deletedAt = conversation.user2DeletedAt;
    }

    // Build query with deletedAt filter if applicable
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.conversationId = :conversationId', { conversationId })
      .andWhere('message.isDeleted = false');

    // Only show messages created after the user left (if they had left)
    if (deletedAt) {
      queryBuilder.andWhere('message.createdAt > :deletedAt', { deletedAt });
    }

    const total = await queryBuilder.getCount();
    const messages = await queryBuilder
      .orderBy('message.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

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
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[ChatService] sendMessage called:', {
        senderId,
        conversationId: dto.conversationId,
        contentLength: dto.content?.length
      });
    }

    // Verify conversation exists and user is part of it
    const conversation = await this.conversationRepository.findOne({
      where: { id: dto.conversationId },
      relations: ['user1', 'user2'], // Load user relations for better debugging
    });

    if (!conversation) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[ChatService] Conversation not found:', dto.conversationId);
      }
      throw new NotFoundException('Conversation not found');
    }

    // Check if the sender had left this conversation and reset if they're re-entering
    const senderHadLeft =
      (conversation.user1Id === senderId && conversation.user1DeletedAt) ||
      (conversation.user2Id === senderId && conversation.user2DeletedAt);

    if (senderHadLeft) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[ChatService] Sender is re-entering conversation, resetting deletedAt');
      }
      // Reset the deletedAt field for the sender to reactivate the conversation
      if (conversation.user1Id === senderId) {
        await this.conversationRepository.update(dto.conversationId, {
          user1DeletedAt: null,
        });
      } else if (conversation.user2Id === senderId) {
        await this.conversationRepository.update(dto.conversationId, {
          user2DeletedAt: null,
        });
      }
    }

    // Convert IDs to strings for comparison (handling potential UUID type mismatch)
    const user1IdStr = String(conversation.user1Id).toLowerCase();
    const user2IdStr = String(conversation.user2Id).toLowerCase();
    const senderIdStr = String(senderId).toLowerCase();

    if (user1IdStr !== senderIdStr && user2IdStr !== senderIdStr) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[ChatService] User not part of conversation - FORBIDDEN');
      }
      throw new ForbiddenException('Not authorized to send message in this conversation');
    }

    // Check if blocked
    const recipientId = user1IdStr === senderIdStr
      ? conversation.user2Id
      : conversation.user1Id;

    const isBlocked = await this.checkBlock(senderId, recipientId);
    if (isBlocked) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[ChatService] Message blocked - users have blocked each other');
      }
      throw new ForbiddenException('Cannot send message to blocked user');
    }

    // Create message with sender relation loaded
    const message = this.messageRepository.create({
      conversationId: dto.conversationId,
      senderId,
      content: dto.content,
    });

    // Save message and get sender info in one operation
    const savedMessage = await this.messageRepository.save(message);

    // Load sender relation efficiently
    const sender = await this.userRepository.findOne({
      where: { id: senderId },
      select: ['id', 'username', 'email', 'profileImage'],
    });

    // Combine message with sender info
    const fullMessage = {
      ...savedMessage,
      sender,
      tempId: dto.tempId || undefined,
    };

    // Update conversation's last message time
    await this.conversationRepository.update(
      dto.conversationId,
      { lastMessageAt: new Date() }
    );

    // If the recipient has left, reactivate the conversation for them
    // so they can see new messages
    // recipientId already declared above, just check if they've left
    const recipientHasLeft =
      (conversation.user1Id === recipientId && conversation.user1DeletedAt) ||
      (conversation.user2Id === recipientId && conversation.user2DeletedAt);

    if (recipientHasLeft && process.env.NODE_ENV === 'development') {
      console.log('[ChatService] Recipient had left this conversation, but new message will make it reappear for them');
      // Note: We do NOT reset their deletedAt here - they'll see the conversation
      // in the list due to the new message, but only see messages after they left
    }

    // Clear cache for both sender and recipient in parallel
    await Promise.all([
      this.cacheManager.del(`conversation:${dto.conversationId}:messages`),
      this.cacheManager.del(`conversations:${senderId}`),
      this.cacheManager.del(`conversations:${recipientId}`),
    ]);

    // Broadcast message via WebSocket to conversation room
    if (this.chatGateway && this.chatGateway.server) {
      this.chatGateway.server
        .to(`conversation:${dto.conversationId}`)
        .emit('new-message', fullMessage);

      // Also emit notification to recipient's user room (even if they've left,
      // so the conversation can reappear in their list)
      this.chatGateway.server
        .to(`user:${recipientId}`)
        .emit('message-notification', {
          conversationId: dto.conversationId,
          message: fullMessage,
        });

      // If recipient had left, also send event to refresh their conversation list
      if (recipientHasLeft) {
        this.chatGateway.server
          .to(`user:${recipientId}`)
          .emit('conversation-list-refresh');
        console.log('[ChatService] Sent conversation-list-refresh event to recipient who had left');
      }

      console.log('[ChatService] Message broadcasted via WebSocket:', {
        conversationId: dto.conversationId,
        messageId: fullMessage.id,
        recipientId,
        recipientHasLeft
      });
    }

    // Emit SSE notification for the recipient (for idle reconnection)
    // Send even if they've left so the conversation can reappear
    this.emitNotification(recipientId, {
      type: 'new-message',
      conversationId: dto.conversationId,
      message: fullMessage,
    });
    console.log('[ChatService] SSE notification emitted to recipient:', recipientId);

    return fullMessage;
  }

  async markAsRead(
    messageId: string,
    userId: string,
  ): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['conversation'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only recipient can mark as read
    if (message.senderId === userId) {
      return message; // Sender's own message
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

    // Return updated message
    message.isRead = true;
    message.readAt = new Date();
    return message;
  }

  async markAllMessagesAsRead(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    // Verify user is part of conversation
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    // Mark all messages from other user as read
    await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true, readAt: new Date() })
      .where('conversationId = :conversationId', { conversationId })
      .andWhere('senderId != :userId', { userId })
      .andWhere('isRead = false')
      .execute();
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

    try {
      // Check if either user has blocked the other
      const block = await this.userBlockRepository.findOne({
        where: [
          { blockerId: user1Id, blockedId: user2Id },
          { blockerId: user2Id, blockedId: user1Id },
        ],
      });

      console.log('[ChatService] Block check result:', {
        user1Id,
        user2Id,
        blockFound: !!block,
        blockDetails: block ? {
          blockerId: block.blockerId,
          blockedId: block.blockedId,
          createdAt: block.createdAt
        } : null
      });

      return !!block;
    } catch (error) {
      console.error('[ChatService] Error checking block:', error);
      // On error, allow the message (don't block due to system error)
      return false;
    }
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
      throw new ForbiddenException('Not authorized to leave this conversation');
    }

    // Soft delete for the user (mark as deleted)
    // This preserves the conversation data for audit purposes
    if (conversation.user1Id === userId) {
      await this.conversationRepository.update(conversationId, {
        user1DeletedAt: new Date(),
      });
      console.log(`[ChatService] User ${userId} left conversation ${conversationId} (as user1)`);
    } else {
      await this.conversationRepository.update(conversationId, {
        user2DeletedAt: new Date(),
      });
      console.log(`[ChatService] User ${userId} left conversation ${conversationId} (as user2)`);
    }

    // Clear any cached data for this conversation and user
    await this.cacheManager.del(`conversation:${conversationId}:messages`);
    await this.cacheManager.del(`conversations:${userId}`);
  }

  getUserNotificationStream(userId: string): Observable<MessageEvent> {
    // Return a filtered stream of notifications for this specific user
    return this.notificationSubject.asObservable().pipe(
      filter(notification => notification.userId === userId),
      map(notification => ({
        data: JSON.stringify(notification.data),
      } as MessageEvent))
    );
  }

  private emitNotification(userId: string, data: any) {
    // Emit notification to the SSE stream
    this.notificationSubject.next({ userId, data });
  }
}