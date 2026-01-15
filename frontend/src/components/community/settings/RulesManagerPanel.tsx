'use client';

import { useState, useCallback } from 'react';
import {
  useCommunityRules,
  useCreateCommunityRule,
  useUpdateCommunityRule,
  useDeleteCommunityRule,
} from '@/hooks/community/useCommunityRules';
import type { CommunityRule } from '@/types/community';
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
import { cn } from '@/lib/utils';
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react';

interface RulesManagerPanelProps {
  slug: string;
  embedded?: boolean;
}

export default function RulesManagerPanel({ slug, embedded = false }: RulesManagerPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingRule, setEditingRule] = useState<CommunityRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommunityRule | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const { data: rules, isLoading } = useCommunityRules(slug);
  const createMutation = useCreateCommunityRule(slug);
  const updateMutation = useUpdateCommunityRule(slug);
  const deleteMutation = useDeleteCommunityRule(slug);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    await createMutation.mutateAsync({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      displayOrder: (rules?.length || 0) + 1,
    });
    setNewTitle('');
    setNewDescription('');
    setIsCreating(false);
  }, [createMutation, newDescription, newTitle, rules?.length]);

  const handleEditStart = useCallback((rule: CommunityRule) => {
    setEditingRule(rule);
    setEditTitle(rule.title);
    setEditDescription(rule.description || '');
  }, []);

  const handleEditCancel = useCallback(() => {
    setEditingRule(null);
    setEditTitle('');
    setEditDescription('');
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingRule || !editTitle.trim()) return;
    await updateMutation.mutateAsync({
      ruleId: editingRule.id,
      dto: {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
      },
    });
    handleEditCancel();
  }, [editDescription, editingRule, editTitle, handleEditCancel, updateMutation]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteMutation, deleteTarget]);

  return (
    <section
      className={cn(
        'space-y-4',
        embedded &&
          'rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[rgb(34,34,34)] p-4',
      )}
    >
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            커뮤니티 규칙
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            커뮤니티 운영 원칙을 추가하고 정렬하세요.
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreating(true)} disabled={isCreating}>
          <Plus className="w-4 h-4 mr-1" />
          규칙 추가
        </Button>
      </header>

      {isCreating && (
        <div className="rounded-xl border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-3">
          <input
            type="text"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="규칙 제목"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
          <textarea
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
            placeholder="설명 (선택)"
            rows={3}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCreating(false)}>
              취소
            </Button>
            <Button size="sm" onClick={handleCreate}>
              저장
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {isLoading && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 animate-pulse text-sm text-gray-500">
            규칙을 불러오는 중...
          </div>
        )}
        {!isLoading &&
          (rules || []).map((rule) => {
            const isEditing = editingRule?.id === rule.id;
            return (
              <div
                key={rule.id}
                className={cn(
                  'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[rgb(36,36,36)] p-4 transition-shadow',
                  isEditing && 'ring-2 ring-blue-400',
                )}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={handleEditCancel}>
                        취소
                      </Button>
                      <Button size="sm" onClick={handleEditSave}>
                        저장
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <GripVertical className="w-4 h-4 mt-1 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {rule.title}
                      </h3>
                      {rule.description && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line">
                          {rule.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditStart(rule)}
                        className="rounded-full bg-gray-100 dark:bg-gray-800 p-2 text-gray-500 hover:text-blue-500"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(rule)}
                        className="rounded-full bg-gray-100 dark:bg-gray-800 p-2 text-gray-500 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        {!isLoading && (!rules || rules.length === 0) && (
          <p className="text-sm text-gray-500">등록된 규칙이 없습니다.</p>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>규칙 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" 규칙을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
