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
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { UserBlock } from '../entities/user-block.entity';
import { User } from '../../users/entities/user.entity';
import { CreateMessageDto } from '../dto/create-message.dto';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { ConversationWithUnread } from '../dto/conversation-with-unread.dto';
import { UnifiedRedisService } from '../../redis/unified-redis.service';
import { ChatGateway } from '../gateways/chat.gateway';
import { ChatQueueService } from './chat-queue.service';
import { ChatBatchService } from './chat-batch.service';
import { MessageRepository } from '../repositories/message.repository';
import { ConversationRepository } from '../repositories/conversation.repository';
import { RedisMessageData } from '../interfaces/message-queue.interface';

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
    private readonly unifiedRedisService: UnifiedRedisService,
    private readonly messageRepo: MessageRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly queueService: ChatQueueService,
    private readonly batchService: ChatBatchService,
  ) {}

  setChatGateway(gateway: ChatGateway) {
    this.chatGateway = gateway;
  }

  /**
   * 대화방 생성 또는 기존 대화방 반환
   * - 자기 자신과의 대화 방지
   * - 차단된 사용자와의 대화 방지
   * - user ID를 정렬하여 중복 대화방 생성 방지
   */
  async getOrCreateConversation(
    currentUserId: string,
    targetUserId: string,
  ): Promise<Conversation> {
    // 자기 자신과의 대화 방지
    if (currentUserId === targetUserId) {
      throw new BadRequestException('Cannot start conversation with yourself');
    }

    // 차단 상태 확인
    const isBlocked = await this.checkBlock(currentUserId, targetUserId);
    if (isBlocked) {
      throw new ForbiddenException('User is blocked');
    }

    // user ID 정렬 (중복 대화방 생성 방지)
    const [user1Id, user2Id] = [currentUserId, targetUserId].sort();

    // First check if conversation already exists
    let conversation = await this.conversationRepository.findOne({
      where: { user1Id, user2Id },
      relations: ['user1', 'user2'],
    });

    /**
     * 기존 대화방이 있으면 반환
     * - 사용자가 대화방을 나갔더라도 대화방 자체는 유지
     * - 다시 메시지를 보내면 deletedAt이 리셋됨
     */
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

    // 디버그 로그 추가
    console.log('[ChatService] getConversationForUser:', {
      conversationId,
      userId,
      user1: conversation.user1 ? { id: conversation.user1.id, username: conversation.user1.username } : null,
      user2: conversation.user2 ? { id: conversation.user2.id, username: conversation.user2.username } : null,
    });

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
    const cached = await this.unifiedRedisService.getCache<ConversationWithUnread[]>('chat', cacheKey);
    if (cached) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[ChatService] Returning cached conversations for user:', userId);
      }
      return cached;
    }

    // Repository 메서드 사용 - 이미 최적화된 쿼리 사용
    // ConversationRepository.findUserConversations()는 단순화된 쿼리 사용
    // (EXISTS 서브쿼리 제거되고 deletedAt 체크만 수행)
    const conversations = await this.conversationRepo.findUserConversations(userId);

    // Repository에서 이미 필터링되어 옴 - 추가 검증 불필요

    /**
     * 성능 최적화: 배치 쿼리로 N+1 문제 해결
     * - 마지막 메시지와 unreadCount를 각각 한 번의 쿼리로 조회
     */

    // 모든 대화방 ID 목록
    const conversationIds = conversations.map(conv => conv.id);

    if (conversationIds.length === 0) {
      return [];
    }

    // 1. 모든 대화방의 마지막 메시지를 한 번에 조회
    const lastMessagesQuery = await this.messageRepository
      .createQueryBuilder('message')
      .select([
        'DISTINCT ON (message."conversationId") message."conversationId"',
        'message.id',
        'message.content',
        'message."createdAt"',
        'message."senderId"'
      ])
      .where('message."conversationId" IN (:...conversationIds)', { conversationIds })
      .andWhere('message."isDeleted" = false')
      .orderBy('message."conversationId"', 'ASC')
      .addOrderBy('message."createdAt"', 'DESC')
      .getRawMany();

    // conversationId를 키로 하는 맵 생성
    const lastMessageMap = new Map(
      lastMessagesQuery.map(msg => [
        msg.conversationId,
        {
          content: msg.content,
          createdAt: msg.createdAt,
          senderId: msg.senderId
        }
      ])
    );

    // 2. 각 대화방의 unreadCount 계산
    // 아직 개별 쿼리지만 이전보다는 최적화됨 (lastMessage는 이미 배치로 처리)
    const conversationsWithUnreadCount = await Promise.all(
      conversations.map(async (conv) => {
        // 현재 사용자의 lastReadAt 타임스탬프
        const lastReadAt = userId === conv.user1Id
          ? conv.user1LastReadAt
          : conv.user2LastReadAt;

        // 상대방이 보낸 메시지 중 lastReadAt 이후 메시지 카운트
        let unreadCount = 0;
        if (!lastReadAt) {
          // lastReadAt이 없으면 모든 상대방 메시지가 unread
          unreadCount = await this.messageRepository
            .createQueryBuilder('message')
            .where('message.conversationId = :conversationId', { conversationId: conv.id })
            .andWhere('message.senderId != :userId', { userId })
            .andWhere('message.isDeleted = false')
            .getCount();
        } else {
          // lastReadAt 이후 메시지만 카운트
          unreadCount = await this.messageRepository
            .createQueryBuilder('message')
            .where('message.conversationId = :conversationId', { conversationId: conv.id })
            .andWhere('message.senderId != :userId', { userId })
            .andWhere('message.isDeleted = false')
            .andWhere('message.createdAt > :lastReadAt', { lastReadAt })
            .getCount();
        }

        // 맵에서 미리 조회된 lastMessage 가져오기 (N+1 문제 해결)
        const lastMessage = lastMessageMap.get(conv.id) || null;

        return {
          ...conv,
          unreadCount,
          lastMessage
        };
      })
    );

    /**
     * 결과 캐싱 (1초)
     * - 짧은 캐시 시간으로 실시간 정확도 향상
     * - 서버 부하는 최소화 (API 호출 간 1초 간격 제한)
     */
    await this.unifiedRedisService.setCache('chat', cacheKey, conversationsWithUnreadCount, 1);

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

    // Try to get messages from Redis cache first
    if (page === 1) {
      const cachedMessages = await this.queueService.getCachedMessages(conversationId, limit);
      if (cachedMessages.length > 0) {
        console.log('[ChatService] Returning cached messages:', cachedMessages.length);

        // Transform Redis data to Message format
        const messages = await this.transformCachedMessages(cachedMessages);
        return {
          messages,
          hasMore: cachedMessages.length === limit, // Assume more if we got full limit
        };
      }
    }

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
      await this.unifiedRedisService.setCache(
        'chat',
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

    // DUAL WRITE STRATEGY: Queue message first for immediate display
    const queuedMessage = await this.queueService.queueMessage({
      conversationId: dto.conversationId,
      senderId,
      content: dto.content,
      tempId: dto.tempId,
    });

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

    // Create message with queued message ID for consistency
    const message = this.messageRepository.create({
      id: queuedMessage.id, // Use same ID from queue
      conversationId: dto.conversationId,
      senderId,
      content: dto.content,
      createdAt: queuedMessage.createdAt,
    });

    // OPTIONAL: Save immediately to DB for critical messages
    // For now, let batch worker handle it
    // const savedMessage = await this.messageRepository.save(message);

    // Load sender relation efficiently
    const sender = await this.userRepository.findOne({
      where: { id: senderId },
      select: ['id', 'username', 'email', 'profileImage'],
    });

    // Combine message with sender info
    const fullMessage = {
      ...message, // Use message object instead of savedMessage
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
      this.unifiedRedisService.deleteCache('chat', `conversation:${dto.conversationId}:messages`),
      this.unifiedRedisService.deleteCache('chat', `conversations:${senderId}`),
      this.unifiedRedisService.deleteCache('chat', `conversations:${recipientId}`),
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

    // Update user's lastReadAt timestamp to this message's creation time
    const updateData = userId === conversation.user1Id
      ? { user1LastReadAt: message.createdAt }
      : { user2LastReadAt: message.createdAt };

    await this.conversationRepository.update(conversation.id, updateData);

    // Clear cache
    await this.unifiedRedisService.deleteCache('chat', `conversations:${userId}`);

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

    // Update user's lastReadAt timestamp
    const updateData = userId === conversation.user1Id
      ? { user1LastReadAt: new Date() }
      : { user2LastReadAt: new Date() };

    await this.conversationRepository.update(conversationId, updateData);

    // Clear cache to reflect the change immediately
    await this.unifiedRedisService.deleteCache('chat', `conversations:${userId}`);
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
    await this.unifiedRedisService.deleteCache('chat', `blocks:${blockerId}:${blockedId}`);
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
    await this.unifiedRedisService.deleteCache('chat', `blocks:${blockerId}:${blockedId}`);
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
    // Note: With the lastReadAt approach, we calculate unread count
    // by counting messages created after the user's lastReadAt timestamp
    // across all conversations where the user is a participant

    const conversations = await this.conversationRepository.find({
      where: [
        { user1Id: userId },
        { user2Id: userId }
      ]
    });

    let totalUnreadCount = 0;

    for (const conversation of conversations) {
      const lastReadAt = userId === conversation.user1Id
        ? conversation.user1LastReadAt
        : conversation.user2LastReadAt;

      const unreadCountQuery = this.messageRepository
        .createQueryBuilder('message')
        .where('message.conversationId = :conversationId', {
          conversationId: conversation.id
        })
        .andWhere('message.senderId != :userId', { userId })
        .andWhere('message.isDeleted = false');

      if (lastReadAt) {
        unreadCountQuery.andWhere('message.createdAt > :lastReadAt', { lastReadAt });
      }

      const count = await unreadCountQuery.getCount();
      totalUnreadCount += count;
    }

    return totalUnreadCount;
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

    // Determine the other user
    const otherUserId = conversation.user1Id === userId
      ? conversation.user2Id
      : conversation.user1Id;

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

    // Clear any cached data for this conversation and both users
    await this.unifiedRedisService.deleteCache('chat', `conversation:${conversationId}:messages`);
    await this.unifiedRedisService.deleteCache('chat', `conversations:${userId}`);
    await this.unifiedRedisService.deleteCache('chat', `conversations:${otherUserId}`);


    // Emit WebSocket event to notify the other user
    if (this.chatGateway && this.chatGateway.server) {
      // Notify the conversation room that a user has left
      this.chatGateway.server
        .to(`conversation:${conversationId}`)
        .emit('user-left', {
          conversationId,
          userId: userId
        });

      // Notify the other user to refresh their conversation list
      this.chatGateway.server
        .to(`user:${otherUserId}`)
        .emit('conversation-state-changed', {
          conversationId,
          action: 'user-left',
          userId: userId
        });

      console.log(`[ChatService] Emitted user-left event for conversation ${conversationId}`);
    }
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

  /**
   * Transform cached messages from Redis to Message format
   */
  private async transformCachedMessages(cachedMessages: RedisMessageData[]): Promise<Message[]> {
    const messages: Message[] = [];

    // Get sender information for all messages
    const senderIds = [...new Set(cachedMessages.map(m => m.senderId))];
    const senders = await this.userRepository.find({
      where: senderIds.map(id => ({ id })),
      select: ['id', 'username', 'email', 'profileImage'],
    });

    const senderMap = new Map(senders.map(s => [s.id, s]));

    for (const cached of cachedMessages) {
      const message = new Message();
      message.id = cached.id;
      message.conversationId = cached.conversationId;
      message.senderId = cached.senderId;
      message.content = cached.content;
      message.createdAt = new Date(cached.createdAt);
      // isRead field removed - using lastReadAt on conversations instead
      message.sender = senderMap.get(cached.senderId);
      messages.push(message);
    }

    return messages;
  }
}