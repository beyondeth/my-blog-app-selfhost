import { Conversation } from '../entities/conversation.entity';

export interface ConversationWithUnread extends Conversation {
  unreadCount: number;
  lastMessage: {
    content: string;
    createdAt: Date;
    senderId: string;
  } | null;
}