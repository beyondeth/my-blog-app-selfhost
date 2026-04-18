export function normalizeKnowledgeLabel(label: string) {
  return label
    .split(">")
    .map((part) => part.replace(/^\s*카테고리:\s*/g, "").trim())
    .filter(Boolean)
    .join(" > ")
    .replace(/\s{2,}/g, " ");
}

export function buildMapHref(
  blogSlug: string,
  focusSlug?: string,
) {
  const params = new URLSearchParams();
  if (focusSlug) {
    params.set("focus", focusSlug);
  }

  const query = params.toString();
  return query ? `/${blogSlug}/kb/map?${query}` : `/${blogSlug}/kb/map`;
}

export function buildNodeHref(blogSlug: string, nodeSlug: string) {
  return buildMapHref(blogSlug, nodeSlug);
}

export function buildTreeHref(blogSlug: string) {
  return buildMapHref(blogSlug);
}

export function buildBlogHomeHref(blogSlug: string) {
  return `/${blogSlug}`;
}

export function formatKnowledgeUpdatedLabel(dateString: string | null) {
  if (!dateString) return "자동 갱신";

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return "자동 갱신";
  }

  return parsed.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

export function relationLabel(relationType?: string) {
  switch (relationType) {
    case "prerequisite_of":
      return "먼저 읽기";
    case "followup_to":
      return "이어 읽기";
    case "duplicate_of":
      return "비슷한 주제";
    default:
      return null;
  }
}

export function relationDescription(relationType?: string) {
  switch (relationType) {
    case "prerequisite_of":
      return "이 주제를 이해하기 전에 먼저 보면 흐름이 잡히는 주제입니다.";
    case "followup_to":
      return "이 주제를 본 다음 확장해서 이어 읽기 좋은 주제입니다.";
    case "duplicate_of":
      return "같은 결을 다른 이름이나 관점으로 다루는 가까운 주제입니다.";
    default:
      return "이 주제와 직접 연결된 관계입니다.";
  }
}

export function treeEdgeDescription() {
  return "같은 위키 트리 안에서 상위 주제와 하위 주제를 잇는 구조선입니다.";
}

export function nodeTypeLabel(nodeType: string) {
  switch (nodeType) {
    case "domain":
      return "큰 분류";
    case "topic":
      return "주제";
    case "concept":
      return "개념";
    default:
      return nodeType;
  }
}

export const KB_FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#264653] focus-visible:ring-offset-2 dark:focus-visible:ring-[#6CC3B2] dark:focus-visible:ring-offset-[#0E141B]";
