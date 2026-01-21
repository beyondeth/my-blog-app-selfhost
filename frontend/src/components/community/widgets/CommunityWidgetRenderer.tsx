'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink, Bookmark as BookmarkIcon, Calendar, Users } from 'lucide-react';
import MarkdownRenderer from '@/components/legal/MarkdownRenderer';
import FlairBadge from '@/components/community/FlairBadge';
import { cn } from '@/lib/utils';
import type {
  Community,
  CommunitySidebarWidget,
  CommunitySidebarWidgetEntry,
} from '@/types/community';
import CommunityRulesList from '../CommunityRulesList';
import FlairsList from '../FlairsList';
import { resolveWidgetTitle } from './titleUtils';
import { useCommunityRules } from '@/hooks/community/useCommunityRules';
import { useCommunityFlairs } from '@/hooks/community/useCommunityFlairs';
import { BOOKMARK_BODY_PREVIEW_MAX } from './constants';

interface CommunityWidgetRendererProps {
  community: Community;
  widget: CommunitySidebarWidget;
  onFlairFilter?: (flairId: string | null) => void;
  selectedFlairId?: string | null;
}

const WidgetCard = ({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <section className="bg-white dark:bg-[rgb(38,38,38)] border border-gray-200 dark:border-gray-700 rounded-3xl p-4 shadow-sm shadow-gray-100/50 dark:shadow-none">
    {(title || description) && (
      <header className="mb-3">
        {title && <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>}
        {description && (
          <p className="text-xs text-gray-500 dark:text-[#C7D1DD] mt-1">{description}</p>
        )}
      </header>
    )}
    {children}
  </section>
);

const formatDate = (value: string | undefined, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const normalizePreviewText = (value?: string | null) => {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
};

const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
};

const renderLinkList = (items: CommunitySidebarWidgetEntry[], variant: 'link' | 'bookmark') => (
  <div className="space-y-2">
    {items
      .filter((item) => !!item.linkUrl)
      .map((item) => {
        const bodyText =
          variant === 'bookmark'
            ? truncateText(normalizePreviewText(item.body), BOOKMARK_BODY_PREVIEW_MAX)
            : '';
        const showBody = variant === 'bookmark' && !!bodyText;
        return (
          <a
            key={item.id}
            href={item.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm transition hover:bg-gray-50 dark:hover:bg-gray-800',
              showBody ? 'items-start' : 'items-center',
              variant === 'bookmark' && 'bg-gray-50 dark:bg-gray-800/40',
            )}
          >
            <div className="flex min-w-0 flex-1 items-start gap-2">
              {variant === 'bookmark' && (
                <BookmarkIcon className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <span className="font-medium text-gray-900 dark:text-gray-100 truncate block">
                  {item.label}
                </span>
                {showBody && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-[#C7D1DD]">
                    {bodyText}
                  </p>
                )}
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400 dark:text-[#C7D1DD] flex-shrink-0 mt-0.5" />
          </a>
        );
      })}
  </div>
);

const CommunityWidgetRenderer: React.FC<CommunityWidgetRendererProps> = ({
  community,
  widget,
  onFlairFilter,
  selectedFlairId,
}) => {
  // Always call hooks at the top level
  // Only fetch rules if the widget type matches
  const isRulesWidget = widget?.type === 'community_rules';
  const { data: latestRules } = useCommunityRules(community.slug); // react-query hook handles caching
  const { data: latestFlairs } = useCommunityFlairs(community.slug);

  if (!widget) return null;

  const title = resolveWidgetTitle(widget);

  switch (widget.type) {
    // ... (case text ~ calendar unchanged)

    // ~~~
    // Need to skip to post_flairs case.
    // I will split this into two simpler Replacements to avoid large context matching error.
    // First, insert the hook call.

    case 'text': {
      const content = widget.metadata?.content as string | undefined;
      if (!content) return null;
      const format = widget.metadata?.format === 'markdown' ? 'markdown' : 'plain';
      return (
        <WidgetCard title={title} description={widget.description}>
          {format === 'markdown' ? (
            <MarkdownRenderer content={content} />
          ) : (
            <p className="text-sm text-gray-700 dark:text-[#C7D1DD] whitespace-pre-wrap leading-relaxed">
              {content}
            </p>
          )}
        </WidgetCard>
      );
    }
    case 'buttons':
      if (!widget.items.length) return null;
      return (
        <WidgetCard title={title} description={widget.description}>
          {renderLinkList(widget.items, 'link')}
        </WidgetCard>
      );
    case 'bookmarks':
      if (!widget.items.length) return null;
      return (
        <WidgetCard title={title} description={widget.description}>
          {renderLinkList(widget.items, 'bookmark')}
        </WidgetCard>
      );
    case 'images':
      if (!widget.items.length) return null;
      return (
        <WidgetCard title={title} description={widget.description}>
          <div className="space-y-4">
            {widget.items.map((item) => {
              if (!item.imageUrl) return null;
              const imageBlock = (
                <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 transition bg-gray-50 dark:bg-gray-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.imageAlt || item.label || 'community widget image'}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                  {item.label && (
                    <p className="absolute left-4 top-3 text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      {item.label}
                    </p>
                  )}
                </div>
              );

              return (
                <div key={item.id} className="space-y-2">
                  {item.linkUrl ? (
                    <Link
                      href={item.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:shadow-lg transition"
                    >
                      {imageBlock}
                    </Link>
                  ) : (
                    imageBlock
                  )}
                  {item.body && (
                    <p className="text-xs text-gray-500 dark:text-[#C7D1DD]">
                      {item.body}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </WidgetCard>
      );
    case 'community_list':
      if (!widget.items.length) return null;
      return (
        <WidgetCard title={title} description={widget.description}>
          <div className="space-y-3">
            {widget.items.map((item) => {
              const target = item.targetCommunity || undefined;
              if (!target) return null;
              return (
                <Link
                  key={item.id}
                  href={`/c/${target.slug}`}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:border-gray-300 dark:hover:border-gray-600 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                      {target.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={target.iconUrl} alt={target.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {target.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-[#C7D1DD] truncate">
                        c/{target.slug}
                      </p>
                    </div>
                  </div>
                  {item.body && (
                    <p className="text-xs text-gray-500 dark:text-[#C7D1DD]">
                      {item.body}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </WidgetCard>
      );
    case 'calendar':
      if (!widget.items.length) return null;
      const sortedEvents = [...widget.items].sort((a, b) => {
        const dateA = a.startsAt ? new Date(a.startsAt).getTime() : 0;
        const dateB = b.startsAt ? new Date(b.startsAt).getTime() : 0;
        return dateA - dateB;
      });
      return (
        <WidgetCard title={title} description={widget.description}>
          <ul className="space-y-3">
            {sortedEvents.map((event) => (
              <li key={event.id} className="flex gap-3">
                <div className="flex-shrink-0">
                  <Calendar className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {event.label}
                  </p>
                  {event.startsAt && (
                    <div className="text-xs text-gray-600 dark:text-[#C7D1DD] space-y-1 mt-1">
                      <div className="flex gap-2">
                        <span className="font-semibold text-gray-700 dark:text-[#C7D1DD]">시작</span>
                        <span className="text-gray-600 dark:text-[#C7D1DD]">
                          {formatDate(event.startsAt)}
                        </span>
                      </div>
                      {event.endsAt && (
                        <div className="flex gap-2">
                          <span className="font-semibold text-gray-700 dark:text-[#C7D1DD]">종료</span>
                          <span className="text-gray-600 dark:text-[#C7D1DD]">
                            {formatDate(event.endsAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {event.location && (
                    <p className="text-xs text-gray-500 dark:text-[#C7D1DD] mt-1">
                      <span className="font-semibold text-gray-600 dark:text-[#C7D1DD]">장소</span>{' '}
                      {event.location}
                    </p>
                  )}
                  {event.body && (
                    <p className="text-xs text-gray-500 dark:text-[#C7D1DD] mt-1">{event.body}</p>
                  )}
                  {event.linkUrl && (
                    <Link
                      href={event.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 mt-2"
                    >
                      이벤트 링크
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </WidgetCard>
      );
    case 'post_flairs': {
      const showAll = Boolean(widget.metadata?.showAll ?? false); // Legacy highlight widgets default to false

      // Case 1: Show All (Unified List Mode)
      if (showAll) {
        // Use latest fetched flairs first
        const flairs = latestFlairs || community.flairs || [];
        
        if (!flairs.length && widget.type === 'post_flairs' && !community.userMembership?.isMember) {
           // ...
        }
      
        const limit = typeof widget.metadata?.limit === 'number' 
          ? widget.metadata.limit 
          : 10;

        return (
          <WidgetCard title={title} description={widget.description}>
            <FlairsList
              flairs={flairs}
              onFlairClick={onFlairFilter}
              selectedFlairId={selectedFlairId}
              showHeader={false}
              limit={limit}
            />
          </WidgetCard>
        );
      }

      // Case 2: Highlight Mode (Specific Flairs)
      const flairIds = Array.isArray(widget.metadata?.flairIds)
        ? (widget.metadata?.flairIds as string[])
        : [];
      
      const allFlairs = latestFlairs || community.flairs || [];
      const highlightedFlairs =
        allFlairs.filter((flair) => flairIds.includes(flair.id)) || [];
        
      if (!highlightedFlairs.length) return null;
      return (
        <WidgetCard title={title} description={widget.description}>
          <div className="flex flex-wrap gap-2">
            {highlightedFlairs.map((flair) => {
              const isSelected = flair.id === selectedFlairId;
              return (
                <button
                  key={flair.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onFlairFilter?.(isSelected ? null : flair.id)}
                  className={cn(
                    'rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 dark:focus-visible:outline-gray-500 transition relative',
                    !onFlairFilter && 'cursor-default',
                  )}
                >
                  {isSelected && (
                    <span className="absolute -top-1 -right-1 z-10 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#4d68ff] shadow ring-1 ring-[#4d68ff]/60">
                      ✓
                    </span>
                  )}
                  <FlairBadge
                    flair={flair}
                    size="sm"
                    className={cn(
                      'pointer-events-none',
                      isSelected && 'ring-2 ring-offset-1 ring-blue-500/50'
                    )}
                  />
                </button>
              );
            })}
          </div>
        </WidgetCard>
      );
    }
    case 'community_rules': {
      const limit =
        typeof widget.metadata?.limit === 'number'
          ? widget.metadata.limit
          : Number(widget.metadata?.limit) || community.rules?.length || 3;
      
      // Use latest fetched rules first, fallback to community.rules (SSR/Initial data)
      const rules = latestRules || community.rules || [];
      
      if (!rules.length) return null;
      // Default to collapsed unless explicitly set otherwise (though we removed the toggle, defaulting to collapsed enables the "See More" behavior)
      const showNumbering = widget.metadata?.showNumbering !== false;
      return (
        <WidgetCard title={title} description={undefined}>
          <CommunityRulesList
            rules={rules}
            maxCollapsed={limit || 3}
            defaultExpanded={false}
            showHeader={false}
            showNumbering={showNumbering}
          />
        </WidgetCard>
      );
    }

    default:
      return null;
  }
};

export default CommunityWidgetRenderer;
