import { notFound } from "next/navigation";
import KnowledgeFlowBoardSection from "@/components/layout/KnowledgeFlowBoardSection";
import { fetchWithAuth } from "@/services/api/serverFetch";
import type {
  BlogKnowledgeTreeResponse,
  KnowledgeFlowBoardResponse,
} from "@/services/api/knowledge.service";

interface PageProps {
  params: Promise<{
    blogSlug: string;
  }>;
  searchParams?: Promise<{
    focus?: string;
    detail?: string;
  }>;
}

async function getBlogKnowledgeFlowBoard(
  blogSlug: string,
  focusSlug?: string,
): Promise<KnowledgeFlowBoardResponse | null> {
  const params = new URLSearchParams();
  if (focusSlug) {
    params.set("focus", focusSlug);
  }
  params.set("limit", "24");

  return fetchWithAuth<KnowledgeFlowBoardResponse>(
    `/blogs/slug/${encodeURIComponent(blogSlug)}/knowledge-flow-board?${params.toString()}`,
  );
}

async function getBlogKnowledgeTree(
  blogSlug: string,
): Promise<BlogKnowledgeTreeResponse | null> {
  return fetchWithAuth<BlogKnowledgeTreeResponse>(
    `/blogs/slug/${encodeURIComponent(blogSlug)}/knowledge-tree`,
  );
}

export default async function KnowledgeMapPage({
  params,
  searchParams,
}: PageProps) {
  const { blogSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const decodedBlogSlug = decodeURIComponent(blogSlug);
  const focusSlug = resolvedSearchParams?.focus
    ? decodeURIComponent(resolvedSearchParams.focus)
    : undefined;
  const detailSlug = resolvedSearchParams?.detail
    ? decodeURIComponent(resolvedSearchParams.detail)
    : undefined;
  const boardFocusSlug = focusSlug ?? detailSlug;
  const [initialData, treeData] = await Promise.all([
    getBlogKnowledgeFlowBoard(decodedBlogSlug, boardFocusSlug),
    getBlogKnowledgeTree(decodedBlogSlug),
  ]);

  if (!initialData) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0E141B]">
      <div className="mx-auto max-w-[1880px] px-4 py-5 md:px-6 md:py-6 xl:px-8">
        <KnowledgeFlowBoardSection
          blogSlug={decodedBlogSlug}
          data={initialData}
          treeData={treeData}
        />
      </div>
    </div>
  );
}
