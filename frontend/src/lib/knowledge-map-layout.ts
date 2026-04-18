import type {
  KnowledgeMapContextNode,
  KnowledgeMapEdge,
} from "@/services/api/knowledge.service";

export const VIEWBOX_WIDTH = 1440;
export const VIEWBOX_HEIGHT = 760;
export const CENTER_X = VIEWBOX_WIDTH / 2;
export const CENTER_Y = VIEWBOX_HEIGHT / 2 + 18;
export const FOCUS_WIDTH = 336;
export const FOCUS_HEIGHT = 188;
export const EXPLICIT_WIDTH = 210;
export const EXPLICIT_HEIGHT = 104;
export const CONTEXT_WIDTH = 188;
export const CONTEXT_HEIGHT = 76;

export type Point = {
  x: number;
  y: number;
};

export type EdgeDisplayKind = "before" | "after" | "similar";

export function point(dx: number, dy: number): Point {
  return {
    x: CENTER_X + dx,
    y: CENTER_Y + dy,
  };
}

function polarPoint(radius: number, angleDegrees: number): Point {
  const angle = (angleDegrees * Math.PI) / 180;
  return {
    x: CENTER_X + Math.cos(angle) * radius,
    y: CENTER_Y + Math.sin(angle) * radius,
  };
}

function buildOrbitAnchors(radii: number[], angles: number[]) {
  return radii.flatMap((radius) =>
    angles.map((angle) => polarPoint(radius, angle)),
  );
}

export const EXPLICIT_BUCKET_ANCHORS: Record<EdgeDisplayKind, Point[]> = {
  before: buildOrbitAnchors(
    [300, 382, 468],
    [-164, -146, -128, 128, 146, 164],
  ),
  after: buildOrbitAnchors(
    [300, 382, 468],
    [-52, -34, -16, 16, 34, 52],
  ),
  similar: buildOrbitAnchors(
    [314, 398, 482],
    [-112, -92, -72, 72, 92, 112],
  ),
};

export const CONTEXT_BUCKET_ANCHORS: Record<
  KnowledgeMapContextNode["contextType"],
  Point[]
> = {
  parent: buildOrbitAnchors([320, 360], [-100, -90, -80]),
  child: buildOrbitAnchors([320, 360], [62, 80, 96, 114]),
  sibling: buildOrbitAnchors([426, 474], [-170, -150, 150, 170]),
  hot: buildOrbitAnchors(
    [420, 470],
    [-140, -108, -72, -36, 36, 72, 108, 140],
  ),
};

function hashSlug(value: string) {
  return Array.from(value).reduce(
    (hash, char) => (hash * 33 + char.charCodeAt(0)) >>> 0,
    5381,
  );
}

export function assignStableAnchors<T extends { slug: string }>(
  items: T[],
  anchors: Point[],
) {
  const used = new Set<number>();
  const positions = new Map<string, Point>();

  if (anchors.length === 0) {
    return positions;
  }

  const sorted = items.slice().sort((left, right) =>
    left.slug.localeCompare(right.slug, "ko"),
  );

  for (const item of sorted) {
    let index = hashSlug(item.slug) % anchors.length;
    let attempts = 0;

    while (used.has(index) && attempts < anchors.length) {
      index = (index + 1) % anchors.length;
      attempts += 1;
    }

    used.add(index);
    positions.set(item.slug, anchors[index]);
  }

  return positions;
}

export function wrapText(label: string, maxLen: number) {
  if (label.length <= maxLen) {
    return [label];
  }

  const tokens = label.split(/\s+/);
  const rows: string[] = [];
  let current = "";

  for (const token of tokens) {
    const candidate = current ? `${current} ${token}` : token;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }

    if (current) {
      rows.push(current);
      current = token;
    } else {
      rows.push(token.slice(0, maxLen));
      current = token.slice(maxLen);
    }
  }

  if (current) {
    rows.push(current);
  }

  return rows.slice(0, 2);
}

export function contextMeta(contextType: KnowledgeMapContextNode["contextType"]) {
  switch (contextType) {
    case "parent":
      return {
        label: "큰 묶음",
        fill: "#E7F1F0",
        text: "#264653",
      };
    case "child":
      return {
        label: "더 좁은 주제",
        fill: "#ECFAF6",
        text: "#145E56",
      };
    case "sibling":
      return {
        label: "같은 결의 주제",
        fill: "#F2F5F8",
        text: "#526072",
      };
    case "hot":
      return {
        label: "많이 다룬 주제",
        fill: "#FEF1EB",
        text: "#B54708",
      };
    default:
      return {
        label: contextType,
        fill: "#F8FAFC",
        text: "#526072",
      };
  }
}

export function edgeDisplayKind(
  edge: KnowledgeMapEdge,
  focusSlug: string,
): EdgeDisplayKind {
  if (edge.relationType === "duplicate_of") {
    return "similar";
  }

  return edge.fromSlug === focusSlug ? "after" : "before";
}

export function edgeDisplayMeta(
  edge: KnowledgeMapEdge,
  focusSlug: string,
) {
  const kind = edgeDisplayKind(edge, focusSlug);

  if (kind === "before") {
    return {
      kind,
      label: "먼저 읽기",
      stroke: "#264653",
      pillFill: "#E3F1EF",
      pillText: "#264653",
    };
  }

  if (kind === "after") {
    return {
      kind,
      label: "이어 읽기",
      stroke: "#2A9D8F",
      pillFill: "#DDF5F0",
      pillText: "#145E56",
    };
  }

  return {
    kind,
    label: "비슷한 주제",
    stroke: "#7C8EA3",
    pillFill: "#EFF3F8",
    pillText: "#526072",
  };
}

export function buildCurve(
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const normalX = -dy * 0.08;
  const normalY = dx * 0.08;
  return `M ${from.x} ${from.y} Q ${Math.round(midX + normalX)} ${Math.round(midY + normalY)} ${to.x} ${to.y}`;
}
