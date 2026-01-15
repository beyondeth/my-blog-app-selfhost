'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Copy } from 'lucide-react';
import type { ReactNode } from 'react';

type CodeSnippetBlockProps = {
  code: string;
  onCopy: () => void;
  copyTitle?: string;
  copyAriaLabel?: string;
  containerClassName?: string;
  preClassName?: string;
  buttonClassName?: string;
  buttonContent?: ReactNode;
  copiedButtonContent?: ReactNode;
};

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const DEFAULT_CONTAINER_CLASS = 'relative bg-gray-950 dark:bg-black rounded';
const DEFAULT_PRE_CLASS =
  'text-gray-100 p-3 pr-12 font-mono text-[10px] sm:text-xs overflow-x-auto -webkit-overflow-scrolling-touch';
const DEFAULT_BUTTON_CLASS =
  'absolute top-2 right-2 p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center bg-gray-700 dark:bg-gray-700 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition';

export function CodeSnippetBlock({
  code,
  onCopy,
  copyTitle = '복사',
  copyAriaLabel = '코드 복사',
  containerClassName,
  preClassName,
  buttonClassName,
  buttonContent,
  copiedButtonContent,
}: CodeSnippetBlockProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setCopied(false);
      timeoutRef.current = null;
    }, 2000);
  };

  const mergedCopyTitle = copied ? '복사됨' : copyTitle;
  const mergedCopyAriaLabel = copied ? '복사 완료' : copyAriaLabel;

  return (
    <div className={cn(DEFAULT_CONTAINER_CLASS, containerClassName)}>
      <pre className={cn(DEFAULT_PRE_CLASS, preClassName)}>{code}</pre>
      <button
        type="button"
        onClick={handleCopy}
        className={cn(DEFAULT_BUTTON_CLASS, buttonClassName)}
        title={mergedCopyTitle}
        aria-label={mergedCopyAriaLabel}
      >
        {copied ? copiedButtonContent ?? <CheckCircle2 className="w-4 h-4" /> : buttonContent ?? <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}
