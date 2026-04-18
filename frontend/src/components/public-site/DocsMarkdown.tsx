import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { slugifyHeading } from '@/lib/docs-utils';

interface DocsMarkdownProps {
  content: string;
}

function getTextContent(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string') return child;
      if (typeof child === 'number') return String(child);
      if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
        return getTextContent(child.props.children);
      }
      return '';
    })
    .join('');
}

const markdownComponents: Components = {
  h2: ({ children, ...props }) => {
    const id = slugifyHeading(getTextContent(children));
    return (
      <h2 id={id} {...props}>
        {children}
      </h2>
    );
  },
  h3: ({ children, ...props }) => {
    const id = slugifyHeading(getTextContent(children));
    return (
      <h3 id={id} {...props}>
        {children}
      </h3>
    );
  },
  a: ({ href, ...props }) => (
    <a
      href={href}
      className="font-medium text-[#2446B8] underline decoration-[#C9D8F7] underline-offset-4 dark:text-[#D6E4FF] dark:decoration-[#314B73]"
      {...props}
    />
  ),
  table: ({ ...props }) => (
    <div className="my-8 overflow-x-auto">
      <table {...props} />
    </div>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className);
    if (!isBlock) {
      return (
        <code
          className="rounded bg-[#F3F6FA] px-1.5 py-0.5 text-[0.9em] dark:bg-[#162231]"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

export default function DocsMarkdown({ content }: DocsMarkdownProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}
