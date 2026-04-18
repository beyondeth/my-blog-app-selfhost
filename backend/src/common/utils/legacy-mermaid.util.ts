export const MCP_RAW_MERMAID_ERROR_MESSAGE =
  'raw Mermaid fenced block은 더 이상 허용되지 않습니다. 구조도, 다이어그램, flow, workflow 요청은 반드시 ```diagram fenced block으로 작성하세요.';

type DiagramDirection = "horizontal" | "vertical";
type DiagramNodeKind = "step" | "decision";

export interface DiagramBlockNode {
  id: string;
  label: string;
  kind?: DiagramNodeKind;
}

export interface DiagramBlockEdge {
  from: string;
  to: string;
}

export interface DiagramBlockSpec {
  type: "flow";
  style: "clean";
  direction: DiagramDirection;
  nodes: DiagramBlockNode[];
  edges: DiagramBlockEdge[];
}

export interface LegacyMermaidConversionResult {
  markdown: string;
  convertedBlocks: number;
  skippedBlocks: number;
  skippedReasons: string[];
}

const MERMAID_BLOCK_PATTERN = /```mermaid\s*\n([\s\S]*?)```/gi;

function parseDirection(firstLine: string): DiagramDirection {
  const match = firstLine.trim().match(/^(?:flowchart|graph)\s+(LR|RL|TB|TD|BT)\b/i);
  if (!match) {
    throw new Error("지원하지 않는 Mermaid 다이어그램입니다. flowchart/graph 방향 선언이 필요합니다.");
  }

  return match[1].toUpperCase() === "LR" || match[1].toUpperCase() === "RL"
    ? "horizontal"
    : "vertical";
}

function normalizeNodeId(rawId: string): string {
  const cleaned = rawId.trim().replace(/[^\w-]/g, "_");
  if (!cleaned) {
    throw new Error(`Mermaid node id를 해석할 수 없습니다: "${rawId}"`);
  }

  return /^[A-Za-z]/.test(cleaned) ? cleaned : `N_${cleaned}`;
}

function decodeMermaidLabel(label: string): string {
  return label
    .trim()
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function parseNodeToken(token: string): DiagramBlockNode {
  const trimmed = token.trim();
  const bareMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9_-]*)$/);
  if (bareMatch) {
    return {
      id: normalizeNodeId(bareMatch[1]),
      label: bareMatch[1],
    };
  }

  const shapedMatch = trimmed.match(
    /^([A-Za-z][A-Za-z0-9_-]*)(?:\[(.+)\]|\((.+)\)|\{(.+)\})$/,
  );
  if (!shapedMatch) {
    throw new Error(`지원하지 않는 Mermaid 노드 형식입니다: "${trimmed}"`);
  }

  const [, rawId, squareLabel, roundLabel, decisionLabel] = shapedMatch;
  const label = decodeMermaidLabel(squareLabel || roundLabel || decisionLabel || rawId);

  return {
    id: normalizeNodeId(rawId),
    label,
    kind: decisionLabel ? "decision" : "step",
  };
}

function parseEdgeLine(line: string): { from: DiagramBlockNode; to: DiagramBlockNode } {
  const edgeMatch = line.match(/^(.*?)\s*--+>\s*(.*?)$/);
  if (!edgeMatch) {
    throw new Error(`지원하지 않는 Mermaid edge 형식입니다: "${line}"`);
  }

  return {
    from: parseNodeToken(edgeMatch[1]),
    to: parseNodeToken(edgeMatch[2]),
  };
}

export function containsRawMermaidFence(markdown?: string | null): boolean {
  if (!markdown) return false;
  return /```mermaid\b/i.test(markdown);
}

export function convertMermaidFlowchartToDiagramBlock(source: string): string {
  const lines = source
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("%%"));

  if (lines.length < 2) {
    throw new Error("Mermaid flowchart 본문이 비어 있습니다.");
  }

  const direction = parseDirection(lines[0]);
  const nodes = new Map<string, DiagramBlockNode>();
  const edges: DiagramBlockEdge[] = [];

  for (const line of lines.slice(1)) {
    if (!line.includes("-->")) {
      const node = parseNodeToken(line);
      const existing = nodes.get(node.id);
      if (!existing) {
        nodes.set(node.id, node);
      }
      continue;
    }

    const { from, to } = parseEdgeLine(line);
    const existingFrom = nodes.get(from.id);
    const existingTo = nodes.get(to.id);
    if (!existingFrom) {
      nodes.set(from.id, from);
    }
    if (!existingTo) {
      nodes.set(to.id, to);
    }
    edges.push({ from: from.id, to: to.id });
  }

  if (nodes.size < 2 || edges.length < 1) {
    throw new Error("diagram block으로 바꾸기 위한 노드/엣지 정보가 부족합니다.");
  }

  const spec: DiagramBlockSpec = {
    type: "flow",
    style: "clean",
    direction,
    nodes: Array.from(nodes.values()),
    edges,
  };

  return diagramBlockStringify(spec);
}

function quoteScalar(value: string): string {
  return JSON.stringify(value);
}

function diagramBlockStringify(spec: DiagramBlockSpec): string {
  const lines: string[] = [
    "type: flow",
    "style: clean",
    `direction: ${spec.direction}`,
    "nodes:",
  ];

  for (const node of spec.nodes) {
    lines.push(`  - id: ${node.id}`);
    lines.push(`    label: ${quoteScalar(node.label)}`);
    if (node.kind && node.kind !== "step") {
      lines.push(`    kind: ${node.kind}`);
    }
  }

  lines.push("edges:");
  for (const edge of spec.edges) {
    lines.push(`  - from: ${edge.from}`);
    lines.push(`    to: ${edge.to}`);
  }

  return lines.join("\n");
}

export function convertLegacyMermaidMarkdownToDiagramBlocks(
  markdown: string,
): LegacyMermaidConversionResult {
  let convertedBlocks = 0;
  let skippedBlocks = 0;
  const skippedReasons: string[] = [];

  const convertedMarkdown = markdown.replace(
    MERMAID_BLOCK_PATTERN,
    (block, source: string) => {
      try {
        const diagramBlock = convertMermaidFlowchartToDiagramBlock(source);
        convertedBlocks += 1;
        return `\`\`\`diagram\n${diagramBlock}\n\`\`\``;
      } catch (error) {
        skippedBlocks += 1;
        skippedReasons.push(error instanceof Error ? error.message : String(error));
        return block;
      }
    },
  );

  return {
    markdown: convertedMarkdown,
    convertedBlocks,
    skippedBlocks,
    skippedReasons,
  };
}
