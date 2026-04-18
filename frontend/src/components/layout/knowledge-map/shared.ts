import type {
  KnowledgeCanvasFactEdge,
  KnowledgeCanvasNode,
  KnowledgeCanvasTreeEdge,
  KnowledgeCanvasResponse,
} from "@/services/api/knowledge.service";
import {
  buildMapHref,
  buildNodeHref,
  normalizeKnowledgeLabel,
  relationDescription,
  relationLabel,
  treeEdgeDescription,
} from "@/lib/knowledge-ui";

export { buildMapHref, buildNodeHref, normalizeKnowledgeLabel };

export const MIN_CANVAS_WIDTH = 1800;
export const MIN_CANVAS_HEIGHT = 980;
export const COLUMN_GAP = 420;
export const ROW_GAP = 220;
export const NODE_CARD_WIDTH = 320;
export const NODE_CARD_HEIGHT = 180;
export const ROOT_CARD_WIDTH = 340;
export const ROOT_CARD_HEIGHT = 200;
export const FOCUS_CARD_WIDTH = 400;
export const FOCUS_CARD_HEIGHT = 260;
export const INSIGHT_CARD_WIDTH = 320;
export const INSIGHT_CARD_HEIGHT = 140;

export type CanvasNodeCard = {
  slug: string;
  title: string;
  canonicalPath: string;
  summary?: string | null;
  nodeType: string;
  postCount: number;
  evidenceCount: number;
  depth: number;
  isOnFocusPath: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "root" | "focus" | "node";
  semanticRole:
    | "root"
    | "focus"
    | "path"
    | "prerequisite"
    | "followup"
    | "duplicate"
    | "branch";
};

export type CanvasInsightCard = {
  id: string;
  title: string;
  reason: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasLayout = {
  width: number;
  height: number;
  nodes: CanvasNodeCard[];
  nodeMap: Map<string, CanvasNodeCard>;
  insights: CanvasInsightCard[];
};

export type CanvasSelectedEdge =
  | {
      kind: "tree";
      edgeKey: string;
      edge: KnowledgeCanvasTreeEdge;
    }
  | {
      kind: "fact";
      edgeKey: string;
      edge: KnowledgeCanvasFactEdge;
    };

export type CanvasRelationKind = "prerequisite" | "followup" | "duplicate";

export function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function sanitizeKnowledgeSummary(summary?: string | null) {
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

export function buildKnowledgeCardSummary(
  summary: string | null | undefined,
  fallback: string,
  maxLength = 96,
) {
  const base = sanitizeKnowledgeSummary(summary) || fallback;
  if (base.length <= maxLength) {
    return base;
  }

  return `${base.slice(0, maxLength - 1).trim()}…`;
}

export function relationKind(relationType: string): CanvasRelationKind {
  switch (relationType) {
    case "prerequisite_of":
      return "prerequisite";
    case "duplicate_of":
      return "duplicate";
    default:
      return "followup";
  }
}

export function relationMeta(relationType: string) {
  const label = relationLabel(relationType) ?? relationType;
  switch (relationKind(relationType)) {
    case "prerequisite":
      return {
        label,
        stroke: "#264653",
        fill: "#E3F1EF",
        text: "#264653",
      };
    case "duplicate":
      return {
        label,
        stroke: "#7C8EA3",
        fill: "#EFF3F8",
        text: "#526072",
      };
    default:
      return {
        label,
        stroke: "#2A9D8F",
        fill: "#DDF5F0",
        text: "#145E56",
      };
  }
}

export function treeEdgeKey(edge: KnowledgeCanvasTreeEdge) {
  return `tree:${edge.fromSlug}::${edge.toSlug}`;
}

export function factEdgeKey(edge: KnowledgeCanvasFactEdge) {
  return `fact:${edge.edgeKey}`;
}

export function semanticRoleLabel(role: CanvasNodeCard["semanticRole"]) {
  switch (role) {
    case "root":
      return "큰 묶음";
    case "focus":
      return "지금 보는 주제";
    case "path":
      return "흐름 위";
    case "prerequisite":
      return "먼저 읽기";
    case "followup":
      return "이어 읽기";
    case "duplicate":
      return "비슷한 주제";
    default:
      return "파생 주제";
  }
}

export function describeSelectedEdge(selectedEdge: CanvasSelectedEdge | null) {
  if (!selectedEdge) {
    return null;
  }

  if (selectedEdge.kind === "tree") {
    return {
      title: "상하위 구조 연결",
      description: treeEdgeDescription(),
    };
  }

  return {
    title:
      relationLabel(selectedEdge.edge.relationType) ??
      selectedEdge.edge.relationType,
    description: relationDescription(selectedEdge.edge.relationType),
  };
}

function semanticRolePriority(role: CanvasNodeCard["semanticRole"]) {
  switch (role) {
    case "root":
      return 0;
    case "path":
      return 1;
    case "focus":
      return 2;
    case "prerequisite":
      return 3;
    case "followup":
      return 4;
    case "duplicate":
      return 5;
    default:
      return 6;
  }
}

function compareCanvasNodes(left: KnowledgeCanvasNode, right: KnowledgeCanvasNode) {
  if (left.isOnFocusPath !== right.isOnFocusPath) {
    return left.isOnFocusPath ? -1 : 1;
  }
  if (right.postCount !== left.postCount) {
    return right.postCount - left.postCount;
  }
  if (right.evidenceCount !== left.evidenceCount) {
    return right.evidenceCount - left.evidenceCount;
  }
  return left.title.localeCompare(right.title, "ko");
}

export function buildCanvasLayout(
  data: KnowledgeCanvasResponse,
  showInsights: boolean,
): CanvasLayout {
  const focusSlug = data.focusNode?.slug ?? null;
  const semanticRoleBySlug = new Map<string, CanvasNodeCard["semanticRole"]>();
  for (const node of data.pathFromRoot) {
    semanticRoleBySlug.set(
      node.slug,
      node.slug === data.rootNode?.slug
        ? "root"
        : node.slug === focusSlug
          ? "focus"
          : "path",
    );
  }

  if (focusSlug) {
    for (const edge of data.factEdges) {
      if (
        edge.toSlug === focusSlug &&
        edge.relationType === "prerequisite_of"
      ) {
        semanticRoleBySlug.set(edge.fromSlug, "prerequisite");
      } else if (
        edge.fromSlug === focusSlug &&
        edge.relationType === "followup_to"
      ) {
        semanticRoleBySlug.set(edge.toSlug, "followup");
      } else if (
        edge.relationType === "duplicate_of" &&
        (edge.fromSlug === focusSlug || edge.toSlug === focusSlug)
      ) {
        semanticRoleBySlug.set(
          edge.fromSlug === focusSlug ? edge.toSlug : edge.fromSlug,
          "duplicate",
        );
      }
    }
  }

  const visualColumns = new Map<string, number>();
  for (const node of data.nodes) {
    visualColumns.set(node.slug, node.depth);
  }

  const focusDepth = focusSlug ? (visualColumns.get(focusSlug) ?? 0) : 0;

  if (focusSlug) {
    for (const edge of data.factEdges) {
      if (edge.toSlug === focusSlug && edge.relationType === "prerequisite_of") {
        const native = visualColumns.get(edge.fromSlug) ?? 0;
        visualColumns.set(edge.fromSlug, Math.min(native, focusDepth - 1));
      } else if (edge.fromSlug === focusSlug && edge.relationType === "followup_to") {
        const native = visualColumns.get(edge.toSlug) ?? 0;
        visualColumns.set(edge.toSlug, Math.max(native, focusDepth + 1));
      } else if (edge.relationType === "duplicate_of") {
        const target = edge.fromSlug === focusSlug ? edge.toSlug : edge.fromSlug;
        visualColumns.set(target, focusDepth);
      }
    }
  }

  let minCol = 0;
  for (const col of visualColumns.values()) {
    if (col < minCol) minCol = col;
  }
  const offsetCol = Math.abs(minCol);
  for (const [slug, col] of visualColumns.entries()) {
    visualColumns.set(slug, col + offsetCol);
  }

  const nodesByColumn = new Map<number, KnowledgeCanvasNode[]>();
  for (const node of data.nodes) {
    const col = visualColumns.get(node.slug)!;
    const existing = nodesByColumn.get(col) ?? [];
    existing.push(node);
    nodesByColumn.set(col, existing);
  }

  for (const entries of nodesByColumn.values()) {
    entries.sort((left, right) => {
      const leftRole = semanticRoleBySlug.get(left.slug) ?? "branch";
      const rightRole = semanticRoleBySlug.get(right.slug) ?? "branch";
      if (semanticRolePriority(leftRole) !== semanticRolePriority(rightRole)) {
        return semanticRolePriority(leftRole) - semanticRolePriority(rightRole);
      }
      return compareCanvasNodes(left, right);
    });
  }

  const maxVisualColumn = Math.max(0, ...Array.from(visualColumns.values()));
  const maxColumnCount = Math.max(
    1,
    ...Array.from(nodesByColumn.values()).map((items) => items.length),
  );
  const showInsightCards =
    showInsights && (data.insights?.followups.length ?? 0) > 0;
  const width = Math.max(
    MIN_CANVAS_WIDTH,
    180 + (maxVisualColumn + 1) * COLUMN_GAP + (showInsightCards ? 420 : 120),
  );
  const height = Math.max(
    MIN_CANVAS_HEIGHT,
    220 + maxColumnCount * ROW_GAP,
  );

  const cards: CanvasNodeCard[] = [];
  const nodeMap = new Map<string, CanvasNodeCard>();

  Array.from(nodesByColumn.entries())
    .sort((left, right) => left[0] - right[0])
    .forEach(([depth, items]) => {
      const totalHeight =
        items.reduce((sum, item) => {
          if (item.slug === data.rootNode?.slug) {
            return sum + ROOT_CARD_HEIGHT;
          }
          if (item.slug === data.focusNode?.slug) {
            return sum + FOCUS_CARD_HEIGHT;
          }
          return sum + NODE_CARD_HEIGHT;
        }, 0) +
        Math.max(0, items.length - 1) * (ROW_GAP - NODE_CARD_HEIGHT);

      let cursorY = Math.max(120, (height - totalHeight) / 2);
      const x = 120 + depth * COLUMN_GAP;

      for (const item of items) {
        const kind =
          item.slug === data.rootNode?.slug
            ? "root"
            : item.slug === data.focusNode?.slug
              ? "focus"
              : "node";
        const widthForCard =
          kind === "root"
            ? ROOT_CARD_WIDTH
            : kind === "focus"
              ? FOCUS_CARD_WIDTH
              : NODE_CARD_WIDTH;
        const heightForCard =
          kind === "root"
            ? ROOT_CARD_HEIGHT
            : kind === "focus"
              ? FOCUS_CARD_HEIGHT
              : NODE_CARD_HEIGHT;

        const card: CanvasNodeCard = {
          ...item,
          x,
          y: cursorY,
          width: widthForCard,
          height: heightForCard,
          kind,
          semanticRole:
            semanticRoleBySlug.get(item.slug) ??
            (kind === "root"
              ? "root"
              : kind === "focus"
                ? "focus"
                : item.isOnFocusPath
                  ? "path"
                  : "branch"),
        };

        cards.push(card);
        nodeMap.set(item.slug, card);
        cursorY += heightForCard + (ROW_GAP - NODE_CARD_HEIGHT);
      }
    });

  const insightCards: CanvasInsightCard[] = showInsightCards
    ? (data.insights?.followups ?? []).slice(0, 6).map((followup, index) => ({
        id: followup.id,
        title: followup.title,
        reason: followup.reason,
        x: width - INSIGHT_CARD_WIDTH - 96,
        y: 140 + index * 144,
        width: INSIGHT_CARD_WIDTH,
        height: INSIGHT_CARD_HEIGHT,
      }))
    : [];

  return {
    width,
    height,
    nodes: cards,
    nodeMap,
    insights: insightCards,
  };
}

export function buildBezierPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  curveStrength = 0.22,
) {
  const dx = to.x - from.x;
  const controlOffset = Math.max(60, Math.abs(dx) * curveStrength);
  const control1X = from.x + controlOffset;
  const control2X = to.x - controlOffset;

  return `M ${from.x} ${from.y} C ${control1X} ${from.y}, ${control2X} ${to.y}, ${to.x} ${to.y}`;
}

export function nodeSummaryFallback(node: {
  canonicalPath: string;
  postCount: number;
}) {
  return `${normalizeKnowledgeLabel(node.canonicalPath)} · 이 주제를 다룬 글 ${formatCount(node.postCount)}개`;
}

export function edgeByKey(
  edges: KnowledgeCanvasFactEdge[],
  edgeKey: string | null,
) {
  if (!edgeKey) {
    return null;
  }
  return edges.find((edge) => edge.edgeKey === edgeKey) ?? null;
}

export function getUnifiedEdgeEndpoints(from: CanvasNodeCard, to: CanvasNodeCard) {
  if (Math.abs(from.x - to.x) < 40) {
    return {
      from: { x: from.x + from.width / 2, y: from.y + (from.y < to.y ? from.height : 0) },
      to: { x: to.x + to.width / 2, y: to.y + (from.y < to.y ? 0 : to.height) }
    };
  }

  const isLeftToRight = from.x < to.x;
  return {
    from: {
      x: isLeftToRight ? from.x + from.width : from.x,
      y: from.y + from.height / 2,
    },
    to: {
      x: isLeftToRight ? to.x : to.x + to.width,
      y: to.y + to.height / 2,
    },
  };
}
