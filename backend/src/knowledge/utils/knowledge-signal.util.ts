import { clampText, toKnowledgeSlug } from "./knowledge-slug.util";
import { KnowledgeSourceSnapshot } from "../knowledge.types";
import { resolveKnowledgeSourceTaxonomy } from "./knowledge-taxonomy.util";

const LOW_SIGNAL_TAG_SLUGS = new Set([
  "실천",
  "체계화",
  "메모",
  "지식관리",
  "워크플로",
  "생산성",
  "카테고리",
  "회고",
  "아이디어",
  "독서",
  "연결",
  "실험",
  "실전",
  "정리",
  "학습",
  "노트",
]);

function dedupePreservingOrder(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLocaleLowerCase("ko");
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

export function getKnowledgeSignalTerms(source: KnowledgeSourceSnapshot) {
  const taxonomy = resolveKnowledgeSourceTaxonomy(source);
  const categorySegmentSlugs = new Set(taxonomy.signalSlugs);
  const selfSlugs = new Set(
    [source.blogAlias, source.blogSlug]
      .map((value) => toKnowledgeSlug(value || ""))
      .filter(Boolean),
  );

  const signalTags = dedupePreservingOrder(
    (source.tags || []).filter((tag) => {
      const slug = toKnowledgeSlug(tag);
      if (!slug || slug === "untitled-node") {
        return false;
      }
      if (selfSlugs.has(slug)) {
        return false;
      }
      if (categorySegmentSlugs.has(slug)) {
        return false;
      }
      if (LOW_SIGNAL_TAG_SLUGS.has(slug)) {
        return false;
      }
      return true;
    }),
  ).map((tag) => clampText(tag, 160));

  const queryTokens = dedupePreservingOrder([
    taxonomy.root.title,
    taxonomy.topic?.title || "",
    ...(source.categorySegments || []),
    ...signalTags,
    source.title || "",
    ...(source.headings || []).slice(0, 5),
  ]).slice(0, 12);

  return {
    signalTags,
    queryTokens,
  };
}
