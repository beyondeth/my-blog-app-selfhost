'use client';

import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeRenderer from '@/components/ui/content-renderer/components/CodeRenderer';
import DiagramRenderer from '@/components/ui/content-renderer/components/DiagramRenderer';
import MermaidRenderer from '@/components/ui/content-renderer/components/MermaidRenderer';
import styles from './AutoPostingSampleShell.module.css';
import { flattenReactText, slugifyHeading } from './markdownOutline';

interface AutoPostingMarkdownViewerProps {
  content: string;
}

type HeadingTag = 'h1' | 'h2' | 'h3';
type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> & {
  children?: React.ReactNode;
};
type CodeProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
  className?: string;
  inline?: boolean;
};
type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  children?: React.ReactNode;
};
type BlockquoteProps = React.BlockquoteHTMLAttributes<HTMLQuoteElement> & {
  children?: React.ReactNode;
};
type PreProps = React.HTMLAttributes<HTMLPreElement> & {
  children?: React.ReactNode;
};
type TableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  children?: React.ReactNode;
};

function createBlockId(prefix: string, content: string): string {
  let hash = 0;
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) >>> 0;
  }

  return `${prefix}-${hash.toString(36)}`;
}

function renderHeading(Tag: HeadingTag, props: HeadingProps) {
  const text = flattenReactText(props.children);
  const id = slugifyHeading(text);

  return <Tag id={id}>{props.children}</Tag>;
}

const markdownComponents: Components = {
  h1: (props) => renderHeading('h1', props),
  h2: (props) => renderHeading('h2', props),
  h3: (props) => renderHeading('h3', props),
  pre: ({ children }: PreProps) => <>{children}</>,
  table: ({ children }: TableProps) => (
    <div className={styles.tableWrap}>
      <table>{children}</table>
    </div>
  ),
  blockquote: ({ children }: BlockquoteProps) => (
    <aside className={styles.callout}>
      <span className={styles.calloutEyebrow}>Document Note</span>
      <div className={styles.calloutBody}>{children}</div>
    </aside>
  ),
  a: ({ href, children, ...props }: LinkProps) => {
    const isAnchorLink = href?.startsWith('#');
    return (
      <a
        href={href}
        className={styles.viewerLink}
        target={isAnchorLink ? undefined : '_blank'}
        rel={isAnchorLink ? undefined : 'noopener noreferrer'}
        {...props}
      >
        {children}
      </a>
    );
  },
  hr: () => <div className={styles.sectionSpacer} aria-hidden="true" />,
  code: ({ className, children, inline, ...props }: CodeProps) => {
    const raw = flattenReactText(children).replace(/\n$/, '');
    const language = className?.replace('language-', '') || 'plaintext';
    const isBlock = inline === false || Boolean(className?.startsWith('language-') || raw.includes('\n'));

    if (!isBlock) {
      return (
        <code className={styles.inlineCode} {...props}>
          {raw}
        </code>
      );
    }

    if (language === 'mermaid') {
      return (
        <div className={styles.mermaidCard}>
          <MermaidRenderer id={createBlockId('sample-mermaid', raw)} content={raw} />
        </div>
      );
    }

    if (language === 'diagram') {
      return (
        <div className={styles.mermaidCard}>
          <DiagramRenderer id={createBlockId('sample-diagram', raw)} content={raw} />
        </div>
      );
    }

    return (
      <CodeRenderer
        id={createBlockId(`sample-code-${language || 'plain'}`, raw)}
        language={language}
        content={raw}
        showCopyButton
      />
    );
  },
};

export default function AutoPostingMarkdownViewer({ content }: AutoPostingMarkdownViewerProps) {
  return (
    <div className={styles.viewer}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
