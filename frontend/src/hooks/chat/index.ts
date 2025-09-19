/**
 * Export all chat hooks
 */

export { useSocketManager } from './useSocketManager';
export type { UseSocketManagerReturn } from './useSocketManager';

export { useConversations } from './useConversations';
export type { UseConversationsReturn } from './useConversations';

export { useMessages } from './useMessages';
export type { UseMessagesReturn } from './useMessages';

export { useChatPerformance } from './useChatPerformance';
export type { UseChatPerformanceReturn } from './useChatPerformance';

export { useChatRefactored } from './useChatRefactored';
export type { UseChatRefactoredReturn } from './useChatRefactored';

// React Query hooks
export { useChatWithQuery } from './useChatWithQuery';
export type { UseChatWithQueryReturn } from './useChatWithQuery';

export * from './useChatsQuery';

// Default export for easy migration - use React Query version
export { useChatWithQuery as default } from './useChatWithQuery';