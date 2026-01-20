import type { CommunitySidebarWidgetType } from '@/types/community';

export const SINGLETON_WIDGET_TYPES: readonly CommunitySidebarWidgetType[] = [
  'bookmarks',
  'post_flairs',
  'community_list',
  'calendar',
  'community_rules',

] as const;

export const MAX_WIDGET_ITEMS = 10;
