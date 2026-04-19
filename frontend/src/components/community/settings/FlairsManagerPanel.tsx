'use client';

import { useState, useMemo } from 'react';
import {
  useCommunityFlairs,
  useCreateCommunityFlair,
  useUpdateCommunityFlair,
  useDeleteCommunityFlair,
} from '@/hooks/community/useCommunityFlairs';
import { FlairType } from '@/types/community';
import type { CommunityFlair, FlairTypeType } from '@/types/community';
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
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLOR_PRESETS = [
  { bg: '#ef4444', text: '#ffffff', label: 'Red' },
  { bg: '#f97316', text: '#ffffff', label: 'Orange' },
  { bg: '#eab308', text: '#000000', label: 'Yellow' },
  { bg: '#22c55e', text: '#ffffff', label: 'Green' },
  { bg: '#3b82f6', text: '#ffffff', label: 'Blue' },
  { bg: '#8b5cf6', text: '#ffffff', label: 'Purple' },
  { bg: '#ec4899', text: '#ffffff', label: 'Pink' },
  { bg: '#6b7280', text: '#ffffff', label: 'Gray' },
];

interface FlairsManagerPanelProps {
  slug: string;
  embedded?: boolean;
  initialFlairs?: CommunityFlair[];
}

export default function FlairsManagerPanel({ slug, embedded = false, initialFlairs }: FlairsManagerPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingFlair, setEditingFlair] = useState<CommunityFlair | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommunityFlair | null>(null);

  const { data: flairs, isLoading } = useCommunityFlairs(slug, undefined, { initialData: initialFlairs });
  const createMutation = useCreateCommunityFlair(slug);
  const updateMutation = useUpdateCommunityFlair(slug);
  const deleteMutation = useDeleteCommunityFlair(slug);

  const [newFlair, setNewFlair] = useState({
    name: '',
    type: FlairType.POST as FlairTypeType,
    backgroundColor: '#3b82f6',
    textColor: '#ffffff',
    isModOnly: false,
  });

  const [editState, setEditState] = useState({
    name: '',
    backgroundColor: '#3b82f6',
    textColor: '#ffffff',
    isModOnly: false,
  });

  const filteredFlairs = useMemo(() => flairs || [], [flairs]);

  const resetCreate = () => {
    setNewFlair({
      name: '',
      type: FlairType.POST,
      backgroundColor: '#3b82f6',
      textColor: '#ffffff',
      isModOnly: false,
    });
    setIsCreating(false);
  };

  const handleCreate = async () => {
    if (!newFlair.name.trim()) return;
    await createMutation.mutateAsync({
      name: newFlair.name.trim(),
      type: newFlair.type,
      backgroundColor: newFlair.backgroundColor,
      textColor: newFlair.textColor,
      isModOnly: newFlair.isModOnly,
      isEnabled: true,
    });
    resetCreate();
  };

  const handleEditStart = (flair: CommunityFlair) => {
    setEditingFlair(flair);
    setEditState({
      name: flair.name,
      backgroundColor: flair.backgroundColor || '#3b82f6',
      textColor: flair.textColor || '#ffffff',
      isModOnly: flair.isModOnly,
    });
  };

  const handleEditSave = async () => {
    if (!editingFlair || !editState.name.trim()) return;
    await updateMutation.mutateAsync({
      flairId: editingFlair.id,
      dto: {
        name: editState.name.trim(),
        backgroundColor: editState.backgroundColor,
        textColor: editState.textColor,
        isModOnly: editState.isModOnly,
      },
    });
    setEditingFlair(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

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
            Post flairs
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage the flairs used to categorize and highlight posts.
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreating(true)} disabled={isCreating}>
          <Plus className="w-4 h-4 mr-1" />
          Add flair
        </Button>
      </header>



      {isCreating && (
        <div className="rounded-xl border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-3">
          <Input
            value={newFlair.name}
            onChange={(event) => setNewFlair((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Flair name"
          />
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.bg}
                type="button"
                onClick={() =>
                  setNewFlair((prev) => ({
                    ...prev,
                    backgroundColor: preset.bg,
                    textColor: preset.text,
                  }))
                }
                className={cn(
                  'w-6 h-6 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  newFlair.backgroundColor === preset.bg
                    ? 'ring-2 ring-blue-600 dark:ring-blue-400 ring-offset-2 ring-offset-blue-50 dark:ring-offset-gray-900 scale-110'
                    : 'hover:scale-110',
                )}
                style={{ backgroundColor: preset.bg }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={newFlair.isModOnly}
              onCheckedChange={(checked) =>
                setNewFlair((prev) => ({ ...prev, isModOnly: checked }))
              }
            />
            <span className="text-xs text-gray-500">Moderators only</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant='outline' size='sm' onClick={resetCreate}>
              Cancel
            </Button>
            <Button size='sm' onClick={handleCreate}>
              Save
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {isLoading && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-sm text-gray-500">
            Loading flairs...
          </div>
        )}
        {!isLoading &&
          filteredFlairs.map((flair) => {
            const isEditing = editingFlair?.id === flair.id;
            return (
              <div
                key={flair.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[rgb(34,34,34)] p-4"
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <Input
                      value={editState.name}
                      onChange={(event) => setEditState((prev) => ({ ...prev, name: event.target.value }))}
                    />
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.bg}
                          type="button"
                          onClick={() =>
                            setEditState((prev) => ({
                              ...prev,
                              backgroundColor: preset.bg,
                              textColor: preset.text,
                            }))
                          }
                          className={cn(
                            'w-6 h-6 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                            editState.backgroundColor === preset.bg
                              ? 'ring-2 ring-blue-600 dark:ring-blue-400 ring-offset-2 ring-offset-white dark:ring-offset-[#222222] scale-110'
                              : 'hover:scale-110',
                          )}
                          style={{ backgroundColor: preset.bg }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editState.isModOnly}
                        onCheckedChange={(checked) =>
                          setEditState((prev) => ({ ...prev, isModOnly: checked }))
                        }
                      />
                      <span className="text-xs text-gray-500">Moderators only</span>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingFlair(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleEditSave}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="rounded-full px-3 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: flair.backgroundColor || '#3b82f6',
                          color: flair.textColor || '#ffffff',
                        }}
                      >
                        {flair.name}
                      </span>
                      {flair.isModOnly && (
                        <span className="text-xs text-gray-500">Moderators only</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditStart(flair)}
                        className="rounded-full bg-gray-100 dark:bg-gray-800 p-2 text-gray-500 hover:text-blue-500"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(flair)}
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
        {!isLoading && filteredFlairs.length === 0 && (
          <p className="text-sm text-gray-500">No flairs match the current conditions.</p>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete flair</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the flair "{deleteTarget?.name}"?
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
