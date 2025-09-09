/**
 * useEditorHandlers Hook
 * 에디터의 paste와 drop 핸들러를 관리
 */

import { Editor } from '@tiptap/react';
import { isYouTubeUrl } from '../utils/youtube.utils';

interface HandlersConfig {
  handleImageUpload: (file: File) => Promise<{ url: string; id: string }>;
}

export function createEditorHandlers(editor: Editor | null, config: HandlersConfig) {
  const { handleImageUpload } = config;

  const handleDrop = (_view: any, event: DragEvent, _slice: any, _moved: boolean) => {
    const files = Array.from(event.dataTransfer?.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      event.preventDefault();
      
      imageFiles.forEach(async (file) => {
        try {
          const result = await handleImageUpload(file);
          
          if (editor && !editor.isDestroyed) {
            const attrs: any = {
              src: result.url, 
              alt: file.name,
              title: file.name
            };
            attrs['data-image-id'] = result.id;
            
            console.log('[handleDrop] Inserting image with attributes:', attrs);
            
            editor
              .chain()
              .focus()
              .setImage(attrs)
              .insertContent('<p></p>') // 새 단락 추가
              .focus('end') // 커서를 끝으로 이동  
              .run();
          }
        } catch (error) {
          console.error('Failed to upload dropped image:', error);
        }
      });
      
      return true;
    }
    
    return false;
  };

  const handlePaste = (_view: any, event: ClipboardEvent, _slice: any) => {
    console.log('[handlePaste] Called with event:', event);
    console.log('[handlePaste] Editor exists:', !!editor, 'Editor destroyed:', editor?.isDestroyed);
    
    // 1. YouTube URL 처리 - CustomYoutube extension이 모두 처리하므로 건드리지 않음
    if (event.clipboardData?.types.includes('text/plain')) {
      const text = event.clipboardData.getData('text/plain');
      const trimmedText = text.trim();
      
      console.log('[handlePaste] Clipboard text:', trimmedText);
      
      // YouTube URL이면 CustomYoutube extension이 처리하도록 위임
      if (trimmedText && isYouTubeUrl(trimmedText)) {
        console.log('[handlePaste] YouTube URL detected, letting CustomYoutube handle it');
        // 썸네일 추가 로직 제거 - CustomYoutube extension이 이벤트를 발생시킴
        // CustomYoutube extension이 paste를 처리하도록 false 반환
        return false;
      }
    }
    
    // 2. 이미지 파일 처리
    const items = Array.from(event.clipboardData?.items || []);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    
    if (imageItems.length > 0) {
      event.preventDefault();
      
      imageItems.forEach(item => {
        const file = item.getAsFile();
        if (file) {
          handleImageUpload(file).then(result => {
            if (editor && !editor.isDestroyed) {
              const attrs: any = {
                src: result.url,
                alt: file.name,
                title: file.name
              };
              attrs['data-image-id'] = result.id;
              
              console.log('[handlePaste] Inserting image with attributes:', attrs);
              
              editor
                .chain()
                .focus()
                .setImage(attrs)
                .insertContent('<p></p>') // 새 단락 추가
                .focus('end') // 커서를 끝으로 이동
                .run();
            }
          }).catch(error => {
            console.error('Failed to upload pasted image:', error);
          });
        }
      });
      
      return true;
    }
    
    return false;
  };

  return {
    handleDrop,
    handlePaste,
  };
}