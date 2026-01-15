/**
 * 커뮤니티 사이드바 위젯 타입 Enum
 */
export const CommunitySidebarWidgetType = {
  TEXT: "text",
  BUTTONS: "buttons",
  IMAGES: "images",
  COMMUNITY_LIST: "community_list",
  CALENDAR: "calendar",
  POST_FLAIRS: "post_flairs",
  BOOKMARKS: "bookmarks",
  COMMUNITY_RULES: "community_rules",
  POST_FLAIR_LIST: "post_flair_list",
} as const;

export type CommunitySidebarWidgetType =
  (typeof CommunitySidebarWidgetType)[keyof typeof CommunitySidebarWidgetType];

/**
 * 위젯 항목 타입 Enum
 */
export const CommunitySidebarWidgetEntryType = {
  TEXT: "text",
  LINK: "link",
  BOOKMARK: "bookmark",
  IMAGE: "image",
  COMMUNITY: "community",
  EVENT: "event",
} as const;

export type CommunitySidebarWidgetEntryType =
  (typeof CommunitySidebarWidgetEntryType)[keyof typeof CommunitySidebarWidgetEntryType];
