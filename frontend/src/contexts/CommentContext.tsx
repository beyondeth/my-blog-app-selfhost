'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface CommentContextType {
  // 답글 펼침 상태 저장 (commentId -> boolean)
  expandedReplies: Record<string, boolean>;
  
  // 답글 펼침 상태 토글
  toggleReplies: (commentId: string) => void;
  
  // 답글 펼침 상태 설정
  setRepliesExpanded: (commentId: string, expanded: boolean) => void;
  
  // 특정 댓글의 답글 상태 가져오기
  isRepliesExpanded: (commentId: string) => boolean;
}

const CommentContext = createContext<CommentContextType | undefined>(undefined);

export function CommentProvider({ children }: { children: ReactNode }) {
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  
  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };
  
  const setRepliesExpanded = (commentId: string, expanded: boolean) => {
    setExpandedReplies(prev => ({
      ...prev,
      [commentId]: expanded
    }));
  };
  
  const isRepliesExpanded = (commentId: string) => {
    return expandedReplies[commentId] || false;
  };
  
  return (
    <CommentContext.Provider value={{
      expandedReplies,
      toggleReplies,
      setRepliesExpanded,
      isRepliesExpanded
    }}>
      {children}
    </CommentContext.Provider>
  );
}

export function useCommentStore() {
  const context = useContext(CommentContext);
  if (context === undefined) {
    throw new Error('useCommentStore must be used within a CommentProvider');
  }
  return context;
}