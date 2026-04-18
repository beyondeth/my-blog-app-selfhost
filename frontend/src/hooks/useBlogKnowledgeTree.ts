"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BlogKnowledgeTreeResponse,
  getBlogKnowledgeTree,
} from "@/services/api/knowledge.service";

export function useBlogKnowledgeTree(
  blogSlug: string,
  initialData?: BlogKnowledgeTreeResponse,
) {
  return useQuery<BlogKnowledgeTreeResponse>({
    queryKey: ["blog-knowledge-tree", blogSlug.replace("@", "")],
    queryFn: () => getBlogKnowledgeTree(blogSlug),
    staleTime: 1000 * 60 * 5,
    initialData,
  });
}
