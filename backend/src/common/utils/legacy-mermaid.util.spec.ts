import {
  containsRawMermaidFence,
  convertLegacyMermaidMarkdownToDiagramBlocks,
  convertMermaidFlowchartToDiagramBlock,
} from "./legacy-mermaid.util";

describe("legacy-mermaid.util", () => {
  it("detects raw Mermaid fenced blocks", () => {
    expect(containsRawMermaidFence("```mermaid\nflowchart LR\nA-->B\n```")).toBe(
      true,
    );
    expect(containsRawMermaidFence("```diagram\ntype: flow\n```")).toBe(false);
    expect(containsRawMermaidFence("")).toBe(false);
  });

  it("converts a simple Mermaid flowchart into a diagram block", () => {
    const converted = convertMermaidFlowchartToDiagramBlock(`flowchart LR
A[작업 집합 선택 n개] --> B[성공확률 함수 f(S)]
B --> C[선형계약 parameter α]
C --> D[에이전트 최적 반응 S*(α)]
D --> E[주인 효용 U(α)]
E --> F[최적 α 탐색]
F --> G[최적 계약]`);

    expect(converted).toContain("type: flow");
    expect(converted).toContain("direction: horizontal");
    expect(converted).toContain('label: "성공확률 함수 f(S)"');
    expect(converted).toContain('label: "에이전트 최적 반응 S*(α)"');
    expect(converted).toContain("from: A");
    expect(converted).toContain("to: G");
  });

  it("rewrites Mermaid fenced blocks inside markdown to diagram blocks", () => {
    const result = convertLegacyMermaidMarkdownToDiagramBlocks(`## Section

\`\`\`mermaid
flowchart LR
A[시작] --> B[끝]
\`\`\`
`);

    expect(result.convertedBlocks).toBe(1);
    expect(result.skippedBlocks).toBe(0);
    expect(result.markdown).toContain("```diagram");
    expect(result.markdown).not.toContain("```mermaid");
  });

  it("leaves unsupported Mermaid blocks untouched and reports a skip", () => {
    const result = convertLegacyMermaidMarkdownToDiagramBlocks(`\`\`\`mermaid
sequenceDiagram
Alice->>Bob: hi
\`\`\``);

    expect(result.convertedBlocks).toBe(0);
    expect(result.skippedBlocks).toBe(1);
    expect(result.markdown).toContain("```mermaid");
    expect(result.skippedReasons[0]).toContain("flowchart/graph");
  });
});
