'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Share2,
  Pin,
  PinOff,
  Lock,
  Unlock,
  AlertTriangle,
  MoreHorizontal,
  Flag,
  Bookmark,
  Edit,
  Trash2,
  Shield,
} from 'lucide-react';
import { FiEye, FiMessageCircle, FiUpload } from 'react-icons/fi';
import VoteButton from '@/components/ui/VoteButton';
import RelativeTime from '@/components/ui/RelativeTime';
import FlairBadge from '../FlairBadge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { CommunityPost, CommunityRoleType } from '@/types/community';
import { CommunityRole } from '@/types/community';

interface CommunityPostContentProps {
  post: CommunityPost;
  communitySlug: string;
  userRole?: CommunityRoleType;
  currentUserId?: string;
  onVote?: (voteType: 'upvote' | 'downvote') => void;
  isVotePending?: boolean;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
  onTogglePinClick?: (isPinned: boolean) => void;
  onToggleLockClick?: (isLocked: boolean) => void;
  onBookmarkClick?: () => void;
  onReportClick?: () => void;
  isBookmarked?: boolean;
  isModerationPending?: boolean;
  className?: string;
  variant?: 'card' | 'article';
}

/**
 * Community post detail content
 */
const CommunityPostContent = React.memo(function CommunityPostContent({
  post,
  communitySlug,
  userRole,
  currentUserId,
  onVote,
  isVotePending = false,
  onEditClick,
  onDeleteClick,
  onTogglePinClick,
  onToggleLockClick,
  onBookmarkClick,
  onReportClick,
  isBookmarked = false,
  isModerationPending = false,
  className,
  variant = 'card',
}: CommunityPostContentProps) {
  const formatCount = (count: number | undefined | null) => {
    const safeCount = count ?? 0;
    if (safeCount >= 1000000) {
      return `${(safeCount / 1000000).toFixed(1)}M`;
    }
    if (safeCount >= 1000) {
      const formatted = (safeCount / 1000).toFixed(1);
      return formatted.endsWith('.0') ? `${Math.floor(safeCount / 1000)}K` : `${formatted}K`;
    }
    return safeCount.toString();
  };

  const isAuthor = currentUserId && post.author?.id && String(currentUserId) === String(post.author.id);

  const canEdit = isAuthor;
  const canDelete = isAuthor || userRole === CommunityRole.OWNER || userRole === CommunityRole.MODERATOR;

  const canModerate =
    userRole === CommunityRole.OWNER ||
    userRole === CommunityRole.ADMIN ||
    userRole === CommunityRole.MODERATOR;

  const authorProfileHref = post.author?.username ? `/${post.author.username}` : undefined;
  const authorDisplayName = post.author?.username || 'Unknown user';
  const communityDisplayName = post.community?.name || post.communityName || communitySlug;
  const communityIconUrl = post.community?.iconUrl;
  const communityLink = `/c/${communitySlug}`;

  const getPostUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/c/${communitySlug}/comments/${post.slug}`;
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
    return `${siteUrl}/c/${communitySlug}/comments/${post.slug}`;
  };

  const handleShare = async () => {
    const url = getPostUrl();

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: `Post from c/${communitySlug}`,
          url,
        });
        return;
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          return;
        }
      }
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast.success('Post link copied.');
    } catch (error) {
      console.error('Share copy failed:', error);
      toast.error('Failed to copy the link.');
    }
  };

  const handleCopyContent = async () => {
    if (!isAuthor) return;

    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = post.content || '';

      const codeBlocks = tempDiv.querySelectorAll('pre code');
      codeBlocks.forEach((block) => {
        const codeText = block.textContent || '';
        const language = block.className.match(/language-(\w+)/)?.[1] || 'code';
        block.textContent = `\n[${language}]\n${codeText}\n`;
      });

      const preBlocks = tempDiv.querySelectorAll('pre:not(:has(code))');
      preBlocks.forEach((block) => {
        const text = block.textContent || '';
        block.textContent = `\n[code]\n${text}\n`;
      });

      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      const fullText = `${post.title}\n\n${textContent}\n\n${getPostUrl()}`;

      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(fullText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = fullText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast.success('Post content copied.');
    } catch (error) {
      console.error('Copy content failed:', error);
      toast.error('Failed to copy the content.');
    }
  };

  const handleScrollToComments = () => {
    const commentsSection = document.querySelector('[data-comment-section]');
    if (commentsSection) {
      commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const isArticle = variant === 'article';
  const containerPadding = isArticle ? '' : 'px-5';
  const topPadding = isArticle ? 'pt-4' : 'pt-5';
  const bodyPadding = isArticle ? 'py-6' : 'py-4';
  const tagPadding = isArticle ? 'pt-4 pb-0' : 'pb-4';

  return (
    <article
      className={cn(
        isArticle
          ? 'space-y-0'
          : 'bg-white dark:bg-[rgb(38,38,38)] rounded-xl border border-gray-200 dark:border-gray-700',
        className
      )}
    >
      <div className={cn(containerPadding, topPadding)}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href={communityLink} className="flex-shrink-0">
              <Avatar
                src={communityIconUrl}
                alt={communityDisplayName}
                fallback={communityDisplayName}
              />
            </Link>
            <div className="flex flex-col">
              <Link
                href={communityLink}
                className="text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-primary transition-colors"
              >
                c/{communityDisplayName}
              </Link>
              <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                {authorProfileHref ? (
                  <Link href={authorProfileHref} className="hover:underline">
                    {authorDisplayName}
                  </Link>
                ) : (
                  <span>{authorDisplayName}</span>
                )}
                <span className="text-gray-300">·</span>
                <RelativeTime date={post.createdAt} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center justify-center p-1 rounded-full text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100 transition-colors"
              title="Share"
            >
              <FiUpload className="w-5 h-5" />
            </button>
            {isAuthor && (
              <button
                onClick={handleCopyContent}
                className="flex items-center justify-center p-1 rounded-full text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100 transition-colors"
                title="Copy post content"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleShare}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onBookmarkClick}>
                  <Bookmark className={cn("mr-2 h-4 w-4", isBookmarked && "fill-current")} />
                  {isBookmarked ? 'Remove bookmark' : 'Bookmark'}
                </DropdownMenuItem>
                {canEdit && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onEditClick}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={onDeleteClick}
                    className="text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
                {canModerate && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Moderation
                    </div>
                    <DropdownMenuItem
                      onClick={() => onTogglePinClick?.(!post.isPinned)}
                      disabled={isModerationPending}
                    >
                      {post.isPinned ? (
                        <>
                          <PinOff className="mr-2 h-4 w-4" />
                          Unpin post
                        </>
                      ) : (
                        <>
                          <Pin className="mr-2 h-4 w-4" />
                          Pin post
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onToggleLockClick?.(!post.isLocked)}
                      disabled={isModerationPending}
                    >
                      {post.isLocked ? (
                        <>
                          <Unlock className="mr-2 h-4 w-4" />
                          Unlock comments
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          Lock comments
                        </>
                      )}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-red-600 dark:text-red-400"
                  onClick={onReportClick}
                >
                  <Flag className="mr-2 h-4 w-4" />
                  Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {(post.isPinned || post.isLocked || post.isNsfw || post.isSpoiler) && (
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {post.isPinned && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                <Pin className="w-3.5 h-3.5" />
                Pinned post
              </span>
            )}
            {post.isLocked && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full">
                <Lock className="w-3.5 h-3.5" />
                Comments locked
              </span>
            )}
            {post.isNsfw && (
              <span className="px-2.5 py-1 text-xs font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-full">
                NSFW
              </span>
            )}
            {post.isSpoiler && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full">
                <AlertTriangle className="w-3.5 h-3.5" />
                Spoiler
              </span>
            )}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
              {post.title}
            </h1>
            {post.flair && (
              <FlairBadge flair={post.flair} size="md" className="mt-3" />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-600 dark:text-gray-300 mb-8 pt-2 pb-2 border-t border-b border-gray-400 dark:border-gray-500">
            <div className="flex flex-wrap items-center gap-6 pl-1">
                <div className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-300 font-medium">
                  <FiEye className="w-5 h-5" />
                  <span>{(post.viewCount || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <VoteButton
                    upvoteCount={post.upvoteCount ?? 0}
                    downvoteCount={post.downvoteCount ?? 0}
                    userVote={post.userVote ?? null}
                    onVote={(type) => onVote?.(type)}
                    disabled={isVotePending}
                    layout="horizontal"
                    compact
                    showScore
                    displayMode="separated"
                  />
                  <button
                    onClick={handleScrollToComments}
                    className="flex items-center space-x-1 px-2 py-1 rounded-full text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100 transition-colors font-medium"
                    title="View comments"
                  >
                    <FiMessageCircle className="w-5 h-5" />
                    <span>{post.commentCount ?? 0}</span>
                  </button>
                </div>
            </div>
          </div>
        </div>
      </div>

      <div className={cn(containerPadding, bodyPadding)}>
        <div
          className="prose prose-gray dark:prose-invert max-w-none
            prose-headings:font-semibold prose-headings:text-gray-900 dark:prose-headings:text-gray-100
            prose-p:text-gray-700 dark:prose-p:text-gray-300
            prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
            prose-img:rounded-lg prose-img:my-4 prose-img:mx-0
            prose-code:text-sm prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
            prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950 prose-pre:text-gray-100
            prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600
            prose-ul:list-disc prose-ol:list-decimal"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </div>

      {(post.thumbnailImageUrl || post.thumbnailUrl) && (
        <div className={cn(containerPadding, isArticle ? 'pb-0 pt-4' : 'pb-4')}>
          <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.thumbnailImageUrl || post.thumbnailUrl}
              alt={post.title}
              className="w-full h-auto max-h-[600px] object-contain"
            />
          </div>
        </div>
      )}

      {post.tags && post.tags.length > 0 && (
        <div className={cn('flex flex-wrap gap-2', containerPadding, tagPadding)}>
          {post.tags.map((tag, index) => (
            <span
              key={index}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
});

export default CommunityPostContent;
