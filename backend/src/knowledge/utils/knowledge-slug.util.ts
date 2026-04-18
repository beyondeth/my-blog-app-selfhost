export function toKnowledgeSlug(value: string): string {
  const normalized = (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);

  return normalized || "untitled-node";
}

export function clampText(value: string, maxLength: number): string {
  const normalized = (value || "").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength).trim();
}
