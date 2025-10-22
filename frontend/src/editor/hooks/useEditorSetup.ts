/**
 * useEditorSetup Hook
 * 에디터 초기화 및 설정 관리
 */

import { useEditor } from '@tiptap/react';
import { useEffect, useRef } from 'react';
import { getEditorExtensions } from '../config/editor-extensions';
import { createEditorHandlers } from './useEditorHandlers';
import { normalizeImageUrl } from '@/utils/imageUtils';
// YouTube 관련 import 제거 - 더 이상 필요하지 않음

interface EditorSetupProps {
  content: string;
  placeholder?: string;
  onChange: (content: string) => void;
  handleImageUpload: (file: File) => Promise<{ url: string; id: string }>;
  addYouTubeThumbnail: (url: string) => void;
}

/**
 * HTML 내의 모든 이미지 URL을 CDN URL로 정규화
 * S3 URL, 프록시 URL 등을 CDN URL로 변환
 */
function normalizeContentImageUrls(html: string): string {
  if (!html) return html;

  // HTML 내의 모든 img 태그의 src 속성을 CDN URL로 변환
  return html.replace(
    /<img([^>]*?)src="([^"]*)"([^>]*?)>/g,
    (match, beforeSrc, srcUrl, afterSrc) => {
      const normalizedUrl = normalizeImageUrl(srcUrl);
      return `<img${beforeSrc}src="${normalizedUrl}"${afterSrc}>`;
    }
  );
}

export function useEditorSetup({
  content,
  placeholder,
  onChange,
  handleImageUpload,
  addYouTubeThumbnail,
}: EditorSetupProps) {
  const editorRef = useRef<any>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: getEditorExtensions(placeholder),
    content: '',
    parseOptions: {
      preserveWhitespace: 'full',
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[300px] p-4',
      },
    },
    onCreate: ({ editor }) => {
      // 전역 window 객체에 현재 에디터 인스턴스 저장 (YouTube paste rule에서 사용)
      (window as any).currentEditor = editor;
      
      // 커스텀 uploadImage 커맨드 추가
      (editor.commands as any).uploadImage = async (file: File) => {
        try {
          const result = await handleImageUpload(file);
          const attrs: any = {
            src: result.url, 
            alt: file.name,
            title: file.name
          };
          attrs['data-image-id'] = result.id;
          
          editor.chain().focus().setImage(attrs).run();
        } catch (error) {
          console.error('Failed to upload image via command:', error);
        }
      };
      
      // Paste와 Drop 핸들러 설정
      const handlers = createEditorHandlers(editor, {
        handleImageUpload,
      });

      // console.log('[EditorSetup] Setting up paste/drop handlers');

      // editorView에 직접 핸들러 등록
      const { view } = editor;
      const originalHandlePaste = view.props.handlePaste;
      const originalHandleDrop = view.props.handleDrop;

      // console.log('[EditorSetup] Original handlePaste exists:', !!originalHandlePaste);
      // console.log('[EditorSetup] Original handleDrop exists:', !!originalHandleDrop);
      
      // 새로운 props 생성
      const newProps = {
        ...view.props,
        handlePaste: (view: any, event: ClipboardEvent, slice: any) => {
          // console.log('[EditorSetup handlePaste wrapper] Called');
          const handled = handlers.handlePaste(view, event, slice);
          // console.log('[EditorSetup handlePaste wrapper] Handled by custom:', handled);
          if (!handled && originalHandlePaste) {
            // console.log('[EditorSetup handlePaste wrapper] Passing to original handler');
            return originalHandlePaste(view, event, slice);
          }
          return handled;
        },
        handleDrop: (view: any, event: DragEvent, slice: any, moved: boolean) => {
          // console.log('[EditorSetup handleDrop wrapper] Called');
          const handled = handlers.handleDrop(view, event, slice, moved);
          // console.log('[EditorSetup handleDrop wrapper] Handled by custom:', handled);
          if (!handled && originalHandleDrop) {
            return originalHandleDrop(view, event, slice, moved);
          }
          return handled;
        },
      };

      // props 업데이트
      view.setProps(newProps);
      // console.log('[EditorSetup] Props updated with custom handlers');
    },
    onDestroy: () => {
      // 에디터가 파괴될 때 전역 참조 제거
      (window as any).currentEditor = null;
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      // YouTube 감지 로직 제거 - 이벤트 기반으로 처리
    },
  });

  // editor ref 업데이트 및 onChange 핸들러 설정
  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
      
      // 기존 onUpdate 핸들러 제거 후 새로운 핸들러 등록
      editor.off('update');
      editor.on('update', ({ editor }) => {
        const html = editor.getHTML();
        onChange(html);
        // YouTube 감지 로직 제거 - 이벤트 기반으로 처리
      });
      
      // 커스텀 uploadImage 커맨드 재설정 (안전을 위해)
      if (!(editor.commands as any).uploadImage) {
        (editor.commands as any).uploadImage = async (file: File) => {
          try {
            const result = await handleImageUpload(file);
            const attrs: any = {
              src: result.url,
              alt: file.name,
              title: file.name
            };
            attrs['data-image-id'] = result.id;
            
            editor
              .chain()
              .focus()
              .setImage(attrs)
              .insertContent('<p></p>') // 새 단락 추가
              .focus('end') // 커서를 끝으로 이동
              .run();
          } catch (error) {
            console.error('Failed to upload image via command:', error);
          }
        };
      }
    }
  }, [editor, onChange, handleImageUpload]);
  
  // YouTube 임베드 추가 이벤트 리스너
  useEffect(() => {
    const handleYouTubeEmbed = (event: CustomEvent) => {
      const { url } = event.detail;
      // console.log('[useEditorSetup] 🎆 YouTube embed 이벤트 발생! URL:', url);
      // console.log('[useEditorSetup] addYouTubeThumbnail 함수 존재:', !!addYouTubeThumbnail);
      addYouTubeThumbnail(url);
    };

    window.addEventListener('youtubeEmbedAdded', handleYouTubeEmbed as EventListener);

    return () => {
      window.removeEventListener('youtubeEmbedAdded', handleYouTubeEmbed as EventListener);
    };
  }, [addYouTubeThumbnail]);

  // 에디터 초기 콘텐츠 설정
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // 에디터가 포커스되어 있지 않을 때만 내용 업데이트
      if (!editor.isFocused) {
        // 모든 이미지 URL을 CDN URL로 정규화
        const transformedContent = normalizeContentImageUrls(content);
        editor.commands.setContent(transformedContent);
      }
    }
  }, [editor, content]);

  return {
    editor,
    editorRef,
  };
}