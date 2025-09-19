import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { authEvents } from '@/lib/auth/events';

export type SidebarView = 'chats' | 'settings';
export type ModalView = 'settings' | null;
export type DMViewMode = 'modal' | 'page';

interface ConversationFilter {
  searchQuery: string;
  showUnreadOnly: boolean;
}

interface DMState {
  // Navigation state
  activeConversationId: string | null;
  sidebarView: SidebarView;
  isModalOpen: boolean;
  modalView: ModalView;

  // UI state
  isSidebarCollapsed: boolean;
  isConversationListVisible: boolean;

  // DM Modal state
  isDMModalOpen: boolean;
  dmViewMode: DMViewMode;

  // Filter state
  conversationFilter: ConversationFilter;

  // User management state (simplified for MVP)
  blockedUsers: Set<string>;

  // Conversation management state
  conversationListVersion: number; // Incremented when list needs refresh
  isRefreshingConversations: boolean;
}

interface DMActions {
  // Navigation actions
  setActiveConversation: (conversationId: string | null) => void;
  setSidebarView: (view: SidebarView) => void;
  openModal: (view: ModalView) => void;
  closeModal: () => void;

  // UI actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setConversationListVisible: (visible: boolean) => void;

  // DM Modal actions
  setDMModalOpen: (open: boolean) => void;
  setDMViewMode: (mode: DMViewMode) => void;
  closeDMModal: () => void; // Unified close method

  // Filter actions
  setSearchQuery: (query: string) => void;
  setShowUnreadOnly: (show: boolean) => void;
  resetFilters: () => void;

  // User management actions (simplified for MVP)
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
  setBlockedUsers: (userIds: string[]) => void;

  // Conversation management actions
  leaveConversation: (conversationId: string) => Promise<void>;
  refreshConversationList: () => void;
  setRefreshingConversations: (refreshing: boolean) => void;

  // Reset store on logout
  resetStore: () => void;
}

type DMStore = DMState & DMActions;

const initialState: DMState = {
  // Navigation state
  activeConversationId: null,
  sidebarView: 'chats',
  isModalOpen: false,
  modalView: null,

  // UI state
  isSidebarCollapsed: false,
  isConversationListVisible: true,

  // DM Modal state
  isDMModalOpen: false,
  dmViewMode: 'modal', // Default to modal mode

  // Filter state
  conversationFilter: {
    searchQuery: '',
    showUnreadOnly: false,
  },

  // User management state (simplified for MVP)
  blockedUsers: new Set(),

  // Conversation management state
  conversationListVersion: 0,
  isRefreshingConversations: false,
};

export const useDMStore = create<DMStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Navigation actions
      setActiveConversation: (conversationId) =>
        set({ activeConversationId: conversationId }),

      setSidebarView: (view) =>
        set({ sidebarView: view }),

      openModal: (view) =>
        set({ isModalOpen: true, modalView: view }),

      closeModal: () =>
        set({ isModalOpen: false, modalView: null }),

      // UI actions
      toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

      setSidebarCollapsed: (collapsed) =>
        set({ isSidebarCollapsed: collapsed }),

      setConversationListVisible: (visible) =>
        set({ isConversationListVisible: visible }),

      // DM Modal actions
      setDMModalOpen: (open) =>
        set({ isDMModalOpen: open }),

      setDMViewMode: (mode) =>
        set({ dmViewMode: mode }),

      closeDMModal: () => {
        // Unified method to properly close DM modal
        set({
          isDMModalOpen: false,
          activeConversationId: null,
          isModalOpen: false,
          modalView: null
        });
      },

      // Filter actions
      setSearchQuery: (query) =>
        set((state) => ({
          conversationFilter: {
            ...state.conversationFilter,
            searchQuery: query,
          },
        })),

      setShowUnreadOnly: (show) =>
        set((state) => ({
          conversationFilter: {
            ...state.conversationFilter,
            showUnreadOnly: show,
          },
        })),

      resetFilters: () =>
        set({
          conversationFilter: {
            searchQuery: '',
            showUnreadOnly: false,
          },
        }),

      // User management actions
      blockUser: (userId) =>
        set((state) => ({
          blockedUsers: new Set([...state.blockedUsers, userId]),
        })),

      unblockUser: (userId) =>
        set((state) => {
          const newBlockedUsers = new Set(state.blockedUsers);
          newBlockedUsers.delete(userId);
          return { blockedUsers: newBlockedUsers };
        }),

      setBlockedUsers: (userIds) =>
        set({ blockedUsers: new Set(userIds) }),

      // Conversation management actions
      leaveConversation: async (conversationId) => {
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
          const response = await fetch(`${API_URL}/chat/conversation/${conversationId}`, {
            method: 'DELETE',
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error('Failed to leave conversation');
          }

          // If the left conversation was active, clear it
          const state = get();
          if (state.activeConversationId === conversationId) {
            set({ activeConversationId: null });
          }

          // Trigger conversation list refresh
          set((state) => ({
            conversationListVersion: state.conversationListVersion + 1
          }));
        } catch (error) {
          console.error('Error leaving conversation:', error);
          throw error;
        }
      },

      refreshConversationList: () => {
        set((state) => ({
          conversationListVersion: state.conversationListVersion + 1
        }));
      },

      setRefreshingConversations: (refreshing) =>
        set({ isRefreshingConversations: refreshing }),

      // Reset store on logout
      resetStore: () => set(initialState),
    }),
    {
      name: 'dm-store',
    }
  )
);

// Listen for auth events to reset store on logout
authEvents.on('logout', () => {
  console.log('[DMStore] Logout event received, resetting store');
  useDMStore.getState().resetStore();
});