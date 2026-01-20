'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { Loader2, GripVertical, Plus, Trash2 } from 'lucide-react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CommunityAdminLayout from '@/components/community/CommunityAdminLayout';
import { useCommunity } from '@/hooks/community';
import {
  useManageCommunityWidgets,
  useCreateCommunityWidget,
  useUpdateCommunityWidget,
  useDeleteCommunityWidget,
  useReorderCommunityWidgets,
  useUploadCommunityWidgetImage,
} from '@/hooks/community/useCommunityWidgets';
import type {
  Community,
  CommunitySidebarWidget,
  CommunitySidebarWidgetType,
  CreateCommunityWidgetInput,
  UpdateCommunityWidgetInput,
  CommunityWidgetItemInput,
} from '@/types/community';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import WidgetEditorForm, {
  buildInitialWidgetPayload,
  widgetTypeOptions,
} from '@/components/community/widgets/WidgetEditorForm';
import { resolveWidgetTitle } from '@/components/community/widgets/titleUtils';
import { SINGLETON_WIDGET_TYPES } from '@/components/community/widgets/constants';
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
  SETTINGS_SUBTLE_BUTTON_CLASS,
  SETTINGS_SECTION_TITLE_CLASS,
  SETTINGS_SECTION_DESCRIPTION_CLASS,
} from '@/app/settings/theme';
import { DESTRUCTIVE_SURFACE_CLASS } from '@/constants/accessibility';

interface CommunityWidgetSettingsPageProps {
  params: Promise<{ slug: string }>;
}

type WidgetFeedback = { type: 'success' | 'error' | 'info'; text: string } | null;

export default function CommunityWidgetSettingsPage({ params }: CommunityWidgetSettingsPageProps) {
  const { slug } = use(params);

  return (
    <CommunityAdminLayout slug={slug}>
      <WidgetSettingsPanel slug={slug} />
    </CommunityAdminLayout>
  );
}

function WidgetSettingsPanel({ slug }: { slug: string }) {
  const { data: community, isLoading: isCommunityLoading } = useCommunity(slug);
  const {
    data: widgets,
    isLoading: isWidgetsLoading,
    isFetching: isWidgetsFetching,
  } = useManageCommunityWidgets(slug);
  const createMutation = useCreateCommunityWidget(slug);
  const updateMutation = useUpdateCommunityWidget(slug);
  const deleteMutation = useDeleteCommunityWidget(slug);
  const reorderMutation = useReorderCommunityWidgets(slug);
  const uploadMutation = useUploadCommunityWidgetImage(slug);

  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [orderedWidgets, setOrderedWidgets] = useState<CommunitySidebarWidget[]>([]);
  const [panelFeedback, setPanelFeedback] = useState<WidgetFeedback>(null);
  const [editorFeedback, setEditorFeedback] = useState<WidgetFeedback>(null);

  useEffect(() => {
    if (widgets) {
      setOrderedWidgets(widgets);
      if (!selectedWidgetId && widgets.length > 0) {
        setSelectedWidgetId(widgets[0].id);
      }
    }
  }, [widgets, selectedWidgetId]);

  const selectedWidget = orderedWidgets.find((widget) => widget.id === selectedWidgetId) || null;

  useEffect(() => {
    if (!panelFeedback) return;
    const timer = setTimeout(() => setPanelFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [panelFeedback]);

  useEffect(() => {
    if (!editorFeedback) return;
    const timer = setTimeout(() => setEditorFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [editorFeedback]);

  useEffect(() => {
    setEditorFeedback(null);
  }, [selectedWidgetId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedWidgets((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const reordered = arrayMove(items, oldIndex, newIndex);
      reorderMutation.mutate({ items: reordered.map((widget) => ({ id: widget.id })) });
      return reordered;
    });
  };

  const handleCreateWidget = async (type: CommunitySidebarWidgetType) => {
    if (!community) return;
    const isSingleton = SINGLETON_WIDGET_TYPES.includes(type);
    if (isSingleton) {
      const existing = orderedWidgets.find((widget) => widget.type === type);
      if (existing) {
        setSelectedWidgetId(existing.id);
        setPanelFeedback({
          type: 'info',
          text: '해당 타입의 위젯이 이미 존재합니다. 목록에서 선택해 편집하세요.',
        });
        return;
      }
    }
    try {
      const payload = buildInitialWidgetPayload(type, community);
      const created = await createMutation.mutateAsync(payload);
      setSelectedWidgetId(created.id);
      setPanelFeedback({ type: 'success', text: '위젯을 생성했습니다.' });
    } catch (error: any) {
      setPanelFeedback({
        type: 'error',
        text: error?.message || '위젯 생성 중 오류가 발생했습니다.',
      });
    }
  };

  const handleDeleteWidget = async (widgetId: string) => {
    try {
      await deleteMutation.mutateAsync(widgetId);
      setPanelFeedback({ type: 'success', text: '위젯을 삭제했습니다.' });
      setSelectedWidgetId((prev) => {
        if (prev === widgetId) {
          const remaining = orderedWidgets.filter((widget) => widget.id !== widgetId);
          return remaining[0]?.id || null;
        }
        return prev;
      });
    } catch (error: any) {
      setPanelFeedback({
        type: 'error',
        text: error?.message || '위젯을 삭제하지 못했습니다.',
      });
    }
  };

  const handleToggleWidget = async (widgetId: string, nextValue: boolean) => {
    setPanelFeedback({
      type: 'info',
      text: nextValue ? '위젯을 표시하도록 전환하는 중...' : '위젯을 숨기는 중...',
    });
    try {
      await updateMutation.mutateAsync({
        widgetId,
        dto: { isEnabled: nextValue },
      });
      setPanelFeedback({
        type: 'success',
        text: nextValue ? '위젯을 활성화했습니다.' : '위젯을 비활성화했습니다.',
      });
    } catch (error: any) {
      setPanelFeedback({
        type: 'error',
        text: error?.message || '표시 상태를 업데이트하지 못했습니다.',
      });
    }
  };

  const handleWidgetSave = async (dto: UpdateCommunityWidgetInput) => {
    if (!selectedWidget) return;
    setEditorFeedback({ type: 'info', text: '위젯을 저장하는 중입니다...' });
    try {
      await updateMutation.mutateAsync({
        widgetId: selectedWidget.id,
        dto,
      });
      setEditorFeedback({ type: 'success', text: '위젯을 저장했습니다.' });
    } catch (error: any) {
      setEditorFeedback({
        type: 'error',
        text: error?.message || '위젯을 저장하지 못했습니다.',
      });
      throw error;
    }
  };

  const handleWidgetImageUpload = async (_index: number, file: File) => {
    if (!selectedWidget) throw new Error('선택된 위젯이 없습니다.');
    setEditorFeedback({ type: 'info', text: '이미지를 업로드하는 중입니다...' });
    try {
      const result = await uploadMutation.mutateAsync({ widgetId: selectedWidget.id, file });
      setEditorFeedback({ type: 'success', text: '이미지를 업로드했습니다.' });
      return result.url;
    } catch (error: any) {
      setEditorFeedback({
        type: 'error',
        text: error?.message || '이미지 업로드에 실패했습니다.',
      });
      throw error;
    }
  };

  if (isCommunityLoading || isWidgetsLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300">
        <Loader2 className="w-4 h-4 animate-spin" />
        로딩 중...
      </div>
    );
  }

  if (!community) {
    return <p className="text-sm text-red-500">커뮤니티 정보를 불러올 수 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className={SETTINGS_SECTION_TITLE_CLASS}>커뮤니티 위젯</h1>
          <p className={SETTINGS_SECTION_DESCRIPTION_CLASS}>
            오른쪽 사이드바에 표시할 콘텐츠를 구성하고 순서를 조정하세요.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={`${SETTINGS_PRIMARY_BUTTON_CLASS} inline-flex items-center gap-2`}>
              <Plus className="w-4 h-4" />
              위젯 추가
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {widgetTypeOptions.map((option) => {
              const isSingleton = SINGLETON_WIDGET_TYPES.includes(option.type);
              const alreadyExists =
                isSingleton && orderedWidgets.some((widget) => widget.type === option.type);
              return (
                <DropdownMenuItem
                  key={option.type}
                  disabled={alreadyExists}
                  onClick={() => handleCreateWidget(option.type)}
                >
                  <div>
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-300">{option.description}</p>
                    {alreadyExists && (
                      <p className="text-[11px] font-medium text-amber-600 mt-1">
                        이미 추가된 위젯입니다.
                      </p>
                    )}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {panelFeedback && (
        <div
          className={cn(
            'rounded-2xl border px-4 py-3 text-sm',
            panelFeedback.type === 'error'
              ? `${DESTRUCTIVE_SURFACE_CLASS} text-[#7A271A] dark:text-red-200`
              : panelFeedback.type === 'success'
                ? 'border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-[#2F3440] dark:bg-[#1F2229] dark:text-gray-300'
          )}
        >
          {panelFeedback.text}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className={`${SETTINGS_CARD_CLASS} p-3 dark:bg-[#181c2c] dark:border-[#2d3447]`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">위젯 목록</h2>
            {isWidgetsFetching && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={orderedWidgets.map((widget) => widget.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {orderedWidgets.map((widget) => (
                  <SortableWidgetRow
                    key={widget.id}
                    widget={widget}
                    isActive={widget.id === selectedWidgetId}
                    onSelect={() => setSelectedWidgetId(widget.id)}
                    onToggle={(nextValue) => handleToggleWidget(widget.id, nextValue)}
                    onDelete={() => handleDeleteWidget(widget.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <div className={`${SETTINGS_CARD_CLASS} p-4 min-h-[400px] dark:bg-[#181c2c] dark:border-[#2d3447]`}>
          {selectedWidget ? (
            <WidgetEditorForm
              community={community}
              widget={selectedWidget}
              onSave={handleWidgetSave}
              onUploadImage={handleWidgetImageUpload}
            />
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-300">
              추가하거나 편집할 위젯을 왼쪽 목록에서 선택하세요.
            </div>
          )}
          {editorFeedback && (
            <p
              className={cn(
                'mt-4 text-sm',
                editorFeedback.type === 'error'
                  ? 'text-red-500 dark:text-red-400'
                  : editorFeedback.type === 'success'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'
              )}
            >
              {editorFeedback.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableWidgetRow({
  widget,
  isActive,
  onSelect,
  onToggle,
  onDelete,
}: {
  widget: CommunitySidebarWidget;
  isActive: boolean;
  onSelect: () => void;
  onToggle: (nextValue: boolean) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-xl border p-2 text-sm cursor-pointer shadow-sm transition-colors',
        isActive
          ? 'border-[#6D79FF] bg-[#6D79FF]/10 dark:bg-[#2A2F3A]'
          : 'border-gray-200 dark:border-[#2F3440] bg-white dark:bg-[#1F2229] hover:border-gray-300 dark:hover:border-[#3A414F]',
        isDragging && 'opacity-80',
      )}
      onClick={onSelect}
    >
      <button
        type="button"
        className="text-gray-400 hover:text-gray-600 dark:text-gray-300"
        {...attributes}
        {...listeners}
        onClick={(event) => event.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
          {resolveWidgetTitle(widget)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-300">{widget.isEnabled ? '표시 중' : '비활성화'}</p>
      </div>
      <Switch
        checked={widget.isEnabled}
        onCheckedChange={(next) => onToggle(next)}
        onClick={(event) => event.stopPropagation()}
      />
      {!['community_rules'].includes(widget.type) && (
        <button
          type="button"
          className="text-gray-400 hover:text-red-500"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
