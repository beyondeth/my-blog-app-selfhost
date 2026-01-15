'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import type { CommunitySidebarWidget } from '@/types/community';
import type { Community } from '@/types/community';

interface WidgetEditorContextValue {
  isEditing: boolean;
  setEditing: (value: boolean) => void;
  selectedWidget: CommunitySidebarWidget | null;
  selectWidget: (widget: CommunitySidebarWidget | null) => void;
  community: Community;
}

const WidgetEditorContext = createContext<WidgetEditorContextValue | null>(null);

export function WidgetEditorProvider({
  community,
  children,
}: {
  community: Community;
  children: React.ReactNode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<CommunitySidebarWidget | null>(null);

  const value = useMemo<WidgetEditorContextValue>(
    () => ({
      isEditing,
      setEditing: setIsEditing,
      selectedWidget,
      selectWidget: setSelectedWidget,
      community,
    }),
    [community, isEditing, selectedWidget],
  );

  return (
    <WidgetEditorContext.Provider value={value}>{children}</WidgetEditorContext.Provider>
  );
}

export function useWidgetEditorContext() {
  const ctx = useContext(WidgetEditorContext);
  if (!ctx) {
    throw new Error('WidgetEditorProvider 하위에서만 사용 가능합니다.');
  }
  return ctx;
}

export function useOptionalWidgetEditorContext() {
  return useContext(WidgetEditorContext);
}
