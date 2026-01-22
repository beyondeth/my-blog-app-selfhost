'use client';

import React from 'react';
import NoticeItem from './NoticeItem';
import type { Post } from '@/types';
import { Speaker } from 'lucide-react';

interface NoticeBoardProps {
  notices: Post[];
  communitySlug: string;
}

export default function NoticeBoard({ notices, communitySlug }: NoticeBoardProps) {
  if (!notices || notices.length === 0) return null;

  return (
    <div className="mb-6 max-w-[780px] mx-auto">
      {/* <div className="flex items-center gap-2 mb-3 px-1">
        <Speaker className="w-4 h-4 text-blue-500" />
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">
          공지사항
        </h3>
      </div> */}
      
      <div className="space-y-2">
        {notices.map((notice) => (
          <NoticeItem 
            key={notice.id} 
            notice={notice} 
            postUrlOverride={`/c/${communitySlug}/comments/${notice.slug}`}
          />
        ))}
      </div>
    </div>
  );
}
