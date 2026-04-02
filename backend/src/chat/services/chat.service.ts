import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  forwardRef,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Brackets } from "typeorm";
import { Conversation } from "../entities/conversation.entity";
import { Message } from "../entities/message.entity";
import { UserBlock } from "../entities/user-block.entity";
import { User } from "../../users/entities/user.entity";
import { CreateMessageDto } from "../dto/create-message.dto";
import { CreateConversationDto } from "../dto/create-conversation.dto";
import { ConversationWithUnread } from "../dto/conversation-with-unread.dto";
import { UnifiedRedisService } from "../../redis/unified-redis.service";
import { ChatGateway } from "../gateways/chat.gateway";
import { ChatQueueService } from "./chat-queue.service";
import { ChatBatchService } from "./chat-batch.service";
import { MessageRepository } from "../repositories/message.repository";
import { ConversationRepository } from "../repositories/conversation.repository";
import { RedisMessageData } from "../interfaces/message-queue.interface";
import { UsersService } from "../../users/users.service";
import { CdnService } from "../../files/services/cdn.service";

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private chatGateway: ChatGateway;

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
    private readonly usersService: UsersService,
    private readonly cdnService: CdnService,
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
      throw new BadRequestException("Cannot start conversation with yourself");
    }

    // 차단 상태 확인
    const isBlocked = await this.checkBlock(currentUserId, targetUserId);
    if (isBlocked) {
      throw new ForbiddenException("User is blocked");
    }

    // user ID 정렬 (중복 대화방 생성 방지)
    const [user1Id, user2Id] = [currentUserId, targetUserId].sort();

    // First check if conversation already exists
    let conversation = await this.conversationRepository.findOne({
      where: { user1Id, user2Id },
      relations: ["user1", "user2"],
    });

    /**
     * 기존 대화방이 있으면 반환
     * - 사용자가 대화방을 나갔더라도 대화방 자체는 유지
     * - 다시 메시지를 보내면 deletedAt이 리셋됨
     */
    if (conversation) {
      const currentUserLeft =
        (conversation.user1Id === currentUserId &&
          conversation.user1DeletedAt) ||
        (conversation.user2Id === currentUserId && conversation.user2DeletedAt);

      if (currentUserLeft) {
        this.logger.debug(
          "[ChatService] User had left this conversation, but returning it (will reset on first message)",
        );
      }

      this.logger.debug("[ChatService] Returning existing conversation:", {
        conversationId: conversation.id,
        user1Username: conversation.user1?.username,
        user2Username: conversation.user2?.username,
        currentUserLeft: currentUserLeft,
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

      this.logger.debug("[ChatService] New conversation created between:", {
        user1Id,
        user2Id,
      });
    } catch (error) {
      this.logger.error("[ChatService] Error creating conversation:", error);
      // Continue to try fetching in case it was created by another request
    }

    // Now safely fetch the conversation with relations
    conversation = await this.conversationRepository.findOne({
      where: { user1Id, user2Id },
      relations: ["user1", "user2"],
    });

    if (!conversation) {
      this.logger.error(
        "[ChatService] Failed to create or find conversation after insert attempt",
      );
      throw new Error("Failed to create or find conversation");
    }

    this.logger.debug("[ChatService] Conversation ready:", {
      conversationId: conversation.id,
      user1Username: conversation.user1?.username,
      user2Username: conversation.user2?.username,
    });

    // 신규 대화방 생성 후 관련 사용자들의 캐시 즉시 무효화
    // 대화 목록 캐시를 즉시 갱신하여 프론트엔드에서 빠르게 반영되도록 함
    await this.invalidateUserConversationsCache(currentUserId);
    await this.invalidateUserConversationsCache(targetUserId);

    this.logger.debug(
      `[ChatService] Invalidated conversations cache for users: ${currentUserId}, ${targetUserId}`,
    );

    return conversation;
  }

  async getConversationById(
    conversationId: string,
  ): Promise<Conversation | null> {
    return this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ["user1", "user2"],
    });
  }

  async getConversationForUser(
    conversationId: string,
    userId: string,
  ): Promise<Conversation> {
    const conversation = await this.conversationRepo.findById(conversationId);

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    // 사용자가 참여한 대화인지 확인
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException("Access denied to this conversation");
    }

    // formatAuthorData 패턴 적용 (PostsService와 동일)
    if (conversation.user1) {
      this.formatAuthorData(conversation.user1);
    }
    if (conversation.user2) {
      this.formatAuthorData(conversation.user2);
    }

    // 디버그 로그 추가
    this.logger.debug("[ChatService] getConversationForUser:", {
      conversationId,
      userId,
      user1: conversation.user1
        ? {
            id: conversation.user1.id,
            username: conversation.user1.username,
            hasProfileImage: !!(conversation.user1 as any).profileImage,
          }
        : null,
      user2: conversation.user2
        ? {
            id: conversation.user2.id,
            username: conversation.user2.username,
            hasProfileImage: !!(conversation.user2 as any).profileImage,
          }
        : null,
    });

    // deletedAt과 상관없이 대화방 정보 반환
    // (메시지는 getMessages에서 이미 deletedAt 기준으로 필터링됨)
    return conversation;
  }

  async getConversations(userId: string): Promise<ConversationWithUnread[]> {
    // Only log in development mode
    if (process.env.NODE_ENV === "development") {
      this.logger.debug(
        "[ChatService] getConversations called for userId:",
        userId,
      );
    }

    // Check cache first
    const cacheKey = `conversations:${userId}`;
    const cached = await this.unifiedRedisService.getCache<
      ConversationWithUnread[]
    >("chat", cacheKey);
    if (cached) {
      if (process.env.NODE_ENV === "development") {
        this.logger.debug(
          "[ChatService] Returning cached conversations for user:",
          userId,
        );
      }
      return cached;
    }

    // Repository 메서드 사용 - 이미 최적화된 쿼리 사용
    // ConversationRepository.findUserConversations()는 단순화된 쿼리 사용
    // (EXISTS 서브쿼리 제거되고 deletedAt 체크만 수행)
    const conversations =
      await this.conversationRepo.findUserConversations(userId);

    // Repository에서 이미 필터링되어 옴 - 추가 검증 불필요

    /**
     * 성능 최적화: 배치 쿼리로 N+1 문제 해결
     * - 마지막 메시지와 unreadCount를 각각 한 번의 쿼리로 조회
     */

    // 모든 대화방 ID 목록
    const conversationIds = conversations.map((conv) => conv.id);

    if (conversationIds.length === 0) {
      return [];
    }

    // 1. 모든 대화방의 마지막 메시지를 한 번에 조회
    // PostgreSQL의 DISTINCT ON을 사용하여 각 대화방별 최신 메시지 조회
    const lastMessagesQuery = await this.messageRepository
      .createQueryBuilder("message")
      .distinctOn(["message.conversationId"]) // TypeORM의 distinctOn 메서드 사용
      .select("message.conversationId", "conversationId")
      .addSelect("message.id", "id")
      .addSelect("message.content", "content")
      .addSelect("message.createdAt", "createdAt")
      .addSelect("message.senderId", "senderId")
      .where("message.conversationId IN (:...conversationIds)", {
        conversationIds,
      })
      .andWhere("message.isDeleted = false")
      .orderBy("message.conversationId", "ASC")
      .addOrderBy("message.createdAt", "DESC")
      .getRawMany();

    // conversationId를 키로 하는 맵 생성
    const lastMessageMap = new Map(
      lastMessagesQuery.map((msg) => [
        msg.conversationId,
        {
          content: msg.content,
          createdAt: msg.createdAt,
          senderId: msg.senderId,
        },
      ]),
    );

    // 2. 배치 쿼리로 모든 대화방의 unreadCount를 한 번에 조회 (N+1 → 2 쿼리로 최적화)
    // Raw SQL로 복잡한 조건 처리 (user1/user2별 lastReadAt)
    let unreadCountMap = new Map<string, number>();

    if (conversationIds.length > 0) {
      const unreadCountsRaw = await this.messageRepository.query(
        `
        SELECT 
          m."conversationId",
          COUNT(*) as "unreadCount"
        FROM messages m
        INNER JOIN conversations c ON c.id = m."conversationId"
        WHERE m."conversationId" = ANY($1)
          AND m."senderId" != $2
          AND m."isDeleted" = false
          AND (
            (c."user1Id" = $2 AND (c."user1LastReadAt" IS NULL OR m."createdAt" > c."user1LastReadAt"))
            OR
            (c."user2Id" = $2 AND (c."user2LastReadAt" IS NULL OR m."createdAt" > c."user2LastReadAt"))
          )
        GROUP BY m."conversationId"
        `,
        [conversationIds, userId],
      );

      unreadCountMap = new Map(
        unreadCountsRaw.map((r: any) => [
          r.conversationId,
          parseInt(r.unreadCount, 10),
        ]),
      );
    }

    // 동기적 매핑 (비동기 루프 제거)
    const conversationsWithUnreadCount = conversations.map((conv) => {
      const lastMessage = lastMessageMap.get(conv.id) || null;
      const unreadCount = unreadCountMap.get(conv.id) || 0;

      // formatAuthorData 패턴 적용 (PostsService와 동일)
      if (conv.user1) {
        this.formatAuthorData(conv.user1);
      }
      if (conv.user2) {
        this.formatAuthorData(conv.user2);
      }

      return {
        ...conv,
        unreadCount,
        lastMessage,
      };
    });

    /**
     * 대화 목록 캐싱 개선
     * 기존 1초에서 5분으로 연장 (캐시 히트율 향상)
     * 메시지 전송 시 캐시 자동 무효화되므로 문제 없음
     */
    await this.unifiedRedisService.setCache(
      "chat",
      cacheKey,
      conversationsWithUnreadCount,
      300,
    ); // 5분

    return conversationsWithUnreadCount;
  }

  async getMessages(
    conversationId: string,
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    this.logger.debug("[ChatService] getMessages called:", {
      conversationId,
      userId,
      userIdType: typeof userId,
      page,
      limit,
    });

    // Try to get messages from Redis cache first
    if (page === 1) {
      const cachedMessages = await this.queueService.getCachedMessages(
        conversationId,
        limit,
      );
      if (cachedMessages.length > 0) {
        this.logger.debug(
          "[ChatService] Returning cached messages:",
          cachedMessages.length,
        );

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
      relations: ["user1", "user2"], // Load user relations for better debugging
    });

    if (!conversation) {
      this.logger.error(
        "[ChatService] Conversation not found for messages:",
        conversationId,
      );
      throw new NotFoundException("Conversation not found");
    }

    // Convert to string for comparison to handle potential type mismatches
    const user1IdStr = String(conversation.user1Id).toLowerCase();
    const user2IdStr = String(conversation.user2Id).toLowerCase();
    const userIdStr = String(userId).toLowerCase();

    this.logger.debug("[ChatService] Message authorization check:", {
      conversationId,
      user1Id: conversation.user1Id,
      user1Username: conversation.user1?.username,
      user2Id: conversation.user2Id,
      user2Username: conversation.user2?.username,
      requestingUserId: userId,
      user1Match: user1IdStr === userIdStr,
      user2Match: user2IdStr === userIdStr,
    });

    if (user1IdStr !== userIdStr && user2IdStr !== userIdStr) {
      this.logger.error(
        "[ChatService] Message authorization failed - FORBIDDEN:",
        {
          conversationId,
          user1IdStr,
          user2IdStr,
          userIdStr,
          user1Username: conversation.user1?.username,
          user2Username: conversation.user2?.username,
        },
      );
      throw new ForbiddenException("Not authorized to view this conversation");
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
      .createQueryBuilder("message")
      .leftJoinAndSelect("message.sender", "sender")
      .leftJoinAndSelect("sender.profile", "profile")
      .where("message.conversationId = :conversationId", { conversationId })
      .andWhere("message.isDeleted = false");

    // Only show messages created after the user left (if they had left)
    if (deletedAt) {
      queryBuilder.andWhere("message.createdAt > :deletedAt", { deletedAt });
    }

    const total = await queryBuilder.getCount();
    const messages = await queryBuilder
      .orderBy("message.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    // 발신자 프로필 이미지 CDN URL 변환
    messages.forEach((message) => {
      if (message.sender?.profile?.profileImage) {
        message.sender.profile.profileImage =
          this.cdnService.generateCdnUrlFromKey(
            message.sender.profile.profileImage,
          );
      }
    });

    // Cache recent messages (first page only)
    if (page === 1) {
      await this.unifiedRedisService.setCache(
        "chat",
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

  async sendMessage(senderId: string, dto: CreateMessageDto): Promise<Message> {
    // Only log in development
    if (process.env.NODE_ENV === "development") {
      this.logger.debug("[ChatService] sendMessage called:", {
        senderId,
        conversationId: dto.conversationId,
        contentLength: dto.content?.length,
      });
    }

    // Verify conversation exists and user is part of it
    const conversation = await this.conversationRepository.findOne({
      where: { id: dto.conversationId },
      relations: ["user1", "user2"], // Load user relations for better debugging
    });

    if (!conversation) {
      if (process.env.NODE_ENV === "development") {
        this.logger.error(
          "[ChatService] Conversation not found:",
          dto.conversationId,
        );
      }
      throw new NotFoundException("Conversation not found");
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
      if (process.env.NODE_ENV === "development") {
        this.logger.debug(
          "[ChatService] Sender is re-entering conversation, resetting deletedAt",
        );
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
      if (process.env.NODE_ENV === "development") {
        this.logger.error(
          "[ChatService] User not part of conversation - FORBIDDEN",
        );
      }
      throw new ForbiddenException(
        "Not authorized to send message in this conversation",
      );
    }

    // Check if blocked
    const recipientId =
      user1IdStr === senderIdStr ? conversation.user2Id : conversation.user1Id;

    const isBlocked = await this.checkBlock(senderId, recipientId);
    if (isBlocked) {
      if (process.env.NODE_ENV === "development") {
        this.logger.error(
          "[ChatService] Message blocked - users have blocked each other",
        );
      }
      throw new ForbiddenException("Cannot send message to blocked user");
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

    // UsersService를 통해 CDN URL이 적용된 sender 정보 로드
    const sender = await this.usersService.findOne(senderId);

    // Combine message with sender info
    const fullMessage = {
      ...message, // Use message object instead of savedMessage
      sender,
      tempId: dto.tempId || undefined,
    };

    // Update conversation's last message time
    await this.conversationRepository.update(dto.conversationId, {
      lastMessageAt: new Date(),
    });

    // 대화방에 활성 상태인 사용자들 확인 (Redis Set 사용)
    const activeUsers = await this.unifiedRedisService.getSetMembers(
      "conversation",
      `${dto.conversationId}:active-users`,
    );

    // 수신자가 현재 대화방에 있으면 자동으로 읽음 처리
    const isRecipientActive = activeUsers.includes(String(recipientId));

    if (isRecipientActive) {
      // 수신자가 대화방에 실시간으로 있으므로 메시지를 읽은 것으로 처리
      const updateData =
        recipientId === conversation.user1Id
          ? { user1LastReadAt: new Date() }
          : { user2LastReadAt: new Date() };

      await this.conversationRepository.update(dto.conversationId, updateData);

      if (process.env.NODE_ENV === "development") {
        this.logger.debug(
          `[ChatService] 수신자(${recipientId})가 대화방에 있어서 자동 읽음 처리`,
        );
      }
    }

    // 수신자가 대화를 삭제했었는지 확인
    const recipientHasLeft =
      (conversation.user1Id === recipientId && conversation.user1DeletedAt) ||
      (conversation.user2Id === recipientId && conversation.user2DeletedAt);

    if (recipientHasLeft && process.env.NODE_ENV === "development") {
      this.logger.debug(
        "[ChatService] 수신자가 삭제했던 대화에 새 메시지 전송 - 대화 목록에 다시 표시됨 (이전 메시지는 보이지 않음)",
      );
      // deletedAt은 유지하여 이전 메시지는 보이지 않도록 함
      // 대화 목록에는 lastMessageAt > deletedAt 조건으로 표시됨
    }

    // Clear cache for both sender and recipient in parallel
    await Promise.all([
      this.unifiedRedisService.deleteCache(
        "chat",
        `conversation:${dto.conversationId}:messages`,
      ),
      this.unifiedRedisService.deleteCache("chat", `conversations:${senderId}`),
      this.unifiedRedisService.deleteCache(
        "chat",
        `conversations:${recipientId}`,
      ),
    ]);

    // Broadcast message via WebSocket to conversation room
    if (this.chatGateway && this.chatGateway.server) {
      this.chatGateway.server
        .to(`conversation:${dto.conversationId}`)
        .emit("new-message", fullMessage);

      // 수신자가 대화방에 없을 때만 notification 발생
      if (!isRecipientActive) {
        // 대화방에 없을 때만 알림 (읽지 않은 메시지 카운트 증가)
        this.chatGateway.server
          .to(`user:${recipientId}`)
          .emit("message-notification", {
            conversationId: dto.conversationId,
            message: fullMessage,
          });

        if (process.env.NODE_ENV === "development") {
          this.logger.debug(
            `[ChatService] 수신자(${recipientId})가 대화방에 없어서 message-notification 발생`,
          );
        }
      } else {
        if (process.env.NODE_ENV === "development") {
          this.logger.debug(
            `[ChatService] 수신자(${recipientId})가 대화방에 있어서 notification 생략 (자동 읽음 처리됨)`,
          );
        }
      }

      // If recipient had left, also send event to refresh their conversation list
      if (recipientHasLeft) {
        this.chatGateway.server
          .to(`user:${recipientId}`)
          .emit("conversation-list-refresh");
        this.logger.debug(
          "[ChatService] Sent conversation-list-refresh event to recipient who had left",
        );
      }

      this.logger.debug("[ChatService] Message broadcasted via WebSocket:", {
        conversationId: dto.conversationId,
        messageId: fullMessage.id,
        recipientId,
        recipientHasLeft,
      });
    }

    return fullMessage;
  }

  async markAsRead(messageId: string, userId: string): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ["conversation"],
    });

    if (!message) {
      throw new NotFoundException("Message not found");
    }

    // Only recipient can mark as read
    if (message.senderId === userId) {
      return message; // Sender's own message
    }

    // Verify user is part of conversation
    const conversation = message.conversation;
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException("Not authorized");
    }

    // Update user's lastReadAt timestamp to this message's creation time
    const updateData =
      userId === conversation.user1Id
        ? { user1LastReadAt: message.createdAt }
        : { user2LastReadAt: message.createdAt };

    await this.conversationRepository.update(conversation.id, updateData);

    // Clear cache
    await this.unifiedRedisService.deleteCache(
      "chat",
      `conversations:${userId}`,
    );

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
      throw new NotFoundException("Conversation not found");
    }

    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException("Not authorized");
    }

    // Update user's lastReadAt timestamp
    const updateData =
      userId === conversation.user1Id
        ? { user1LastReadAt: new Date() }
        : { user2LastReadAt: new Date() };

    await this.conversationRepository.update(conversationId, updateData);

    // Clear cache to reflect the change immediately
    await this.unifiedRedisService.deleteCache(
      "chat",
      `conversations:${userId}`,
    );
  }

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new BadRequestException("Cannot block yourself");
    }

    // Check if already blocked
    const existing = await this.userBlockRepository.findOne({
      where: { blockerId, blockedId },
    });

    if (existing) {
      throw new BadRequestException("User is already blocked");
    }

    // Create block
    await this.userBlockRepository.save({
      blockerId,
      blockedId,
    });

    // Clear cache
    await this.unifiedRedisService.deleteCache(
      "chat",
      `blocks:${blockerId}:${blockedId}`,
    );
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const block = await this.userBlockRepository.findOne({
      where: { blockerId, blockedId },
    });

    if (!block) {
      throw new NotFoundException("Block not found");
    }

    await this.userBlockRepository.remove(block);

    // Clear cache
    await this.unifiedRedisService.deleteCache(
      "chat",
      `blocks:${blockerId}:${blockedId}`,
    );
  }

  async getBlockedUsers(userId: string): Promise<UserBlock[]> {
    return this.userBlockRepository.find({
      where: { blockerId: userId },
      relations: ["blockedUser"],
    });
  }

  async checkBlock(user1Id: string, user2Id: string): Promise<boolean> {
    this.logger.debug("[ChatService] checkBlock called:", { user1Id, user2Id });

    try {
      // Check if either user has blocked the other
      const block = await this.userBlockRepository.findOne({
        where: [
          { blockerId: user1Id, blockedId: user2Id },
          { blockerId: user2Id, blockedId: user1Id },
        ],
      });

      this.logger.debug("[ChatService] Block check result:", {
        user1Id,
        user2Id,
        blockFound: !!block,
        blockDetails: block
          ? {
              blockerId: block.blockerId,
              blockedId: block.blockedId,
              createdAt: block.createdAt,
            }
          : null,
      });

      return !!block;
    } catch (error) {
      this.logger.error("[ChatService] Error checking block:", error);
      // On error, allow the message (don't block due to system error)
      return false;
    }
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ["conversation"],
    });

    if (!message) {
      throw new NotFoundException("Message not found");
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException("Can only delete your own messages");
    }

    // 거래 채팅 메시지는 삭제 불가 (법적 보존 의무)
    if (message.conversation?.type === "transaction") {
      throw new ForbiddenException(
        "거래 관련 메시지는 삭제할 수 없습니다",
      );
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
      where: [{ user1Id: userId }, { user2Id: userId }],
    });

    let totalUnreadCount = 0;

    for (const conversation of conversations) {
      const lastReadAt =
        userId === conversation.user1Id
          ? conversation.user1LastReadAt
          : conversation.user2LastReadAt;

      const unreadCountQuery = this.messageRepository
        .createQueryBuilder("message")
        .where("message.conversationId = :conversationId", {
          conversationId: conversation.id,
        })
        .andWhere("message.senderId != :userId", { userId })
        .andWhere("message.isDeleted = false");

      if (lastReadAt) {
        unreadCountQuery.andWhere("message.createdAt > :lastReadAt", {
          lastReadAt,
        });
      }

      const count = await unreadCountQuery.getCount();
      totalUnreadCount += count;
    }

    return totalUnreadCount;
  }

  async deleteConversation(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    // Check if user is part of the conversation
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException("Not authorized to leave this conversation");
    }

    // Determine the other user
    const otherUserId =
      conversation.user1Id === userId
        ? conversation.user2Id
        : conversation.user1Id;

    // Soft delete for the user (mark as deleted)
    // This preserves the conversation data for audit purposes
    if (conversation.user1Id === userId) {
      await this.conversationRepository.update(conversationId, {
        user1DeletedAt: new Date(),
      });
      this.logger.debug(
        `[ChatService] User ${userId} left conversation ${conversationId} (as user1)`,
      );
    } else {
      await this.conversationRepository.update(conversationId, {
        user2DeletedAt: new Date(),
      });
      this.logger.debug(
        `[ChatService] User ${userId} left conversation ${conversationId} (as user2)`,
      );
    }

    // Clear any cached data for this conversation and both users
    await this.unifiedRedisService.deleteCache(
      "chat",
      `conversation:${conversationId}:messages`,
    );
    await this.unifiedRedisService.deleteCache(
      "chat",
      `conversations:${userId}`,
    );
    await this.unifiedRedisService.deleteCache(
      "chat",
      `conversations:${otherUserId}`,
    );

    // Emit WebSocket event to notify the other user
    if (this.chatGateway && this.chatGateway.server) {
      // Notify the conversation room that a user has left
      this.chatGateway.server
        .to(`conversation:${conversationId}`)
        .emit("user-left", {
          conversationId,
          userId: userId,
        });

      // Notify the other user to refresh their conversation list
      this.chatGateway.server
        .to(`user:${otherUserId}`)
        .emit("conversation-state-changed", {
          conversationId,
          action: "user-left",
          userId: userId,
        });

      this.logger.debug(
        `[ChatService] Emitted user-left event for conversation ${conversationId}`,
      );
    }
  }

  /**
   * Transform cached messages from Redis to Message format
   */
  private async transformCachedMessages(
    cachedMessages: RedisMessageData[],
  ): Promise<Message[]> {
    const messages: Message[] = [];

    // Get sender information for all messages
    // Phase 1-2-3: profileImage는 profiles 테이블에서 조회
    const senderIds = [...new Set(cachedMessages.map((m) => m.senderId))];
    const senders = await this.userRepository.find({
      where: senderIds.map((id) => ({ id })),
      relations: ["profile"],
      select: {
        id: true,
        username: true,
        email: true,
        profile: {
          profileImage: true,
        },
      },
    });

    // 프로필 이미지를 CDN URL로 변환
    senders.forEach((sender) => {
      if (
        sender.profile?.profileImage &&
        (sender.profile.profileImage.startsWith("v2/") ||
          sender.profile.profileImage.startsWith("uploads/"))
      ) {
        sender.profile.profileImage = this.cdnService.generateCdnUrlFromKey(
          sender.profile.profileImage,
        );
      }
    });

    const senderMap = new Map(senders.map((s) => [s.id, s]));

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

  /**
   * Author 데이터 포맷팅 (PostsService와 동일한 패턴)
   * @description profile 관계의 데이터를 User 객체에 flatten 하고 CDN URL로 변환
   */
  private formatAuthorData(author: any): any {
    // 채팅에서 필요한 필드만 처리: 이미지와 이름
    if (author.profile) {
      author.name = author.profile.name;
      author.profileImage = author.profile.profileImage;
    }

    // 프로필 이미지를 CDN URL로 변환 (v2/, uploads/ 모두 처리)
    if (author.profileImage) {
      if (
        author.profileImage.startsWith("v2/") ||
        author.profileImage.startsWith("uploads/")
      ) {
        // CDN 서비스 활성화 - S3 키를 CDN URL로 변환
        author.profileImage = this.cdnService.generateCdnUrlFromKey(
          author.profileImage,
        );
        this.logger.debug(
          `[ChatService] Author profile image CDN URL: ${author.profileImage}`,
        );
      }
    }

    // 채팅에 필요한 필드만 선택
    return {
      id: author.id,
      username: author.username,
      profileImage: author.profileImage,
    };
  }

  /**
   * 이미지 URL 최적화 (PostsService와 동일)
   */
  private optimizeImageUrl(url?: string): string | null {
    if (!url) return null;

    // 이미 절대 URL이면 그대로 사용
    if (url.startsWith("http")) {
      return url;
    }

    // S3 키인 경우 CDN URL로 변환
    if (url.startsWith("v2/") || url.startsWith("uploads/")) {
      return this.cdnService.generateCdnUrlFromKey(url);
    }

    return url;
  }

  /**
   * 사용자의 대화 목록 캐시 무효화
   * 신규 대화방 생성 후 즉시 반영되도록 캐시 삭제
   */
  private async invalidateUserConversationsCache(
    userId: string,
  ): Promise<void> {
    const cacheKey = `conversations:${userId}`;
    await this.unifiedRedisService.deleteCache("chat", cacheKey);
    this.logger.debug(
      `[ChatService] Invalidated conversations cache for user: ${userId}`,
    );
  }
}
