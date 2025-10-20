'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface MarkdownRendererProps {
  content: string;
}

/**
 * Markdown 콘텐츠를 렌더링하는 컴포넌트
 *
 * @param content - 렌더링할 Markdown 문자열
 */
export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // 테이블 스타일링
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-6">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" {...props} />
            </div>
          ),
          // 링크 스타일링
          a: ({ node, ...props }) => (
            <a
              className="text-blue-600 dark:text-blue-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          // 코드 블록 스타일링
          code: ({ node, inline, ...props }: any) => {
            if (inline) {
              return (
                <code
                  className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-sm rounded"
                  {...props}
                />
              );
            }
            return (
              <code
                className="block p-4 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-x-auto"
                {...props}
              />
            );
          },
          // 체크박스 스타일링
          input: ({ node, ...props }) => {
            if (props.type === 'checkbox') {
              return (
                <input
                  className="mr-2 h-4 w-4 rounded border-gray-300"
                  {...props}
                />
              );
            }
            return <input {...props} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
