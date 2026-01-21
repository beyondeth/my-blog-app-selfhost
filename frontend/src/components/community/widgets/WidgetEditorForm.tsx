'use client';

import { useState, useEffect } from 'react';
import { Loader2, Check } from 'lucide-react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  SETTINGS_INPUT_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
} from '@/app/settings/theme';
import type {
  Community,
  CommunitySidebarWidget,
  CommunitySidebarWidgetType,
  CommunityWidgetItemInput,
  UpdateCommunityWidgetInput,
  CreateCommunityWidgetInput,
} from '@/types/community';
import RulesManagerPanel from '@/components/community/settings/RulesManagerPanel';
import FlairsManagerPanel from '@/components/community/settings/FlairsManagerPanel';
import { useCommunities } from '@/hooks/community';
import {
  BOOKMARK_BODY_MAX,
  BOOKMARK_BODY_PREVIEW_MAX,
  BOOKMARK_LABEL_MAX,
  MAX_WIDGET_ITEMS,
} from './constants';

export const widgetTypeOptions: Array<{
  type: CommunitySidebarWidgetType;
  label: string;
  description: string;
}> = [
  { type: 'text', label: '텍스트', description: '공지, 가이드라인' },
  { type: 'buttons', label: '버튼', description: '링크 버튼 최대 10개' },
  { type: 'bookmarks', label: '북마크', description: '빠른 링크 목록' },
  { type: 'images', label: '이미지', description: '최대 10장의 이미지' },
  { type: 'community_list', label: '추천 커뮤니티', description: '다른 커뮤니티 홍보' },
  { type: 'calendar', label: '캘린더', description: '이벤트 일정' },
  { type: 'post_flairs', label: '말머리', description: '게시판의 말머리(토픽)를 필터링할 수 있는 위젯입니다.' },
  { type: 'community_rules', label: '커뮤니티 규칙', description: '규칙을 사이드바 위젯으로 표시' },
];

interface WidgetEditorFormProps {
  community: Community;
  widget: CommunitySidebarWidget;
  onSave: (dto: UpdateCommunityWidgetInput) => Promise<void>;
  onUploadImage: (index: number, file: File) => Promise<string>;
}

export default function WidgetEditorForm({
  community,
  widget,
  onSave,
  onUploadImage,
}: WidgetEditorFormProps) {
  const [draft, setDraft] = useState<UpdateCommunityWidgetInput>(() => convertWidgetToDraft(widget));
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    setDraft(convertWidgetToDraft(widget));
    setFormError(null);
    setIsSuccess(false);
  }, [widget]);

  const handleFieldChange = (field: keyof UpdateCommunityWidgetInput, value: any) => {
    setFormError(null);
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index: number, value: CommunityWidgetItemInput) => {
    setFormError(null);
    setDraft((prev) => {
      const items = Array.isArray(prev.items) ? [...prev.items] : [];
      items[index] = value;
      return { ...prev, items };
    });
  };

  const addItem = (value: CommunityWidgetItemInput) => {
    setFormError(null);
    setDraft((prev) => {
      const items = Array.isArray(prev.items) ? [...prev.items] : [];
      if (items.length >= MAX_WIDGET_ITEMS) {
        return prev;
      }
      items.push(value);
      return { ...prev, items };
    });
  };

  const removeItem = (index: number) => {
    setFormError(null);
    setDraft((prev) => {
      const items = Array.isArray(prev.items) ? [...prev.items] : [];
      items.splice(index, 1);
      return { ...prev, items };
    });
  };

  const handleSave = async () => {
    const validationMessage = validateWidgetDraft(widget.type, draft);
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }
    setIsSaving(true);
    setIsSuccess(false);
    try {
      const payload = prepareWidgetPayloadForSave(widget.type, draft);
      await onSave(payload);
      setDraft(payload);
      setFormError(null);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);
    } catch (error: any) {
      setFormError(error?.message || '위젯을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 text-gray-900 dark:text-gray-100">
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs uppercase tracking-wide text-gray-500 dark:text-white">제목</Label>
          <span className="text-xs text-gray-500">{(draft.title ?? '').length}/30</span>
        </div>
        <Input
          className={cn(SETTINGS_INPUT_CLASS, 'mt-1')}
          value={draft.title ?? ''}
          onChange={(event) => handleFieldChange('title', event.target.value.slice(0, 30))}
          placeholder="위젯 제목"
        />
      </div>

      <WidgetTypeSpecificForm
        community={community}
        widget={widget}
        draft={draft}
        onChange={handleFieldChange}
        onItemChange={handleItemChange}
        onAddItem={addItem}
        onRemoveItem={removeItem}
        onUploadImage={onUploadImage}
      />

      {formError && (
        <p className="text-xs text-red-500">{formError}</p>
      )}
      
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch
              id="widget-toggle"
              checked={draft.isEnabled ?? widget.isEnabled}
              onCheckedChange={(checked) => handleFieldChange('isEnabled', checked)}
            />
            <div>
              <Label htmlFor="widget-toggle" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                이 위젯을 사이드바에 표시
              </Label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                비활성화 시 설정은 유지되지만 사용자에게 보이지 않습니다
              </p>
            </div>
          </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isSuccess}
          className={cn(
            SETTINGS_PRIMARY_BUTTON_CLASS,
            'w-auto min-w-[80px] transition-all duration-200',
            isSuccess 
              ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 border-transparent' 
              : 'dark:bg-[#4d68ff] dark:hover:bg-[#3c52c7]'
          )}
        >
          {isSaving ? (
            <span className="mr-2 h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
          ) : isSuccess ? (
            <Check className="mr-2 h-4 w-4" />
          ) : null}
          {isSuccess ? '저장됨' : '저장'}
        </button>
        </div>
      </div>
    </div>
  );
}

interface WidgetTypeSpecificFormProps {
  community: Community;
  widget: CommunitySidebarWidget;
  draft: UpdateCommunityWidgetInput;
  onChange: (field: keyof UpdateCommunityWidgetInput, value: any) => void;
  onItemChange: (index: number, value: CommunityWidgetItemInput) => void;
  onAddItem: (value: CommunityWidgetItemInput) => void;
  onRemoveItem: (index: number) => void;
  onUploadImage: (index: number, file: File) => Promise<string>;
}

function WidgetTypeSpecificForm({
  community,
  widget,
  draft,
  onChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onUploadImage,
}: WidgetTypeSpecificFormProps) {
  const items = draft.items || [];

  switch (widget.type) {
    case 'text':
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">내용</Label>
          <Textarea
            className={cn(SETTINGS_INPUT_CLASS, 'min-h-[180px]')}
            rows={6}
            value={(draft.metadata?.content as string) ?? ''}
            onChange={(event) =>
              onChange('metadata', {
                ...(draft.metadata || {}),
                content: event.target.value,
                format: draft.metadata?.format || 'markdown',
              })
            }
            placeholder="방문자에게 전달할 내용을 입력하세요."
          />
        </div>
      );
    case 'buttons':
    case 'bookmarks': {
      const isBookmark = widget.type === 'bookmarks';
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                {widget.type === 'bookmarks' ? '북마크 목록' : '버튼 목록'}
              </Label>
              <p className="text-xs text-gray-500 dark:text-white">
                최대 {MAX_WIDGET_ITEMS}개까지 추가할 수 있습니다.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={items.length >= MAX_WIDGET_ITEMS}
              onClick={() => onAddItem({ label: '', linkUrl: '' })}
            >
              추가
            </Button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => {
              const labelValue = item.label ?? '';
              const bodyValue = item.body ?? '';
              return (
                <div
                  key={index}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2"
                >
                  <Label className="text-xs font-semibold text-gray-500 dark:text-white">
                    표시될 라벨
                  </Label>
                  <Input
                    className={SETTINGS_INPUT_CLASS}
                  value={labelValue}
                  onChange={(event) => onItemChange(index, { ...item, label: event.target.value })}
                  placeholder={isBookmark ? `라벨 (최대 ${BOOKMARK_LABEL_MAX}자)` : '버튼 라벨'}
                  maxLength={isBookmark ? BOOKMARK_LABEL_MAX : undefined}
                />
                {isBookmark && (
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-white">
                    <span>최대 {BOOKMARK_LABEL_MAX}자</span>
                    <span>
                      {labelValue.length}/{BOOKMARK_LABEL_MAX}
                    </span>
                  </div>
                )}
                <Label className="text-xs font-semibold text-gray-500 dark:text-white">
                  클릭 시 이동할 주소
                </Label>
                <Input
                  value={item.linkUrl ?? ''}
                  onChange={(event) =>
                    onItemChange(index, {
                      ...item,
                      linkUrl: event.target.value,
                    })
                  }
                  placeholder="https://example.com"
                  inputMode="url"
                  className={cn(
                    SETTINGS_INPUT_CLASS,
                    item.linkUrl && !isLinkFieldValid(item.linkUrl) && 'border-red-500 focus-visible:ring-red-500',
                  )}
                />
                <p
                  className={cn(
                    'text-xs',
                    item.linkUrl && !isLinkFieldValid(item.linkUrl)
                      ? 'text-red-500'
                      : 'text-gray-500 dark:text-white',
                  )}
                >
                  https:// 로 시작하는 전체 주소만 허용됩니다.
                </p>
                <Textarea
                  className={cn(SETTINGS_INPUT_CLASS, 'min-h-[90px]')}
                  value={bodyValue}
                  onChange={(event) => onItemChange(index, { ...item, body: event.target.value })}
                  placeholder="사이드바에 표시할 짧은 소개 (선택)"
                  maxLength={isBookmark ? BOOKMARK_BODY_MAX : undefined}
                />
                {isBookmark && (
                  <p className="text-xs text-gray-500 dark:text-white">
                    최대 {BOOKMARK_BODY_MAX}자 · 사이드바에는 최대 {BOOKMARK_BODY_PREVIEW_MAX}자만 표시
                    <span className="ml-2">
                      {bodyValue.length}/{BOOKMARK_BODY_MAX}
                    </span>
                  </p>
                )}
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => onRemoveItem(index)}>
                    삭제
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    case 'images':
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Label className="text-sm font-medium">이미지 목록</Label>
              <p className="text-xs text-gray-500 dark:text-white">
                권장 크기: 가로형 640×360px · 세로형 720×960px (모바일 비율)
              </p>
              <p className="text-xs text-gray-500 dark:text-white">
                제목은 이미지 좌측 상단에 얇은 텍스트로 노출됩니다.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={items.length >= MAX_WIDGET_ITEMS}
              onClick={() =>
                onAddItem({
                  label: '',
                  imageUrl: undefined,
                })
              }
            >
              이미지 추가
            </Button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
                <Label className="text-xs font-semibold text-gray-500 dark:text-white">이미지 제목</Label>
                <Input
                  className={SETTINGS_INPUT_CLASS}
                  value={item.label ?? ''}
                  onChange={(event) => onItemChange(index, { ...item, label: event.target.value })}
                  placeholder="이미지 제목"
                />
                <p className="text-[11px] text-gray-500 dark:text-white">
                  여러 이미지를 올릴 경우 제목으로 식별됩니다.
                </p>
                {item.imageUrl && (
                  <div className="overflow-hidden rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.imageAlt || item.label || 'widget image preview'}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = async (event: Event) => {
                        const target = event.target as HTMLInputElement;
                        const file = target.files?.[0];
                        if (file) {
                          const url = await onUploadImage(index, file);
                          onItemChange(index, { ...item, imageUrl: url });
                        }
                      };
                      input.click();
                    }}
                  >
                    이미지 선택
                  </Button>
                  <span className="text-xs text-gray-500 dark:text-white">
                    JPG/PNG/WebP · 최대 10MB
                  </span>
                </div>
                <Label className="text-xs font-semibold text-gray-500 dark:text-white">
                  이미지 설명 (선택)
                </Label>
                <Textarea
                  className={cn(SETTINGS_INPUT_CLASS, 'min-h-[80px]')}
                  value={item.body ?? ''}
                  onChange={(event) => onItemChange(index, { ...item, body: event.target.value })}
                  placeholder="이미지 아래쪽에 표시할 짧은 문장"
                  rows={2}
                />
                <Label className="text-xs font-semibold text-gray-500 dark:text-white">
                  이미지 클릭 시 이동할 주소 (선택)
                </Label>
                <Input
                  value={item.linkUrl ?? ''}
                  onChange={(event) =>
                    onItemChange(index, {
                      ...item,
                      linkUrl: event.target.value,
                    })
                  }
                  placeholder="https://example.com"
                  inputMode="url"
                  className={cn(
                    SETTINGS_INPUT_CLASS,
                    item.linkUrl && !isLinkFieldValid(item.linkUrl) && 'border-red-500 focus-visible:ring-red-500',
                  )}
                />
                <p
                  className={cn(
                    'text-xs',
                    item.linkUrl && !isLinkFieldValid(item.linkUrl)
                      ? 'text-red-500'
                      : 'text-gray-500 dark:text-white',
                  )}
                >
                  URL을 입력하지 않으면 이미지만 노출됩니다.
                </p>
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => onRemoveItem(index)}>
                  삭제
                </Button>
              </div>
            ))}
          </div>
        </div>
      );
    case 'community_list':
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">추천 커뮤니티</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onAddItem({
                  targetCommunitySlug: community.slug,
                  label: community.name,
                })
              }
            >
              추가
            </Button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
                <CommunitySearchSelect
                  selectedSlug={item.targetCommunitySlug}
                  onSelect={(selected) =>
                    onItemChange(index, {
                      ...item,
                      targetCommunitySlug: selected.slug,
                      targetCommunityId: selected.id,
                      label: item.label || selected.name,
                      metadata: {
                        ...(item.metadata || {}),
                        slug: selected.slug,
                        iconUrl: selected.iconUrl,
                      },
                      body: item.body ?? '',
                    })
                  }
                />
                {item.targetCommunitySlug ? (
                  <p className="text-xs text-gray-500 dark:text-white">
                    선택된 커뮤니티: <strong>c/{item.targetCommunitySlug}</strong>
                  </p>
                ) : (
                  <p className="text-xs text-pink-600">추천할 커뮤니티를 선택하세요.</p>
                )}
                <Textarea
                  className={cn(SETTINGS_INPUT_CLASS, 'min-h-[80px]')}
                  value={item.body ?? ''}
                  onChange={(event) => onItemChange(index, { ...item, body: event.target.value })}
                  placeholder="설명 (선택)"
                />
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => onRemoveItem(index)}>
                  삭제
                </Button>
              </div>
            ))}
          </div>
        </div>
      );
    case 'calendar':
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">캘린더 이벤트</Label>
              <p className="text-xs text-gray-500 dark:text-white">
                시작 날짜는 필수이며, 종료/시간/링크는 선택입니다.
              </p>
              <p className="text-xs text-gray-500 dark:text-white">최대 {MAX_WIDGET_ITEMS}개까지 관리할 수 있습니다.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={items.length >= MAX_WIDGET_ITEMS}
              onClick={() =>
                onAddItem({
                  label: '새 이벤트',
                  startsAt: new Date().toISOString(),
                })
              }
            >
              추가
            </Button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
                <Label className="text-xs font-semibold text-gray-500 dark:text-white">이벤트 제목</Label>
                <Input
                  className={SETTINGS_INPUT_CLASS}
                  value={item.label ?? ''}
                  onChange={(event) => onItemChange(index, { ...item, label: event.target.value })}
                  placeholder="이벤트 제목"
                />
                <DateTimeInlineControl
                  label="시작 시간"
                  helpText="날짜만 입력하면 하루 종일 일정으로 표시됩니다."
                  parts={parseDateParts(item.startsAt)}
                  onChange={(changes) => {
                    const iso = buildDateTime({ ...parseDateParts(item.startsAt), ...changes });
                    onItemChange(index, { ...item, startsAt: iso });
                  }}
                />
                <DateTimeInlineControl
                  label="종료 시간 (선택)"
                  helpText="미입력 시 시작 시간만 표시됩니다."
                  parts={parseDateParts(item.endsAt)}
                  optional
                  onClear={() => onItemChange(index, { ...item, endsAt: undefined })}
                  onChange={(changes) => {
                    const iso = buildDateTime({ ...parseDateParts(item.endsAt), ...changes });
                    onItemChange(index, { ...item, endsAt: iso });
                  }}
                />
                <Label className="text-xs font-semibold text-gray-500 dark:text-white">위치 (선택)</Label>
                <Input
                  className={SETTINGS_INPUT_CLASS}
                  value={item.location ?? ''}
                  onChange={(event) => onItemChange(index, { ...item, location: event.target.value })}
                  placeholder="예: 교대역, 온라인 (Zoom)"
                />
                <Label className="text-xs font-semibold text-gray-500 dark:text-white">이벤트 설명 (선택)</Label>
                <Textarea
                  className={cn(SETTINGS_INPUT_CLASS, 'min-h-[100px]')}
                  value={item.body ?? ''}
                  onChange={(event) => onItemChange(index, { ...item, body: event.target.value })}
                  placeholder="참석자에게 전달할 세부 내용을 입력하세요."
                  rows={3}
                />
                <Label className="text-xs font-semibold text-gray-500 dark:text-white">이벤트 링크 (선택)</Label>
                <Input
                  value={item.linkUrl ?? ''}
                  onChange={(event) =>
                    onItemChange(index, {
                      ...item,
                      linkUrl: event.target.value,
                    })
                  }
                  placeholder="https://example.com/event"
                  inputMode="url"
                  className={cn(
                    SETTINGS_INPUT_CLASS,
                    item.linkUrl && !isLinkFieldValid(item.linkUrl) && 'border-red-500 focus-visible:ring-red-500',
                  )}
                />
                <p
                  className={cn(
                    'text-xs',
                    item.linkUrl && !isLinkFieldValid(item.linkUrl)
                      ? 'text-red-500'
                      : 'text-gray-500 dark:text-white',
                  )}
                >
                  링크를 입력하면 사이드바에서 \"자세히 보기\" 버튼이 노출됩니다.
                </p>
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => onRemoveItem(index)}>
                  삭제
                </Button>
              </div>
            ))}
          </div>
        </div>
      );
    case 'post_flairs': {
      const availableFlairs = (community.flairs || []).filter(flair => flair.type === 'post');
      const selectedFlairs = (draft.metadata?.flairIds as string[]) || [];
      const showAll = Boolean(draft.metadata?.showAll ?? true); // Default to Show All

      return (
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
            <Label className="text-sm font-medium mb-3 block">표시 방식</Label>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="mode-all"
                  name="flair-mode"
                  checked={showAll}
                  onChange={() => onChange('metadata', { ...(draft.metadata || {}), showAll: true, flairIds: [] })}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                />
                <Label htmlFor="mode-all" className="text-sm cursor-pointer select-none">
                  전체 말머리 (기본)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="mode-select"
                  name="flair-mode"
                  checked={!showAll}
                  onChange={() => onChange('metadata', { ...(draft.metadata || {}), showAll: false })}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                />
                <Label htmlFor="mode-select" className="text-sm cursor-pointer select-none">
                  특정 말머리 강조
                </Label>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-2 px-1">
              {showAll 
                ? "커뮤니티의 모든 말머리를 목록 형태로 표시합니다." 
                : "선택한 말머리만 별도로 강조하여 표시합니다."}
            </p>
          </div>

          {showAll && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">최대 표시 개수</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
                    이 개수까지 펼쳐 보이고, 나머지는 '더보기' 버튼으로 숨깁니다 (기본값: 10개)
                  </p>
                  <Input
                    className={SETTINGS_INPUT_CLASS}
                    type="number"
                    min={1}
                    max={50}
                    value={draft.metadata?.limit ?? 10}
                    onChange={(event) =>
                      onChange('metadata', {
                        ...(draft.metadata || {}),
                        limit: Number(event.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {!showAll && (
            <div className="space-y-3 pl-1">
              <Label className="text-sm font-medium">강조할 말머리 선택</Label>
              {availableFlairs.length === 0 ? (
                <div className="rounded-lg border border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 p-3 space-y-2">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                    말머리가 아직 생성되지 않았습니다
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    커뮤니티 설정에서 말머리를 생성해주세요.
                  </p>
                  <a
                    href={`/c/${community.slug}/settings/flairs`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    말머리 관리 페이지로 이동 →
                  </a>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableFlairs.map((flair) => {
                    const isSelected = selectedFlairs.includes(flair.id);
                    return (
                      <Button
                        key={flair.id}
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'flex items-center gap-2 border',
                          isSelected
                            ? 'bg-[#4d68ff] text-white border-transparent hover:bg-[#3c52c7]'
                            : 'text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-[#1f2538]',
                        )}
                        onClick={() => {
                          const next = isSelected
                            ? selectedFlairs.filter((id) => id !== flair.id)
                            : [...selectedFlairs, flair.id];
                          onChange('metadata', { ...(draft.metadata || {}), flairIds: next });
                        }}
                      >
                        <span>{flair.name}</span>
                        {isSelected && (
                          <span className="text-xs font-semibold text-white">✓</span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <Label className="text-sm font-medium mb-3 block">말머리 관리</Label>
            <FlairsManagerPanel slug={community.slug} initialFlairs={community.flairs} embedded />
          </div>
        </div>
      );
    }
    case 'community_rules': {
      const limitValue =
        typeof draft.metadata?.limit === 'number'
          ? draft.metadata.limit
          : Number(draft.metadata?.limit) || 5;
      
      const showNumbering = draft.metadata?.showNumbering !== false;

      return (
        <div className="space-y-4">
          <RulesManagerPanel 
            slug={community.slug} 
            embedded 
            showNumbering={showNumbering}
            onShowNumberingChange={(checked) => 
              onChange('metadata', { ...(draft.metadata || {}), showNumbering: checked })
            }
          />
          
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <Label className="text-sm font-medium mb-3 block">표시 옵션</Label>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm font-medium">최대 표시 규칙 수</Label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
                  이 개수까지 펼쳐 보이고, 나머지는 '더보기' 버튼으로 숨깁니다
                </p>
                <Input
                  className={SETTINGS_INPUT_CLASS}
                  type="number"
                  min={1}
                  max={20}
                  value={limitValue}
                  onChange={(event) =>
                    onChange('metadata', {
                      ...(draft.metadata || {}),
                      limit: Number(event.target.value),
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

export function convertWidgetToDraft(widget: CommunitySidebarWidget): UpdateCommunityWidgetInput {
  return {
    title: widget.title || '',
    description: widget.description || '',
    isEnabled: widget.isEnabled,
    metadata: widget.metadata || {},
    items: widget.items.map((item) => ({
      label: item.label,
      body: item.body,
      linkUrl: item.linkUrl,
      imageUrl: item.imageUrl,
      imageAlt: item.imageAlt,
      metadata: item.metadata,
      ctaLabel: item.ctaLabel,
      ctaUrl: item.ctaUrl,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      location: item.location,
      targetCommunitySlug: item.targetCommunity?.slug,
      targetCommunityId: item.targetCommunity?.id,
    })),
  };
}

export function buildInitialWidgetPayload(
  type: CommunitySidebarWidgetType,
  community: Community,
): CreateCommunityWidgetInput {
  switch (type) {
    case 'text':
      return {
        type,
        title: '새 공지',
        metadata: {
          content: '여기에 공지를 입력하세요.',
          format: 'markdown',
        },
      };
    case 'buttons':
      return {
        type,
        title: '바로가기',
        items: [
          {
            label: '홈으로 이동',
            linkUrl: 'https://example.com',
            body: '링크 설명',
          },
        ],
      };
    case 'bookmarks':
      return {
        type,
        title: '북마크',
        items: [
          {
            label: '첫 번째 링크',
            linkUrl: 'https://example.com',
          },
        ],
      };
    case 'images':
      return {
        type,
        title: '이미지 모듈',
        items: [
          {
            label: community.name,
            imageUrl: 'https://placehold.co/600x360/png',
          },
        ],
      };
    case 'community_list':
      return {
        type,
        title: '추천 커뮤니티',
        items: [
          {
            targetCommunitySlug: community.slug,
          },
        ],
      };
    case 'calendar':
      return {
        type,
        title: '캘린더',
        items: [
          {
            label: '새 이벤트',
            startsAt: new Date().toISOString(),
          },
        ],
      };
    case 'post_flairs':
      if (!community.flairs || community.flairs.length === 0) {
        throw new Error('먼저 말머리를 생성한 뒤 위젯을 추가할 수 있습니다.');
      }
      return {
        type,
        metadata: {
          flairIds: community.flairs?.slice(0, 2).map((flair) => flair.id) ?? [],
        },
      };
    case 'community_rules':
      return {
        type,
        metadata: {
          limit: Math.min(community.rules?.length || 3, 10),
          collapsed: false,
          showNumbering: true,
        },
      };

    default:
      return { type };
  }
}

interface CommunitySelectProps {
  selectedSlug?: string | null;
  onSelect: (community: { id: string; slug: string; name: string; iconUrl?: string | null; description?: string | null }) => void;
}

function CommunitySearchSelect({ selectedSlug, onSelect }: CommunitySelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const normalizedQuery = query.trim();
  const shouldSearch = normalizedQuery.length >= 2;
  const { data, isLoading } = useCommunities({
    limit: 5,
    search: shouldSearch ? normalizedQuery : undefined,
  });
  const results = shouldSearch ? data?.items ?? [] : [];

  return (
    <div className="space-y-2">
      <Input
        className={SETTINGS_INPUT_CLASS}
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        placeholder="커뮤니티 검색 (두 글자 이상)"
      />
      {open && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg max-h-56 overflow-y-auto">
          {!shouldSearch && (
            <p className="px-3 py-2 text-xs text-gray-500 dark:text-white">두 글자 이상 입력하면 검색합니다.</p>
          )}
          {shouldSearch && isLoading && (
            <p className="px-3 py-2 text-xs text-gray-500 dark:text-white">검색 중...</p>
          )}
          {shouldSearch && !isLoading && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-500 dark:text-white">검색 결과가 없습니다.</p>
          )}
          {results.map((community) => (
            <button
              key={community.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect({
                  id: community.id,
                  slug: community.slug,
                  name: community.name,
                  iconUrl: community.iconUrl,
                  description: community.description,
                });
                setQuery('');
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {community.name}
              </span>
              <span className="text-xs text-gray-500 dark:text-white">c/{community.slug}</span>
            </button>
          ))}
        </div>
      )}
      {selectedSlug && (
        <Link
          href={`/c/${selectedSlug}`}
          target="_blank"
          className="text-xs text-blue-600 dark:text-blue-400"
        >
          c/{selectedSlug} 바로가기
        </Link>
      )}
    </div>
  );
}

function normalizeLinkToHttps(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const sanitized = trimmed.replace(/^https?:\/\//i, '');
  if (!sanitized) return undefined;
  const candidate = `https://${sanitized}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname || !url.hostname.includes('.')) {
      return undefined;
    }
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return undefined;
  }
}

function isLinkFieldValid(value?: string | null): boolean {
  if (!value || !value.trim()) {
    return true;
  }
  return Boolean(normalizeLinkToHttps(value));
}

function sanitizeWidgetItems(items?: CommunityWidgetItemInput[]): CommunityWidgetItemInput[] | undefined {
  if (!items) return undefined;
  return items.map((item) => {
    const next: CommunityWidgetItemInput = { ...item };
    const normalizedLink = normalizeLinkToHttps(item.linkUrl);
    next.linkUrl = normalizedLink;
    if (!normalizedLink) {
      delete next.linkUrl;
    }
    return next;
  });
}

function prepareWidgetPayloadForSave(
  _type: CommunitySidebarWidgetType,
  draft: UpdateCommunityWidgetInput,
): UpdateCommunityWidgetInput {
  const base: UpdateCommunityWidgetInput = {
    ...draft,
    title: draft.title?.trim() || undefined,
    description: draft.description?.trim() || undefined,
    items: sanitizeWidgetItems(draft.items),
  };
  return base;
}

function validateWidgetDraft(
  type: CommunitySidebarWidgetType,
  draft: UpdateCommunityWidgetInput,
): string | null {
  const items = draft.items || [];
  switch (type) {
    case 'buttons':
    case 'bookmarks': {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item.label?.trim()) {
          return `${i + 1}번째 항목의 라벨을 입력하세요.`;
        }
        if (type === 'bookmarks' && item.label.trim().length > BOOKMARK_LABEL_MAX) {
          return `${i + 1}번째 라벨은 최대 ${BOOKMARK_LABEL_MAX}자까지 입력할 수 있습니다.`;
        }
        if (!isLinkFieldValid(item.linkUrl)) {
          return `${i + 1}번째 항목의 링크는 https:// 로 시작하는 전체 주소여야 합니다.`;
        }
        if (type === 'bookmarks' && item.body?.trim() && item.body.trim().length > BOOKMARK_BODY_MAX) {
          return `${i + 1}번째 소개는 최대 ${BOOKMARK_BODY_MAX}자까지 입력할 수 있습니다.`;
        }
      }
      break;
    }
    case 'images': {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item.imageUrl) {
          return `${i + 1}번째 이미지 파일을 업로드하세요.`;
        }
        if (!isLinkFieldValid(item.linkUrl)) {
          return `${i + 1}번째 이미지의 링크가 올바르지 않습니다.`;
        }
      }
      break;
    }
    case 'community_list': {
      for (let i = 0; i < items.length; i += 1) {
        if (!items[i].targetCommunitySlug) {
          return `${i + 1}번째 추천 커뮤니티를 검색 후 선택하세요.`;
        }
      }
      break;
    }
    case 'calendar': {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item.startsAt) {
          return `${i + 1}번째 이벤트의 시작 날짜를 지정하세요.`;
        }
        if (!isLinkFieldValid(item.linkUrl)) {
          return `${i + 1}번째 이벤트의 링크가 올바르지 않습니다.`;
        }
      }
      break;
    }
    default:
      break;
  }
  return null;
}

const HOURS = ['--', ...Array.from({ length: 12 }, (_, idx) => String(idx + 1).padStart(2, '0'))];
const MINUTES = ['--', ...Array.from({ length: 12 }, (_, idx) => String(idx * 5).toString().padStart(2, '0'))];

type DateTimeParts = {
  date: string;
  hour: string;
  minute: string;
  period: '오전' | '오후';
};

function parseDateParts(value?: string): DateTimeParts {
  if (!value) {
    return { date: '', hour: '--', minute: '--', period: '오전' };
  }
  const date = new Date(value);
  const hours = date.getHours();
  const period = hours >= 12 ? '오후' : '오전';
  const hour12 = hours % 12 || 12;
  return {
    date: date.toISOString().slice(0, 10),
    hour: hour12.toString().padStart(2, '0'),
    minute: date.getMinutes().toString().padStart(2, '0'),
    period,
  };
}

function buildDateTime(parts: DateTimeParts): string | undefined {
  if (!parts.date) return undefined;
  if (parts.hour === '--' || parts.minute === '--') {
    return new Date(`${parts.date}T00:00:00`).toISOString();
  }
  let hour = parseInt(parts.hour, 10);
  if (parts.period === '오후' && hour < 12) hour += 12;
  if (parts.period === '오전' && hour === 12) hour = 0;
  const minute = parts.minute.padStart(2, '0');
  const iso = new Date(`${parts.date}T${hour.toString().padStart(2, '0')}:${minute}:00`).toISOString();
  return iso;
}

interface DateTimeInlineControlProps {
  label: string;
  parts: DateTimeParts;
  optional?: boolean;
  onClear?: () => void;
  onChange: (changes: Partial<DateTimeParts>) => void;
  helpText?: string;
}

function DateTimeInlineControl({ label, parts, optional, onClear, onChange, helpText }: DateTimeInlineControlProps) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">{label}</p>
      <Input
        type="date"
        className={SETTINGS_INPUT_CLASS}
        value={parts.date}
        onChange={(event) => onChange({ date: event.target.value })}
      />
      <div className="flex gap-2">
        <select
          className={cn(SETTINGS_INPUT_CLASS, 'flex-1')}
          value={parts.hour}
          onChange={(event) => onChange({ hour: event.target.value })}
        >
        {HOURS.map((hour) =>
          hour === '--' ? (
            <option key="unset" value="--">
              --시
            </option>
          ) : (
            <option key={hour} value={hour}>
              {hour}시
            </option>
          ),
        )}
      </select>
      <select
        className={cn(SETTINGS_INPUT_CLASS, 'flex-1')}
        value={parts.minute}
        onChange={(event) => onChange({ minute: event.target.value })}
      >
        {MINUTES.map((minute) =>
          minute === '--' ? (
            <option key="unset-min" value="--">
              --분
            </option>
          ) : (
            <option key={minute} value={minute}>
              {minute}분
            </option>
          ),
        )}
      </select>
      </div>
      <div className="flex items-center gap-2">
        {(['오전', '오후'] as const).map((period) => (
          <Button
            key={period}
            type="button"
            size="sm"
            variant={parts.period === period ? 'default' : 'outline'}
            onClick={() => onChange({ period })}
          >
            {period}
          </Button>
        ))}
        {optional && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            비우기
          </Button>
        )}
      </div>
      {helpText && (
        <p className="text-[11px] text-gray-500 dark:text-white">{helpText}</p>
      )}
    </div>
  );
}
