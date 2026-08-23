import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { ChatService } from "../services/chat.service";
import { CreateMessageDto } from "../dto/create-message.dto";
import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../../users/users.service";
import { UnifiedRedisService } from "../../redis/unified-redis.service";
import { ChatMetricsService } from "../../metrics/chat-metrics.service";

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    credentials: true,
  },
  namespace: "/chat",
})
@Injectable()
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly unifiedRedisService: UnifiedRedisService,
    private readonly metricsService: ChatMetricsService,
  ) {}

  afterInit(server: Server) {
    // 초기화 로그 제거 - 너무 빈번함
    // Register this gateway with ChatService for bidirectional communication
    this.chatService.setChatGateway(this);

    // Reset WebSocket connection count on server start
    // This ensures the count is accurate after a restart
    this.metricsService.updateWebSocketConnections(0);
  }

  async handleConnection(client: Socket) {
    // 연결 로그 제거 - 매 연결마다 출력되어 너무 많음
    // Flag to track if connection was authenticated
    client.data.authenticated = false;

    try {
      // Extract and verify JWT token
      const token = this.extractToken(client);
      if (!token) {
        // 토큰 없음 - 인증 실패만 로그 (중요 이벤트)
        this.logger.warn("WebSocket authentication failed: No token found");
        client.disconnect();
        return;
      }

      const payload = await this.verifyToken(token);
      if (!payload) {
        // 무효한 토큰 - 인증 실패만 로그 (중요 이벤트)
        this.logger.warn("WebSocket authentication failed: Invalid token");
        client.disconnect();
        return;
      }

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        client.disconnect();
        return;
      }

      // Store user ID in socket data
      const userId = payload.id || payload.sub;
      client.data.userId = userId;
      client.data.tokenExp = payload.exp;
      client.data.authenticated = true; // Mark as authenticated

      // Check for existing connection and clean it up
      const existingSocketId = await this.unifiedRedisService.getCache<string>(
        "chat",
        `online:${userId}`,
      );
      if (existingSocketId && existingSocketId !== client.id) {
        // WebSocket 서버가 초기화되었는지 확인
        if (this.server?.sockets?.sockets) {
          const existingSocket =
            this.server.sockets.sockets.get(existingSocketId);
          if (existingSocket) {
            // 중복 연결 처리 - 중요 이벤트이므로 로그 유지
            if (process.env.NODE_ENV === "development") {
              this.logger.debug("Disconnecting duplicate WebSocket connection");
            }
            existingSocket.disconnect(true);
          }
        }
      }

      // Store socket mapping for this user
      await this.unifiedRedisService.setCache(
        "chat",
        `socket:${client.id}`,
        userId,
        3600, // 1 hour
      );

      // Use Redis SET for online users (more efficient)
      await this.unifiedRedisService.setCache(
        "chat",
        `online:${userId}`,
        client.id,
        3600, // 1 hour
      );

      // Join user's personal room only
      client.join(`user:${userId}`);

      // Don't join all conversations at connection (memory optimization)
      // Conversations will be joined on-demand

      // 연결 성공 로그 제거 - 너무 빈번함

      // Update WebSocket connection metrics ONLY for authenticated connections
      this.metricsService.incrementWebSocketConnections();

      // Set up periodic token check
      client.data.tokenCheckInterval = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        if (client.data.tokenExp && client.data.tokenExp < now) {
          // 토큰 만료 - 중요 이벤트이므로 로그 유지
          if (process.env.NODE_ENV === "development") {
            this.logger.debug("WebSocket token expired, disconnecting");
          }
          client.disconnect();
        }
      }, 60000); // Check every minute
    } catch (error) {
      this.logger.error("WebSocket connection error", error.stack);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = client.data.userId;

      // Clear token check interval
      if (client.data.tokenCheckInterval) {
        clearInterval(client.data.tokenCheckInterval);
      }

      // Only decrement if this was an authenticated connection
      if (client.data.authenticated) {
        this.metricsService.decrementWebSocketConnections();
        // 메트릭 업데이트 로그 제거 - 너무 빈번함
      }

      if (userId) {
        // Remove socket mapping
        await this.unifiedRedisService.deleteCache(
          "chat",
          `socket:${client.id}`,
        );

        // Remove from online users
        await this.unifiedRedisService.deleteCache("chat", `online:${userId}`);

        // 연결 해제 로그 제거 - 너무 빈번함
      }
    } catch (error) {
      this.logger.error("WebSocket disconnect error", error.stack);
    }
  }

  /**
   * 채팅방 입장 처리
   * - Socket.io room 입장
   * - Redis Set에 활성 사용자 추가
   * - lastReadAt 현재 시간으로 업데이트 (unreadCount 0으로 만들기)
   * - 다른 사용자들에게 입장 알림
   */
  @SubscribeMessage("join-conversation")
  async handleJoinConversation(
    @MessageBody() conversationId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    try {
      // Never mutate room or presence state before membership is confirmed.
      await this.chatService.assertConversationParticipant(
        conversationId,
        userId,
      );

      await client.join(`conversation:${conversationId}`);

      // Redis Set에 활성 사용자 추가 (대화방에 실제로 있는 사용자 추적)
      await this.unifiedRedisService.addToSet(
        "conversation",
        `${conversationId}:active-users`,
        userId,
      );

      // Room 멤버십 확인 로그 제거 - 디버깅용이므로 개발 환경에서만
      if (
        process.env.NODE_ENV === "development" &&
        process.env.DEBUG_CHAT === "true"
      ) {
        const activeUsers = await this.unifiedRedisService.getSetMembers(
          "conversation",
          `${conversationId}:active-users`,
        );
        this.logger.debug(
          `Room joined - Conv: ${conversationId}, Active users: ${activeUsers.length}`,
        );
      }

      /**
       * lastReadAt 업데이트 - 채팅방 입장 시 필수
       * - 모든 메시지를 읽은 것으로 처리
       * - unreadCount가 자동으로 0이 됨
       */
      await this.chatService.markAllMessagesAsRead(conversationId, userId);

      // 다른 사용자들에게 입장 알림
      client.broadcast
        .to(`conversation:${conversationId}`)
        .emit("user-joined", { conversationId, userId });

      return {
        success: true,
        joined: true,
        conversationId,
        userId,
      };
    } catch (error) {
      await client.leave(`conversation:${conversationId}`);
      try {
        await this.unifiedRedisService.removeFromSet(
          "conversation",
          `${conversationId}:active-users`,
          userId,
        );
      } catch (cleanupError) {
        this.logger.error(
          "Failed to clean up room presence after join failure",
          cleanupError instanceof Error ? cleanupError.stack : cleanupError,
        );
      }

      const message =
        error instanceof Error ? error.message : "Unable to join conversation";
      throw new WsException(message);
    }
  }

  /**
   * 채팅방 나가기 처리
   * - Socket.io room에서 나가기
   * - Redis Set에서 활성 사용자 제거
   * - lastReadAt는 변경하지 않음 (나간 시점부터 unreadCount 증가)
   * - 다른 사용자들에게 퇴장 알림
   */
  @SubscribeMessage("leave-conversation")
  async handleLeaveConversation(
    @MessageBody() conversationId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    client.leave(`conversation:${conversationId}`);

    // Redis Set에서 활성 사용자 제거
    await this.unifiedRedisService.removeFromSet(
      "conversation",
      `${conversationId}:active-users`,
      userId,
    );

    // 디버깅용 로그
    if (
      process.env.NODE_ENV === "development" &&
      process.env.DEBUG_CHAT === "true"
    ) {
      const activeUsers = await this.unifiedRedisService.getSetMembers(
        "conversation",
        `${conversationId}:active-users`,
      );
      this.logger.debug(
        `Room left - Conv: ${conversationId}, Remaining active users: ${activeUsers.length}`,
      );
    }

    // lastReadAt 유지 (나간 후 메시지는 읽지 않은 것으로 처리)

    // 다른 사용자들에게 퇴장 알림
    client.broadcast
      .to(`conversation:${conversationId}`)
      .emit("user-left", { conversationId, userId });

    return { success: true };
  }

  /**
   * 메시지 전송 처리
   * - 메시지를 Redis 큐에 저장 (5초 후 배치 처리)
   * - 채팅방에 있는 사용자들에게 실시간 전달
   * - 상대방이 채팅방에 있으면 즉시 lastReadAt 업데이트
   */
  @SubscribeMessage("send-message")
  async handleMessage(
    @MessageBody() dto: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;
      if (!userId) {
        throw new WsException("Unauthorized");
      }

      // 메시지 저장 (Redis 큐 + 5초 후 DB)
      const message = await this.chatService.sendMessage(userId, dto);

      // 채팅방에 있는 다른 사용자들에게 전달
      client.broadcast
        .to(`conversation:${dto.conversationId}`)
        .emit("new-message", message);

      // 상대방 ID 찾기
      const conversation = await this.chatService.getConversationById(
        dto.conversationId,
      );
      if (!conversation) {
        throw new WsException("Conversation not found");
      }

      const recipientId =
        conversation.user1Id === userId
          ? conversation.user2Id
          : conversation.user1Id;

      /**
       * 중요: 상대방이 현재 채팅방에 있는지 확인
       * 채팅방에 있는 유저에게는 notification을 보내지 않음
       *
       * 채팅방에 있는 경우:
       * - 이미 'new-message' 이벤트를 받았으므로 중복 알림 불필요
       * - unreadCount가 증가하면 안됨 (채팅방 내부에서는 자동 읽음 처리)
       * - lastReadAt를 현재 시간으로 업데이트 (중요!)
       *
       * 채팅방에 없는 경우만:
       * - 'message-notification' 이벤트 전송
       * - 대화 목록의 unreadCount 업데이트 필요
       */
      const roomName = `conversation:${dto.conversationId}`;
      const recipientSocketId = await this.unifiedRedisService.getCache<string>(
        "chat",
        `online:${recipientId}`,
      );

      // 메시지 전송 디버깅 로그 제거 - 매 메시지마다 출력되어 너무 많음

      if (recipientSocketId) {
        const recipientSocket =
          this.server.sockets.sockets.get(recipientSocketId);

        if (recipientSocket) {
          // Room 멤버십을 두 가지 방법으로 확인
          const isInRoom = recipientSocket.rooms.has(roomName);
          const roomsArray = Array.from(recipientSocket.rooms);

          // Room 상태 확인 로그 제거 - 매 메시지마다 출력되어 너무 많음

          if (isInRoom) {
            /**
             * 상대방이 채팅방에 있는 경우
             * - 즉시 lastReadAt 업데이트하여 읽음 처리
             * - 5초 후 DB 저장 시에도 이미 읽은 상태로 처리됨
             * - notification 이벤트 보내지 않음 (중복 방지)
             */
            // 채팅방 상태 로그 제거 - 너무 빈번함
            try {
              await this.chatService.markAllMessagesAsRead(
                dto.conversationId,
                recipientId,
              );
              // lastReadAt 업데이트 성공 로그 제거
            } catch (error) {
              this.logger.error("Failed to mark messages as read", error.stack);
            }
          } else {
            /**
             * 상대방이 채팅방에 없는 경우
             * - message-notification 이벤트 전송
             * - 프론트엔드에서 unreadCount 증가 처리
             */
            // 알림 전송 로그 제거 - 너무 빈번함
            this.server.to(`user:${recipientId}`).emit("message-notification", {
              conversationId: dto.conversationId,
              message,
            });
          }
        } else {
          // Socket은 있는데 실제 연결이 없는 경우 (캐시 불일치)
          // 캐시 불일치는 중요한 문제이므로 로그 유지
          this.logger.warn(
            "Cache inconsistency detected: Socket ID exists but no WebSocket connection",
          );

          // 캐시 정리
          await this.unifiedRedisService.deleteCache(
            "chat",
            `online:${recipientId}`,
          );

          // 알림 전송
          this.server.to(`user:${recipientId}`).emit("message-notification", {
            conversationId: dto.conversationId,
            message,
          });
        }
      } else {
        /**
         * 상대방이 오프라인
         * - 나중에 로그인하면 unreadCount 표시
         */
        // 오프라인 로그 제거 - 너무 빈번함
        this.server.to(`user:${recipientId}`).emit("message-notification", {
          conversationId: dto.conversationId,
          message,
        });
      }

      return message;
    } catch (error) {
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage("typing")
  async handleTyping(
    @MessageBody() data: { conversationId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      throw new WsException("Unauthorized");
    }

    // Store typing state in Redis with TTL
    if (data.isTyping) {
      await this.unifiedRedisService.setCache(
        "chat",
        `typing:${data.conversationId}:${userId}`,
        true,
        3, // 3 seconds TTL
      );
    } else {
      await this.unifiedRedisService.deleteCache(
        "chat",
        `typing:${data.conversationId}:${userId}`,
      );
    }

    // Broadcast to conversation participants
    client.to(`conversation:${data.conversationId}`).emit("user-typing", {
      userId,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage("mark-read")
  async handleMarkRead(
    @MessageBody() messageId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      throw new WsException("Unauthorized");
    }

    try {
      // Mark the message as read
      const message = await this.chatService.markAsRead(messageId, userId);

      // Get the conversation ID from the message
      const conversationId = message.conversationId;

      // Emit to all users in the conversation room
      this.server.to(`conversation:${conversationId}`).emit("message-read", {
        messageId,
        conversationId,
        readBy: userId,
        readAt: new Date(),
      });

      return { success: true };
    } catch (error) {
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage("mark-all-read")
  async handleMarkAllRead(
    @MessageBody() conversationId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      throw new WsException("Unauthorized");
    }

    try {
      // Mark all messages as read
      await this.chatService.markAllMessagesAsRead(conversationId, userId);

      // Emit to all users in the conversation room
      this.server
        .to(`conversation:${conversationId}`)
        .emit("all-messages-read", {
          conversationId,
          readBy: userId,
          readAt: new Date(),
        });

      return { success: true };
    } catch (error) {
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage("get-online-users")
  async handleGetOnlineUsers() {
    // Get all online:* keys from Redis to find online users
    // This is a simplified version - in production, use Redis SCAN
    const onlineUsers: string[] = [];

    // Note: This needs proper Redis SCAN implementation for production
    // For now, return empty array (to be improved with Redis adapter)
    return { onlineUsers };
  }

  private extractToken(client: Socket): string | null {
    // Try to get token from cookie first (httpOnly cookie)
    const cookies = client.handshake.headers?.cookie;
    if (cookies) {
      const accessTokenMatch = cookies.match(/access_token=([^;]+)/);
      if (accessTokenMatch && accessTokenMatch[1]) {
        return accessTokenMatch[1];
      }
    }

    // Fallback to auth header or handshake auth
    const auth =
      client.handshake.auth?.token || client.handshake.headers?.authorization;
    if (!auth) return null;

    if (auth.startsWith("Bearer ")) {
      return auth.substring(7);
    }
    return auth;
  }

  private async verifyToken(token: string): Promise<any> {
    try {
      return await this.jwtService.verifyAsync(token);
    } catch (error) {
      return null;
    }
  }
}
