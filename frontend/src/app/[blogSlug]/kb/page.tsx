import { redirect } from "next/navigation";
import { buildMapHref } from "@/lib/knowledge-ui";

interface PageProps {
  params: Promise<{
    blogSlug: string;
  }>;
}

export default async function KnowledgeTreeIndexPage({ params }: PageProps) {
  const { blogSlug } = await params;
  redirect(buildMapHref(decodeURIComponent(blogSlug)));
}
