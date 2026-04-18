import { redirect } from "next/navigation";
import { buildMapHref } from "@/lib/knowledge-ui";

interface PageProps {
  params: Promise<{
    blogSlug: string;
    nodeSlug: string;
  }>;
}

export default async function KnowledgeNodePage({ params }: PageProps) {
  const { blogSlug, nodeSlug } = await params;
  const decodedBlogSlug = decodeURIComponent(blogSlug);
  const decodedNodeSlug = decodeURIComponent(nodeSlug);

  redirect(buildMapHref(decodedBlogSlug, decodedNodeSlug));
}
