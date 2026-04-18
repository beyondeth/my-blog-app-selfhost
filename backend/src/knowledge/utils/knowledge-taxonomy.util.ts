import { KNOWLEDGE_TAXONOMY_ROOTS } from "../knowledge-taxonomy.config";
import { KnowledgeSourceSnapshot } from "../knowledge.types";
import { clampText, toKnowledgeSlug } from "./knowledge-slug.util";

interface CanonicalKnowledgeRoot {
  title: string;
  slug: string;
  generic: boolean;
}

interface ParsedCategoryLabel {
  rootCandidate: string | null;
  topicCandidate: string | null;
}

export interface KnowledgeSourceTaxonomy {
  root: CanonicalKnowledgeRoot;
  topic: {
    title: string;
    slug: string;
  } | null;
  signalSlugs: string[];
}

const CANONICAL_ROOTS = KNOWLEDGE_TAXONOMY_ROOTS.map((root) => ({
  ...root,
  slug: toKnowledgeSlug(root.title),
}));

const ROOT_BY_ALIAS = new Map(
  CANONICAL_ROOTS.flatMap((root) =>
    root.aliases.map((alias) => [toKnowledgeSlug(alias), root] as const),
  ),
);

const GENERIC_ROOT =
  CANONICAL_ROOTS.find((root) => root.generic) ?? CANONICAL_ROOTS[0];

function cleanupCategoryValue(value: string | null | undefined) {
  return (value || "").replace(/^\s*카테고리:\s*/i, "").trim();
}

function parseBracketCategoryLabel(value: string) {
  const cleaned = cleanupCategoryValue(value);
  const match = cleaned.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (!match) {
    return null;
  }

  return {
    rootCandidate: match[1]?.trim() || null,
    topicCandidate: match[2]?.trim() || null,
  };
}

function normalizeTopicCandidate(value: string | null | undefined) {
  const cleaned = cleanupCategoryValue(value);
  if (!cleaned) {
    return null;
  }

  const bracket = parseBracketCategoryLabel(cleaned);
  const withoutBracket = bracket?.topicCandidate ?? cleaned;
  const firstClause = withoutBracket.split(/[:：]/)[0]?.trim() || withoutBracket;
  const normalized = clampText(firstClause.replace(/\s+/g, " ").trim(), 160);

  if (!normalized) {
    return null;
  }

  if (/^\d+$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeRootAliasCandidate(value: string | null | undefined) {
  const cleaned = cleanupCategoryValue(value);
  if (!cleaned) {
    return "";
  }

  const bracket = parseBracketCategoryLabel(cleaned);
  const base = bracket?.rootCandidate ?? cleaned;
  const slug = toKnowledgeSlug(base)
    .replace(/^domain-/, "")
    .replace(/^topic-/, "")
    .replace(/^concept-/, "")
    .replace(/-\d+$/, "");

  return slug;
}

function resolveConfiguredRoot(
  value: string | null | undefined,
): CanonicalKnowledgeRoot | null {
  const aliasSlug = normalizeRootAliasCandidate(value);

  if (!aliasSlug) {
    return null;
  }

  if (/^\d+$/.test(aliasSlug)) {
    return {
      title: GENERIC_ROOT.title,
      slug: GENERIC_ROOT.slug,
      generic: Boolean(GENERIC_ROOT.generic),
    };
  }

  const matched = ROOT_BY_ALIAS.get(aliasSlug);
  if (!matched) {
    return null;
  }

  return {
    title: matched.title,
    slug: matched.slug,
    generic: Boolean(matched.generic),
  };
}

function buildOpenWorldRoot(
  value: string | null | undefined,
): CanonicalKnowledgeRoot | null {
  const aliasSlug = normalizeRootAliasCandidate(value);
  if (!aliasSlug) {
    return null;
  }

  if (/^\d+$/.test(aliasSlug)) {
    return {
      title: GENERIC_ROOT.title,
      slug: GENERIC_ROOT.slug,
      generic: Boolean(GENERIC_ROOT.generic),
    };
  }

  const configured = resolveConfiguredRoot(value);
  if (configured) {
    return configured;
  }

  const cleaned = cleanupCategoryValue(value);
  const bracket = parseBracketCategoryLabel(cleaned);
  const label = clampText(
    (bracket?.rootCandidate ?? cleaned).replace(/\s+/g, " ").trim(),
    160,
  );

  if (!label) {
    return null;
  }

  return {
    title: label,
    slug: toKnowledgeSlug(label),
    generic: false,
  };
}

function shouldKeepSingleSegmentAsTopic(
  rawSegment: string,
  canonicalRoot: CanonicalKnowledgeRoot,
) {
  const cleaned = normalizeTopicCandidate(rawSegment);
  if (!cleaned) {
    return false;
  }

  if (canonicalRoot.generic) {
    return false;
  }

  return toKnowledgeSlug(cleaned) !== canonicalRoot.slug;
}

function dedupeSlugs(values: Array<string | null | undefined>) {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const slug = toKnowledgeSlug(value || "");
    if (!slug || slug === "untitled-node" || seen.has(slug)) {
      continue;
    }

    seen.add(slug);
    result.push(slug);
  }

  return result;
}

function parseCategoryCandidates(source: KnowledgeSourceSnapshot): ParsedCategoryLabel {
  const categorySegments = (source.categorySegments || []).filter(Boolean);

  if (categorySegments.length >= 2) {
    return {
      rootCandidate: categorySegments[0],
      topicCandidate: categorySegments[categorySegments.length - 1],
    };
  }

  const singleSegment = categorySegments[0] || source.category || "";
  if (!singleSegment) {
    return {
      rootCandidate: null,
      topicCandidate: null,
    };
  }

  const bracket = parseBracketCategoryLabel(singleSegment);
  if (bracket) {
    return bracket;
  }

  return {
    rootCandidate: singleSegment,
    topicCandidate: null,
  };
}

export function resolveKnowledgeSourceTaxonomy(
  source: Pick<KnowledgeSourceSnapshot, "category" | "categorySegments">,
): KnowledgeSourceTaxonomy {
  const categorySegments = (source.categorySegments || []).filter(Boolean);
  const { rootCandidate, topicCandidate } = parseCategoryCandidates(
    source as KnowledgeSourceSnapshot,
  );

  const canonicalRoot =
    buildOpenWorldRoot(rootCandidate) ??
    buildOpenWorldRoot(topicCandidate) ?? {
      title: GENERIC_ROOT.title,
      slug: GENERIC_ROOT.slug,
      generic: Boolean(GENERIC_ROOT.generic),
    };

  let topicTitle = normalizeTopicCandidate(topicCandidate);

  if (!topicTitle && categorySegments.length === 1) {
    const singleSegment = categorySegments[0];
    if (singleSegment && shouldKeepSingleSegmentAsTopic(singleSegment, canonicalRoot)) {
      topicTitle = normalizeTopicCandidate(singleSegment);
    }
  }

  if (topicTitle && toKnowledgeSlug(topicTitle) === canonicalRoot.slug) {
    topicTitle = null;
  }

  return {
    root: canonicalRoot,
    topic: topicTitle
      ? {
          title: topicTitle,
          slug: toKnowledgeSlug(topicTitle),
        }
      : null,
    signalSlugs: dedupeSlugs([
      ...categorySegments,
      canonicalRoot.slug,
      topicTitle,
    ]),
  };
}

export function getKnowledgeNodeCanonicalRoot(
  input: Pick<
    {
      title?: string | null;
      slug?: string | null;
      canonicalPath?: string | null;
    },
    "title" | "slug" | "canonicalPath"
  >,
): CanonicalKnowledgeRoot {
  const pathRootSegment =
    (input.canonicalPath || "")
      .replace(/^\//, "")
      .split("/")
      .map((segment) => segment.trim())
      .find(Boolean) || null;

  return (
    resolveConfiguredRoot(pathRootSegment) ??
    resolveConfiguredRoot(input.title) ??
    resolveConfiguredRoot(input.slug) ??
    buildOpenWorldRoot(pathRootSegment) ??
    buildOpenWorldRoot(input.title) ??
    buildOpenWorldRoot(input.slug) ?? {
      title: GENERIC_ROOT.title,
      slug: GENERIC_ROOT.slug,
      generic: Boolean(GENERIC_ROOT.generic),
    }
  );
}

export function normalizeKnowledgeRootTitle(value: string | null | undefined) {
  return getKnowledgeNodeCanonicalRoot({
    title: value ?? null,
    slug: value ?? null,
    canonicalPath: null,
  }).title;
}

export function resolveKnowledgeSeedRoot(value: string | null | undefined) {
  return resolveConfiguredRoot(value);
}
