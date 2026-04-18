"use client";

import { useState } from "react";
import Link from "next/link";
import { FiFolder, FiHash } from "react-icons/fi";
import type { KnowledgeTreeNode } from "@/services/api/knowledge.service";
import {
  buildNodeHref,
  KB_FOCUS_RING,
  normalizeKnowledgeLabel,
} from "@/lib/knowledge-ui";

interface KnowledgeTreeBodyProps {
  blogSlug: string;
  tree: KnowledgeTreeNode[];
  hotNodes: Array<Pick<KnowledgeTreeNode, "slug" | "title" | "postCount">>;
}

export function KnowledgeTreeBody({
  blogSlug,
  tree,
  hotNodes,
}: KnowledgeTreeBodyProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showAllRoots, setShowAllRoots] = useState(false);
  const rootPreviewLimit = 6;
  const previewTree = showAllRoots ? tree : tree.slice(0, rootPreviewLimit);
  const hiddenRootCount = Math.max(0, tree.length - previewTree.length);

  const toggleNode = (slug: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const renderNode = (node: KnowledgeTreeNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.slug);
    const normalizedTitle = normalizeKnowledgeLabel(node.title);
    const childGroupId = `knowledge-tree-group-${node.slug}`;
    return (
      <li
        key={node.slug}
        className={depth === 0 ? "" : "mt-1"}
      >
        <div
          className="flex items-start gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-[#F7FAFC] dark:hover:bg-[#1A232E]"
          style={{ paddingLeft: `${Math.min(depth, 5) * 14 + 8}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleNode(node.slug)}
              className="mt-0.5 text-[#6B7280] hover:text-[#1F2937] dark:text-[#9CA3AF] dark:hover:text-[#E5E7EB]"
              aria-controls={childGroupId}
              aria-expanded={isExpanded}
              aria-label={`${normalizedTitle} 하위 노드 ${isExpanded ? "접기" : "펼치기"}`}
            >
              <FiFolder className="h-4 w-4" />
            </button>
          ) : (
            <FiHash className="mt-0.5 h-4 w-4 text-[#94A3B8] dark:text-[#64748B]" />
          )}

          <div className="min-w-0 flex-1">
            <Link
              href={buildNodeHref(blogSlug, node.slug)}
              className={`block line-clamp-2 text-sm font-medium text-[#1B2430] hover:text-[#264653] dark:text-[#E6EDF3] dark:hover:text-[#6CC3B2] ${KB_FOCUS_RING}`}
            >
              {normalizedTitle}
            </Link>
            <div className="mt-1 flex items-center gap-2 text-xs text-[#667085] dark:text-[#98A2B3]">
              <span>{node.postCount}개 글</span>
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <ul id={childGroupId} className="mt-1" role="list">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4">

      <ul className="space-y-1" role="list">
        {previewTree.map((node) => renderNode(node))}
      </ul>

      {hiddenRootCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowAllRoots((previous) => !previous)}
          className={`inline-flex items-center rounded-full border border-[#D9E0EA] bg-white px-4 py-2 text-xs font-semibold text-[#264653] transition-colors hover:border-[#BFD0DD] hover:bg-[#F8FBFD] dark:border-[#2A3645] dark:bg-[#111923] dark:text-[#9FE2D7] dark:hover:border-[#35506A] dark:hover:bg-[#1A232E] ${KB_FOCUS_RING}`}
        >
          {showAllRoots
            ? "핵심 분류만 보기"
            : `나머지 ${hiddenRootCount}개 분류 보기`}
        </button>
      ) : null}
    </div>
  );
}
