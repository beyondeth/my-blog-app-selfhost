"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { FiChevronDown, FiChevronRight, FiFolder, FiHash } from "react-icons/fi";
import type {
  BlogKnowledgeTreeResponse,
  KnowledgeTreeNode,
} from "@/services/api/knowledge.service";
import {
  KB_FOCUS_RING,
  normalizeKnowledgeLabel,
} from "@/lib/knowledge-ui";
import SidebarNodeIcon from "../SidebarNodeIcon";

interface KnowledgeMapTreeSidebarProps {
  treeData: BlogKnowledgeTreeResponse | null;
  activeFocusSlug: string | null;
  activeFocusTitle?: string | null;
  onFocusNavigate: (
    event: MouseEvent<HTMLElement>,
    nextSlug: string,
    nextTitle?: string,
  ) => void;
  variant?: "rail" | "drawer";
  sticky?: boolean;
}

function buildTreeIndex(tree: KnowledgeTreeNode[]) {
  const parentBySlug = new Map<string, string | null>();

  const visit = (nodes: KnowledgeTreeNode[], parentSlug: string | null) => {
    nodes.forEach((node) => {
      parentBySlug.set(node.slug, parentSlug);
      visit(node.children, node.slug);
    });
  };

  visit(tree, null);

  return { parentBySlug };
}

function buildAncestorChain(
  parentBySlug: Map<string, string | null>,
  slug: string | null,
) {
  const chain: string[] = [];
  let cursor = slug;

  while (cursor) {
    chain.unshift(cursor);
    cursor = parentBySlug.get(cursor) ?? null;
  }

  return chain;
}

function escapeSelectorValue(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, "\\$&");
}

interface TreeBranchProps {
  nodes: KnowledgeTreeNode[];
  expandedSlugs: Set<string>;
  activeFocusSlug: string | null;
  onToggle: (slug: string) => void;
  onFocusNavigate: (
    event: MouseEvent<HTMLElement>,
    nextSlug: string,
    nextTitle?: string,
  ) => void;
  depth?: number;
}

function TreeBranch({
  nodes,
  expandedSlugs,
  activeFocusSlug,
  onToggle,
  onFocusNavigate,
  depth = 0,
}: TreeBranchProps) {
  return (
    <ul
      role="list"
      className={
        depth === 0
          ? "space-y-1"
          : "ml-3 space-y-1 border-l border-[#E6ECF3] pl-4 pt-1 dark:border-[#223142]"
      }
    >
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = hasChildren && expandedSlugs.has(node.slug);
        const isActive = activeFocusSlug === node.slug;
        const normalizedTitle = normalizeKnowledgeLabel(node.title);

        return (
          <li key={node.slug}>
            <div
              data-tree-node={node.slug}
              className={[
                "flex items-start justify-between gap-2 rounded-xl px-2 py-2 transition-colors",
                isActive
                  ? "bg-[#EEF4FB] dark:bg-[#141E28]"
                  : "hover:bg-[#F5F8FC] dark:hover:bg-[#141E28]",
              ].join(" ")}
            >
              <button
                type="button"
                data-tree-nav={node.slug}
                data-tree-node-type={hasChildren ? "branch" : "leaf"}
                onClick={(event) => {
                  if (hasChildren) {
                    onToggle(node.slug);
                  } else {
                    onFocusNavigate(event, node.slug, node.title);
                  }
                }}
                onDoubleClick={(event) => {
                  if (hasChildren) {
                    onFocusNavigate(event as unknown as MouseEvent<HTMLElement>, node.slug, node.title);
                  }
                }}
                className={`min-w-0 flex-1 text-left ${KB_FOCUS_RING}`}
              >
                <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                  {hasChildren ? (
                    <SidebarNodeIcon
                      icon={FiFolder}
                      isActive={isActive}
                      iconClassName="text-[#6B7280] dark:text-[#9CA3AF]"
                    />
                  ) : (
                    <SidebarNodeIcon
                      icon={FiHash}
                      isActive={isActive}
                      iconClassName="text-[#94A3B8] dark:text-[#64748B]"
                    />
                  )}
                  <span
                    className={[
                      "truncate text-sm leading-6",
                      isActive
                        ? "font-semibold text-[#1B2430] dark:text-[#E6EDF3]"
                        : "font-medium text-[#1B2430] hover:text-[#264653] dark:text-[#E6EDF3] dark:hover:text-[#6CC3B2]",
                    ].join(" ")}
                  >
                    {normalizedTitle}
                  </span>
                  {hasChildren ? (
                    isExpanded ? (
                      <FiChevronDown className="h-4 w-4 shrink-0 text-[#6B7280] dark:text-[#9CA3AF]" />
                    ) : (
                      <FiChevronRight className="h-4 w-4 shrink-0 text-[#6B7280] dark:text-[#9CA3AF]" />
                    )
                  ) : null}
                </div>
              </button>

              {hasChildren ? (
                <span className="mt-0.5 shrink-0 text-[13px] font-medium text-[#667085] dark:text-[#98A2B3]">
                  {node.children.length}
                </span>
              ) : null}
            </div>

            {isExpanded ? (
              <TreeBranch
                nodes={node.children}
                expandedSlugs={expandedSlugs}
                activeFocusSlug={activeFocusSlug}
                onToggle={onToggle}
                onFocusNavigate={onFocusNavigate}
                depth={depth + 1}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function KnowledgeMapTreeSidebar({
  treeData,
  activeFocusSlug,
  activeFocusTitle: _activeFocusTitle,
  onFocusNavigate,
  variant = "rail",
  sticky = true,
}: KnowledgeMapTreeSidebarProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [manualExpandedSlugs, setManualExpandedSlugs] = useState<Set<string>>(
    new Set(),
  );
  const { parentBySlug } = useMemo(
    () => buildTreeIndex(treeData?.tree ?? []),
    [treeData?.tree],
  );

  const ancestorChain = useMemo(
    () => buildAncestorChain(parentBySlug, activeFocusSlug),
    [activeFocusSlug, parentBySlug],
  );
  const autoExpandedSlugs = useMemo(
    () => new Set(ancestorChain.slice(0, -1)),
    [ancestorChain],
  );
  const expandedSlugs = useMemo(() => {
    const next = new Set(manualExpandedSlugs);
    autoExpandedSlugs.forEach((slug) => next.add(slug));
    return next;
  }, [autoExpandedSlugs, manualExpandedSlugs]);

  useEffect(() => {
    if (!activeFocusSlug || !scrollContainerRef.current) {
      return;
    }

    const target = scrollContainerRef.current.querySelector<HTMLElement>(
      `[data-tree-node="${escapeSelectorValue(activeFocusSlug)}"]`,
    );

    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeFocusSlug]);

  const toggleNode = (slug: string) => {
    setManualExpandedSlugs((previous) => {
      const next = new Set(previous);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const panel = (
    <div
      data-tree-panel
      className="rounded-2xl border border-[#E4EAF2] bg-white p-5 shadow-[0_22px_60px_rgba(15,23,42,0.06)] dark:border-[#1F2C39] dark:bg-[#101821]"
    >
      <div
        ref={scrollContainerRef}
        className={[
          "min-h-0 overflow-y-auto pr-2 knowledge-sidebar-scroll",
          variant === "drawer"
            ? "max-h-[calc(100dvh-15rem)]"
            : "max-h-[calc(100dvh-11rem)]",
        ].join(" ")}
      >
        {treeData?.tree?.length ? (
          <TreeBranch
            nodes={treeData.tree}
            expandedSlugs={expandedSlugs}
            activeFocusSlug={activeFocusSlug}
            onToggle={toggleNode}
            onFocusNavigate={onFocusNavigate}
          />
        ) : (
          <div className="rounded-[18px] bg-[#F7FAFD] px-4 py-5 text-sm leading-6 text-[#667085] dark:bg-[#121C26] dark:text-[#98A2B3]">
            아직 공개된 지식 구조가 없습니다. 포스트가 더 쌓이면 여기서 경로 중심 탐색이 가능합니다.
          </div>
        )}
      </div>
    </div>
  );

  if (!sticky) {
    return panel;
  }

  if (variant === "drawer") {
    return <aside className="h-full bg-[#F5F7FA] p-4 dark:bg-[#0B1117]">{panel}</aside>;
  }

  return (
    <aside className="sticky top-8" aria-label="전체 주제 구조">
      {panel}
    </aside>
  );
}
