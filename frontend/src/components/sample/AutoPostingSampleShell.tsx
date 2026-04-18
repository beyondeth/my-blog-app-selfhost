'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpenText, GitBranch, ListChecks, TableProperties, FileCode2, Sparkles } from 'lucide-react';
import CodeRenderer from '@/components/ui/content-renderer/components/CodeRenderer';
import HtmlContentRenderer from '@/components/ui/content-renderer/HtmlContentRenderer';
import { convertMarkdownToHtml } from '@/utils/markdownConversion';
import styles from './AutoPostingSampleShell.module.css';
import AutoPostingMarkdownViewer from './AutoPostingMarkdownViewer';
import { sampleAutoPostingMarkdown } from './sampleAutopostContent';
import {
  countMarkdownTables,
  estimateReadingMinutes,
  extractMarkdownHeadings,
  type MarkdownHeading,
} from './markdownOutline';

type ViewMode = 'document' | 'pipeline' | 'source';

interface AutoPostingSampleShellProps {
  markdown?: string;
}

function metricValue(value: number, suffix: string) {
  return `${value}${suffix}`;
}

export default function AutoPostingSampleShell({
  markdown = sampleAutoPostingMarkdown,
}: AutoPostingSampleShellProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('document');
  const headings = useMemo(() => extractMarkdownHeadings(markdown), [markdown]);
  const [activeHeading, setActiveHeading] = useState<string>(headings[0]?.id ?? '');
  const pipelineHtml = useMemo(() => convertMarkdownToHtml(markdown), [markdown]);

  const stats = useMemo(() => {
    const mermaidCount = (markdown.match(/```mermaid/g) ?? []).length;
    const diagramCount = (markdown.match(/```diagram/g) ?? []).length;
    const checklistCount = (markdown.match(/^\s*[-*]\s+\[[ xX]\]/gm) ?? []).length;

    return {
      readingMinutes: estimateReadingMinutes(markdown),
      headingCount: headings.length,
      tableCount: countMarkdownTables(markdown),
      checklistCount,
      mermaidCount,
      diagramCount,
    };
  }, [headings.length, markdown]);

  useEffect(() => {
    if (viewMode !== 'document' || headings.length === 0) {
      return;
    }

    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (elements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (visibleEntry?.target?.id) {
          setActiveHeading(visibleEntry.target.id);
        }
      },
      {
        rootMargin: '-20% 0px -65% 0px',
        threshold: [0.2, 0.4, 0.7],
      },
    );

    elements.forEach((element) => observer.observe(element));
    setActiveHeading(elements[0].id);

    return () => observer.disconnect();
  }, [headings, viewMode]);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <section className={styles.heroCard}>
          <div>
            <div className={styles.eyebrow}>
              <Sparkles size={14} />
              MCP Auto-posting Sample
            </div>
            <h1 className={styles.heroTitle}>자동포스팅 결과물을 문서처럼 읽히게 만드는 샘플</h1>
            <p className={styles.heroDescription}>
              이 샘플은 Antigravity의 implementation plan 문서 UX에서 착안해, 자동포스팅 Markdown이
              게시 화면에서 얼마나 더 정돈되고 읽기 좋게 보일 수 있는지 검증하기 위한 독립 실험 화면입니다.
            </p>
          </div>

          <div className={styles.heroMeta}>
            <span className={styles.heroMetaItem}>
              <BookOpenText size={16} />
              원본 Markdown 보존
            </span>
            <span className={styles.heroMetaItem}>
              <GitBranch size={16} />
              Diagram 블록 포함
            </span>
            <span className={styles.heroMetaItem}>
              <FileCode2 size={16} />
              코드/표/체크리스트 동시 지원
            </span>
          </div>

          <div className={styles.toggleRow}>
            <div className={styles.toggleGroup} role="tablist" aria-label="sample view mode">
              <button
                type="button"
                className={`${styles.toggleButton} ${viewMode === 'document' ? styles.toggleButtonActive : ''}`}
                onClick={() => setViewMode('document')}
              >
                <BookOpenText size={16} />
                문서형 미리보기
              </button>
              <button
                type="button"
                className={`${styles.toggleButton} ${viewMode === 'pipeline' ? styles.toggleButtonActive : ''}`}
                onClick={() => setViewMode('pipeline')}
              >
                <GitBranch size={16} />
                실제 렌더 경로
              </button>
              <button
                type="button"
                className={`${styles.toggleButton} ${viewMode === 'source' ? styles.toggleButtonActive : ''}`}
                onClick={() => setViewMode('source')}
              >
                <FileCode2 size={16} />
                원본 Markdown
              </button>
            </div>
          </div>
        </section>

        <section className={styles.metricsGrid}>
          <article className={styles.metricCard}>
            <div className={styles.metricLabel}>
              <BookOpenText size={15} />
              예상 읽기 시간
            </div>
            <div className={styles.metricValue}>{metricValue(stats.readingMinutes, '분')}</div>
            <p className={styles.metricHint}>자동포스팅 결과물이 문서처럼 읽히는지 체감하는 가장 직접적인 지표입니다.</p>
          </article>
          <article className={styles.metricCard}>
            <div className={styles.metricLabel}>
              <GitBranch size={15} />
              섹션 / 워크플로우
            </div>
            <div className={styles.metricValue}>{metricValue(stats.headingCount, '개')}</div>
            <p className={styles.metricHint}>heading 구조가 살아 있어야 outline과 빠른 스캔 UX가 작동합니다.</p>
          </article>
          <article className={styles.metricCard}>
            <div className={styles.metricLabel}>
              <TableProperties size={15} />
              표 / 비교 정보
            </div>
            <div className={styles.metricValue}>{metricValue(stats.tableCount, '개')}</div>
            <p className={styles.metricHint}>자동포스팅 글의 비교 정보는 표가 깔끔해야 품질이 바로 드러납니다.</p>
          </article>
          <article className={styles.metricCard}>
            <div className={styles.metricLabel}>
              <ListChecks size={15} />
              체크리스트 / Diagram
            </div>
            <div className={styles.metricValue}>
              {stats.checklistCount} / {stats.diagramCount + stats.mermaidCount}
            </div>
            <p className={styles.metricHint}>실행 문서형 글에서는 action list와 diagram block이 함께 있어야 구조가 빨리 읽힙니다.</p>
          </article>
        </section>

        <section className={styles.contentGrid}>
          <article className={styles.articleCard}>
            {viewMode === 'document' ? (
              <div data-sample-document-preview="true">
                <AutoPostingMarkdownViewer content={markdown} />
              </div>
            ) : viewMode === 'pipeline' ? (
              <div className={styles.pipelinePreview} data-sample-pipeline-preview="true">
                <div className={styles.pipelineNotice}>
                  <strong>frontend local pipeline</strong>
                  <span>
                    {' '}
                    <code className={styles.inlineCode}>content_markdown</code>을
                    로컬의 <code className={styles.inlineCode}>convertMarkdownToHtml</code>로 HTML로 바꾼 뒤,
                    실제 상세 페이지가 사용하는 <code className={styles.inlineCode}>HtmlContentRenderer</code>로 다시 렌더링한 결과입니다.
                  </span>
                </div>
                <div className={styles.pipelineSurface}>
                  <HtmlContentRenderer
                    content={pipelineHtml}
                    className={styles.pipelineRenderer}
                    options={{
                      enableDiagram: true,
                      enableMermaid: true,
                      enableCodeCopy: true,
                      enableCodeHighlight: true,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className={styles.sourceCard}>
                <CodeRenderer
                  id="sample-autoposting-markdown-source"
                  language="markdown"
                  content={markdown}
                  showCopyButton
                />
              </div>
            )}
          </article>

          <aside className={styles.sidebarStack}>
            <section className={styles.sidebarCard}>
              <h2 className={styles.sidebarTitle}>문서 Outline</h2>
              <div className={styles.outlineList}>
                {headings.map((heading: MarkdownHeading) => (
                  <a
                    key={heading.id}
                    href={`#${heading.id}`}
                    className={[
                      styles.outlineLink,
                      heading.level === 2 ? styles.outlineLevel2 : '',
                      heading.level === 3 ? styles.outlineLevel3 : '',
                      activeHeading === heading.id && viewMode === 'document' ? styles.outlineLinkActive : '',
                    ].join(' ').trim()}
                  >
                    {heading.text}
                  </a>
                ))}
              </div>
            </section>

            <section className={styles.sidebarCard}>
              <h2 className={styles.sidebarTitle}>차용 포인트</h2>
              <p className={styles.sidebarBody}>
                이 샘플이 통과되면 production에서는 <code className={styles.inlineCode}>content_type = markdown</code>
                {' '}인 자동포스팅 글에만 우선 적용할 수 있습니다.
              </p>
              <ul className={styles.supportList}>
                <li>기존 HTML 포스트 렌더러와 충돌하지 않습니다.</li>
                <li>backend 계약을 바꾸지 않고도 차용 가능합니다.</li>
                <li>원본 Markdown을 유지해 재렌더링과 편집 확장이 쉽습니다.</li>
              </ul>
            </section>

            <section className={styles.sidebarCard}>
              <h2 className={styles.sidebarTitle}>지원 요소</h2>
              <ul className={styles.supportList}>
                <li>heading 기반 outline</li>
                <li>표, 체크리스트, 코드 복사</li>
                <li>diagram block + Mermaid legacy fallback</li>
                <li>blockquote 기반 callout</li>
              </ul>
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}
