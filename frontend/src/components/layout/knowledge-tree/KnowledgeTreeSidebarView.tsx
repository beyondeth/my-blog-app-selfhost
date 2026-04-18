import Link from "next/link";
import { FiBookOpen, FiGitBranch } from "react-icons/fi";
import type { BlogKnowledgeTreeResponse } from "@/services/api/knowledge.service";
import {
  buildMapHref,
  formatKnowledgeUpdatedLabel,
  KB_FOCUS_RING,
} from "@/lib/knowledge-ui";
import SidebarSection from "../SidebarSection";
import { KnowledgeTreeBody } from "./KnowledgeTreeBody";

interface KnowledgeTreeSidebarViewProps {
  blogSlug: string;
  className?: string;
  data?: BlogKnowledgeTreeResponse | null;
  isLoading: boolean;
  hasError: boolean;
}

function renderBodyState(
  blogSlug: string,
  data: BlogKnowledgeTreeResponse | null | undefined,
  isLoading: boolean,
  hasError: boolean,
) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-10 animate-pulse rounded-xl bg-[#EEF3F8] dark:bg-[#1A232E]"
          />
        ))}
      </div>
    );
  }

  if (hasError) {
    return (
      <p className="text-sm text-[#4B5563] dark:text-[#C7D1DD]">
        지식 지도를 불러오지 못했습니다.
      </p>
    );
  }

  if (!data || data.tree.length === 0) {
    return (
      <div className="space-y-3 text-sm text-[#4B5563] dark:text-[#C7D1DD]">
        <p>아직 정리된 지식 트리가 없습니다.</p>
        <p className="text-xs text-[#6B7280] dark:text-[#98A2B3]">
          새 글이 발행된 뒤 지식 지도가 자동으로 갱신됩니다.
        </p>
      </div>
    );
  }

  return (
    <KnowledgeTreeBody
      blogSlug={blogSlug}
      tree={data.tree}
      hotNodes={data.hotNodes}
    />
  );
}

export function KnowledgeTreeSidebarView({
  blogSlug,
  className,
  data,
  isLoading,
  hasError,
}: KnowledgeTreeSidebarViewProps) {
  const hotNodes = data?.hotNodes ?? [];

  return (
    <SidebarSection
      className={className}
      title={
      <div className="flex items-center gap-2">
          <FiBookOpen className="h-4 w-4 text-[#264653] dark:text-[#6CC3B2]" />
          <span>지식 지도</span>
        </div>
      }
    >
      <div className="mb-4 space-y-4">
        <div className="flex items-center justify-center divide-x divide-[#E4EAF2] py-1 dark:divide-[#2A3645]">
          <div className="flex-1 text-center">
            <span className="text-xs font-medium text-[#6A7788] dark:text-[#8C9BAA]">
              전체 주제
            </span>
            <div className="mt-0.5 text-base font-semibold text-[#293240] dark:text-[#E6EDF3]">
              {data?.nodeCount ?? 0}
            </div>
          </div>
          <div className="flex-1 text-center">
            <span className="text-xs font-medium text-[#6A7788] dark:text-[#8C9BAA]">
              최근 갱신
            </span>
            <div className="mt-0.5 text-base font-semibold text-[#293240] dark:text-[#E6EDF3]">
              {formatKnowledgeUpdatedLabel(data?.lastUpdatedAt ?? null)}
            </div>
          </div>
        </div>
        <Link
          href={buildMapHref(blogSlug, hotNodes[0]?.slug)}
          className={`inline-flex w-full items-center justify-center rounded-full border border-[#D9E0EA] bg-[#264653] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2F5B6B] dark:border-[#6CC3B2] dark:bg-[#6CC3B2] dark:text-[#0E141B] dark:hover:bg-[#7DD1C0] ${KB_FOCUS_RING}`}
        >
          지식 지도 열기
          <FiGitBranch className="ml-2 h-4 w-4" />
        </Link>
      </div>
      {renderBodyState(blogSlug, data, isLoading, hasError)}
    </SidebarSection>
  );
}
