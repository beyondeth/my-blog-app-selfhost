import type { CommunitySidebarWidget, CommunitySidebarWidgetType } from '@/types/community';
import { widgetTypeOptions } from './WidgetEditorForm';

type WidgetLabelMap = Record<CommunitySidebarWidgetType, string>;

const widgetLabelMap = widgetTypeOptions.reduce<WidgetLabelMap>((acc, option) => {
  acc[option.type] = option.label;
  return acc;
}, {} as WidgetLabelMap);

const legacyTitleTypeMap: Partial<Record<string, CommunitySidebarWidgetType>> = {
  '새 공지': 'text',
  공지: 'text',
  '바로가기': 'buttons',
  '바로가기 링크': 'buttons',
  '이미지 모듈': 'images',
  '추천 이미지': 'images',
  '커뮤니티 추천 편집': 'community_list',
  '커뮤니티 추천': 'community_list',
  '캘린더 편집': 'calendar',
  '커뮤니티 일정': 'calendar',
  '이벤트': 'calendar',
  '말머리 하이라이트 편집': 'post_flairs',
  '하이라이트 말머리': 'post_flairs',
  '플레어 하이라이트 편집': 'post_flairs',
  '하이라이트 플레어': 'post_flairs',
  '북마크 편집': 'bookmarks',
  '커뮤니티 규칙 편집': 'community_rules',
  '말머리 목록 편집': 'post_flairs',
  '말머리 목록': 'post_flairs',
  '플레어 목록 편집': 'post_flairs',
  '플레어 목록': 'post_flairs',
};

export function getWidgetLabel(type: CommunitySidebarWidgetType) {
  return widgetLabelMap[type] ?? 'Widget';
}

export function resolveWidgetTitle(widget: CommunitySidebarWidget) {
  const rawTitle = widget.title?.trim();
  if (rawTitle) {
    const remapped = legacyTitleTypeMap[rawTitle as keyof typeof legacyTitleTypeMap];
    if (remapped) {
      return getWidgetLabel(remapped);
    }
    if (rawTitle.endsWith(' 편집')) {
      const base = rawTitle.replace(/\s*편집$/, '').trim();
      const baseRemap = legacyTitleTypeMap[base as keyof typeof legacyTitleTypeMap];
      if (baseRemap) {
        return getWidgetLabel(baseRemap);
      }
    }
    return rawTitle;
  }
  return getWidgetLabel(widget.type);
}
