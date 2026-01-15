import {
  CommunitySidebarWidgetEntryType,
  CommunitySidebarWidgetType,
} from "../enums";

export interface CommunitySidebarWidgetEntryDto {
  readonly id: string;
  readonly entryType: CommunitySidebarWidgetEntryType;
  readonly label?: string;
  readonly body?: string;
  readonly linkUrl?: string;
  readonly imageUrl?: string;
  readonly imageAlt?: string;
  readonly ctaLabel?: string;
  readonly ctaUrl?: string;
  readonly location?: string;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly targetCommunity?: {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly iconUrl?: string | null;
  } | null;
  readonly metadata?: Record<string, any>;
  readonly orderIndex: number;
}

export interface CommunitySidebarWidgetDto {
  readonly id: string;
  readonly type: CommunitySidebarWidgetType;
  readonly title?: string;
  readonly description?: string;
  readonly isEnabled: boolean;
  readonly orderIndex: number;
  readonly metadata?: Record<string, any>;
  readonly items: CommunitySidebarWidgetEntryDto[];
}
