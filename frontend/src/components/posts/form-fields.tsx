"use client";

import React from 'react';
import type { ControllerRenderProps } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

type GenericField = ControllerRenderProps<any, any>;

interface FloatingTitleFieldProps {
  field: GenericField;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}

export function FloatingTitleField({
  field,
  disabled = false,
  label = 'Title',
  placeholder = '',
}: FloatingTitleFieldProps) {
  const { ref: hookFormRef, ...restField } = field;
  const [isFocused, setIsFocused] = React.useState(false);
  const [textareaHeight, setTextareaHeight] = React.useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const showLabel = isFocused || Boolean(field.value);

  React.useEffect(() => {
    if (textareaRef.current) {
      setTextareaHeight(textareaRef.current.scrollHeight);
    }
  }, [field.value]);

  const handleInputResize = (event: React.FormEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
    setTextareaHeight(target.scrollHeight);
  };

  return (
    <div className="relative">
      {showLabel && (
        <>
          <div className="mb-2 lg:hidden">
            <span className="text-xs text-gray-700 dark:text-gray-100 flex items-center gap-1">
              <Plus className="h-3 w-3" />
              <span>{label}</span>
            </span>
          </div>
          <div
            className="hidden lg:flex absolute -left-24 top-1 items-start gap-3"
            style={{ height: `${textareaHeight}px` }}
          >
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-100 whitespace-nowrap">
              <Plus className="h-3 w-3" />
              <span>{label}</span>
            </div>
            <div className="w-px bg-gray-500 dark:bg-gray-300" style={{ height: '100%' }} />
          </div>
        </>
      )}
      <div
        className="cursor-text"
        onClick={() => textareaRef.current?.focus()}
      >
        <Textarea
          ref={(element) => {
            hookFormRef(element);
            textareaRef.current = element;
          }}
          {...restField}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setIsFocused(true)}
          onBlur={(event) => {
            setIsFocused(false);
            restField.onBlur?.();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
            }
          }}
          rows={1}
          className="!text-lg border-0 border-b border-gray-300 dark:border-gray-600 rounded-none px-0 resize-none overflow-hidden focus-visible:ring-0 focus-visible:border-gray-900 dark:focus-visible:border-gray-100 min-h-0 py-1 w-full placeholder:!text-gray-500 dark:placeholder:!text-gray-300 text-gray-900 dark:text-gray-50"
          style={{ height: 'auto' }}
          onInput={handleInputResize}
        />
      </div>
    </div>
  );
}

interface TagInputFieldProps {
  field: GenericField;
  disabled?: boolean;
  label?: string;
  maxTags?: number;
}

export function TagInputField({
  field,
  disabled = false,
  label = 'Tags',
  maxTags,
}: TagInputFieldProps) {
  const [inputValue, setInputValue] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);
  const [isComposing, setIsComposing] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const tags: string[] = Array.isArray(field.value) ? field.value : [];
  const showLabel = isFocused || tags.length > 0 || Boolean(inputValue);
  const isMaxReached = typeof maxTags === 'number' && tags.length >= maxTags;

  const commitTag = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || tags.includes(trimmed) || isMaxReached) {
      return;
    }
    field.onChange([...tags, trimmed]);
    setInputValue('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isComposing) {
      event.preventDefault();
      commitTag(inputValue);
    } else if (event.key === 'Backspace' && !inputValue && tags.length > 0) {
      field.onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (indexToRemove: number) => {
    field.onChange(tags.filter((_, index) => index !== indexToRemove));
  };

  const handleBlur = () => {
    setIsFocused(false);
    commitTag(inputValue);
  };

  return (
    <div className="relative">
      {showLabel && (
        <>
          <div className="mb-2 lg:hidden">
            <span className="text-xs text-gray-700 dark:text-gray-100">{label}</span>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">(Optional)</div>
          </div>
          <div className="hidden lg:block absolute -left-24 top-3">
            <div className="flex flex-col text-gray-700 dark:text-gray-100">
              <div className="flex items-center gap-2 text-sm whitespace-nowrap">
                <Plus className="h-3 w-3" />
                <span>{label}</span>
              </div>
              <div className="ml-5 text-[11px] text-gray-500 dark:text-gray-400">(Optional)</div>
            </div>
          </div>
        </>
      )}

      <div
        className="border-0 border-b border-gray-300 dark:border-gray-600 pb-2 cursor-text"
        onClick={(event) => {
          if (!(event.target as HTMLElement).closest('button')) {
            inputRef.current?.focus();
          }
        }}
      >
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm"
            >
              <span>#{tag}</span>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={(event) => {
                  event.stopPropagation();
                  removeTag(index);
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(event) => {
            const value = event.target.value;
            if (value.endsWith(',')) {
              commitTag(value.slice(0, -1));
            } else {
              setInputValue(value);
            }
          }}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          disabled={disabled || isMaxReached}
          placeholder={
            isMaxReached ? 'You have reached the maximum number of tags.' : 'Type a tag, then press Enter or comma.'
          }
          className="!border-0 focus-visible:ring-0 !px-0 text-lg h-auto py-1 w-auto min-w-[280px] !bg-transparent !rounded-none placeholder:text-gray-500 dark:placeholder:text-gray-300 text-gray-900 dark:text-gray-50"
          style={{ width: inputValue ? `${Math.max(280, inputValue.length * 14)}px` : '280px' }}
        />
      </div>
    </div>
  );
}

export function EditCategoryField({
  field,
  disabled = false,
}: {
  field: GenericField;
  disabled?: boolean;
}) {
  return (
    <TagInputField
      field={field}
      disabled={disabled}
      label="Categories"
      maxTags={2}
    />
  );
}
