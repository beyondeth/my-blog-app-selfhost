'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import CommunityInfo from './CommunityInfo';
import ModeratorList from './ModeratorList';
import type { Community, CommunitySidebarWidget } from '@/types/community';
import CommunityWidgetRenderer from './widgets/CommunityWidgetRenderer';
import { Button } from '@/components/ui/button';
import { useOptionalWidgetEditorContext } from './context/WidgetEditorContext';
import { useReorderCommunityWidgets } from '@/hooks/community/useCommunityWidgets';
import { GripVertical } from 'lucide-react';
import SidebarFooter from '@/components/home/SidebarFooter';

interface CommunitySidebarProps {
  community: Community;
  showJoinButton?: boolean;
  /** 플레어 필터링 콜백 (포스트 목록 필터링용) */
  onFlairFilter?: (flairId: string | null) => void;
  /** 현재 선택된 플레어 ID */
  selectedFlairId?: string | null;
  className?: string;
  widgets?: CommunitySidebarWidget[];
  canEditWidgets?: boolean;
}

const EMPTY_WIDGETS: CommunitySidebarWidget[] = [];

/**
 * 커뮤니티 사이드바 컴포넌트
 * 커뮤니티 정보, 규칙, 매니저, 플레어 등을 표시하는 오른쪽 사이드바
 */
const CommunitySidebar = React.memo(function CommunitySidebar({
  community,
  showJoinButton = true,
  onFlairFilter,
  selectedFlairId,
  className,
  widgets: widgetsProp,
  canEditWidgets = false,
}: CommunitySidebarProps) {
  const widgets = widgetsProp ?? EMPTY_WIDGETS;
  const widgetEditor = useOptionalWidgetEditorContext();
  const isEditing = Boolean(widgetEditor?.isEditing && canEditWidgets);
  const selectedWidget = isEditing ? widgetEditor?.selectedWidget ?? null : null;
  const reorderMutation = useReorderCommunityWidgets(community.slug);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const activeWidgets = useMemo(() => {
    if (!widgets.length) {
      return EMPTY_WIDGETS;
    }
    return widgets
      .filter((widget) => widget.isEnabled)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [widgets]);

  const [orderedWidgets, setOrderedWidgets] = useState<CommunitySidebarWidget[]>(activeWidgets);

  useEffect(() => {
    setOrderedWidgets(activeWidgets);
  }, [activeWidgets]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedWidgets((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      const next = arrayMove(items, oldIndex, newIndex);
      reorderMutation.mutate({ items: next.map((widget) => ({ id: widget.id })) });
      return next;
    });
  };

  const renderWidget = (widget: CommunitySidebarWidget) => {
    const content = (
      <CommunityWidgetRenderer
        community={community}
        widget={widget}
        onFlairFilter={onFlairFilter}
        selectedFlairId={selectedFlairId}
      />
    );

    if (!isEditing) {
      return (
        <div key={widget.id}>
          {content}
        </div>
      );
    }

    const isSelected = selectedWidget?.id === widget.id;

    return (
      <SortableEditableWidget
        key={widget.id}
        widget={widget}
        isSelected={isSelected}
        onSelect={() => widgetEditor?.selectWidget(widget)}
      >
        {content}
      </SortableEditableWidget>
    );
  };

  return (
    <aside className={cn('space-y-4', className)}>
      <CommunityInfo community={community} showJoinButton={showJoinButton} />

      {canEditWidgets && (
        <div className="flex items-center justify-between rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
          <span>{isEditing ? 'Sidebar editing is active.' : 'You can edit these widgets directly.'}</span>
          <Button
            variant={isEditing ? 'secondary' : 'outline'}
            size="sm"
            disabled={!widgetEditor}
            onClick={() => {
              if (!canEditWidgets || !widgetEditor) return;
              if (widgetEditor.isEditing) {
                widgetEditor.selectWidget(null);
              }
              widgetEditor.setEditing(!widgetEditor.isEditing);
            }}
          >
            {isEditing ? 'Finish editing' : 'Edit widgets'}
          </Button>
        </div>
      )}

      {isEditing ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={orderedWidgets.map((widget) => widget.id)}
            strategy={verticalListSortingStrategy}
          >
            {orderedWidgets.map((widget) => renderWidget(widget))}
          </SortableContext>
        </DndContext>
      ) : (
        orderedWidgets.map((widget) => renderWidget(widget))
      )}

      <ModeratorList communitySlug={community.slug} userMembership={community.userMembership} />
      <SidebarFooter />
    </aside>
  );
});

export default CommunitySidebar;

interface SortableEditableWidgetProps {
  widget: CommunitySidebarWidget;
  children: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
}

function SortableEditableWidget({
  widget,
  children,
  isSelected,
  onSelect,
}: SortableEditableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('relative rounded-2xl', isDragging && 'z-10 opacity-80')}
    >
      <button
        type="button"
        className="absolute left-3 top-3 z-40 flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 shadow hover:text-gray-800 active:cursor-grabbing dark:bg-[#0f172a] dark:border-[#1f2333] dark:text-gray-200"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3 h-3" />
        Reorder
      </button>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          'group relative block w-full cursor-pointer text-left focus:outline-none',
          isSelected &&
            'ring-2 ring-offset-2 ring-[#4d68ff] rounded-2xl z-20 ring-offset-white dark:ring-offset-[#0b0f19]',
        )}
      >
        <div className="absolute right-3 top-3 z-30 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 shadow group-hover:bg-blue-600 group-hover:text-white dark:bg-[#0b1220]/90 dark:text-gray-100 dark:group-hover:bg-[#4d68ff]">
          Edit
        </div>
        <div className={cn('relative', isSelected && 'z-10 rounded-2xl overflow-hidden')}>
          {children}
        </div>
      </div>
    </div>
  );
}
