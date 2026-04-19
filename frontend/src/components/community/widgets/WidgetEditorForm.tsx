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
  { type: 'text', label: 'Text', description: 'Notices and guidelines' },
  { type: 'buttons', label: 'Buttons', description: 'Up to 10 link buttons' },
  { type: 'bookmarks', label: 'Bookmarks', description: 'Quick link list' },
  { type: 'images', label: 'Images', description: 'Up to 10 images' },
  { type: 'community_list', label: 'Featured communities', description: 'Promote other communities' },
  { type: 'calendar', label: 'Calendar', description: 'Event schedule' },
  { type: 'post_flairs', label: 'Flairs', description: 'Widget for filtering post flairs.' },
  { type: 'community_rules', label: 'Community rules', description: 'Show rules in a sidebar widget' },
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
      setFormError(error?.message || 'Failed to save the widget.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 text-gray-900 dark:text-gray-100">
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs uppercase tracking-wide text-gray-500 dark:text-white">Title</Label>
          <span className="text-xs text-gray-500">{(draft.title ?? '').length}/30</span>
        </div>
        <Input
          className={cn(SETTINGS_INPUT_CLASS, 'mt-1')}
          value={draft.title ?? ''}
          onChange={(event) => handleFieldChange('title', event.target.value.slice(0, 30))}
          placeholder="Widget title"
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
                Show this widget in the sidebar
              </Label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Disabled widgets keep their settings but stay hidden from users
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
          {isSuccess ? 'Saved' : 'Save'}
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
          <Label className="text-sm font-medium">Content</Label>
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
            placeholder="Enter the message you want visitors to see."
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
                {widget.type === 'bookmarks' ? 'Bookmark list' : 'Button list'}
              </Label>
              <p className="text-xs text-gray-500 dark:text-white">
                You can add up to {MAX_WIDGET_ITEMS} items.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={items.length >= MAX_WIDGET_ITEMS}
              onClick={() => onAddItem({ label: '', linkUrl: '' })}
            >
              Add
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
                    Display label
                  </Label>
                  <Input
                    className={SETTINGS_INPUT_CLASS}
                  value={labelValue}
                  onChange={(event) => onItemChange(index, { ...item, label: event.target.value })}
                  placeholder={isBookmark ? `Label (max ${BOOKMARK_LABEL_MAX} characters)` : 'Button label'}
                  maxLength={isBookmark ? BOOKMARK_LABEL_MAX : undefined}
                />
                {isBookmark && (
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-white">
                    <span>Max {BOOKMARK_LABEL_MAX} characters</span>
                    <span>
                      {labelValue.length}/{BOOKMARK_LABEL_MAX}
                    </span>
                  </div>
                )}
                <Label className="text-xs font-semibold text-gray-500 dark:text-white">
                  Destination URL
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
                  Only full URLs starting with `https://` are allowed.
                </p>
                <Textarea
                  className={cn(SETTINGS_INPUT_CLASS, 'min-h-[90px]')}
                  value={bodyValue}
                  onChange={(event) => onItemChange(index, { ...item, body: event.target.value })}
                  placeholder="Short description shown in the sidebar (optional)"
                  maxLength={isBookmark ? BOOKMARK_BODY_MAX : undefined}
                />
                {isBookmark && (
                  <p className="text-xs text-gray-500 dark:text-white">
                    Max {BOOKMARK_BODY_MAX} characters. Only the first {BOOKMARK_BODY_PREVIEW_MAX} show in the sidebar.
                    <span className="ml-2">
                      {bodyValue.length}/{BOOKMARK_BODY_MAX}
                    </span>
                  </p>
                )}
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => onRemoveItem(index)}>
                    Delete
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
              <Label className="text-sm font-medium">Image list</Label>
              <p className="text-xs text-gray-500 dark:text-white">
                Recommended sizes: landscape 640×360px, portrait 720×960px (mobile ratio)
              </p>
              <p className="text-xs text-gray-500 dark:text-white">
                Titles appear as subtle text in the upper-left corner of the image.
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
              Add image
            </Button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
                <Label className="text-xs font-semibold text-gray-500 dark:text-white">Image title</Label>
                <Input
                  className={SETTINGS_INPUT_CLASS}
                  value={item.label ?? ''}
                  onChange={(event) => onItemChange(index, { ...item, label: event.target.value })}
                  placeholder="Image title"
                />
                <p className="text-[11px] text-gray-500 dark:text-white">
                  When you upload multiple images, the title helps distinguish them.
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
                    Choose image
                  </Button>
                  <span className="text-xs text-gray-500 dark:text-white">
                    JPG/PNG/WebP · up to 10MB
                  </span>
                </div>
                <Label className="text-xs font-semibold text-gray-500 dark:text-white">
                  Image caption (optional)
                </Label>
                <Textarea
                  className={cn(SETTINGS_INPUT_CLASS, 'min-h-[80px]')}
                  value={item.body ?? ''}
                  onChange={(event) => onItemChange(index, { ...item, body: event.target.value })}
                  placeholder="Short text shown below the image"
                  rows={2}
                />
                <Label className="text-xs font-semibold text-gray-500 dark:text-white">
                  Click-through URL (optional)
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
                  Leave this empty to show the image without a link.
                </p>
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => onRemoveItem(index)}>
                  Delete
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
            <Label className="text-sm font-medium">Featured communities</Label>
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
              Add
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
                    Selected community: <strong>c/{item.targetCommunitySlug}</strong>
                  </p>
                ) : (
                  <p className="text-xs text-pink-600">Search for and select a community to feature.</p>
                )}
                <Textarea
                  className={cn(SETTINGS_INPUT_CLASS, 'min-h-[80px]')}
                  value={item.body ?? ''}
                  onChange={(event) => onItemChange(index, { ...item, body: event.target.value })}
                  placeholder="Description (optional)"
                />
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => onRemoveItem(index)}>
                  Delete
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
              <Label className="text-sm font-medium">Calendar events</Label>
              <p className="text-xs text-gray-500 dark:text-white">
                A start date is required. End time, location, and link are optional.
              </p>
              <p className="text-xs text-gray-500 dark:text-white">You can manage up to {MAX_WIDGET_ITEMS} items.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={items.length >= MAX_WIDGET_ITEMS}
              onClick={() =>
                onAddItem({
                  label: 'New event',
                  startsAt: new Date().toISOString(),
                })
              }
            >
              Add
            </Button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
                <Label className="text-xs font-semibold text-gray-500 dark:text-white">Event title</Label>
                <Input
                  className={SETTINGS_INPUT_CLASS}
                  value={item.label ?? ''}
                  onChange={(event) => onItemChange(index, { ...item, label: event.target.value })}
                  placeholder="Event title"
                />
                <DateTimeInlineControl
                  label="Start time"
                  helpText="If you only enter a date, the event is shown as all-day."
                  parts={parseDateParts(item.startsAt)}
                  onChange={(changes) => {
                    const iso = buildDateTime({ ...parseDateParts(item.startsAt), ...changes });
                    onItemChange(index, { ...item, startsAt: iso });
                  }}
                />
                <DateTimeInlineControl
                  label="End time (optional)"
                  helpText="If you leave this empty, only the start time is shown."
                  parts={parseDateParts(item.endsAt)}
                  optional
                  onClear={() => onItemChange(index, { ...item, endsAt: undefined })}
                  onChange={(changes) => {
                    const iso = buildDateTime({ ...parseDateParts(item.endsAt), ...changes });
                    onItemChange(index, { ...item, endsAt: iso });
                  }}
                />
                <Label className="text-xs font-semibold text-gray-500 dark:text-white">Location (optional)</Label>
                <Input
                  className={SETTINGS_INPUT_CLASS}
                  value={item.location ?? ''}
                  onChange={(event) => onItemChange(index, { ...item, location: event.target.value })}
                  placeholder="e.g. Union Square, Online (Zoom)"
                />
                <Label className="text-xs font-semibold text-gray-500 dark:text-white">Event description (optional)</Label>
                <Textarea
                  className={cn(SETTINGS_INPUT_CLASS, 'min-h-[100px]')}
                  value={item.body ?? ''}
                  onChange={(event) => onItemChange(index, { ...item, body: event.target.value })}
                  placeholder="Add the details attendees should know."
                  rows={3}
                />
                <Label className="text-xs font-semibold text-gray-500 dark:text-white">Event link (optional)</Label>
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
                  If provided, the sidebar shows a "View details" button.
                </p>
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => onRemoveItem(index)}>
                  Delete
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
            <Label className="text-sm font-medium mb-3 block">Display mode</Label>
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
                  All flairs (default)
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
                  Highlight selected flairs
                </Label>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-2 px-1">
              {showAll 
                ? "Show every flair from the community in a list."
                : "Highlight only the flairs you select below."}
            </p>
          </div>

          {showAll && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">Maximum visible items</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
                    Show this many items before hiding the rest behind a "View more" button. Default: 10.
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
              <Label className="text-sm font-medium">Choose flairs to highlight</Label>
              {availableFlairs.length === 0 ? (
                <div className="rounded-lg border border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 p-3 space-y-2">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                    No flairs have been created yet
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    Create flairs first in the community settings.
                  </p>
                  <a
                    href={`/c/${community.slug}/settings/flairs`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Open flair management →
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
            <Label className="text-sm font-medium mb-3 block">Flair management</Label>
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
            <Label className="text-sm font-medium mb-3 block">Display options</Label>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm font-medium">Maximum visible rules</Label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
                  Show this many rules before hiding the rest behind a "View more" button.
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
        title: 'New notice',
        metadata: {
          content: 'Write your notice here.',
          format: 'markdown',
        },
      };
    case 'buttons':
      return {
        type,
        title: 'Quick links',
        items: [
          {
            label: 'Visit homepage',
            linkUrl: 'https://example.com',
            body: 'Link description',
          },
        ],
      };
    case 'bookmarks':
      return {
        type,
        title: 'Bookmarks',
        items: [
          {
            label: 'First link',
            linkUrl: 'https://example.com',
          },
        ],
      };
    case 'images':
      return {
        type,
        title: 'Image module',
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
        title: 'Featured communities',
        items: [
          {
            targetCommunitySlug: community.slug,
          },
        ],
      };
    case 'calendar':
      return {
        type,
        title: 'Calendar',
        items: [
          {
            label: 'New event',
            startsAt: new Date().toISOString(),
          },
        ],
      };
    case 'post_flairs':
      if (!community.flairs || community.flairs.length === 0) {
        throw new Error('Create flairs first before adding this widget.');
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
        placeholder="Search communities (2+ characters)"
      />
      {open && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg max-h-56 overflow-y-auto">
          {!shouldSearch && (
            <p className="px-3 py-2 text-xs text-gray-500 dark:text-white">Start typing at least 2 characters to search.</p>
          )}
          {shouldSearch && isLoading && (
            <p className="px-3 py-2 text-xs text-gray-500 dark:text-white">Searching...</p>
          )}
          {shouldSearch && !isLoading && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-500 dark:text-white">No matching communities found.</p>
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
          Open c/{selectedSlug}
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
          return `Enter a label for item ${i + 1}.`;
        }
        if (type === 'bookmarks' && item.label.trim().length > BOOKMARK_LABEL_MAX) {
          return `Label ${i + 1} must be ${BOOKMARK_LABEL_MAX} characters or fewer.`;
        }
        if (!isLinkFieldValid(item.linkUrl)) {
          return `Item ${i + 1} must use a full URL starting with https://.`;
        }
        if (type === 'bookmarks' && item.body?.trim() && item.body.trim().length > BOOKMARK_BODY_MAX) {
          return `Description ${i + 1} must be ${BOOKMARK_BODY_MAX} characters or fewer.`;
        }
      }
      break;
    }
    case 'images': {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item.imageUrl) {
          return `Upload an image for item ${i + 1}.`;
        }
        if (!isLinkFieldValid(item.linkUrl)) {
          return `The link for image ${i + 1} is invalid.`;
        }
      }
      break;
    }
    case 'community_list': {
      for (let i = 0; i < items.length; i += 1) {
        if (!items[i].targetCommunitySlug) {
          return `Search for and select featured community ${i + 1}.`;
        }
      }
      break;
    }
    case 'calendar': {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item.startsAt) {
          return `Set a start date for event ${i + 1}.`;
        }
        if (!isLinkFieldValid(item.linkUrl)) {
          return `The link for event ${i + 1} is invalid.`;
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
  period: 'AM' | 'PM';
};

function parseDateParts(value?: string): DateTimeParts {
  if (!value) {
    return { date: '', hour: '--', minute: '--', period: 'AM' };
  }
  const date = new Date(value);
  const hours = date.getHours();
  const period = hours >= 12 ? 'PM' : 'AM';
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
  if (parts.period === 'PM' && hour < 12) hour += 12;
  if (parts.period === 'AM' && hour === 12) hour = 0;
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
              -- hour
            </option>
          ) : (
            <option key={hour} value={hour}>
              {hour}
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
              -- min
            </option>
          ) : (
            <option key={minute} value={minute}>
              {minute}
            </option>
          ),
        )}
      </select>
      </div>
      <div className="flex items-center gap-2">
        {(['AM', 'PM'] as const).map((period) => (
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
            Clear
          </Button>
        )}
      </div>
      {helpText && (
        <p className="text-[11px] text-gray-500 dark:text-white">{helpText}</p>
      )}
    </div>
  );
}
