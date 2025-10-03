import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * 왼쪽 사이드바 토글 상태 관리 스토어
 * 미디엄 스타일의 햄버거 메뉴로 사이드바 열기/닫기 기능
 */

interface SidebarState {
  // 사이드바 열림/닫힘 상태
  isOpen: boolean;
}

interface SidebarActions {
  // 사이드바 토글
  toggleSidebar: () => void;

  // 사이드바 열기
  openSidebar: () => void;

  // 사이드바 닫기
  closeSidebar: () => void;

  // 사이드바 상태 설정
  setSidebarOpen: (open: boolean) => void;
}

type SidebarStore = SidebarState & SidebarActions;

const initialState: SidebarState = {
  isOpen: true, // 기본적으로 열려있음 (데스크톱)
};

export const useSidebarStore = create<SidebarStore>()(
  devtools(
    (set) => ({
      ...initialState,

      toggleSidebar: () =>
        set((state) => ({ isOpen: !state.isOpen })),

      openSidebar: () =>
        set({ isOpen: true }),

      closeSidebar: () =>
        set({ isOpen: false }),

      setSidebarOpen: (open) =>
        set({ isOpen: open }),
    }),
    {
      name: 'sidebar-store',
    }
  )
);
