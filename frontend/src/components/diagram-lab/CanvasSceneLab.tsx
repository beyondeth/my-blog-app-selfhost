"use client";

import { useState, type ReactNode } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { ArrowRight, ExternalLink, Github, Info, Lock, Search, ShieldCheck, ZoomIn, ZoomOut } from "lucide-react";
import DiagramRenderer from "@/components/ui/content-renderer/components/DiagramRenderer";
import MermaidRenderer from "@/components/ui/content-renderer/components/MermaidRenderer";
import D2Renderer from "./D2Renderer";
import { canvasScenes, type SceneAccent, type SceneAnchor, type SceneConnector, type SceneDefinition, type SceneNode, type SceneSurface } from "./canvas-scenes";

const accentStyles: Record<SceneAccent, { border: string; bg: string; bar: string; chip: string; text: string }> = {
  teal: {
    border: "border-[#B7D8D4] dark:border-[#2A5550]",
    bg: "bg-[#F5FBFA] dark:bg-[#0F1F1D]",
    bar: "bg-[#2D6F68] dark:bg-[#79C5B6]",
    chip: "bg-[#DCEFEB] dark:bg-[#16332F]",
    text: "text-[#214A46] dark:text-[#BEE6DE]",
  },
  navy: {
    border: "border-[#C7D5E9] dark:border-[#30415E]",
    bg: "bg-[#F7FAFF] dark:bg-[#101923]",
    bar: "bg-[#385A8B] dark:bg-[#7FA8E8]",
    chip: "bg-[#E3ECFA] dark:bg-[#172536]",
    text: "text-[#31517D] dark:text-[#C3D9FF]",
  },
  mint: {
    border: "border-[#CDE4D7] dark:border-[#274439]",
    bg: "bg-[#F7FBF8] dark:bg-[#0F1915]",
    bar: "bg-[#4B8A72] dark:bg-[#8ED5B7]",
    chip: "bg-[#E2F0E8] dark:bg-[#173026]",
    text: "text-[#3F6F5D] dark:text-[#C7E9D8]",
  },
  sand: {
    border: "border-[#E3D8C2] dark:border-[#514838]",
    bg: "bg-[#FFFCF7] dark:bg-[#17130D]",
    bar: "bg-[#9B7A45] dark:bg-[#E6BF7E]",
    chip: "bg-[#F6EBD8] dark:bg-[#2E2517]",
    text: "text-[#7B6136] dark:text-[#F0D8A5]",
  },
  rose: {
    border: "border-[#E6CCD8] dark:border-[#523544]",
    bg: "bg-[#FFF8FB] dark:bg-[#1A1117]",
    bar: "bg-[#A75A78] dark:bg-[#E3A0BB]",
    chip: "bg-[#F5E3EB] dark:bg-[#311B26]",
    text: "text-[#83445F] dark:text-[#F2C9D8]",
  },
};

const surfaceStyles: Record<
  SceneSurface,
  {
    shell: string;
    grid: string;
    overlay?: string;
    canvasBorder: string;
    nodeRadius: string;
  }
> = {
  document: {
    shell: "bg-white dark:bg-[#0B1118]",
    grid: "rgba(38,70,83,0.05)",
    canvasBorder: "border-[#DDE5EE] dark:border-[#26313D]",
    nodeRadius: "rounded-[24px]",
  },
  whiteboard: {
    shell: "bg-[#FFFDFC] dark:bg-[#10161D]",
    grid: "rgba(155,122,69,0.06)",
    overlay:
      "radial-gradient(circle at top left, rgba(244,229,199,0.52), transparent 28%), radial-gradient(circle at bottom right, rgba(108,195,178,0.14), transparent 26%)",
    canvasBorder: "border-[#E7DDC9] dark:border-[#32404C]",
    nodeRadius: "rounded-[28px]",
  },
  sketch: {
    shell: "bg-[#FBF7EF] dark:bg-[#13100D]",
    grid: "rgba(122,97,54,0.08)",
    overlay:
      "radial-gradient(circle at top left, rgba(245,226,206,0.72), transparent 24%), radial-gradient(circle at bottom right, rgba(214,164,181,0.18), transparent 30%)",
    canvasBorder: "border-[#E6D8BE] dark:border-[#4B4031]",
    nodeRadius: "rounded-[26px]",
  },
  editor: {
    shell: "bg-[#0E141C] dark:bg-[#0B1118]",
    grid: "rgba(143,161,181,0.09)",
    overlay:
      "radial-gradient(circle at top right, rgba(56,90,139,0.18), transparent 30%), radial-gradient(circle at bottom left, rgba(45,111,104,0.16), transparent 28%)",
    canvasBorder: "border-[#263340] dark:border-[#30404F]",
    nodeRadius: "rounded-[22px]",
  },
  workflow: {
    shell: "bg-[#F7FAFC] dark:bg-[#0C1117]",
    grid: "rgba(87,104,124,0.05)",
    overlay:
      "linear-gradient(to bottom, rgba(45,111,104,0.06) 0%, rgba(45,111,104,0.06) 20%, transparent 20%, transparent 33%, rgba(56,90,139,0.06) 33%, rgba(56,90,139,0.06) 53%, transparent 53%, transparent 66%, rgba(155,122,69,0.05) 66%, rgba(155,122,69,0.05) 86%, transparent 86%)",
    canvasBorder: "border-[#D8E2EB] dark:border-[#26313D]",
    nodeRadius: "rounded-[20px]",
  },
  network: {
    shell: "bg-[#F8FBFD] dark:bg-[#0A1016]",
    grid: "rgba(56,90,139,0.05)",
    overlay:
      "radial-gradient(circle at center, rgba(127,168,232,0.10), transparent 36%), radial-gradient(circle at top left, rgba(108,195,178,0.10), transparent 24%), radial-gradient(circle at bottom right, rgba(167,90,120,0.08), transparent 26%)",
    canvasBorder: "border-[#D7E3EC] dark:border-[#22303C]",
    nodeRadius: "rounded-[24px]",
  },
  studio: {
    shell: "bg-[#FCFDFC] dark:bg-[#0B1117]",
    grid: "rgba(38,70,83,0.045)",
    overlay:
      "radial-gradient(circle at top left, rgba(108,195,178,0.13), transparent 24%), radial-gradient(circle at top right, rgba(56,90,139,0.10), transparent 20%)",
    canvasBorder: "border-[#D8E4ED] dark:border-[#27313D]",
    nodeRadius: "rounded-[24px]",
  },
};

function inferDiagramType(scene: SceneDefinition) {
  switch (scene.surface) {
    case "workflow":
      return "workflow";
    case "network":
      return "cluster-map";
    case "whiteboard":
    case "sketch":
      return "research-board";
    case "editor":
      return "pipeline";
    case "studio":
      return "branch-board";
    case "document":
    default:
      return "flow-board";
  }
}

function mermaidDirection(scene: SceneDefinition) {
  switch (scene.surface) {
    case "editor":
    case "studio":
    case "network":
      return "LR";
    case "workflow":
      return "TB";
    default:
      return "TD";
  }
}

function d2Direction(scene: SceneDefinition) {
  switch (scene.surface) {
    case "editor":
    case "studio":
    case "network":
      return "right";
    default:
      return "down";
  }
}

function toSafeNodeId(id: string) {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function compactText(text: string, maxLength = 70) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function quoteDiagramValue(value: string) {
  return JSON.stringify(value.replace(/\n/g, " ").trim());
}

function getFocusTitle(scene: SceneDefinition) {
  return (
    scene.nodes.find((node) => node.eyebrow?.includes("지금 보는 주제"))?.title ??
    scene.nodes.find((node) => node.variant === "hero")?.title ??
    scene.nodes.find((node) => node.variant === "panel")?.title ??
    scene.name
  );
}

function getSectionTitles(scene: SceneDefinition) {
  return scene.nodes
    .filter((node) => node.variant !== "banner" && node.variant !== "strip")
    .map((node) => node.title)
    .filter((title, index, list) => title !== getFocusTitle(scene) && list.indexOf(title) === index)
    .slice(0, 5);
}

function buildMermaidSource(scene: SceneDefinition) {
  const direction = mermaidDirection(scene);
  const nodeLines = scene.nodes.map((node) => {
    const labelParts = [
      node.title,
      node.summary ? compactText(node.summary, 78) : undefined,
      node.rows?.[0]?.value ? compactText(node.rows[0].value, 64) : undefined,
    ].filter(Boolean);
    const label = labelParts.join("<br/>").replace(/"/g, "'");
    return `  ${toSafeNodeId(node.id)}["${label}"]`;
  });

  const connectorLines = scene.connectors.map((connector) => {
    const from = toSafeNodeId(connector.from);
    const to = toSafeNodeId(connector.to);
    const arrow = connector.tone === "dashed" ? "-.->" : connector.tone === "secondary" ? "-->" : "==>";
    const label = connector.label ? `|${connector.label.replace(/\|/g, "/")}|` : "";
    return `  ${from} ${arrow}${label} ${to}`;
  });

  return [`flowchart ${direction}`, ...nodeLines, ...connectorLines].join("\n");
}

function buildD2Source(scene: SceneDefinition) {
  const lines = [`direction: ${d2Direction(scene)}`];

  for (const node of scene.nodes) {
    const safeId = toSafeNodeId(node.id);
    const labelParts = [
      node.title,
      node.summary ? compactText(node.summary, 92) : undefined,
      node.rows?.[0]?.value ? compactText(node.rows[0].value, 80) : undefined,
    ].filter(Boolean);

    lines.push(`${safeId}: {`);
    lines.push(`  label: "${labelParts.join("\\n").replace(/"/g, "'")}"`);
    lines.push("}");
  }

  for (const connector of scene.connectors) {
    const from = toSafeNodeId(connector.from);
    const to = toSafeNodeId(connector.to);
    lines.push(connector.label ? `${from} -> ${to}: "${connector.label.replace(/"/g, "'")}"` : `${from} -> ${to}`);
  }

  return lines.join("\n");
}

function buildDiagramBlockSource(scene: SceneDefinition) {
  const direction = d2Direction(scene) === 'right' ? 'horizontal' : 'vertical';
  const nodeLines = scene.nodes.map((node) => {
    const lines = [
      `  - id: ${toSafeNodeId(node.id)}`,
      `    label: ${quoteDiagramValue(node.title)}`,
    ];

    const note = node.summary
      ? compactText(node.summary, 92)
      : node.rows?.[0]?.value
        ? compactText(node.rows[0].value, 80)
        : "";

    if (note) {
      lines.push(`    note: ${quoteDiagramValue(note.replace(/:/g, " -"))}`);
    }

    return lines.join("\n");
  });

  const edgeLines = scene.connectors.map((connector) => {
    const lines = [
      `  - from: ${toSafeNodeId(connector.from)}`,
      `    to: ${toSafeNodeId(connector.to)}`,
    ];
    if (connector.label) {
      lines.push(`    label: ${quoteDiagramValue(connector.label.replace(/:/g, " -"))}`);
    }
    return lines.join("\n");
  });

  return [
    "type: flow",
    "style: clean",
    `direction: ${direction}`,
    `title: ${quoteDiagramValue(scene.name)}`,
    "nodes:",
    ...nodeLines,
    "edges:",
    ...edgeLines,
  ].join("\n");
}

function getAutopostPrompt(scene: SceneDefinition) {
  const focus = getFocusTitle(scene);
  switch (scene.id) {
    case "mcp-publishing-pipeline":
      return "지금까지 작업한 자동포스팅과 KB 반영 흐름을 블로그 글로 정리해줘. 플로우차트 함께.";
    case "kb-branch-board":
      return `${focus}를 중심으로 위키 흐름을 설명하는 글을 자동포스팅해줘. 구조도도 함께 넣어줘.`;
    case "approval-bpmn-lanes":
      return "후보 주제가 승인되어 공개 KB에 반영되는 과정을 절차형 글로 자동포스팅해줘. 흐름도도 같이.";
    case "cluster-explorer-map":
      return "지식 시스템의 핵심 축이 어떻게 연결되는지 정리한 글을 자동포스팅해줘. 관계 구조도도 함께.";
    default:
      return `${scene.name} 구조를 설명하는 글을 자동포스팅해줘. 플로우차트 함께.`;
  }
}

function buildMarkdownExample(scene: SceneDefinition, engine: "diagram" | "mermaid" | "d2") {
  const focus = getFocusTitle(scene);

  if (engine === "mermaid") {
    return `# ${scene.name}를 한 장으로 이해하기

${scene.blurb}

\`\`\`mermaid
${buildMermaidSource(scene)}
\`\`\`

## 핵심 요약

- 현재 글에서 가장 먼저 이해해야 할 주제는 **${focus}** 입니다.
- 본문에서는 위 다이어그램을 기준으로 단계와 연결을 설명합니다.
`;
  }

  if (engine === "d2") {
    return `# ${scene.name}를 한 장으로 이해하기

${scene.blurb}

\`\`\`d2
${buildD2Source(scene)}
\`\`\`

## 핵심 요약

- 현재 글에서 가장 먼저 이해해야 할 주제는 **${focus}** 입니다.
- 본문에서는 위 다이어그램을 기준으로 단계와 연결을 설명합니다.
`;
  }

  const diagramSource = buildDiagramBlockSource(scene);

  return `# ${scene.name}를 한 장으로 이해하기

${scene.blurb}

\`\`\`diagram
${diagramSource}
\`\`\`

## 핵심 요약

- 현재 글에서 가장 먼저 이해해야 할 주제는 **${focus}** 입니다.
- 구조는 단순한 관계망이 아니라, 실제 읽는 순서와 판단 흐름이 보이도록 정리합니다.
- 본문에서는 위 다이어그램을 기준으로 각 단계와 근거를 설명합니다.
`;
}

function EnginePreviewCard({
  title,
  blurb,
  markdown,
  children,
  initialPreviewScale = 1,
}: {
  title: string;
  blurb: string;
  markdown: string;
  children: ReactNode;
  initialPreviewScale?: number;
}) {
  const [previewScale, setPreviewScale] = useState(initialPreviewScale);

  return (
    <section className="overflow-hidden border-b border-[#E7EDF3] bg-white last:border-b-0 dark:border-[#22303C] dark:bg-[#0F161E]">
      <div className="border-b border-[#E7EDF3] px-5 py-4 dark:border-[#22303C]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#738094] dark:text-[#8CA0B5]">{title}</div>
        <div className="mt-2 text-sm leading-7 text-[#4F5E71] dark:text-[#A7B8C9]">{blurb}</div>
      </div>
      <div className="grid min-h-[640px] lg:grid-cols-[420px_minmax(0,1fr)]">
        <pre className="max-h-[340px] overflow-auto border-b border-[#E7EDF3] px-5 py-4 text-[12px] leading-6 text-[#314254] dark:border-[#22303C] dark:text-[#D8E6F4] lg:max-h-none lg:border-b-0 lg:border-r">
          <code>{markdown}</code>
        </pre>
        <div className="min-h-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E7EDF3] px-4 py-3 dark:border-[#22303C]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#738094] dark:text-[#8CA0B5]">
              Preview
            </div>
            <div className="flex items-center gap-2">
              <span className="min-w-[54px] text-right text-[11px] font-semibold text-[#6E7E91] dark:text-[#8CA0B5]">
                {Math.round(previewScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setPreviewScale((value) => Math.max(0.75, Number((value - 0.1).toFixed(2))))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D7E1EA] bg-white text-[#284150] transition-colors hover:bg-[#F3F7FA] dark:border-[#243240] dark:bg-[#101923] dark:text-[#CFE2F3] dark:hover:bg-[#15202B]"
                aria-label={`${title} 축소`}
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewScale(initialPreviewScale)}
                className="rounded-full border border-[#D7E1EA] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#284150] transition-colors hover:bg-[#F3F7FA] dark:border-[#243240] dark:bg-[#101923] dark:text-[#CFE2F3] dark:hover:bg-[#15202B]"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setPreviewScale((value) => Math.min(1.8, Number((value + 0.1).toFixed(2))))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D7E1EA] bg-white text-[#284150] transition-colors hover:bg-[#F3F7FA] dark:border-[#243240] dark:bg-[#101923] dark:text-[#CFE2F3] dark:hover:bg-[#15202B]"
                aria-label={`${title} 확대`}
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="h-[460px] overflow-auto px-4 py-4">
            <div
              style={{
                transform: `scale(${previewScale})`,
                transformOrigin: "top left",
                width: `${100 / previewScale}%`,
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CustomScenePreview({ scene }: { scene: SceneDefinition }) {
  const scale = 0.28;
  return (
    <div className="overflow-auto rounded-[24px] border border-[#DFE7EF] bg-[#F7FAFC] p-4 dark:border-[#24313E] dark:bg-[#0B1118]">
      <div style={{ width: scene.width * scale, height: scene.height * scale }}>
        <div style={{ width: scene.width, height: scene.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <SceneCanvas scene={scene} />
        </div>
      </div>
    </div>
  );
}

function getAnchorPoint(node: SceneNode, anchor: SceneAnchor): { x: number; y: number } {
  switch (anchor) {
    case "top":
      return { x: node.x + node.w / 2, y: node.y };
    case "right":
      return { x: node.x + node.w, y: node.y + node.h / 2 };
    case "bottom":
      return { x: node.x + node.w / 2, y: node.y + node.h };
    case "left":
    default:
      return { x: node.x, y: node.y + node.h / 2 };
  }
}

function buildConnectorPath(scene: SceneDefinition, connector: SceneConnector) {
  const fromNode = scene.nodes.find((node) => node.id === connector.from);
  const toNode = scene.nodes.find((node) => node.id === connector.to);
  if (!fromNode || !toNode) {
    return null;
  }

  const from = getAnchorPoint(fromNode, connector.fromAnchor ?? "right");
  const to = getAnchorPoint(toNode, connector.toAnchor ?? "left");
  const horizontalDistance = Math.max(Math.abs(to.x - from.x) * 0.45, 80);
  const verticalDistance = Math.max(Math.abs(to.y - from.y) * 0.3, 42);

  let c1 = { x: from.x + horizontalDistance, y: from.y };
  let c2 = { x: to.x - horizontalDistance, y: to.y };

  if ((connector.fromAnchor ?? "right") === "bottom") {
    c1 = { x: from.x, y: from.y + verticalDistance };
  }
  if ((connector.toAnchor ?? "left") === "top") {
    c2 = { x: to.x, y: to.y - verticalDistance };
  }
  if ((connector.fromAnchor ?? "right") === "left") {
    c1 = { x: from.x - horizontalDistance, y: from.y };
  }
  if ((connector.toAnchor ?? "left") === "right") {
    c2 = { x: to.x + horizontalDistance, y: to.y };
  }

  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}

function SceneNodeCard({ node, surface }: { node: SceneNode; surface: SceneSurface }) {
  const accent = accentStyles[node.accent];
  const surfaceTone = surfaceStyles[surface];
  const isHero = node.variant === "hero";
  const isBanner = node.variant === "banner";
  const isStrip = node.variant === "strip";

  return (
    <div
      className={[
        "absolute overflow-hidden border bg-white shadow-[0_18px_50px_-32px_rgba(23,35,52,0.28)] dark:bg-[#0F1720]",
        accent.border,
        isBanner ? "rounded-[24px]" : isStrip ? "rounded-[22px]" : surfaceTone.nodeRadius,
      ].join(" ")}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
    >
      <div className={`h-1.5 w-full ${accent.bar}`} />
      <div className="flex h-[calc(100%-6px)] flex-col gap-3 overflow-hidden px-5 py-4">
        {(node.eyebrow || isHero) ? (
          <div className="flex items-center gap-2">
            {node.eyebrow ? (
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase ${accent.chip} ${accent.text}`}>
                {node.eyebrow}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="min-w-0">
          <h3
            className={[
              "break-words font-semibold leading-tight text-[#18212D] dark:text-[#F3F7FB]",
              isBanner ? "text-[34px]" : isHero ? "text-[28px]" : isStrip ? "text-[22px]" : "text-[23px]",
            ].join(" ")}
          >
            {node.title}
          </h3>
          {node.summary ? (
            <p
              className={[
                "mt-2 break-words text-sm leading-6 text-[#4A5565] dark:text-[#AFC1D4]",
                isBanner || isHero ? "line-clamp-4" : "line-clamp-3",
              ].join(" ")}
            >
              {node.summary}
            </p>
          ) : null}
        </div>

        {node.bullets?.length ? (
          <ul className="grid gap-2 text-[14px] leading-6 text-[#223245] dark:text-[#DDE6F0]">
            {node.bullets.slice(0, 4).map((bullet) => (
              <li key={bullet} className="grid grid-cols-[10px_minmax(0,1fr)] items-start gap-2">
                <span className={`mt-2 h-1.5 w-1.5 rounded-full ${accent.bar}`} />
                <span className="break-words line-clamp-2">{bullet}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {node.rows?.length ? (
          <div className="grid gap-2 overflow-hidden rounded-[18px] border border-[#E5ECF3] bg-[#FCFDFE] px-3 py-3 dark:border-[#24303E] dark:bg-[#111A23]">
            {node.rows.slice(0, 4).map((row) => (
              <div key={`${row.label}-${row.value}`} className="grid grid-cols-[108px_minmax(0,1fr)] gap-3 border-b border-[#E9EEF3] pb-2 last:border-b-0 last:pb-0 dark:border-[#1E2935]">
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#718093] dark:text-[#8294A8]">
                  {row.label}
                </span>
                <span className="break-words text-sm leading-6 text-[#213243] dark:text-[#E1EAF4]">{row.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        {node.evidence?.length ? (
          <div className="mt-auto grid gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C8795] dark:text-[#8FA0B3]">
              대표 근거
            </div>
            <div className="grid gap-2">
              {node.evidence.slice(0, 2).map((item) => (
                <div
                  key={`${item.title}-${item.meta}`}
                  className="grid gap-1 rounded-[16px] border border-[#E7EDF3] bg-white px-3 py-2.5 dark:border-[#223040] dark:bg-[#0D141C]"
                >
                  <div className="line-clamp-2 break-words text-[13px] font-medium leading-5 text-[#1A2634] dark:text-[#F4F7FB]">
                    {item.title}
                  </div>
                  <div className="text-[12px] text-[#748295] dark:text-[#8EA1B5]">{item.meta}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SceneCanvas({ scene }: { scene: SceneDefinition }) {
  const surfaceTone = surfaceStyles[scene.surface];
  return (
    <div
      className={[
        "relative overflow-hidden rounded-[32px] border shadow-[0_24px_60px_-40px_rgba(17,24,39,0.28)]",
        surfaceTone.canvasBorder,
        surfaceTone.shell,
      ].join(" ")}
      style={{ width: scene.width, height: scene.height }}
    >
      {surfaceTone.overlay ? <div className="absolute inset-0" style={{ background: surfaceTone.overlay }} /> : null}
      <div
        className="absolute inset-0 opacity-80 dark:opacity-30"
        style={{
          backgroundImage:
            `linear-gradient(to right, ${surfaceTone.grid} 1px, transparent 1px), linear-gradient(to bottom, ${surfaceTone.grid} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${scene.width} ${scene.height}`} fill="none">
        <defs>
          <marker id="scene-arrow" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
            <path d="M 0 0 L 12 6 L 0 12 z" fill="#264653" />
          </marker>
        </defs>
        {scene.connectors.map((connector) => {
          const path = buildConnectorPath(scene, connector);
          if (!path) {
            return null;
          }
          const toneClass =
            connector.tone === "primary"
              ? { stroke: "#264653", width: 2.6, dash: undefined, marker: "url(#scene-arrow)" }
              : connector.tone === "secondary"
                ? { stroke: "#8AA5B4", width: 2, dash: undefined, marker: undefined }
                : { stroke: "#B67686", width: 2, dash: "8 8", marker: undefined };
          return (
            <g key={connector.id}>
              <path
                d={path}
                stroke={toneClass.stroke}
                strokeWidth={toneClass.width}
                strokeDasharray={toneClass.dash}
                markerEnd={toneClass.marker}
                fill="none"
                opacity={connector.tone === "secondary" ? 0.9 : 1}
              />
              {connector.label ? (
                <text x={12} y={12} style={{ display: "none" }}>
                  {connector.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {scene.nodes.map((node) => (
        <SceneNodeCard key={node.id} node={node} surface={scene.surface} />
      ))}
    </div>
  );
}

function SecurityPanel() {
  return (
    <div className="rounded-[26px] border border-[#DDE5EE] bg-white px-5 py-5 shadow-[0_20px_48px_-36px_rgba(19,31,48,0.26)] dark:border-[#26303B] dark:bg-[#0F161E]">
      <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#264653] dark:text-[#8BD4C5]">
        <ShieldCheck className="h-4 w-4" />
        SVG / Security
      </div>
      <div className="mt-4 grid gap-3 text-sm leading-6 text-[#4D5D70] dark:text-[#A8BACB]">
        <p>
          권장 방식은 <strong className="text-[#1E2937] dark:text-white">raw SVG 업로드</strong>가 아니라
          <strong className="text-[#1E2937] dark:text-white"> trusted renderer가 생성한 SVG를 sanitize 후 저장</strong>하는 것입니다.
        </p>
        <div className="rounded-[18px] border border-[#E7EDF4] bg-[#FBFCFE] px-4 py-3 dark:border-[#24313E] dark:bg-[#101922]">
          <div className="grid gap-2">
            <div className="flex items-start gap-2">
              <Lock className="mt-1 h-4 w-4 text-[#264653] dark:text-[#8BD4C5]" />
              <span>사용자 업로드 SVG는 `script`, event handler, 외부 참조를 막아야 합니다.</span>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-1 h-4 w-4 text-[#264653] dark:text-[#8BD4C5]" />
              <span>Canvas JSON은 우리 컴포넌트가 직접 렌더하므로, 같은 의미 구조를 더 안전하게 보여주기 쉽습니다.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CanvasSceneLab() {
  const [selectedSceneId, setSelectedSceneId] = useState(canvasScenes[0].id);
  const selectedScene =
    canvasScenes.find((scene) => scene.id === selectedSceneId) ?? canvasScenes[0];
  const sceneCount = canvasScenes.length;
  const promptExample = getAutopostPrompt(selectedScene);
  const mermaidSource = buildMermaidSource(selectedScene);
  const d2Source = buildD2Source(selectedScene);
  const mermaidMarkdownExample = buildMarkdownExample(selectedScene, "mermaid");
  const d2MarkdownExample = buildMarkdownExample(selectedScene, "d2");
  const customMarkdownExample = buildMarkdownExample(selectedScene, "diagram");
  const diagramSource = buildDiagramBlockSource(selectedScene);

  return (
    <div className="min-h-screen bg-white text-[#18212D] dark:bg-[#0B1118] dark:text-[#F2F6FB]">
      <div
        className="border-b border-[#DDE5EE] dark:border-[#22303C]"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(108,195,178,0.18), transparent 28%), radial-gradient(circle at top right, rgba(38,70,83,0.12), transparent 24%)",
        }}
      >
        <div className="mx-auto max-w-[1560px] px-6 pb-10 pt-10 lg:px-8">
          <div className="grid gap-10 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-end">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D9E5EE] bg-white/92 px-3 py-1.5 text-[12px] font-semibold tracking-[0.18em] text-[#264653] shadow-sm dark:border-[#25313D] dark:bg-[#0E151D] dark:text-[#8BD4C5]">
                <span className="font-['Orbitron',sans-serif]">Markdown</span>
                <span>/</span>
                <span>Diagram Playground</span>
              </div>
              <div className="space-y-4">
                <h1 className="max-w-[13ch] text-[clamp(2.25rem,4vw,4.6rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-[#101925] dark:text-white">
                  자동포스팅용 Markdown 안에 어떤 다이어그램을 자연스럽게 넣을지 미리 보는 샘플 페이지
                </h1>
                <p className="max-w-[30ch] text-base leading-7 text-[#4B5A6B] dark:text-[#A9B8C9]">
                  사용자는 자연어로 “플로우차트 함께”라고만 말하고, 시스템은 `.md` 안에 `diagram` block을 넣습니다. 이 페이지는 그 결과물이 어떤 품질로 렌더될지 10개 샘플로 확인하는 playground 입니다.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {canvasScenes.map((scene) => {
                const active = scene.id === selectedScene.id;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => setSelectedSceneId(scene.id)}
                    className={[
                      "group min-w-0 border-b px-0 pb-3 pt-0 text-left transition-colors",
                      active
                        ? "border-[#264653] text-[#18212D] dark:border-[#8BD4C5] dark:text-white"
                        : "border-[#DDE5EE] text-[#516170] hover:border-[#8DA9B3] dark:border-[#233240] dark:text-[#A5B7C9] dark:hover:border-[#587D8A]",
                    ].join(" ")}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7A8795] dark:text-[#8AA0B5]">
                      Sample {scene.index} · {scene.category}
                    </div>
                    <div className="mt-2 text-[19px] font-semibold leading-6">{scene.name}</div>
                    <div className="mt-2 line-clamp-2 text-sm leading-6">{scene.blurb}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1560px] px-6 py-8 lg:px-8">
        <div className="grid gap-8 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-[26px] border border-[#DDE5EE] bg-white px-5 py-5 shadow-[0_20px_48px_-36px_rgba(19,31,48,0.26)] dark:border-[#26303B] dark:bg-[#0F161E]">
              <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#264653] dark:text-[#8BD4C5]">
                <Search className="h-4 w-4" />
                선택한 샘플
              </div>
              <div className="mt-4 space-y-3">
                <h2 className="text-[26px] font-semibold leading-8">{selectedScene.name}</h2>
                <p className="text-sm leading-7 text-[#566474] dark:text-[#A7B6C7]">{selectedScene.blurb}</p>
                <div className="inline-flex items-center rounded-full border border-[#DCE6EE] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#66788B] dark:border-[#243240] dark:text-[#9DB2C6]">
                  {selectedScene.index} / {sceneCount} · {selectedScene.surface}
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-[#DDE5EE] bg-white px-5 py-5 shadow-[0_20px_48px_-36px_rgba(19,31,48,0.26)] dark:border-[#26303B] dark:bg-[#0F161E]">
              <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#264653] dark:text-[#8BD4C5]">
                <Github className="h-4 w-4" />
                GitHub 레퍼런스
              </div>
              <div className="mt-4 grid gap-3 text-sm leading-7 text-[#4D5D70] dark:text-[#A8BACB]">
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#7A8795] dark:text-[#8AA0B5]">
                    Inspired by
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[#14202D] dark:text-white">{selectedScene.inspiration.name}</div>
                </div>
                <p>{selectedScene.inspiration.note}</p>
                <a
                  href={selectedScene.inspiration.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#264653] underline-offset-4 hover:underline dark:text-[#8BD4C5]"
                >
                  <span>{selectedScene.inspiration.repo}</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="rounded-[26px] border border-[#DDE5EE] bg-white px-5 py-5 shadow-[0_20px_48px_-36px_rgba(19,31,48,0.26)] dark:border-[#26303B] dark:bg-[#0F161E]">
              <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#264653] dark:text-[#8BD4C5]">
                <Info className="h-4 w-4" />
                Authoring 원칙
              </div>
              <div className="mt-4 grid gap-3 text-sm leading-7 text-[#4D5D70] dark:text-[#A8BACB]">
                <p>작성 원본은 계속 Markdown입니다. 사용자가 `canvas json`을 직접 쓰는 구조로 가면 안 됩니다.</p>
                <p>자동포스팅 시에는 본문 안에 compact한 <code>diagram</code> block만 넣고, 실제 레이아웃/스타일은 렌더러가 맡는 쪽이 자연스럽습니다.</p>
              </div>
            </div>

            <SecurityPanel />
          </aside>

          <div className="min-w-0 border-l border-[#E1E8EF] pl-0 dark:border-[#1F2B37] xl:pl-8">
            <div className="space-y-8">
              <section className="rounded-[32px] border border-[#DCE4EE] bg-white shadow-[0_30px_80px_-50px_rgba(17,24,39,0.3)] dark:border-[#26313D] dark:bg-[#0F161E]">
                <div className="grid gap-4 border-b border-[#E5ECF3] px-5 py-5 dark:border-[#22303C] lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
                  <div className="space-y-3">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#738094] dark:text-[#8CA0B5]">
                      비교 실험
                    </div>
                    <h2 className="text-[28px] font-semibold leading-9 tracking-[-0.03em] text-[#14202D] dark:text-white">
                      Mermaid vs D2 vs custom diagram block
                    </h2>
                    <p className="max-w-[70ch] text-sm leading-7 text-[#506072] dark:text-[#A6B8C9]">
                      같은 구조를 세 방식으로 넣었을 때, 자동포스팅 본문 안에서 얼마나 자연스럽게 읽히는지 바로 비교합니다. 사용자는 자연어로 요청하고, 실제 포스트에는 compact한 차트 블록만 들어가는 구조가 목표입니다.
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-[#E5ECF3] bg-[#FBFCFE] px-4 py-4 text-sm leading-7 text-[#4F5E71] dark:border-[#24313E] dark:bg-[#101922] dark:text-[#A7B8C9]">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6E7E91] dark:text-[#8CA0B5]">
                      자동포스팅 요청 예시
                    </div>
                    <div className="mt-2">{promptExample}</div>
                  </div>
                </div>

                <div className="divide-y divide-[#E7EDF3] dark:divide-[#22303C]">
                  <EnginePreviewCard
                    key={`${selectedScene.id}-mermaid`}
                    title="Mermaid"
                    blurb="가장 붙이기 쉽지만 기본 스타일이 강하고, 블로그용 시각 품질은 평균적입니다. 기존 호환과 빠른 authoring에는 유리합니다."
                    markdown={mermaidMarkdownExample}
                    initialPreviewScale={1}
                  >
                    <div className="rounded-[24px] border border-[#DFE7EF] bg-[#F7FAFC] p-4 dark:border-[#24313E] dark:bg-[#0B1118]">
                      <MermaidRenderer
                        id={`diagram-lab-mermaid-${selectedScene.id}`}
                        content={mermaidSource}
                        className="min-h-[260px]"
                      />
                    </div>
                  </EnginePreviewCard>

                  <EnginePreviewCard
                    key={`${selectedScene.id}-d2`}
                    title="D2"
                    blurb="텍스트 DSL 기반인데 Mermaid보다 더 정돈된 레이아웃과 SVG 품질을 기대할 수 있습니다. 현재 자동포스팅 차트 대안으로 가장 유력합니다."
                    markdown={d2MarkdownExample}
                    initialPreviewScale={1.15}
                  >
                    <div className="rounded-[24px] border border-[#DFE7EF] bg-[#F7FAFC] p-4 dark:border-[#24313E] dark:bg-[#0B1118]">
                      <D2Renderer source={d2Source} />
                    </div>
                  </EnginePreviewCard>

                  <EnginePreviewCard
                    key={`${selectedScene.id}-custom`}
                    title="Custom diagram block"
                    blurb="사용자는 가장 짧고 자연스러운 block만 쓰고, 내부 렌더러가 우리 서비스 톤에 맞는 레이아웃과 시각 언어를 책임집니다."
                    markdown={customMarkdownExample}
                    initialPreviewScale={1.15}
                  >
                    <DiagramRenderer
                      id={`diagram-lab-custom-${selectedScene.id}`}
                      content={diagramSource}
                    />
                  </EnginePreviewCard>
                </div>
              </section>

              <section className="rounded-[32px] border border-[#DCE4EE] bg-white shadow-[0_30px_80px_-50px_rgba(17,24,39,0.3)] dark:border-[#26313D] dark:bg-[#0F161E]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5ECF3] px-5 py-4 dark:border-[#22303C]">
                  <div>
                    <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#738094] dark:text-[#8CA0B5]">
                      Custom Renderer 확대 보기
                    </div>
                    <div className="mt-1 text-lg font-semibold text-[#14202D] dark:text-white">
                      {selectedScene.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#728093] dark:text-[#91A4B7]">
                    <span className="rounded-full border border-[#DCE6EE] px-3 py-1.5 dark:border-[#25313D]">Wheel 줌</span>
                    <span className="rounded-full border border-[#DCE6EE] px-3 py-1.5 dark:border-[#25313D]">Drag 이동</span>
                    <span className="rounded-full border border-[#DCE6EE] px-3 py-1.5 dark:border-[#25313D]">Canvas는 내부 포맷</span>
                  </div>
                </div>

                <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="min-w-0 border-b border-[#E7EDF3] bg-[#F8FBFD] dark:border-[#22303C] dark:bg-[#0A1016] xl:border-b-0 xl:border-r">
                    <TransformWrapper
                      initialScale={0.55}
                      minScale={0.35}
                      maxScale={1.35}
                      centerOnInit
                      limitToBounds={false}
                      wheel={{ step: 0.06 }}
                      doubleClick={{ disabled: true }}
                      panning={{ velocityDisabled: true }}
                    >
                      {({ zoomIn, zoomOut, resetTransform }) => (
                        <>
                          <div className="flex items-center justify-end gap-2 px-4 py-3">
                            <button
                              type="button"
                              onClick={() => zoomOut()}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D7E1EA] bg-white text-[#284150] transition-colors hover:bg-[#F3F7FA] dark:border-[#243240] dark:bg-[#101923] dark:text-[#CFE2F3] dark:hover:bg-[#15202B]"
                            >
                              <ZoomOut className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => zoomIn()}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D7E1EA] bg-white text-[#284150] transition-colors hover:bg-[#F3F7FA] dark:border-[#243240] dark:bg-[#101923] dark:text-[#CFE2F3] dark:hover:bg-[#15202B]"
                            >
                              <ZoomIn className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => resetTransform()}
                              className="rounded-full border border-[#D7E1EA] bg-white px-3 py-2 text-xs font-semibold text-[#284150] transition-colors hover:bg-[#F3F7FA] dark:border-[#243240] dark:bg-[#101923] dark:text-[#CFE2F3] dark:hover:bg-[#15202B]"
                            >
                              Reset
                            </button>
                          </div>
                          <TransformComponent
                            wrapperStyle={{ width: "100%", height: "920px" }}
                            contentStyle={{
                              width: `${selectedScene.width}px`,
                              height: `${selectedScene.height}px`,
                              padding: "32px",
                              boxSizing: "content-box",
                            }}
                          >
                            <SceneCanvas scene={selectedScene} />
                          </TransformComponent>
                        </>
                      )}
                    </TransformWrapper>
                  </div>

                  <div className="grid gap-0">
                    <div className="border-b border-[#E7EDF3] px-5 py-4 dark:border-[#22303C]">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#738094] dark:text-[#8CA0B5]">
                        판단 기준
                      </div>
                      <div className="mt-3 grid gap-2 text-sm leading-6 text-[#516173] dark:text-[#A7B7C8]">
                        <div className="flex items-start gap-2">
                          <ArrowRight className="mt-1 h-4 w-4 text-[#264653] dark:text-[#8BD4C5]" />
                          <span>사용자는 자연어로 요청하고, 포스트 원본은 계속 Markdown으로 남아야 합니다.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <ArrowRight className="mt-1 h-4 w-4 text-[#264653] dark:text-[#8BD4C5]" />
                          <span>차트 포맷은 짧아야 하고, 내부 렌더러가 스타일과 레이아웃을 책임져야 합니다.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <ArrowRight className="mt-1 h-4 w-4 text-[#264653] dark:text-[#8BD4C5]" />
                          <span>Canvas JSON은 authoring source가 아니라 renderer 내부 상태 포맷으로 쓰는 쪽이 더 적합합니다.</span>
                        </div>
                      </div>
                    </div>
                    <div className="border-b border-[#E7EDF3] px-5 py-4 dark:border-[#22303C]">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#738094] dark:text-[#8CA0B5]">
                        현재 샘플의 구조 포인트
                      </div>
                      <div className="mt-3 grid gap-2 text-sm leading-6 text-[#516173] dark:text-[#A7B7C8]">
                        <div>주요 중심 주제: <strong className="text-[#14202D] dark:text-white">{getFocusTitle(selectedScene)}</strong></div>
                        <div>섹션 후보: {getSectionTitles(selectedScene).join(" · ") || "핵심 구조"}</div>
                        <div>표현 방향: {inferDiagramType(selectedScene)} / {selectedScene.surface}</div>
                      </div>
                    </div>
                    <div className="px-5 py-4">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#738094] dark:text-[#8CA0B5]">
                        결론
                      </div>
                      <div className="mt-3 rounded-[18px] border border-[#E5ECF3] bg-[#FBFCFE] px-4 py-4 text-sm leading-7 text-[#4F5E71] dark:border-[#24313E] dark:bg-[#101922] dark:text-[#A7B8C9]">
                        자동포스팅 본문에는 <code>diagram</code> 같은 compact block을 넣고, 실제 출력은 D2 또는 custom renderer가 담당하는 구조가 가장 자연스럽습니다. 이 페이지는 그 판단을 같은 내용으로 바로 비교하는 실험실입니다.
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
