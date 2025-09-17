import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  async getConversations(@CurrentUser() user: User) {
    return this.chatService.getConversations(user.id);
  }

  @Get('conversation/:userId')
  async getOrCreateConversation(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: User,
  ) {
    console.log('[Chat] getOrCreateConversation:', {
      currentUserId: currentUser?.id,
      targetUserId: userId,
      currentUserEmail: currentUser?.email
    });
    return this.chatService.getOrCreateConversation(currentUser.id, userId);
  }

  @Get('messages/:conversationId')
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query('page', ParseIntPipe) page = 1,
    @CurrentUser() user: User,
  ) {
    return this.chatService.getMessages(conversationId, user.id, page);
  }

  @Post('message')
  async sendMessage(
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: User,
  ) {
    return this.chatService.sendMessage(user.id, dto);
  }

  @Post('message/:messageId/read')
  async markAsRead(
    @Param('messageId') messageId: string,
    @CurrentUser() user: User,
  ) {
    await this.chatService.markAsRead(messageId, user.id);
    return { success: true };
  }

  @Delete('message/:messageId')
  async deleteMessage(
    @Param('messageId') messageId: string,
    @CurrentUser() user: User,
  ) {
    await this.chatService.deleteMessage(messageId, user.id);
    return { success: true };
  }

  @Post('block/:userId')
  async blockUser(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: User,
  ) {
    await this.chatService.blockUser(currentUser.id, userId);
    return { success: true };
  }

  @Delete('unblock/:userId')
  async unblockUser(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: User,
  ) {
    await this.chatService.unblockUser(currentUser.id, userId);
    return { success: true };
  }

  @Get('blocked-users')
  async getBlockedUsers(@CurrentUser() user: User) {
    return this.chatService.getBlockedUsers(user.id);
  }

  @Delete('conversation/:conversationId')
  async deleteConversation(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: User,
  ) {
    await this.chatService.deleteConversation(user.id, conversationId);
    return { success: true };
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: User) {
    const count = await this.chatService.getUnreadCount(user.id);
    return { count };
  }
}