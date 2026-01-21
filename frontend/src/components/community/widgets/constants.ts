import type { CommunitySidebarWidgetType } from '@/types/community';

export const SINGLETON_WIDGET_TYPES: readonly CommunitySidebarWidgetType[] = [
  'bookmarks',
  'post_flairs',
  'community_list',
  'calendar',
  'community_rules',

] as const;

export const MAX_WIDGET_ITEMS = 10;
export const BOOKMARK_LABEL_MAX = 30;
export const BOOKMARK_BODY_MAX = 120;
export const BOOKMARK_BODY_PREVIEW_MAX = 80;
