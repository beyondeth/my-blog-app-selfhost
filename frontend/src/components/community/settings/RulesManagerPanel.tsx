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
import Linkify from 'linkify-react';

const TITLE_MAX_LENGTH = 30;
const DESCRIPTION_MAX_LENGTH = 300;

interface RulesManagerPanelProps {
  slug: string;
  embedded?: boolean;
  showNumbering?: boolean;
  onShowNumberingChange?: (show: boolean) => void;
}

// linkify-react 옵션
const linkifyOptions = {
  className: 'text-blue-600 dark:text-blue-400 hover:underline',
  target: '_blank',
  rel: 'noopener noreferrer',
};

export default function RulesManagerPanel({ 
  slug, 
  embedded = false,
  showNumbering,
  onShowNumberingChange
}: RulesManagerPanelProps) {
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
            Community rules
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Add and organize the rules that guide this community.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {onShowNumberingChange && (
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Show numbering</span>
              <input
                type="checkbox"
                checked={showNumbering}
                onChange={(e) => onShowNumberingChange(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
          )}
          <Button size="sm" onClick={() => setIsCreating(true)} disabled={isCreating}>
            <Plus className="w-4 h-4 mr-1" />
            Add rule
          </Button>
        </div>
      </header>

      {isCreating && (
        <div className="rounded-xl border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Rule title</label>
              <span className="text-xs text-gray-500">{newTitle.length}/{TITLE_MAX_LENGTH}</span>
            </div>
            <input
              type="text"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value.slice(0, TITLE_MAX_LENGTH))}
              placeholder="Rule title"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Description (optional)</label>
              <span className="text-xs text-gray-500">{newDescription.length}/{DESCRIPTION_MAX_LENGTH}</span>
            </div>
            <textarea
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
              placeholder="Description (optional) - links are allowed"
              rows={3}
              className="w-full max-w-2xl rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate}>
              Save
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {isLoading && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 animate-pulse text-sm text-gray-500">
            Loading rules...
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
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Rule title</label>
                        <span className="text-xs text-gray-500">{editTitle.length}/{TITLE_MAX_LENGTH}</span>
                      </div>
                      <input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value.slice(0, TITLE_MAX_LENGTH))}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Description (optional)</label>
                        <span className="text-xs text-gray-500">{editDescription.length}/{DESCRIPTION_MAX_LENGTH}</span>
                      </div>
                      <textarea
                        value={editDescription}
                        onChange={(event) => setEditDescription(event.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
                        rows={3}
                        className="w-full max-w-2xl rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={handleEditCancel}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleEditSave}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <GripVertical className="w-4 h-4 mt-1 text-gray-400" />
                    <div className="flex-1 min-w-0 max-w-2xl">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {rule.title}
                      </h3>
                      {rule.description && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line">
                          <Linkify options={linkifyOptions}>
                            {rule.description}
                          </Linkify>
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
          <p className="text-sm text-gray-500">No rules added yet.</p>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rule</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the rule "{deleteTarget?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
