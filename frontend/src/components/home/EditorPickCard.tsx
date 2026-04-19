import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Avatar } from '@/components/ui/avatar';
import { shouldDisableOptimization } from '@/utils/imageUtils';
import type { Post } from '@/types';

interface EditorPickCardProps {
  post: any; // Using any to match existing usage in page.tsx, preferably type this strictly if possible
  priority?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export function EditorPickCard({ post, priority = false, onClick, className = '' }: EditorPickCardProps) {
  const author = post?.author;
  const authorName = author?.username || author?.email || 'Anonymous';
  const authorImage = author?.profileImage || null;
  const postImage = post?.thumbnail || post?.images?.[0] || null;
  const ctaLabel = 'Open';
  const emptyExcerpt = 'No summary is available for this post.';
  
  const href = post?.blog?.slug
    ? `/${post.blog.slug}/${post.slug || post.id}`
    : '/c';

    // Wrapper classes handled by parent for mobile/desktop flexibility?
    // Actually, the internal padding/layout depends on whether there is an image.

  if (!post) return null;

  if (postImage) {
    return (
      <div className={`relative h-full w-full overflow-hidden ${className}`}>
        <Image
          src={postImage}
          alt={post.title || 'Editor pick'}
          fill
          sizes="(max-width: 640px) 85vw, 780px"
          className="object-cover transition-transform duration-500 hover:scale-105"
          priority={priority}
          unoptimized={shouldDisableOptimization(postImage)}
        />
        <div className="absolute inset-x-0 bottom-0 z-0 h-40 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        
        <div className="absolute left-6 top-6 z-10 rounded-full bg-[#C1121F] px-3.5 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-white dark:bg-[#E11D48]">
          EDITOR&apos;S PICK
        </div>

        <div className="absolute inset-x-0 bottom-16 z-10 px-6">
          <h3 className="text-xl font-semibold text-white sm:text-2xl line-clamp-2">
            {post.title}
          </h3>
          <div className="mt-3 flex items-center gap-2 text-sm text-white/85">
            <Avatar
              src={authorImage}
              alt={authorName}
              size="xs"
              className="ring-1 ring-white/60 bg-white/20"
            />
            <span className="font-medium">{authorName}</span>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-4 z-10 flex justify-between items-center px-6">
           <div /> {/* Spacer for alignment if needed, existing code used grid */}
           <div className="ml-auto">
             <Link
               href={href}
               onClick={(e) => e.stopPropagation()}
               className="rounded-full bg-[#111827] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0B1220] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F87171] dark:bg-[#0B0F14] dark:hover:bg-[#111827] dark:focus-visible:ring-[#F87171]"
             >
               {ctaLabel}
             </Link>
           </div>
        </div>
        
        {/* Click overlay for the whole card */}
        <Link 
            href={href} 
            className="absolute inset-0 z-0" 
            aria-label={`View ${post.title}`}
            onClick={onClick}
        />
      </div>
    );
  }

  // Text-only version
  return (
    <div className={`flex h-full flex-col pt-16 pb-4 px-8 relative ${className}`}>
        {/* Editor's pick label for text version? Original had it outside or specific place */}
        <div className="absolute left-6 top-6 inline-flex items-center rounded-full bg-[#C1121F] px-3.5 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-white dark:bg-[#E11D48]">
            EDITOR&apos;S PICK
        </div>

      <div className="space-y-3">
        <h3 className="text-2xl font-semibold tracking-[-0.01em] leading-tight sm:text-3xl line-clamp-2">
          {post.title}
        </h3>
        <p
          className="text-[15px] text-[#3F4A59] dark:text-[#E1E8F0] leading-relaxed"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {post.editorPickExcerpt || post.excerpt || emptyExcerpt}
        </p>
      </div>
      <div className="mt-auto space-y-4">
        <div className="flex items-center gap-2 text-xs text-[#4B5563] dark:text-[#A9B4C2]">
          <Avatar
            src={authorImage}
            alt={authorName}
            size="xs"
            className="ring-1 ring-black/10 dark:ring-white/20"
          />
          <span className="font-medium">{authorName}</span>
        </div>
        
        <div className="flex justify-end">
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="rounded-full border border-[#111827] px-4 py-2 text-sm font-semibold text-[#111827] transition-colors hover:bg-[#111827] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F87171] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-[#E6EDF3] dark:text-[#E6EDF3] dark:hover:bg-[#E6EDF3] dark:hover:text-[#0E141B] dark:focus-visible:ring-[#F87171] dark:focus-visible:ring-offset-[#0E141B]"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>

       {/* Click overlay for the whole card */}
       <Link 
            href={href} 
            className="absolute inset-0 z-0" 
            aria-label={`View ${post.title}`}
            onClick={onClick}
        />
    </div>
  );
}
