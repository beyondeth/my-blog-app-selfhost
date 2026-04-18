import type { KnowledgeFlowBoardNode } from "@/services/api/knowledge.service";
import { normalizeKnowledgeLabel } from "@/lib/knowledge-ui";

export function sanitizeSummary(summary?: string | null) {
  if (!summary) {
    return "";
  }

  return summary
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildBoardSummary(
  summary: string | null | undefined,
  fallback: string,
  maxLength = 120,
) {
  const base = sanitizeSummary(summary) || fallback;
  if (base.length <= maxLength) {
    return base;
  }

  return `${base.slice(0, maxLength - 1).trim()}…`;
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function nodeKindLabel(kind: KnowledgeFlowBoardNode["kind"]) {
  switch (kind) {
    case "focus":
      return "현재 주제";
    case "child":
      return "파생 주제";
    case "prerequisite":
      return "먼저 읽기";
    case "followup":
      return "이어 읽기";
    case "duplicate":
      return "같이 보기";
    case "path":
      return "흐름";
    default:
      return normalizeKnowledgeLabel(kind);
  }
}
