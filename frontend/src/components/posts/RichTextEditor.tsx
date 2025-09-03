"use client";

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Heading from '@tiptap/extension-heading';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { common, createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';

// 리팩토링된 훅들 사용
import { useUploadFile } from '@/hooks/useFiles';
import { usePostImageTracker } from '@/hooks/usePostImageTracker';
import { validateImageFile } from '@/utils/imageUtils';
import { getProxyImageUrl, normalizeImageUrl, debugLog } from '@/utils/imageUtils';
import { getErrorMessage } from '@/utils/queryHelpers';
import EnhancedEditorToolbar from './EnhancedEditorToolbar';
import ImageUploadManager, { UploadedImageInfo } from './ImageUploadManager';
import { useImageUploadManager } from '@/hooks/useImageUploadManager';
import { stripUnderline } from '@/utils/stripUnderline';
import { toast } from 'sonner';
import { suggestion } from './SlashCommands';

// lowlight 인스턴스 생성 및 언어 등록 - Context7 권장사항
const lowlight = createLowlight(common);
lowlight.register({ javascript, typescript, js: javascript, ts: typescript });

// 슬래시 커맨드 Extension
const SlashCommands = Extension.create({
  name: 'slashCommands',
  
  addOptions() {
    return {
      suggestion,
    };
  },
  
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
        ...this.options.suggestion,
      }),
    ];
  },
});

// 커스텀 이미지 확장 - 리사이징 지원 + 이미지 ID 추적
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => element.getAttribute('width'),
        renderHTML: attributes => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      height: {
        default: null,
        parseHTML: element => element.getAttribute('height'),
        renderHTML: attributes => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
      'data-image-id': {
        default: null,
        parseHTML: element => element.getAttribute('data-image-id'),
        renderHTML: attributes => {
          if (!attributes['data-image-id']) return {};
          return { 'data-image-id': attributes['data-image-id'] };
        },
      },
    };
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const container = document.createElement('div');
      container.className = 'image-resizer';
      container.style.cssText = `
        position: relative;
        display: inline-block;
        max-width: 100%;
        margin: 8px 0;
      `;

      const img = document.createElement('img');
      Object.assign(img, HTMLAttributes);
      img.src = node.attrs.src;
      img.alt = node.attrs.alt || '';
      img.title = node.attrs.title || '';
      // Add data-image-id for tracking
      if (node.attrs['data-image-id']) {
        img.setAttribute('data-image-id', node.attrs['data-image-id']);
      }
      img.className = 'editor-image';
      img.style.cssText = `
        max-width: 100%;
        height: auto;
        border-radius: 4px;
        cursor: pointer;
        ${node.attrs.width ? `width: ${node.attrs.width}px;` : ''}
        ${node.attrs.height ? `height: ${node.attrs.height}px;` : ''}
      `;

      // 리사이즈 핸들
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.style.cssText = `
        position: absolute;
        bottom: 0;
        right: 0;
        width: 12px;
        height: 12px;
        background: #3b82f6;
        cursor: se-resize;
        border-radius: 2px;
        opacity: 0;
        transition: opacity 0.2s;
      `;

      // 마우스 호버 시 리사이즈 핸들 표시
      container.addEventListener('mouseenter', () => {
        resizeHandle.style.opacity = '1';
      });
      container.addEventListener('mouseleave', () => {
        resizeHandle.style.opacity = '0';
      });

      // 리사이즈 기능
      let isResizing = false;
      let startX = 0;
      let startY = 0;
      let startWidth = 0;
      let startHeight = 0;

      resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = img.offsetWidth;
        startHeight = img.offsetHeight;
        
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
      });

      const handleResize = (e: MouseEvent) => {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        const newWidth = Math.max(100, startWidth + deltaX);
        const aspectRatio = startHeight / startWidth;
        const newHeight = newWidth * aspectRatio;
        
        img.style.width = `${newWidth}px`;
        img.style.height = `${newHeight}px`;
      };

      const stopResize = () => {
        if (!isResizing) return;
        isResizing = false;
        
        const newWidth = img.offsetWidth;
        const newHeight = img.offsetHeight;
        
        // TipTap 노드 업데이트
        if (typeof getPos === 'function') {
          editor.chain()
            .setNodeSelection(getPos())
            .updateAttributes('image', {
              width: newWidth,
              height: newHeight,
            })
            .run();
        }
        
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
      };

      container.appendChild(img);
      container.appendChild(resizeHandle);

      return {
        dom: container,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'image') return false;
          
          img.src = updatedNode.attrs.src;
          img.alt = updatedNode.attrs.alt || '';
          img.title = updatedNode.attrs.title || '';
          
          if (updatedNode.attrs.width) {
            img.style.width = `${updatedNode.attrs.width}px`;
          }
          if (updatedNode.attrs.height) {
            img.style.height = `${updatedNode.attrs.height}px`;
          }
          
          return true;
        },
      };
    };
  },
});


interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onFilesChange?: (fileIds: string[]) => void;
  onThumbnailSelect?: (thumbnailId: string) => void;
  placeholder?: string;
  className?: string;
  // Enable enhanced image upload manager
  enableImageManager?: boolean;
  // Maximum number of images allowed
  maxImages?: number;
  // 포스트 작성 취소시 cleanup 사용 여부
  enableCleanupOnUnmount?: boolean;
}

export default function BlogRichTextEditor({ 
  content, 
  onChange, 
  onFilesChange,
  onThumbnailSelect,
  placeholder = "내용을 입력하세요...",
  className = "",
  enableImageManager = false,
  maxImages = 5,
  enableCleanupOnUnmount = false
}: RichTextEditorProps) {
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const editorRef = useRef<any>(null);
  
  // Internal state for image management (encapsulation)
  const [images, setImages] = useState<UploadedImageInfo[]>([]);
  const [selectedThumbnailId, setSelectedThumbnailId] = useState<string>('');

  // 리팩토링된 파일 업로드 훅 사용
  const uploadMutation = useUploadFile();
  
  // 포스트 이미지 용량 추적
  const imageTracker = usePostImageTracker();

  // Initialize the editor first (moved from later in the file)
  const editor = useEditor({
    immediatelyRender: false, // Prevent SSR hydration mismatch warning
    extensions: [
      StarterKit.configure({
        // StarterKit의 기본 codeBlock과 heading을 비활성화
        codeBlock: false,
        heading: false,
      }),
      // 이미지 확장 - TipTap 공식 문서 권장 설정
      ResizableImage.configure({
        inline: true, // 텍스트와 함께 인라인으로 표시
        allowBase64: true, // base64 이미지 허용
        HTMLAttributes: {
          class: 'editor-image',
          style: 'max-width: 100%; height: auto; display: inline-block; margin: 4px 0; border-radius: 4px;',
          loading: 'lazy',
        },
      }),
      // 링크 확장
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
        },
      }),
      // 텍스트 스타일과 색상
      TextStyle,
      Color.configure({
        types: ['textStyle'],
      }),
      // 제목 레벨
      Heading.configure({
        levels: [1, 2, 3, 4, 5, 6],
        HTMLAttributes: {
          class: 'editor-heading',
        },
      }),
      // 하이라이트 (배경색)
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: {
          class: 'editor-highlight',
        },
      }),
      // 밑줄
      Underline,
      // 위 첨자, 아래 첨자
      Subscript,
      Superscript,
      // 플레이스홀더
      Placeholder.configure({
        placeholder: placeholder,
      }),
      // 텍스트 정렬 - Context7 권장 설정
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: null,
      }),
      // 코드 블록 하이라이팅 - Context7 권장 설정
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'hljs',
        },
      }),
      // 슬래시 커맨드
      SlashCommands,
    ],
    content: '',
    // TipTap 공식 문서 권장: parseOptions 설정
    parseOptions: {
      preserveWhitespace: 'full',
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[300px] p-4',
      },
      handleDrop: (view, event, slice, moved) => {
        const files = Array.from(event.dataTransfer?.files || []);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length > 0) {
          event.preventDefault();
          
          imageFiles.forEach(async (file) => {
            try {
              const imageUrl = await handleImageUpload(file);
              
              // 업로드 완료 후 즉시 이미지 삽입
              if (editor && !editor.isDestroyed) {
                editor.chain().focus().setImage({ 
                  src: imageUrl, 
                  alt: file.name,
                  title: file.name
                }).run();
              }
            } catch (error) {
              console.error('Failed to upload dropped image:', error);
            }
          });
          
          return true;
        }
        
        return false;
      },
      handlePaste: (view, event, slice) => {
        const files = Array.from(event.clipboardData?.files || []);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length > 0) {
          event.preventDefault();
          
          imageFiles.forEach(async (file) => {
            try {
              const imageUrl = await handleImageUpload(file);
              
              // 업로드 완료 후 즉시 이미지 삽입
              if (editor && !editor.isDestroyed) {
                editor.chain().focus().setImage({ 
                  src: imageUrl, 
                  alt: file.name,
                  title: file.name
                }).run();
              }
            } catch (error) {
              console.error('Failed to upload pasted image:', error);
            }
          });
          
          return true;
        }
        // 텍스트/HTML 붙여넣기 시 밑줄 제거
        if (event.clipboardData?.types.includes('text/html')) {
          event.preventDefault();
          const html = event.clipboardData.getData('text/html');
          const sanitized = stripUnderline(html);
          editor?.commands.insertContent(sanitized);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      handleEditorUpdate(html);
    },
    onCreate: ({ editor }) => {
      // 커스텀 uploadImage 커맨드 추가
      (editor.commands as any).uploadImage = async (file: File) => {
        try {
          const imageUrl = await handleImageUpload(file);
          editor.chain().focus().setImage({ 
            src: imageUrl, 
            alt: file.name,
            title: file.name
          }).run();
        } catch (error) {
          console.error('Failed to upload image via command:', error);
        }
      };
    },
  }, []); // 의존성 배열을 빈 배열로 변경하여 성능 최적화

  // Image Upload Manager integration (optional)
  const imageUploadManager = useImageUploadManager({
    editor: editor,
    images,
    onImagesChange: (newImages) => {
      setImages(newImages);
      // Extract file IDs for parent component if needed
      if (onFilesChange) {
        const fileIds = newImages.map(img => img.id);
        onFilesChange(fileIds);
      }
    },
    selectedThumbnailId,
    onThumbnailSelect: (thumbnailId) => {
      setSelectedThumbnailId(thumbnailId);
      // Notify parent if callback provided
      if (onThumbnailSelect) {
        onThumbnailSelect(thumbnailId);
      }
    },
  });

  

  // onChange 핸들러를 useCallback으로 메모이제이션
  const handleEditorUpdate = useCallback((html: string) => {
    onChange(html);
  }, [onChange]);

  // 파일 업로드 핸들러 - 즉시 업로드 방식 (원래 로직)
  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    try {
      setIsUploading(true);
      
      // 파일 검증
      const validation = validateImageFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 포스트 총 용량 체크
      if (!imageTracker.canAddFile(file.size)) {
        throw new Error('포스트 용량 초과');
      }

      // 즉시 업로드 수행
      const result = await uploadMutation.mutateAsync({ 
        file, 
        fileType: 'image' 
      });
      
      // 성공 시 파일 ID 추가
      const fileId = result.id.toString();
      setUploadedFiles(prev => {
        const newFiles = [...prev, fileId];
        // useEffect에서 호출하도록 지연
        setTimeout(() => {
          onFilesChange?.(newFiles);
        }, 0);
        return newFiles;
      });
      
      // 이미지 트래커에 파일 추가 (useEffect에서 호출하도록 지연)
      setTimeout(() => {
        imageTracker.addFile({
          id: fileId,
          size: file.size,
          name: file.name
        });
      }, 0);
      
      // 백엔드에서 반환한 URL 사용
      const proxyUrl = result.fileKey 
        ? getProxyImageUrl(result.fileKey)
        : getProxyImageUrl(result.fileUrl);
      
      debugLog('Image upload completed', {
        originalUrl: result.fileUrl,
        fileKey: result.fileKey,
        proxyUrl: proxyUrl,
      });
      
      return proxyUrl || result.fileUrl;
    } catch (error) {
      debugLog('Image upload failed', error);
      
      // 사용자 친화적인 에러 처리
      const errorMessage = getErrorMessage(error);
      
      // 401 에러인 경우 로그인 안내
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 401) {
        toast.error('로그인이 필요합니다. 다시 로그인해주세요.');
      } else {
        toast.error(`이미지 업로드 실패: ${errorMessage}`);
      }
      
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [uploadMutation, onFilesChange, imageTracker]);


  // editor ref 업데이트 및 onChange 핸들러 설정
  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
      // 기존 onUpdate 핸들러 제거 후 새로운 핸들러 등록
      editor.off('update');
      editor.on('update', ({ editor }) => {
        const html = editor.getHTML();
        handleEditorUpdate(html);
      });
      
      // 커스텀 uploadImage 커맨드 추가 (onCreate에서 설정했지만 useEffect에서도 확실히 설정)
      if (!(editor.commands as any).uploadImage) {
        (editor.commands as any).uploadImage = async (file: File) => {
          try {
            const imageUrl = await handleImageUpload(file);
            editor.chain().focus().setImage({ 
              src: imageUrl, 
              alt: file.name,
              title: file.name
            }).run();
          } catch (error) {
            console.error('Failed to upload image via command:', error);
          }
        };
      }
    }
  }, [editor, handleEditorUpdate, handleImageUpload]);

  // Update image upload manager when editor changes
  useEffect(() => {
    if (enableImageManager && editor) {
      // Update the image upload manager with the current editor instance
      // This allows the manager to insert images directly into the editor
    }
  }, [editor, enableImageManager]);

  // 컴포넌트 unmount 시 cleanup (포스트 작성 취소시)
  // @deprecated 자동 삭제 비활성화
  useEffect(() => {
    return () => {
      // 이미지 자동 삭제 비활성화
      // 사용자가 나중에 재사용할 수 있도록 보존
      if (enableCleanupOnUnmount) {
        console.log('[Editor] Cleanup disabled - images preserved for reuse');
      }
    };
  }, [enableCleanupOnUnmount]);

  // 글로벌 cleanup 이벤트 수신 (취소 버튼 클릭시)
  // @deprecated 자동 삭제 비활성화
  useEffect(() => {
    const handleCleanupEvent = (event: CustomEvent) => {
      // 이미지 자동 삭제 비활성화
      console.log('[Editor] Cleanup event received but ignored - images preserved');
    };

    window.addEventListener('cleanup-uploaded-files', handleCleanupEvent as EventListener);
    
    return () => {
      window.removeEventListener('cleanup-uploaded-files', handleCleanupEvent as EventListener);
    };
  }, []);

  // 슬래시 커맨드 이미지 업로드 이벤트 수신
  useEffect(() => {
    const handleSlashImageUpload = async (event: CustomEvent) => {
      const { file, editor: eventEditor } = event.detail;
      if (file && eventEditor === editor) {
        try {
          const imageUrl = await handleImageUpload(file);
          
          // 업로드 완료 후 즉시 이미지 삽입
          if (editor && !editor.isDestroyed) {
            editor.chain().focus().setImage({ 
              src: imageUrl, 
              alt: file.name,
              title: file.name
            }).run();
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
  }, [editor, handleImageUpload]);

  // 페이지 이탈 시 경고 (포스트 작성 취소시)
  useEffect(() => {
    if (!enableCleanupOnUnmount) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // 업로드된 파일이 있으면 경고 메시지만 표시 (삭제하지 않음)
      if (imageTracker.trackedFiles.length > 0) {
        event.preventDefault();
        // 이미지는 삭제하지 않고 보존
        console.log('[Editor] Page unload - images preserved for future use');
        return (event.returnValue = '입력한 내용이 저장되지 않습니다. 정말 떠나시겠습니까?');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enableCleanupOnUnmount, imageTracker]);

  // 에디터 초기 콘텐츠 설정
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // 에디터가 포커스되어 있지 않을 때만 내용 업데이트
      if (!editor.isFocused) {
        editor.commands.setContent(content);
      }
    }
  }, [editor, content]);

  // 이미지 업로드 트리거 (툴바에서 사용)
  const triggerImageUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const imageUrl = await handleImageUpload(file);
          
          // 업로드 완료 후 즉시 이미지 삽입
          if (editor && !editor.isDestroyed) {
            editor.chain().focus().setImage({ 
              src: imageUrl, 
              alt: file.name,
              title: file.name
            }).run();
          }
        } catch (error) {
          console.error('Failed to upload image:', error);
        }
      }
    };
    input.click();
  }, [handleImageUpload, editor]);

  if (!editor) {
    return (
      <div className="border border-gray-300 rounded-md p-4 min-h-[300px] flex items-center justify-center">
        <div className="text-gray-500">에디터를 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className={`border border-gray-300 rounded-md ${className}`}>
      <EnhancedEditorToolbar 
        editor={editor} 
        onImageUpload={triggerImageUpload}
        isUploading={isUploading}
        hideImageButton={enableImageManager}
      />
      <EditorContent editor={editor} />
      
      {/* Enhanced Image Upload Manager */}
      {enableImageManager && (
        <div className="border-t border-gray-200">
          {/* Sync status indicator */}
          {imageUploadManager.syncSource && (
            <div className="px-4 py-2 bg-blue-50 border-b border-gray-200">
              <div className="flex items-center text-sm text-blue-600">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                {imageUploadManager.syncSource === 'editor' 
                  ? '에디터에서 변경 사항 동기화 중...' 
                  : '갤러리에서 변경 사항 동기화 중...'}
              </div>
            </div>
          )}
          <div className="p-4">
            <ImageUploadManager
              images={images}
              maxImages={maxImages}
              onImagesChange={imageUploadManager.handleGalleryImageChange}
              onImagesUploaded={imageUploadManager.handleImagesUploaded}
              onThumbnailSelect={imageUploadManager.handleThumbnailSelect}
              selectedThumbnailId={selectedThumbnailId}
              className=""
            />
          </div>
        </div>
      )}
      
      {/* 용량 표시 바 */}
      {imageTracker.totalSize > 0 && (
        <div className="p-3 bg-gray-50 border-t border-gray-300">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              이미지 용량: {imageTracker.formatFileSize(imageTracker.totalSize)} / 30MB
            </span>
            <span className={`font-medium ${
              imageTracker.percentage >= 80 ? 'text-orange-600' : 
              imageTracker.percentage >= 60 ? 'text-yellow-600' : 
              'text-green-600'
            }`}>
              {imageTracker.percentage.toFixed(0)}% 사용
            </span>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                imageTracker.percentage >= 80 ? 'bg-orange-500' : 
                imageTracker.percentage >= 60 ? 'bg-yellow-500' : 
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(imageTracker.percentage, 100)}%` }}
            />
          </div>
        </div>
      )}
      
      {isUploading && (
        <div className="p-2 bg-blue-50 border-t border-gray-300">
          <div className="flex items-center text-sm text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            이미지를 업로드하는 중...
        </div>
        </div>
      )}
    </div>
  );
}

// 컨텐츠에서 파일 ID 추출 함수 (기존 유지)
export const extractFileIdsFromContent = (htmlContent: string): string[] => {
    const fileIds: string[] = [];
  const imgRegex = /<img[^>]+src="[^"]*\/files\/([^"/]+)"/g;
  let match;
  
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    fileIds.push(match[1]);
  }
    
  return fileIds;
}; 