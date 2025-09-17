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
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
  namespace: '/chat',
})
@Injectable()
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  afterInit(server: Server) {
    console.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    console.log('[Chat Gateway] New connection attempt from:', client.id);
    console.log('[Chat Gateway] Handshake headers:', Object.keys(client.handshake.headers));
    console.log('[Chat Gateway] Cookies:', client.handshake.headers?.cookie);

    try {
      // Extract and verify JWT token
      const token = this.extractToken(client);
      console.log('[Chat Gateway] Token extracted:', !!token);
      if (!token) {
        console.log('[Chat Gateway] No token found, disconnecting client');
        client.disconnect();
        return;
      }

      const payload = await this.verifyToken(token);
      console.log('[Chat Gateway] Token verified, payload:', payload ? { sub: payload.sub, email: payload.email } : null);
      if (!payload) {
        console.log('[Chat Gateway] Invalid token, disconnecting client');
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

      // Store socket mapping for this user
      await this.cacheManager.set(
        `socket:${client.id}`,
        userId,
        3600, // 1 hour
      );

      // Use Redis SET for online users (more efficient)
      await this.cacheManager.set(
        `online:${userId}`,
        client.id,
        3600, // 1 hour
      );

      // Join user's personal room only
      client.join(`user:${userId}`);

      // Don't join all conversations at connection (memory optimization)
      // Conversations will be joined on-demand

      console.log(`User ${userId} connected`);

      // Set up periodic token check
      client.data.tokenCheckInterval = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        if (client.data.tokenExp && client.data.tokenExp < now) {
          console.log(`Token expired for user ${userId}`);
          client.disconnect();
        }
      }, 60000); // Check every minute
    } catch (error) {
      console.error('Connection error:', error);
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

      if (userId) {
        // Remove socket mapping
        await this.cacheManager.del(`socket:${client.id}`);

        // Remove from online users
        await this.cacheManager.del(`online:${userId}`);

        console.log(`User ${userId} disconnected`);
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }

  @SubscribeMessage('join-conversation')
  handleJoinConversation(
    @MessageBody() conversationId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`conversation:${conversationId}`);
    return { success: true };
  }

  @SubscribeMessage('leave-conversation')
  handleLeaveConversation(
    @MessageBody() conversationId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`conversation:${conversationId}`);
    return { success: true };
  }

  @SubscribeMessage('send-message')
  async handleMessage(
    @MessageBody() dto: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;
      if (!userId) {
        throw new WsException('Unauthorized');
      }

      // Save message
      const message = await this.chatService.sendMessage(userId, dto);

      // Emit to conversation room
      this.server
        .to(`conversation:${dto.conversationId}`)
        .emit('new-message', message);

      // Get conversation to find recipient
      const conversation = await this.chatService.getConversationById(dto.conversationId);
      if (!conversation) {
        throw new WsException('Conversation not found');
      }

      const recipientId = conversation.user1Id === userId
        ? conversation.user2Id
        : conversation.user1Id;

      // Emit notification to recipient's user room
      this.server
        .to(`user:${recipientId}`)
        .emit('message-notification', {
          conversationId: dto.conversationId,
          message,
        });

      return message;
    } catch (error) {
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() data: { conversationId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      throw new WsException('Unauthorized');
    }

    // Store typing state in Redis with TTL
    if (data.isTyping) {
      await this.cacheManager.set(
        `typing:${data.conversationId}:${userId}`,
        true,
        3, // 3 seconds TTL
      );
    } else {
      await this.cacheManager.del(`typing:${data.conversationId}:${userId}`);
    }

    // Broadcast to conversation participants
    client.to(`conversation:${data.conversationId}`).emit('user-typing', {
      userId,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('mark-read')
  async handleMarkRead(
    @MessageBody() messageId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      throw new WsException('Unauthorized');
    }

    try {
      await this.chatService.markAsRead(messageId, userId);

      // Notify sender that message was read
      this.server.emit('message-read', { messageId, userId });

      return { success: true };
    } catch (error) {
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage('get-online-users')
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
    const auth = client.handshake.auth?.token || client.handshake.headers?.authorization;
    if (!auth) return null;

    if (auth.startsWith('Bearer ')) {
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