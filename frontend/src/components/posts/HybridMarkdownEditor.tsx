'use client';

import React, { useState, useCallback, useRef, forwardRef, useImperativeHandle, useLayoutEffect, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { VisualMarkdownImageBlock } from '@/components/posts/VisualMarkdownImageBlock';
import { parseMarkdownBlocks, serializeBlocks, MarkdownBlock } from '@/utils/markdownBlockParser';
import { ImageSize } from '@/types/image-metadata.types';
import { cn } from '@/lib/utils';

export interface HybridMarkdownEditorProps {
  content: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export interface HybridMarkdownEditorRef {
  insertImageBlock: (image: { url: string; alt: string; size: ImageSize; caption?: string; fileId?: string }) => void;
  insertText: (text: string) => void;
}

export const HybridMarkdownEditor = forwardRef<HybridMarkdownEditorRef, HybridMarkdownEditorProps>(
  ({ content, onChange, className, placeholder }, ref) => {
    const [blocks, setBlocks] = useState<MarkdownBlock[]>(() => parseMarkdownBlocks(content));
    const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
    const textSelectionRef = useRef<Map<string, { start: number; end: number }>>(new Map());
    const activeTextBlockIdRef = useRef<string | null>(null);
    const pendingFocusRef = useRef<{ id: string; cursor: number } | null>(null);
    const lastSerializedRef = useRef<string>(serializeBlocks(parseMarkdownBlocks(content)));

    const createBlockId = useCallback((prefix: 'text' | 'img') => {
      return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }, []);
    
    // 외부에서 content가 변경되었을 때 (예: 초기 로드, 리셋 등)
    // 타이핑 중에는 이 효과가 발생하지 않도록 주의해야 함.
    // 여기서는 content prop이 변경될 때, serialize한 결과가 다르면 업데이트
    // 하지만 타이핑 딜레이로 인해 문제가 생길 수 있으므로,
    // 부모가 "Controlled" 방식으로 동작한다고 가정하고 일단 동기화함.
    // 다만 커서 위치 보존을 위해 Textarea는 Uncontrolled에 가깝게 동작하도록 key를 쓰거나 유의해야 함.
    // 여기서는 간단히: 외부 content prop은 초기값 또는 전체 교체 시에만 유효하다고 가정.
    // (실제 타이핑은 onChange로 상위로 전파되지만 상위에서 다시 내려오는 prop은 무시하거나 debounce 처리됨을 기대)
    
    // content prop이 외부에서 갱신될 경우(초기 로드/리셋/드래프트 복원 등) 블록 동기화
    useEffect(() => {
      if (typeof content !== 'string') {
        return;
      }
      if (content === lastSerializedRef.current) {
        return;
      }
      const nextBlocks = parseMarkdownBlocks(content);
      lastSerializedRef.current = content;
      setBlocks(nextBlocks);
    }, [content]);

    const updateBlocks = useCallback((newBlocks: MarkdownBlock[]) => {
      setBlocks(newBlocks);
      const serialized = serializeBlocks(newBlocks);
      lastSerializedRef.current = serialized;
      onChange(serialized);
    }, [onChange]);

    const syncTextareaHeight = useCallback((textarea: HTMLTextAreaElement) => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }, []);

    useLayoutEffect(() => {
      blocks.forEach((block) => {
        if (block.type === 'text') {
          const textarea = textareaRefs.current.get(block.id);
          if (textarea) {
            syncTextareaHeight(textarea);
          }
        }
      });
    }, [blocks, syncTextareaHeight]);

    useEffect(() => {
      const pending = pendingFocusRef.current;
      if (!pending) return;

      const textarea = textareaRefs.current.get(pending.id);
      if (!textarea) return;

      textarea.focus();
      textarea.setSelectionRange(pending.cursor, pending.cursor);
      syncTextareaHeight(textarea);
      activeTextBlockIdRef.current = pending.id;
      textSelectionRef.current.set(pending.id, { start: pending.cursor, end: pending.cursor });
      pendingFocusRef.current = null;
    }, [blocks, syncTextareaHeight]);

    const updateTextSelection = useCallback((id: string, textarea: HTMLTextAreaElement) => {
      activeTextBlockIdRef.current = id;
      const start = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : textarea.value.length;
      const end = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : start;
      textSelectionRef.current.set(id, { start, end });
    }, []);

    const insertImageAtCursor = useCallback((image: { url: string; alt: string; size: ImageSize; caption?: string; fileId?: string }) => {
      const activeId = activeTextBlockIdRef.current;
      if (!activeId) return false;

      const targetIndex = blocks.findIndex((block) => block.type === 'text' && block.id === activeId);
      if (targetIndex === -1) return false;

      const targetBlock = blocks[targetIndex];
      if (targetBlock.type !== 'text') return false;

      const selection = textSelectionRef.current.get(activeId);
      const rawStart = selection?.start ?? targetBlock.content.length;
      const rawEnd = selection?.end ?? rawStart;
      const start = Math.max(0, Math.min(rawStart, targetBlock.content.length));
      const end = Math.max(start, Math.min(rawEnd, targetBlock.content.length));

      const before = targetBlock.content.slice(0, start);
      const after = targetBlock.content.slice(end);
      const trailingTextId = createBlockId('text');

      const nextBlocks: MarkdownBlock[] = [
        ...blocks.slice(0, targetIndex),
        { type: 'text', id: targetBlock.id, content: before },
        { type: 'image', id: createBlockId('img'), ...image },
        { type: 'text', id: trailingTextId, content: after },
        ...blocks.slice(targetIndex + 1),
      ];

      pendingFocusRef.current = { id: trailingTextId, cursor: 0 };
      updateBlocks(nextBlocks);
      return true;
    }, [blocks, createBlockId, updateBlocks]);

    const insertImageAtEnd = useCallback((image: { url: string; alt: string; size: ImageSize; caption?: string; fileId?: string }) => {
      const trailingTextId = createBlockId('text');
      const nextBlocks: MarkdownBlock[] = [
        ...blocks,
        { type: 'image', id: createBlockId('img'), ...image },
        { type: 'text', id: trailingTextId, content: '' },
      ];
      pendingFocusRef.current = { id: trailingTextId, cursor: 0 };
      updateBlocks(nextBlocks);
    }, [blocks, createBlockId, updateBlocks]);

    useImperativeHandle(ref, () => ({
      insertImageBlock: (image) => {
        const inserted = insertImageAtCursor(image);
        if (!inserted) {
          insertImageAtEnd(image);
        }
      },
      insertText: (text: string) => {
        // 마지막 블록이 텍스트라면 거기에 추가, 아니면 새 텍스트 블록 추가
        const newBlocks = [...blocks];
        const lastBlock = newBlocks[newBlocks.length - 1];
        
        if (lastBlock.type === 'text') {
          // 줄바꿈 확인
          const prefix = lastBlock.content && !lastBlock.content.endsWith('\n') ? '\n' : '';
          const contentToAdd = text.endsWith('\n') ? text : text + '\n';
          lastBlock.content += prefix + contentToAdd;
        } else {
          newBlocks.push({
            type: 'text' as const, 
            id: `text-${Date.now()}-inserted`, 
            content: text.endsWith('\n') ? text : text + '\n' 
          });
        }
        updateBlocks(newBlocks);
      }
    }), [blocks, insertImageAtCursor, insertImageAtEnd, updateBlocks]);

    const handleTextChange = (id: string, newContent: string) => {
      const newBlocks = blocks.map(block => 
        block.id === id && block.type === 'text' 
          ? { ...block, content: newContent } 
          : block
      );
      setBlocks(newBlocks); // 로컬 업데이트 즉시
      // 부모 전파는 약간 지연시키거나 바로 해도 됨. serialize 비용 확인.
      const serialized = serializeBlocks(newBlocks);
      lastSerializedRef.current = serialized;
      onChange(serialized);
    };

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      const target = e.currentTarget;
      syncTextareaHeight(target);
    };

    const handleImageChange = (id: string, changes: { size?: ImageSize; caption?: string }) => {
      const newBlocks = blocks.map(block => 
        block.id === id && block.type === 'image' 
          ? { ...block, ...changes } 
          : block
      );
      updateBlocks(newBlocks);
    };

    const handleRemoveImage = (index: number) => {
      const newBlocks = [...blocks];
      newBlocks.splice(index, 1);
      
      const mergedBlocks: MarkdownBlock[] = [];
      newBlocks.forEach((block) => {
        if (mergedBlocks.length === 0) {
          mergedBlocks.push(block);
          return;
        }
        const lastBlock = mergedBlocks[mergedBlocks.length - 1];
        if (lastBlock.type === 'text' && block.type === 'text') {
          lastBlock.content += '\n' + block.content; // 줄바꿈 보존? 
          // 원래 블록 사이엔 이미지가 있었으므로 병합 시 줄바꿈 등 처리 필요할 수 있음
          // 하지만 parseMarkdownBlocks에서 텍스트를 통째로 가져오므로, 
          // 여기서는 단순히 content contact
        } else {
          mergedBlocks.push(block);
        }
      });
      
      if (mergedBlocks.length === 0) {
        mergedBlocks.push({ type: 'text' as const, id: `text-${Date.now()}`, content: '' });
      }
      updateBlocks(mergedBlocks);
    };

    const handleMoveUp = (index: number) => {
      if (index <= 0) return;
      const newBlocks = [...blocks];
      [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
      updateBlocks(newBlocks);
    };

    const handleMoveDown = (index: number) => {
      if (index >= blocks.length - 1) return;
      const newBlocks = [...blocks];
      [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
      updateBlocks(newBlocks);
    };

    return (
      <div className={cn("hybrid-markdown-editor space-y-4", className)}>
        {blocks.map((block, index) => {
          if (block.type === 'text') {
            return (
              <Textarea
                key={block.id}
                value={block.content}
                onChange={(e) => handleTextChange(block.id, e.target.value)}
                onInput={handleInput}
                onFocus={(e) => updateTextSelection(block.id, e.currentTarget)}
                onClick={(e) => updateTextSelection(block.id, e.currentTarget)}
                onKeyUp={(e) => updateTextSelection(block.id, e.currentTarget)}
                onSelect={(e) => updateTextSelection(block.id, e.currentTarget)}
                ref={(node) => {
                  if (node) {
                    textareaRefs.current.set(block.id, node);
                  } else {
                    textareaRefs.current.delete(block.id);
                  }
                }}
                className="border-none shadow-none resize-none overflow-hidden focus-visible:ring-0 p-2 text-base leading-7 bg-transparent rounded-md"
                placeholder={blocks.length === 1 ? (placeholder || "당신의 이야기를 적어보세요...") : undefined}
                // 자동 높이 조절을 위해 ref 사용 고려 가능
              />
            );
          } else {
            return (
              <VisualMarkdownImageBlock
                key={block.id}
                url={block.url}
                alt={block.alt}
                size={block.size}
                caption={block.caption}
                fileId={block.fileId}
                onChange={(changes) => handleImageChange(block.id, changes)}
                onRemove={() => handleRemoveImage(index)}
                onMoveUp={index > 0 ? () => handleMoveUp(index) : undefined}
                onMoveDown={index < blocks.length - 1 ? () => handleMoveDown(index) : undefined}
              />
            );
          }
        })}
      </div>
    );
  }
);

HybridMarkdownEditor.displayName = 'HybridMarkdownEditor';
