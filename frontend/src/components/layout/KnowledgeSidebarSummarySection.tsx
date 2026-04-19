"use client";

import Link from "next/link";
import { FiArrowRight, FiBookOpen } from "react-icons/fi";
import SidebarSection from "./SidebarSection";
import { useBlogKnowledgeTree } from "@/hooks/useBlogKnowledgeTree";
import {
  buildTreeHref,
  buildNodeHref,
  formatKnowledgeUpdatedLabel,
  KB_FOCUS_RING,
  normalizeKnowledgeLabel,
} from "@/lib/knowledge-ui";

interface KnowledgeSidebarSummarySectionProps {
  blogSlug: string;
  className?: string;
}

export default function KnowledgeSidebarSummarySection({
  blogSlug,
  className,
}: KnowledgeSidebarSummarySectionProps) {
  const { data, isLoading, error } = useBlogKnowledgeTree(blogSlug);
  const hotNodes = data?.hotNodes ?? [];

  return (
    <SidebarSection
      className={className}
      title={
        <div className="flex items-center gap-2">
          <FiBookOpen className="h-4 w-4 text-[#264653] dark:text-[#6CC3B2]" />
          <span>Knowledge map</span>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-12 animate-pulse rounded-2xl bg-[#EEF3F8] dark:bg-[#1A232E]"
            />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-[#4B5563] dark:text-[#C7D1DD]">
          Could not load the knowledge map summary.
        </p>
      ) : !data || data.tree.length === 0 ? (
        <p className="text-sm text-[#4B5563] dark:text-[#C7D1DD]">
          No knowledge nodes yet.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[#4B5563] dark:text-[#A9B4C2]">
            A quick summary of the main topics and how they connect across this blog.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#D9E0EA] bg-[#F8FBFD] px-4 py-3 dark:border-[#2A3645] dark:bg-[#111923]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#667085] dark:text-[#98A2B3]">
                Topics
              </p>
              <p className="mt-2 text-lg font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
                {data.nodeCount}
              </p>
            </div>
            <div className="rounded-2xl border border-[#D9E0EA] bg-[#F8FBFD] px-4 py-3 dark:border-[#2A3645] dark:bg-[#111923]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#667085] dark:text-[#98A2B3]">
                Last updated
              </p>
              <p className="mt-2 text-lg font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
                {formatKnowledgeUpdatedLabel(data.lastUpdatedAt)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {hotNodes.slice(0, 4).map((node) => (
              <Link
                key={node.slug}
                href={buildNodeHref(blogSlug, node.slug)}
                className={`block rounded-2xl border border-[#D9E0EA] bg-white px-4 py-3 transition-colors hover:bg-[#EEF3F8] dark:border-[#2A3645] dark:bg-[#131A22] dark:hover:bg-[#16212C] ${KB_FOCUS_RING}`}
              >
                <p className="text-sm font-medium leading-6 text-[#1B2430] dark:text-[#E6EDF3]">
                  {normalizeKnowledgeLabel(node.title)}
                </p>
                <p className="mt-1 text-xs text-[#667085] dark:text-[#98A2B3]">
                  {node.postCount} post{node.postCount === 1 ? '' : 's'} on this topic
                </p>
              </Link>
            ))}
          </div>

          <Link
            href={buildTreeHref(blogSlug)}
            className={`inline-flex items-center gap-2 rounded-full bg-[#264653] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2F5B6B] dark:bg-[#6CC3B2] dark:text-[#0E141B] dark:hover:bg-[#7DD1C0] ${KB_FOCUS_RING}`}
          >
            Open knowledge map
            <FiArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </SidebarSection>
  );
}
