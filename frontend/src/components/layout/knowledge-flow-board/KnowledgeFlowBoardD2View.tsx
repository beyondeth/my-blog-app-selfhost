"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { Folder } from "lucide-react";
import { FiArrowUpRight } from "react-icons/fi";
import type {
  KnowledgeCanvasPostSummary,
  KnowledgeFlowBoardNode,
  KnowledgeFlowBoardPanel,
  KnowledgeFlowBoardResponse,
} from "@/services/api/knowledge.service";
import {
  KB_FOCUS_RING,
  normalizeKnowledgeLabel,
} from "@/lib/knowledge-ui";
import { buildBoardSummary } from "./shared";

interface KnowledgeFlowBoardD2ViewProps {
  blogSlug: string;
  data: KnowledgeFlowBoardResponse;
  focusTrail: Array<{ slug: string; title: string }>;
  handleFocusNavigate: (
    event: MouseEvent<HTMLElement>,
    nextSlug: string,
    nextTitle?: string,
  ) => void;
}

function D2EvidencePosts({
  blogSlug,
  posts,
  maxVisible = 2,
}: {
  blogSlug: string;
  posts: KnowledgeCanvasPostSummary[];
  maxVisible?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (posts.length === 0) {
    return null;
  }

  const expandableCount = Math.max(posts.length - maxVisible, 0);
  const visiblePosts =
    isExpanded || expandableCount === 0 ? posts : posts.slice(0, maxVisible);

  return (
    <div className="mt-4 overflow-hidden border-t border-[#E4EBF2] pt-3 dark:border-[#223142]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5E7287] dark:text-[#8AAAB5]">
          대표 포스트
        </div>
        {expandableCount > 0 ? (
          <button
            type="button"
            data-evidence-toggle
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((current) => !current)}
            className="shrink-0 border border-[#DCE5EE] bg-[#F7FAFC] px-2.5 py-1 text-xs font-semibold text-[#1B4F5F] transition-colors hover:bg-[#EEF4F8] dark:border-[#223142] dark:bg-[#101923] dark:text-[#7FD6CA] dark:hover:bg-[#14202B]"
          >
            {isExpanded ? "접기" : `${expandableCount}개 더 보기`}
          </button>
        ) : null}
      </div>
      <div data-evidence-list className="space-y-1.5 overflow-hidden">
        {visiblePosts.map((post) => (
          <Link
            key={post.id}
            href={`/${blogSlug}/${post.slug}`}
            data-flow-post={post.id}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 overflow-hidden rounded-xl border border-[#DCE5EE] bg-white px-3 py-2.5 transition-colors hover:bg-[#F7FAFC] dark:border-[#223142] dark:bg-[#101923] dark:hover:bg-[#14202B]"
          >
            <div className="min-w-0">
              <div className="line-clamp-2 break-words text-[13px] font-medium leading-[1.5] text-[#1B2430] dark:text-[#E6EDF3]">
                {post.title}
              </div>
              <div className="mt-1 line-clamp-1 break-words text-xs text-[#667085] dark:text-[#98A2B3]">
                {post.category ?? new Date(post.createdAt).toLocaleDateString("ko-KR")}
              </div>
            </div>
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center border border-[#DCE5EE] bg-[#F7FAFC] text-[#526072] dark:border-[#223142] dark:bg-[#0E141B] dark:text-[#7FD6CA]">
              <FiArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function D2FocusCard({
  node,
}: {
  node: KnowledgeFlowBoardNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[620px] rounded-2xl border border-[#DCE5EE] bg-white px-6 py-5 dark:border-[#223142] dark:bg-[#111923]">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1E6B7F] dark:text-[#7FD6CA]">
        중심 주제
      </div>
      <h2 className="mt-3 break-words text-[28px] font-semibold leading-[1.18] tracking-tight text-[#12202B] dark:text-[#E6EDF3]">
        {normalizeKnowledgeLabel(node.title)}
      </h2>
      <p className="mt-3 break-words text-[14px] leading-[1.8] text-[#526072] dark:text-[#A9B4C2]">
        {buildBoardSummary(
          node.summary,
          `${normalizeKnowledgeLabel(node.canonicalPath)}에 연결된 지식 축입니다.`,
          220,
        )}
      </p>
    </div>
  );
}

function D2ItemGrid({
  items,
  handleFocusNavigate,
}: {
  items: KnowledgeFlowBoardNode[];
  handleFocusNavigate: (
    event: MouseEvent<HTMLElement>,
    nextSlug: string,
    nextTitle?: string,
  ) => void;
}) {
  const useGrid = items.length >= 4;

  return (
    <div className={useGrid ? "grid gap-3 md:grid-cols-2" : "space-y-3"}>
      {items.map((item, index) => (
        <div
          key={item.slug}
          className="min-w-0 overflow-hidden rounded-2xl border border-[#DCE5EE] bg-white px-4 py-4 dark:border-[#223142] dark:bg-[#101923]"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-[#CFE2E8] bg-[#F2F8FA] text-xs font-semibold text-[#1E6B7F] dark:border-[#2A4456] dark:bg-[#13212B] dark:text-[#7FD6CA]">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  data-flow-nav={item.slug}
                  onClick={(event) =>
                    handleFocusNavigate(event, item.slug, item.title)
                  }
                  className={`line-clamp-3 min-w-0 break-words text-left text-[15px] font-semibold leading-[1.5] text-[#12202B] transition-colors hover:text-[#1E6B7F] dark:text-[#E6EDF3] dark:hover:text-[#7FD6CA] ${KB_FOCUS_RING}`}
                >
                  {normalizeKnowledgeLabel(item.title)}
                </button>
              </div>
              <p className="mt-2 line-clamp-3 break-words text-[13px] leading-[1.7] text-[#5B6878] dark:text-[#98A2B3]">
                {buildBoardSummary(
                  item.summary,
                  normalizeKnowledgeLabel(item.canonicalPath),
                  132,
                )}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function D2PrimaryPanel({
  blogSlug,
  title,
  items,
  evidencePosts,
  handleFocusNavigate,
}: {
  blogSlug: string;
  title: string;
  items: KnowledgeFlowBoardNode[];
  evidencePosts: KnowledgeCanvasPostSummary[];
  handleFocusNavigate: (
    event: MouseEvent<HTMLElement>,
    nextSlug: string,
    nextTitle?: string,
  ) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-[880px] overflow-hidden rounded-2xl border border-[#DCE5EE] bg-white px-5 py-5 dark:border-[#223142] dark:bg-[#111923]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1E6B7F] dark:text-[#7FD6CA]">
            주요 흐름
          </div>
          <h3 className="mt-2 break-words text-[20px] font-semibold leading-[1.3] text-[#12202B] dark:text-[#E6EDF3]">
            {title}
          </h3>
        </div>
      </div>

      <div className="mt-4">
        <D2ItemGrid
          items={items}
          handleFocusNavigate={handleFocusNavigate}
        />
      </div>

      <D2EvidencePosts blogSlug={blogSlug} posts={evidencePosts} />
    </div>
  );
}

function D2BranchPanel({
  blogSlug,
  panel,
  handleFocusNavigate,
}: {
  blogSlug: string;
  panel: KnowledgeFlowBoardPanel;
  handleFocusNavigate: (
    event: MouseEvent<HTMLElement>,
    nextSlug: string,
    nextTitle?: string,
  ) => void;
}) {
  if (panel.items.length === 0) {
    return null;
  }

  return (
    <div
      data-d2-panel-id={panel.id}
      className="overflow-hidden rounded-2xl border border-[#DCE5EE] bg-white px-4 py-4 dark:border-[#223142] dark:bg-[#111923]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="break-words text-[17px] font-semibold leading-[1.35] text-[#12202B] dark:text-[#E6EDF3]">
            {panel.title}
          </h4>
        </div>
      </div>

      <div className="mt-4 divide-y divide-[#E4EBF2] overflow-hidden dark:divide-[#223142]">
        {panel.items.map((item, index) => (
          <div key={item.slug} className={`flex min-w-0 items-start gap-3 py-3 ${index === 0 ? "pt-0" : ""}`}>
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-[#DCE5EE] bg-[#F7FAFC] text-[11px] font-semibold text-[#526072] dark:border-[#223142] dark:bg-[#0E141B] dark:text-[#98A2B3]">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  data-flow-nav={item.slug}
                  onClick={(event) =>
                    handleFocusNavigate(event, item.slug, item.title)
                  }
                  className={`line-clamp-3 min-w-0 break-words text-left text-[15px] font-semibold leading-[1.5] text-[#12202B] transition-colors hover:text-[#1E6B7F] dark:text-[#E6EDF3] dark:hover:text-[#7FD6CA] ${KB_FOCUS_RING}`}
                >
                  {normalizeKnowledgeLabel(item.title)}
                </button>
              </div>
              <p className="mt-2 line-clamp-3 break-words text-[13px] leading-[1.7] text-[#5B6878] dark:text-[#98A2B3]">
                {buildBoardSummary(
                  item.summary,
                  normalizeKnowledgeLabel(item.canonicalPath),
                  96,
                )}
              </p>
            </div>
          </div>
        ))}
      </div>

      <D2EvidencePosts blogSlug={blogSlug} posts={panel.evidencePosts} />
    </div>
  );
}

export function KnowledgeFlowBoardD2View({
  blogSlug,
  data,
  focusTrail,
  handleFocusNavigate,
}: KnowledgeFlowBoardD2ViewProps) {
  const pathItems = data.rootPath.slice(0, -1);
  const visibleTrail = focusTrail.slice(-5);
  const leftPanels = data.detailPanels.filter(
    (panel) => panel.layoutHint === "bottomLeft" || panel.layoutHint === "bottom",
  );
  const rightPanels = data.detailPanels.filter(
    (panel) => panel.layoutHint === "right" || panel.layoutHint === "bottomRight",
  );
  const hasTrueSplit = leftPanels.length > 0 && rightPanels.length > 0;
  const stackedPanels = hasTrueSplit ? [] : data.detailPanels;
  const layoutMode = hasTrueSplit ? "split" : "stacked";

  return (
    <div
      data-d2-view
      data-d2-layout={layoutMode}
      className="h-[min(calc(100dvh-200px),980px)] min-h-[680px] overflow-auto rounded-2xl border border-[#E4EAF2] bg-white dark:border-[#1F2C39] dark:bg-[#101821]"
    >
      <div className="mx-auto max-w-[1160px] px-4 py-5 md:px-6 lg:px-8">
        {visibleTrail.length > 1 ? (
          <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-[#E4EBF2] pb-3 dark:border-[#223142]">
            {visibleTrail.map((entry) => (
              <button
                key={entry.slug}
                type="button"
                onClick={(event) =>
                  handleFocusNavigate(event, entry.slug, entry.title)
                }
                className={`inline-flex items-center gap-2 border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  entry.slug === data.focus?.slug
                    ? "border-[#1E6B7F] bg-[#EEF7FA] text-[#1B4F5F] dark:border-[#2C6F7C] dark:bg-[#14242D] dark:text-[#7FD6CA]"
                    : "border-[#DCE5EE] bg-white text-[#526072] hover:bg-[#F7FAFC] dark:border-[#223142] dark:bg-[#111923] dark:text-[#98A2B3] dark:hover:bg-[#14202B]"
                } ${KB_FOCUS_RING}`}
              >
                <Folder className="h-3.5 w-3.5 shrink-0" />
                <span>{normalizeKnowledgeLabel(entry.title)}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="space-y-0">
          <div className="mx-auto w-full max-w-[760px] rounded-2xl border border-[#DCE5EE] bg-[#FBFCFD] px-5 py-4 dark:border-[#223142] dark:bg-[#101923]">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5E7287] dark:text-[#8AAAB5]">
              상위 흐름
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {pathItems.length > 0 ? (
                pathItems.map((item) => (
                  <div key={item.slug} className="flex items-center gap-2">
                    <Folder className="h-3.5 w-3.5 shrink-0 text-[#94A3B8] dark:text-[#7F93A8]" />
                    <button
                      type="button"
                      data-flow-nav={item.slug}
                      onClick={(event) =>
                        handleFocusNavigate(event, item.slug, item.title)
                      }
                      className={`font-medium text-[#1B4F5F] transition-colors hover:text-[#0F2C38] dark:text-[#7FD6CA] dark:hover:text-[#BFF6EC] ${KB_FOCUS_RING}`}
                    >
                      {normalizeKnowledgeLabel(item.title)}
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-sm text-[#667085] dark:text-[#98A2B3]">
                  이 주제가 시작점입니다.
                </div>
              )}
            </div>
          </div>

          <div className="mx-auto h-7 w-px bg-[#DCE5EE] dark:bg-[#223142]" />

          {data.focus ? <D2FocusCard node={data.focus} /> : null}

          {data.primaryFlow ? (
            <>
              <div className="mx-auto h-8 w-px bg-[#DCE5EE] dark:bg-[#223142]" />
              <D2PrimaryPanel
                blogSlug={blogSlug}
                title={data.primaryFlow.title}
                items={data.primaryFlow.items}
                evidencePosts={data.primaryFlow.evidencePosts}
                handleFocusNavigate={handleFocusNavigate}
              />
            </>
          ) : null}

          {data.detailPanels.length > 0 ? (
            <>
              {hasTrueSplit ? (
                <>
                  <div
                    data-d2-connector="split"
                    className="mx-auto flex w-full max-w-[880px] flex-col items-center"
                  >
                    <div className="h-6 w-px bg-[#DCE5EE] dark:bg-[#223142]" />
                    <div className="h-px w-[min(560px,80%)] bg-[#DCE5EE] dark:bg-[#223142]" />
                  </div>
                  <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                    <div data-d2-column="left" className="space-y-4">
                      <div className="mx-auto h-5 w-px bg-[#DCE5EE] dark:bg-[#223142]" />
                      <div className="space-y-6">
                        {leftPanels.map((panel) => (
                          <D2BranchPanel
                            key={panel.id}
                            blogSlug={blogSlug}
                            panel={panel}
                            handleFocusNavigate={handleFocusNavigate}
                          />
                        ))}
                      </div>
                    </div>
                    <div data-d2-column="right" className="space-y-4">
                      <div className="mx-auto h-5 w-px bg-[#DCE5EE] dark:bg-[#223142]" />
                      <div className="space-y-6">
                        {rightPanels.map((panel) => (
                          <D2BranchPanel
                            key={panel.id}
                            blogSlug={blogSlug}
                            panel={panel}
                            handleFocusNavigate={handleFocusNavigate}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    data-d2-connector="single"
                    className="mx-auto h-6 w-px bg-[#DCE5EE] dark:bg-[#223142]"
                  />
                  <div
                    data-d2-stack
                    className="mx-auto mt-4 w-full max-w-[440px] space-y-6"
                  >
                    {stackedPanels.map((panel) => (
                      <D2BranchPanel
                        key={panel.id}
                        blogSlug={blogSlug}
                        panel={panel}
                        handleFocusNavigate={handleFocusNavigate}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
