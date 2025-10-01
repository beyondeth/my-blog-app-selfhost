export interface DMLayoutProps {
  children?: React.ReactNode;
}

export interface User {
  id: string;
  username: string;
  profileImage?: string;
  isOnline?: boolean;
  lastSeen?: Date;
}

export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  // isRead, readAt 제거 - 대화 레벨에서만 읽음 상태 관리
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  sender?: User;
  status?: MessageStatus; // For optimistic updates
}

export interface Conversation {
  id: string;
  user1Id: string;
  user2Id: string;
  lastMessage?: Message;
  lastMessageAt?: Date;
  unreadCount?: number;
  user1?: User;
  user2?: User;
}

export interface ConversationItemProps {
  conversation: Conversation;
  currentUserId: string;
  isActive: boolean;
  onClick: (conversationId: string) => void;
  onLeaveConversation?: (conversationId: string) => Promise<void>;
}

export interface MessageItemProps {
  message: Message;
  isOwnMessage: boolean;
  showAvatar: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}