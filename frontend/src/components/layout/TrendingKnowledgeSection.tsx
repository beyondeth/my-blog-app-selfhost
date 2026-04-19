"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FiBookOpen } from "react-icons/fi";
import SidebarSection from "./SidebarSection";
import {
  TrendingKnowledgeNode,
  getTrendingKnowledgeNodes,
} from "@/services/api/knowledge.service";
import { buildMapHref } from "@/lib/knowledge-ui";

function buildNodeHref(node: TrendingKnowledgeNode) {
  const blogPath = node.blog.alias ? `@${node.blog.alias}` : node.blog.slug;
  return buildMapHref(blogPath, node.slug);
}

export default function TrendingKnowledgeSection() {
  const { data, isLoading, error, refetch } = useQuery<TrendingKnowledgeNode[]>({
    queryKey: ["trending-knowledge-nodes"],
    queryFn: () => getTrendingKnowledgeNodes(5),
    staleTime: 1000 * 60 * 5,
  });

  const items = data ?? [];

  return (
    <SidebarSection
      title={
        <div className="flex items-center gap-2">
          <FiBookOpen className="h-4 w-4 text-[#264653] dark:text-[#6CC3B2]" />
          <span>Trending Knowledge</span>
        </div>
      }
    >
      {isLoading ? (
        <div className="-mx-5 divide-y divide-[#E5E7EB] dark:divide-[#2A3645]">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="px-5 py-3">
              <div className="mb-2 h-4 w-1/2 rounded bg-[#DCE3EC] dark:bg-[#223040] animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-[#DCE3EC] dark:bg-[#223040] animate-pulse" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-[#3F4A59] dark:text-[#E1E8F0]">
          Could not load the data.
          <button
            type="button"
            className="ml-2 text-[#264653] underline dark:text-[#6CC3B2]"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#3F4A59] dark:text-[#E1E8F0]">
          No knowledge nodes yet.
        </p>
      ) : (
        <div className="-mx-5 divide-y divide-[#E5E7EB] dark:divide-[#4B5563]">
          {items.map((node) => (
            <Link
              key={`${node.blog.slug}:${node.slug}`}
              href={buildNodeHref(node)}
              className="block px-5 py-3 transition-colors hover:bg-[#F9FAFB] dark:hover:bg-[#1A232E]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#1B2430] dark:text-[#E6EDF3] line-clamp-2">
                    {node.title}
                  </p>
                  <p className="mt-1 text-xs text-[#667085] dark:text-[#98A2B3] line-clamp-2">
                    {node.summary || `Connected knowledge node from ${node.blog.name}`}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-[#667085] dark:text-[#98A2B3]">
                    <span>{node.blog.name}</span>
                    <span>•</span>
                    <span>{node.postCount} posts</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </SidebarSection>
  );
}
