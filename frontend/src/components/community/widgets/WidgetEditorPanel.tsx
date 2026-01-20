'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { CommunitySidebarWidget, UpdateCommunityWidgetInput } from '@/types/community';
import { useWidgetEditorContext } from '../context/WidgetEditorContext';
import WidgetEditorForm, { buildInitialWidgetPayload, widgetTypeOptions } from './WidgetEditorForm';
import { resolveWidgetTitle } from './titleUtils';
import { cn } from '@/lib/utils';
import {
  useUpdateCommunityWidget,
  useUploadCommunityWidgetImage,
  useCreateCommunityWidget,
  useDeleteCommunityWidget,
} from '@/hooks/community/useCommunityWidgets';
import { SINGLETON_WIDGET_TYPES } from './constants';

interface WidgetEditorPanelProps {
  widgets: CommunitySidebarWidget[];
}

export default function WidgetEditorPanel({ widgets }: WidgetEditorPanelProps) {
  const { isEditing, selectedWidget, selectWidget, setEditing, community } = useWidgetEditorContext();
  const updateMutation = useUpdateCommunityWidget(community.slug);
  const createMutation = useCreateCommunityWidget(community.slug);
  const uploadMutation = useUploadCommunityWidgetImage(community.slug);
  const deleteMutation = useDeleteCommunityWidget(community.slug);
  const [status, setStatus] = useState<string>('');
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [localWidgets, setLocalWidgets] = useState<CommunitySidebarWidget[]>(widgets);
  useEffect(() => {
    setLocalWidgets(widgets);
  }, [widgets]);
  const sortedWidgets = useMemo(() => {
    // Deduplicate by ID to prevent duplicate widgets from appearing
    const uniqueMap = new Map<string, CommunitySidebarWidget>();
    localWidgets.forEach((widget) => {
      if (!uniqueMap.has(widget.id)) {
        uniqueMap.set(widget.id, widget);
      }
    });
    const result = Array.from(uniqueMap.values()).sort((a, b) => a.orderIndex - b.orderIndex);
    
    // Debug logging
    if (localWidgets.length !== result.length) {
      console.log('[Widget Editor] Duplicate widgets detected!');
      console.log('Original count:', localWidgets.length);
      console.log('After dedup:', result.length);
      console.log('Duplicates:', localWidgets.filter((w, i, arr) => 
        arr.findIndex(w2 => w2.id === w.id) !== i
      ));
    }
    
    return result;
  }, [localWidgets]);

  const widget = useMemo(() => {
    if (!selectedWidget) return null;
    return sortedWidgets.find((item) => item.id === selectedWidget.id) ?? selectedWidget;
  }, [selectedWidget, sortedWidgets]);

  useEffect(() => {
    setStatus('');
  }, [isEditing, widget?.id]);

  const handleSave = async (dto: UpdateCommunityWidgetInput) => {
    if (!widget) return;
    setStatus('저장 중...');
    try {
      await updateMutation.mutateAsync({ widgetId: widget.id, dto });
      setStatus('저장되었습니다.');
    } catch (error: any) {
      setStatus(error?.message || '저장에 실패했습니다.');
    }
  };

  const handleCreateWidget = async (type: string) => {
    setPendingType(type);
    setStatus('새 위젯을 추가하는 중...');
    try {
      const payload = buildInitialWidgetPayload(type as any, community);
      const created = await createMutation.mutateAsync(payload);
      selectWidget(created);
      setLocalWidgets((prev) => [...prev, created]);
      setStatus('새 위젯이 추가되었습니다. 사이드바를 확인하세요.');
    } catch (error: any) {
      setStatus(error?.message || '위젯 추가에 실패했습니다.');
    } finally {
      setPendingType(null);
    }
  };

  const deletableTypes = useMemo(
    () =>
      new Set<CommunitySidebarWidget['type']>([
        'text',
        'buttons',
        'bookmarks',
        'images',
        'community_list',
        'calendar',
        'post_flairs',
      ]),
    [],
  );

  const canDeleteSelected = Boolean(widget && deletableTypes.has(widget.type));

  const handleDeleteWidget = async (widgetId: string) => {
    setStatus('위젯을 삭제하는 중...');
    try {
      await deleteMutation.mutateAsync(widgetId);
      setStatus('위젯을 삭제했습니다.');
      setLocalWidgets((prev) => prev.filter((widgetItem) => widgetItem.id !== widgetId));
      if (selectedWidget?.id === widgetId) {
        selectWidget(null);
      }
    } catch (error: any) {
      setStatus(error?.message || '위젯을 삭제하지 못했습니다.');
    } finally {
      setPendingDeleteId(null);
    }
  };

  return (
    <>
    <AnimatePresence>
      {isEditing && (
        <motion.div
          initial={{ y: 160, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 160, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-4 left-36 z-40 w-[420px]"
        >
          <div className="rounded-3xl border border-gray-200 dark:border-[#3C3D37] bg-white dark:bg-[#181C14] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] text-gray-900 dark:text-white">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#3C3D37]">
              <div className="flex flex-col gap-1">
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {widget?.title || '위젯 선택'}
                </p>
                <span className="text-xs text-gray-600 dark:text-gray-200">
                  {status || '사이드바에서 위젯을 선택해 구성하세요.'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => selectWidget(null)}>
                  초기화
                </Button>
                <Button size="sm" onClick={() => setEditing(false)}>
                  닫기
                </Button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-6 space-y-5 bg-white dark:bg-transparent">
              <section className="space-y-3 rounded-2xl border border-gray-200 dark:border-[#3C3D37] bg-gray-50 dark:bg-[#3C3D37] p-4">
                <p className="text-sm font-semibold">위젯 추가</p>
                <div className="flex flex-wrap gap-2">
                  {widgetTypeOptions.map((option) => {
                    const isSelectedType = selectedWidget?.type === option.type;
                    const isSingleton = SINGLETON_WIDGET_TYPES.includes(option.type);
                    const existingWidget = sortedWidgets.find((item) => item.type === option.type);
                    const alreadyExists = isSingleton && Boolean(existingWidget);
                    return (
                      <Button
                        key={option.type}
                        variant={alreadyExists ? 'secondary' : 'outline'}
                        size="sm"
                        className={cn(
                          'transition-colors duration-150',
                          alreadyExists
                            ? 'border border-[#4d68ff] bg-[#4d68ff] text-white'
                            : 'border border-gray-200 text-gray-900 dark:text-white dark:border-[#55584f] bg-white dark:bg-[#181C14]',
                          'hover:bg-[#111827] hover:text-white',
                          alreadyExists
                            ? 'dark:hover:bg-[#4d68ff] dark:hover:text-white'
                            : 'dark:hover:bg-accent dark:hover:text-accent-foreground',
                          isSelectedType &&
                            'ring-2 ring-offset-1 ring-[#f66b6b] dark:ring-[#f66b6b] ring-offset-white dark:ring-offset-[#181C14]',
                        )}
                        disabled={pendingType === option.type}
                        onClick={() => {
                          if (alreadyExists && existingWidget) {
                            selectWidget(existingWidget);
                            setStatus(`${option.label} 위젯 설정을 열었습니다.`);
                            return;
                          }
                          handleCreateWidget(option.type);
                        }}
                        title={
                          alreadyExists
                            ? '이미 추가된 위젯입니다. 버튼을 눌러 구성 화면으로 이동하세요.'
                            : option.description
                        }
                      >
                        {pendingType === option.type ? '추가 중...' : option.label}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-700 dark:text-white">
                  말머리/규칙/북마크 등 일부 위젯은 커뮤니티당 1개만 존재합니다. 이미 존재한다면 목록에서 선택해 수정하세요.
                </p>
              </section>

              <section className="space-y-3 rounded-2xl border border-gray-200 dark:border-[#3C3D37] bg-gray-50 dark:bg-[#3C3D37] p-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">현재 위젯</p>
                <div className="flex flex-wrap gap-2">
                  {sortedWidgets.map((item) => {
                    const isSelected = selectedWidget?.id === item.id;
                    return (
                    <div key={item.id} className="relative">
                      <Button
                        size="sm"
                        variant={selectedWidget?.id === item.id ? 'secondary' : 'outline'}
                        className={cn(
                          'border transition-colors duration-150',
                          selectedWidget?.id === item.id
                            ? 'bg-[#4d68ff] text-white border-[#4d68ff]'
                            : 'text-gray-900 dark:text-white border-gray-200 dark:border-[#55584f] bg-white dark:bg-[#181C14]',
                          'hover:bg-[#111827] hover:text-white',
                          selectedWidget?.id === item.id
                            ? 'dark:hover:bg-[#4d68ff] dark:hover:text-white'
                            : 'dark:hover:bg-accent dark:hover:text-accent-foreground',
                          isSelected &&
                            'ring-2 ring-offset-1 ring-[#f66b6b] dark:ring-[#f66b6b] ring-offset-white dark:ring-offset-[#181C14]',
                        )}
                        onClick={() => selectWidget(item)}
                      >
                        <span className="flex items-center gap-2">
                          {resolveWidgetTitle(item)}
                          {!item.isEnabled && (
                            <span
                              className={cn(
                                'text-[11px] font-medium transition-colors',
                                selectedWidget?.id === item.id
                                  ? 'text-[#ffc46d]'
                                  : 'text-amber-600 dark:text-amber-200',
                              )}
                            >
                              비활성
                            </span>
                          )}
                        </span>
                      </Button>
                      {deletableTypes.has(item.type) && (
                        <button
                          type="button"
                          className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white text-[9px] shadow focus:outline-none dark:bg-white dark:text-[#181C14]"
                          onClick={() => setPendingDeleteId(item.id)}
                          aria-label={`${resolveWidgetTitle(item)} 삭제`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )})}
                  {sortedWidgets.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-200">
                      아직 위젯이 없습니다. 위에서 타입을 선택해 추가해보세요.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 dark:border-[#3C3D37] bg-gray-50 dark:bg-[#3C3D37] p-4 text-gray-900 dark:text-white">
                {widget ? (
                  <WidgetEditorForm
                    community={community}
                    widget={widget}
                    onSave={handleSave}
                    onUploadImage={(index, file) =>
                      uploadMutation.mutateAsync({ widgetId: widget.id, file }).then((res) => res.url)
                    }
                  />
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-200">
                    위젯을 선택하거나 새로운 위젯을 추가하면 이곳에서 상세 설정을 수정할 수 있습니다.
                  </p>
                )}
              </section>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    <AlertDialog open={Boolean(pendingDeleteId)} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
      <AlertDialogContent className="bg-white dark:bg-[#0b1220] dark:text-gray-100 border border-gray-100 dark:border-[#24304a]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-gray-900 dark:text-gray-50">위젯을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-600 dark:text-gray-300">
            삭제하면 해당 위젯의 설정과 내용이 모두 사라집니다. 다시 추가해야 복원할 수 있습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-gray-100 text-gray-800 dark:bg-[#161c2d] dark:text-gray-100 border border-gray-200 dark:border-[#2c344b]">
            취소
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => pendingDeleteId && handleDeleteWidget(pendingDeleteId)}
            className="bg-[#ef4444] hover:bg-[#dc2626] focus:ring-[#ef4444] text-white"
            disabled={deleteMutation.isPending}
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
