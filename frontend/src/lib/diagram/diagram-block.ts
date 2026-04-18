import { z } from 'zod';

const DIAGRAM_NODE_KINDS = ['step', 'data', 'decision', 'output', 'focus'] as const;
const DIAGRAM_DIRECTIONS = ['vertical', 'horizontal'] as const;
const DIAGRAM_STYLES = ['clean', 'soft', 'system'] as const;

const DiagramNodeSchema = z.object({
  id: z.string().min(1).regex(/^[A-Za-z][A-Za-z0-9_-]*$/),
  label: z.string().min(1),
  note: z.string().min(1).optional(),
  kind: z.enum(DIAGRAM_NODE_KINDS).optional(),
});

const DiagramEdgeSchema = z.object({
  from: z.string().min(1).regex(/^[A-Za-z][A-Za-z0-9_-]*$/),
  to: z.string().min(1).regex(/^[A-Za-z][A-Za-z0-9_-]*$/),
  label: z.string().min(1).optional(),
});

export const DiagramBlockSchema = z
  .object({
    type: z.literal('flow').default('flow'),
    style: z.enum(DIAGRAM_STYLES).default('clean'),
    direction: z.enum(DIAGRAM_DIRECTIONS).default('vertical'),
    title: z.string().min(1).optional(),
    nodes: z.array(DiagramNodeSchema).min(2),
    edges: z.array(DiagramEdgeSchema).min(1),
  })
  .superRefine((value, ctx) => {
    const nodeIds = new Set(value.nodes.map((node) => node.id));

    value.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `edges[${index}].from가 존재하지 않는 node를 가리킵니다: ${edge.from}`,
          path: ['edges', index, 'from'],
        });
      }

      if (!nodeIds.has(edge.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `edges[${index}].to가 존재하지 않는 node를 가리킵니다: ${edge.to}`,
          path: ['edges', index, 'to'],
        });
      }
    });
  });

export type DiagramBlockSpec = z.infer<typeof DiagramBlockSchema>;

type ParsedRootValue = string | ParsedArray;
type ParsedArray = Array<Record<string, string>>;

function parseScalar(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseKeyValue(line: string): [string, string] | null {
  const separatorIndex = line.indexOf(':');
  if (separatorIndex === -1) {
    return null;
  }

  const key = line.slice(0, separatorIndex).trim();
  const value = line.slice(separatorIndex + 1).trim();
  if (!key) {
    return null;
  }

  return [key, parseScalar(value)];
}

function leadingSpaces(line: string): number {
  return line.match(/^\s*/)?.[0]?.length ?? 0;
}

function parseObjectArray(lines: string[], startIndex: number, baseIndent: number) {
  const items: ParsedArray = [];
  let index = startIndex;

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const indent = leadingSpaces(rawLine);
    if (indent <= baseIndent) {
      break;
    }

    if (indent !== baseIndent + 2 || !trimmed.startsWith('- ')) {
      throw new Error(`잘못된 diagram 배열 형식입니다: "${rawLine}"`);
    }

    const item: Record<string, string> = {};
    const inlinePart = trimmed.slice(2).trim();
    if (inlinePart) {
      const parsedInline = parseKeyValue(inlinePart);
      if (!parsedInline) {
        throw new Error(`diagram 배열 항목을 해석할 수 없습니다: "${rawLine}"`);
      }
      item[parsedInline[0]] = parsedInline[1];
    }

    index += 1;

    while (index < lines.length) {
      const nestedRawLine = lines[index];
      const nestedTrimmed = nestedRawLine.trim();

      if (!nestedTrimmed) {
        index += 1;
        continue;
      }

      const nestedIndent = leadingSpaces(nestedRawLine);
      if (nestedIndent <= baseIndent + 2) {
        break;
      }

      if (nestedIndent !== baseIndent + 4) {
        throw new Error(`diagram 들여쓰기가 너무 깊습니다: "${nestedRawLine}"`);
      }

      const parsedPair = parseKeyValue(nestedTrimmed);
      if (!parsedPair) {
        throw new Error(`diagram 항목 속성을 해석할 수 없습니다: "${nestedRawLine}"`);
      }

      item[parsedPair[0]] = parsedPair[1];
      index += 1;
    }

    items.push(item);
  }

  return { items, nextIndex: index };
}

export function parseDiagramBlock(source: string): DiagramBlockSpec {
  const lines = source.replace(/\t/g, '  ').split(/\r?\n/);
  const root: Record<string, ParsedRootValue> = {};

  let index = 0;
  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (leadingSpaces(rawLine) !== 0) {
      throw new Error(`diagram 루트 들여쓰기가 잘못되었습니다: "${rawLine}"`);
    }

    const parsedRoot = parseKeyValue(trimmed);
    if (!parsedRoot) {
      throw new Error(`diagram 루트 속성을 해석할 수 없습니다: "${rawLine}"`);
    }

    const [key, value] = parsedRoot;
    if (value) {
      root[key] = value;
      index += 1;
      continue;
    }

    const { items, nextIndex } = parseObjectArray(lines, index + 1, 0);
    root[key] = items;
    index = nextIndex;
  }

  return DiagramBlockSchema.parse(root);
}

function quoteD2String(value: string): string {
  return JSON.stringify(value.replace(/\r/g, '').trim());
}

function nodeShape(kind?: DiagramBlockSpec['nodes'][number]['kind']): string | null {
  switch (kind) {
    case 'data':
      return 'cylinder';
    case 'decision':
      return 'diamond';
    case 'output':
      return 'page';
    default:
      return null;
  }
}

type DiagramStylePalette = {
  titleFill: string;
  titleStroke: string;
  titleText: string;
  nodeFill: string;
  nodeStroke: string;
  nodeText: string;
  focusFill: string;
  focusStroke: string;
  focusText: string;
  dataFill: string;
  dataStroke: string;
  decisionFill: string;
  decisionStroke: string;
  outputFill: string;
  outputStroke: string;
};

const DIAGRAM_STYLE_PALETTES: Record<
  DiagramBlockSpec['style'],
  DiagramStylePalette
> = {
  clean: {
    titleFill: '#F2F7FB',
    titleStroke: '#9BB4CD',
    titleText: '#17324A',
    nodeFill: '#F8FBFF',
    nodeStroke: '#A9BDD3',
    nodeText: '#1E3449',
    focusFill: '#DDEBFF',
    focusStroke: '#4F7DB4',
    focusText: '#18324C',
    dataFill: '#EEF6F7',
    dataStroke: '#5D8F97',
    decisionFill: '#FFF5E8',
    decisionStroke: '#BC8B43',
    outputFill: '#EEF7ED',
    outputStroke: '#5F9062',
  },
  soft: {
    titleFill: '#F4FBF6',
    titleStroke: '#A7C8B4',
    titleText: '#244338',
    nodeFill: '#F7FBF8',
    nodeStroke: '#B2CCBC',
    nodeText: '#28453C',
    focusFill: '#DCF4E5',
    focusStroke: '#5F9473',
    focusText: '#1E3A30',
    dataFill: '#EFF6FB',
    dataStroke: '#739CB8',
    decisionFill: '#FFF4EA',
    decisionStroke: '#C79466',
    outputFill: '#F3F8EE',
    outputStroke: '#7EA06B',
  },
  system: {
    titleFill: '#E8EEF5',
    titleStroke: '#5A718C',
    titleText: '#0F1E2D',
    nodeFill: '#F3F6F9',
    nodeStroke: '#7B8EA4',
    nodeText: '#14283D',
    focusFill: '#D9E4F2',
    focusStroke: '#32506E',
    focusText: '#0E2033',
    dataFill: '#EAF3F6',
    dataStroke: '#537E8C',
    decisionFill: '#F8EEDF',
    decisionStroke: '#A47433',
    outputFill: '#EBF2E8',
    outputStroke: '#62815F',
  },
};

function nodeColors(
  kind: DiagramBlockSpec['nodes'][number]['kind'] | undefined,
  palette: DiagramStylePalette,
) {
  switch (kind) {
    case 'focus':
      return {
        fill: palette.focusFill,
        stroke: palette.focusStroke,
        text: palette.focusText,
      };
    case 'data':
      return {
        fill: palette.dataFill,
        stroke: palette.dataStroke,
        text: palette.nodeText,
      };
    case 'decision':
      return {
        fill: palette.decisionFill,
        stroke: palette.decisionStroke,
        text: palette.nodeText,
      };
    case 'output':
      return {
        fill: palette.outputFill,
        stroke: palette.outputStroke,
        text: palette.nodeText,
      };
    default:
      return {
        fill: palette.nodeFill,
        stroke: palette.nodeStroke,
        text: palette.nodeText,
      };
  }
}

export function diagramBlockToD2(spec: DiagramBlockSpec): string {
  const lines: string[] = [];
  const palette = DIAGRAM_STYLE_PALETTES[spec.style];

  lines.push(`direction: ${spec.direction === 'horizontal' ? 'right' : 'down'}`);
  if (spec.title) {
    lines.push(`title: ${quoteD2String(spec.title)}`);
    lines.push('title.style: {');
    lines.push(`  fill: ${quoteD2String(palette.titleFill)}`);
    lines.push(`  stroke: ${quoteD2String(palette.titleStroke)}`);
    lines.push(`  font-color: ${quoteD2String(palette.titleText)}`);
    lines.push('}');
  }

  for (const node of spec.nodes) {
    const labelLines = [node.label];
    if (node.note) {
      labelLines.push(node.note);
    }

    lines.push(`${node.id}: {`);
    lines.push(`  label: ${quoteD2String(labelLines.join('\n'))}`);
    const shape = nodeShape(node.kind);
    if (shape) {
      lines.push(`  shape: ${shape}`);
    }
    const colors = nodeColors(node.kind, palette);
    lines.push('  style: {');
    lines.push(`    fill: ${quoteD2String(colors.fill)}`);
    lines.push(`    stroke: ${quoteD2String(colors.stroke)}`);
    lines.push(`    font-color: ${quoteD2String(colors.text)}`);
    lines.push('  }');
    lines.push('}');
  }

  for (const edge of spec.edges) {
    if (edge.label) {
      lines.push(`${edge.from} -> ${edge.to}: ${quoteD2String(edge.label)}`);
    } else {
      lines.push(`${edge.from} -> ${edge.to}`);
    }
  }

  return lines.join('\n');
}
