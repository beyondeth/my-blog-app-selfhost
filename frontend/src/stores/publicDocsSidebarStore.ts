import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface PublicDocsSidebarState {
  isOpen: boolean;
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const usePublicDocsSidebarStore = create<PublicDocsSidebarState>()(
  devtools(
    (set) => ({
      isOpen: true,
      toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })),
      openSidebar: () => set({ isOpen: true }),
      closeSidebar: () => set({ isOpen: false }),
      setSidebarOpen: (open) => set({ isOpen: open }),
    }),
    {
      name: 'public-docs-sidebar-store',
    }
  )
);
