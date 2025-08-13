import { create } from 'zustand';

interface CommentStore {
  // 답글 펼침 상태 저장 (commentId -> boolean)
  expandedReplies: Record<string, boolean>;
  
  // 답글 펼침 상태 토글
  toggleReplies: (commentId: string) => void;
  
  // 답글 펼침 상태 설정
  setRepliesExpanded: (commentId: string, expanded: boolean) => void;
  
  // 특정 댓글의 답글 상태 가져오기
  isRepliesExpanded: (commentId: string) => boolean;
}

export const useCommentStore = create<CommentStore>((set, get) => ({
  expandedReplies: {},
  
  toggleReplies: (commentId: string) => set((state) => ({
    expandedReplies: {
      ...state.expandedReplies,
      [commentId]: !state.expandedReplies[commentId]
    }
  })),
  
  setRepliesExpanded: (commentId: string, expanded: boolean) => set((state) => ({
    expandedReplies: {
      ...state.expandedReplies,
      [commentId]: expanded
    }
  })),
  
  isRepliesExpanded: (commentId: string) => {
    return get().expandedReplies[commentId] || false;
  }
}));