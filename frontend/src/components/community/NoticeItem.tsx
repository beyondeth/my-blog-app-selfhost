'use client';

import React from 'react';
import Link from 'next/link';
import { Megaphone, Pin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Post } from '@/types';

interface NoticeItemProps {
  notice: Post;
  className?: string;
  postUrlOverride?: string;
}

export default function NoticeItem({ notice, className, postUrlOverride }: NoticeItemProps) {
  const postUrl = postUrlOverride || (notice.blog ? `/@${notice.blog.slug}/${notice.slug}` : `/posts/${notice.slug}`);
  
  return (
    <Link 
      href={postUrl}
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg transition-all duration-200",
        "bg-blue-50/50 hover:bg-blue-100/50 border border-blue-100/50 hover:border-blue-200",
        "dark:bg-blue-900/10 dark:hover:bg-blue-900/20 dark:border-blue-800/30 dark:hover:border-blue-800/50",
        className
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
          <Megaphone className="w-4 h-4" strokeWidth={2.5} />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white dark:bg-blue-500">
            공지
          </span>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {notice.title}
          </h3>
        </div>
        
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mb-1">
          {notice.excerpt || "내용 미리보기가 없습니다."}
        </p>
        
        <div className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
          <span>{notice.author?.username || '관리자'}</span>
          <span>•</span>
          <span>
            {formatDistanceToNow(new Date(notice.createdAt), {
              addSuffix: true,
              locale: ko,
            })}
          </span>
        </div>
      </div>
    </Link>
  );
}
