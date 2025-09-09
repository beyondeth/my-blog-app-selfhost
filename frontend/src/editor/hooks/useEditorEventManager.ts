/**
 * useEditorEventManager Hook
 * 에디터 관련 모든 window event listener를 통합 관리
 */

import { useEffect } from 'react';
import { Editor } from '@tiptap/react';

interface EventHandlers {
  onImageUpload?: (file: File) => Promise<{ url: string; id: string }>;
  onYouTubeEmbed?: (url: string) => void;
  onCleanup?: () => void;
  imageTracker?: {
    trackedFiles: any[];
  };
  enableCleanupOnUnmount?: boolean;
}

export function useEditorEventManager(
  editor: Editor | null,
  handlers: EventHandlers
) {
  const {
    onImageUpload,
    onYouTubeEmbed,
    onCleanup,
    imageTracker,
    enableCleanupOnUnmount = false,
  } = handlers;

  // 슬래시 커맨드 이미지 업로드 이벤트
  useEffect(() => {
    if (!editor || !onImageUpload) return;

    const handleSlashImageUpload = async (event: CustomEvent) => {
      const { file, editor: eventEditor } = event.detail;
      if (file && eventEditor === editor) {
        try {
          const result = await onImageUpload(file);
          
          if (editor && !editor.isDestroyed) {
            const attrs: any = {
              src: result.url,
              alt: file.name,
              title: file.name
            };
            attrs['data-image-id'] = result.id;
            
            console.log('[SlashCommand] Inserting image with attributes:', attrs);
            
            editor
              .chain()
              .focus()
              .setImage(attrs)
              .insertContent('<p></p>')
              .focus('end')
              .run();
          }
        } catch (error) {
          console.error('슬래시 커맨드 이미지 업로드 실패:', error);
        }
      }
    };

    window.addEventListener('editorImageUpload', handleSlashImageUpload as any);
    return () => {
      window.removeEventListener('editorImageUpload', handleSlashImageUpload as any);
    };
  }, [editor, onImageUpload]);

  // YouTube 임베드 추가 이벤트
  useEffect(() => {
    if (!editor || !onYouTubeEmbed) return;

    const handleYouTubeEmbed = (event: CustomEvent) => {
      const { url, editor: eventEditor } = event.detail;
      if (url && eventEditor === editor) {
        onYouTubeEmbed(url);
      }
    };
    
    window.addEventListener('youtubeEmbedAdded', handleYouTubeEmbed as any);
    return () => {
      window.removeEventListener('youtubeEmbedAdded', handleYouTubeEmbed as any);
    };
  }, [editor, onYouTubeEmbed]);

  // Cleanup 이벤트 (deprecated - 이미지 보존)
  useEffect(() => {
    const handleCleanupEvent = (_event: CustomEvent) => {
      console.log('[Editor] Cleanup event received but ignored - images preserved');
      onCleanup?.();
    };

    window.addEventListener('cleanup-uploaded-files', handleCleanupEvent as EventListener);
    
    return () => {
      window.removeEventListener('cleanup-uploaded-files', handleCleanupEvent as EventListener);
    };
  }, [onCleanup]);

  // 페이지 이탈 시 경고
  useEffect(() => {
    if (!enableCleanupOnUnmount || !imageTracker) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (imageTracker.trackedFiles.length > 0) {
        event.preventDefault();
        console.log('[Editor] Page unload - images preserved for future use');
        // Modern way to show confirmation dialog
        const message = '입력한 내용이 저장되지 않습니다. 정말 떠나시겠습니까?';
        // @ts-ignore - returnValue is deprecated but needed for legacy browser support
        event.returnValue = message;
        return message; // For modern browsers
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enableCleanupOnUnmount, imageTracker]);

  // 컴포넌트 unmount 시 cleanup (deprecated)
  useEffect(() => {
    return () => {
      if (enableCleanupOnUnmount) {
        console.log('[Editor] Cleanup disabled - images preserved for reuse');
      }
    };
  }, [enableCleanupOnUnmount]);
}