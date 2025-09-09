/**
 * Rich Text Editor Hook
 * 에디터 초기화 및 관리를 위한 커스텀 훅
 */

import { useEditor } from '@tiptap/react';
import { useCallback, useEffect } from 'react';
import { getEditorExtensions } from '../config/editor-extensions';
import { isYouTubeUrl, createYouTubeNodeAttrs } from '../utils/youtube.utils';
import { SUCCESS_MESSAGES } from '../constants/editor.constants';

interface UseRichTextEditorProps {
  content?: string;
  placeholder?: string;
  onContentChange?: (content: string) => void;
  onImageUpload?: (file: File) => Promise<{ url: string; id: string }>;
  onYouTubeAdd?: (videoId: string) => void;
}

export const useRichTextEditor = ({
  content = '',
  placeholder,
  onContentChange,
  onImageUpload,
  onYouTubeAdd,
}: UseRichTextEditorProps) => {
  // 에디터 초기화
  const editor = useEditor({
    extensions: getEditorExtensions(placeholder),
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onContentChange?.(html);
    },
  });

  // YouTube 삽입 처리
  const insertYouTube = useCallback((url: string) => {
    if (!editor || !isYouTubeUrl(url)) return false;

    try {
      const attrs = createYouTubeNodeAttrs(url);
      
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'youtube',
          attrs,
        })
        .insertContent('<p></p>')
        .focus('end')
        .run();

      // YouTube ID 추출 및 콜백 실행
      const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
      if (videoIdMatch && onYouTubeAdd) {
        onYouTubeAdd(videoIdMatch[1]);
      }

      return true;
    } catch (error) {
      console.error('YouTube insertion error:', error);
      return false;
    }
  }, [editor, onYouTubeAdd]);

  // 이미지 삽입 처리
  const insertImage = useCallback((url: string, id: string) => {
    if (!editor) return;

    editor
      .chain()
      .focus()
      .setImage({ src: url, alt: '', title: '' })
      .insertContent('<p></p>')
      .focus('end')
      .run();
  }, [editor]);

  // 이미지 업로드 및 삽입
  const uploadAndInsertImage = useCallback(async (file: File) => {
    if (!editor || !onImageUpload) return;

    try {
      const { url, id } = await onImageUpload(file);
      insertImage(url, id);
      return { url, id };
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  }, [editor, onImageUpload, insertImage]);

  // Paste 이벤트 처리
  useEffect(() => {
    if (!editor) return;

    const handlePaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain');
      
      if (text && isYouTubeUrl(text)) {
        event.preventDefault();
        insertYouTube(text);
        return;
      }

      // 이미지 붙여넣기 처리
      const items = event.clipboardData?.items;
      if (items) {
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
              uploadAndInsertImage(file);
            }
            return;
          }
        }
      }
    };

    const editorDom = editor.view.dom;
    editorDom.addEventListener('paste', handlePaste);

    return () => {
      editorDom.removeEventListener('paste', handlePaste);
    };
  }, [editor, insertYouTube, uploadAndInsertImage]);

  // Drop 이벤트 처리
  useEffect(() => {
    if (!editor) return;

    const handleDrop = (event: DragEvent) => {
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        event.preventDefault();
        
        for (const file of Array.from(files)) {
          if (file.type.startsWith('image/')) {
            uploadAndInsertImage(file);
          }
        }
      }
    };

    const editorDom = editor.view.dom;
    editorDom.addEventListener('drop', handleDrop);

    return () => {
      editorDom.removeEventListener('drop', handleDrop);
    };
  }, [editor, uploadAndInsertImage]);

  // 포맷팅 명령
  const commands = {
    // 텍스트 포맷팅
    toggleBold: () => editor?.chain().focus().toggleBold().run(),
    toggleItalic: () => editor?.chain().focus().toggleItalic().run(),
    toggleUnderline: () => editor?.chain().focus().toggleUnderline().run(),
    toggleStrike: () => editor?.chain().focus().toggleStrike().run(),
    toggleCode: () => editor?.chain().focus().toggleCode().run(),
    
    // 제목
    setHeading: (level: 1 | 2 | 3) => 
      editor?.chain().focus().toggleHeading({ level }).run(),
    setParagraph: () => editor?.chain().focus().setParagraph().run(),
    
    // 리스트
    toggleBulletList: () => editor?.chain().focus().toggleBulletList().run(),
    toggleOrderedList: () => editor?.chain().focus().toggleOrderedList().run(),
    
    // 정렬
    setTextAlign: (align: 'left' | 'center' | 'right') => 
      editor?.chain().focus().setTextAlign(align).run(),
    
    // 코드 블록
    toggleCodeBlock: () => editor?.chain().focus().toggleCodeBlock().run(),
    
    // 링크
    setLink: (url: string) => 
      editor?.chain().focus().setLink({ href: url }).run(),
    unsetLink: () => editor?.chain().focus().unsetLink().run(),
    
    // 실행 취소/재실행
    undo: () => editor?.chain().focus().undo().run(),
    redo: () => editor?.chain().focus().redo().run(),
  };

  // 상태 확인
  const isActive = {
    bold: editor?.isActive('bold') ?? false,
    italic: editor?.isActive('italic') ?? false,
    underline: editor?.isActive('underline') ?? false,
    strike: editor?.isActive('strike') ?? false,
    code: editor?.isActive('code') ?? false,
    heading: (level: number) => editor?.isActive('heading', { level }) ?? false,
    bulletList: editor?.isActive('bulletList') ?? false,
    orderedList: editor?.isActive('orderedList') ?? false,
    codeBlock: editor?.isActive('codeBlock') ?? false,
    link: editor?.isActive('link') ?? false,
    textAlign: (align: string) => editor?.isActive({ textAlign: align }) ?? false,
  };

  return {
    editor,
    commands,
    isActive,
    insertYouTube,
    insertImage,
    uploadAndInsertImage,
  };
};