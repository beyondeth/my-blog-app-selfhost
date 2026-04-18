"use client";

import type { BlogKnowledgeTreeResponse } from "@/services/api/knowledge.service";
import { useBlogKnowledgeTree } from "@/hooks/useBlogKnowledgeTree";
import { KnowledgeTreeSidebarView } from "./knowledge-tree/KnowledgeTreeSidebarView";

interface KnowledgeTreeSectionProps {
  blogSlug: string;
  className?: string;
  initialData?: BlogKnowledgeTreeResponse | null;
}

export default function KnowledgeTreeSection({
  blogSlug,
  className,
  initialData = null,
}: KnowledgeTreeSectionProps) {
  const { data, isLoading, error } = useBlogKnowledgeTree(
    blogSlug,
    initialData ?? undefined,
  );

  return (
    <KnowledgeTreeSidebarView
      blogSlug={blogSlug}
      className={className}
      data={data}
      isLoading={isLoading}
      hasError={Boolean(error)}
    />
  );
}
