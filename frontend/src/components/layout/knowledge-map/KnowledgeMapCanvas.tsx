"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import type { KnowledgeCanvasResponse } from "@/services/api/knowledge.service";
import {
  buildBezierPath,
  buildKnowledgeCardSummary,
  describeSelectedEdge,
  factEdgeKey,
  buildNodeHref,
  formatCount,
  normalizeKnowledgeLabel,
  relationMeta,
  semanticRoleLabel,
  treeEdgeKey,
  getUnifiedEdgeEndpoints,
  type CanvasSelectedEdge,
  type CanvasInsightCard,
  type CanvasLayout,
  type CanvasNodeCard,
} from "./shared";

interface KnowledgeMapCanvasProps {
  blogSlug: string;
  data: KnowledgeCanvasResponse;
  layout: CanvasLayout;
  showInsights: boolean;
  selectedNodeSlug: string | null;
  selectedEdge: CanvasSelectedEdge | null;
  onSelectNode: (slug: string) => void;
  onSelectEdge: (edge: CanvasSelectedEdge | null) => void;
  handleFocusNavigate: (
    event: MouseEvent<HTMLElement>,
    nextSlug: string,
    nextTitle?: string,
  ) => void;
}

interface TransformStateSnapshot {
  scale: number;
  positionX: number;
  positionY: number;
}

function cardCenter(card: CanvasNodeCard) {
  return {
    x: card.x + card.width / 2,
    y: card.y + card.height / 2,
  };
}



function cardTone(card: CanvasNodeCard, isSelected: boolean, isCurrentFocus: boolean) {
  if (isCurrentFocus) {
    return {
      shell:
        "border-[#264653] bg-[linear-gradient(180deg,#FFFFFF_0%,#F4FAF9_100%)] dark:border-[#6CC3B2] dark:bg-[linear-gradient(180deg,#131A22_0%,#16252A_100%)]",
      chip: "border-[#D8E6EA] bg-[#EAF5F3] text-[#264653] dark:border-[#295562] dark:bg-[#18353D] dark:text-[#9FE2D7]",
      accent: "#264653",
    };
  }

  if (isSelected) {
    return {
      shell:
        "border-[#6CC3B2] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FCFB_100%)] dark:border-[#9FE2D7] dark:bg-[linear-gradient(180deg,#131A22_0%,#15232B_100%)]",
      chip: "border-[#D8E6EA] bg-[#EAF5F3] text-[#264653] dark:border-[#295562] dark:bg-[#18353D] dark:text-[#9FE2D7]",
      accent: "#6CC3B2",
    };
  }

  switch (card.semanticRole) {
    case "root":
      return {
        shell:
          "border-[#264653] bg-[linear-gradient(180deg,#F5FBFA_0%,#FFFFFF_100%)] dark:border-[#5EAFA0] dark:bg-[linear-gradient(180deg,#132028_0%,#131A22_100%)]",
        chip: "border-[#D8E6EA] bg-[#EAF5F3] text-[#264653] dark:border-[#295562] dark:bg-[#18353D] dark:text-[#9FE2D7]",
        accent: "#264653",
      };
    case "prerequisite":
      return {
        shell:
          "border-[#BFD9D4] bg-[linear-gradient(180deg,#F6FBFB_0%,#FFFFFF_100%)] dark:border-[#31555C] dark:bg-[linear-gradient(180deg,#132028_0%,#131A22_100%)]",
        chip: "border-[#D9E8E5] bg-[#EEF8F6] text-[#264653] dark:border-[#31555C] dark:bg-[#173038] dark:text-[#A9E4DA]",
        accent: "#264653",
      };
    case "followup":
      return {
        shell:
          "border-[#C7E8E1] bg-[linear-gradient(180deg,#F6FCFB_0%,#FFFFFF_100%)] dark:border-[#2B6158] dark:bg-[linear-gradient(180deg,#10211F_0%,#131A22_100%)]",
        chip: "border-[#D8EEE8] bg-[#EDF9F6] text-[#145E56] dark:border-[#2B6158] dark:bg-[#14312C] dark:text-[#A8E8DD]",
        accent: "#2A9D8F",
      };
    case "duplicate":
      return {
        shell:
          "border-[#D4DCE6] bg-[linear-gradient(180deg,#F9FBFD_0%,#FFFFFF_100%)] dark:border-[#3B4B5F] dark:bg-[linear-gradient(180deg,#17212B_0%,#131A22_100%)]",
        chip: "border-[#E0E7EF] bg-[#F3F6FA] text-[#526072] dark:border-[#3B4B5F] dark:bg-[#1C2733] dark:text-[#C0CCD8]",
        accent: "#7C8EA3",
      };
    default:
      return {
        shell:
          "border-[#D9E0EA] bg-white dark:border-[#2A3645] dark:bg-[#131A22]",
        chip: "border-[#E4EAF1] bg-[#F8FBFD] text-[#526072] dark:border-[#314255] dark:bg-[#16212C] dark:text-[#A9B4C2]",
        accent: "#9DB2BF",
      };
  }
}

function NodeCard({
  blogSlug,
  card,
  isSelected,
  isCurrentFocus,
  onSelectNode,
  onClearSelectedEdge,
  onFocusNavigate,
}: {
  blogSlug: string;
  card: CanvasNodeCard;
  isSelected: boolean;
  isCurrentFocus: boolean;
  onSelectNode: (slug: string) => void;
  onClearSelectedEdge: () => void;
  onFocusNavigate: (
    event: MouseEvent<HTMLElement>,
    nextSlug: string,
    nextTitle?: string,
  ) => void;
}) {
  const fallback = `${normalizeKnowledgeLabel(card.canonicalPath)} · 이 주제를 다룬 글 ${formatCount(card.postCount)}개`;
  const summary = buildKnowledgeCardSummary(
    card.summary,
    fallback,
    card.kind === "focus" ? 220 : 140,
  );
  const tone = cardTone(card, isSelected, isCurrentFocus);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    if (isCurrentFocus) {
      onClearSelectedEdge();
      onSelectNode(card.slug);
      return;
    }

    onFocusNavigate(event as unknown as MouseEvent<HTMLButtonElement>, card.slug, card.title);
  };

  return (
    <div
      className="absolute"
      style={{
        left: `${card.x}px`,
        top: `${card.y}px`,
        width: `${card.width}px`,
        height: `${card.height}px`,
        zIndex: isCurrentFocus ? 40 : isSelected ? 30 : card.isOnFocusPath ? 24 : 16,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        data-node-card={card.slug}
        aria-label={`${normalizeKnowledgeLabel(card.title)}${isCurrentFocus ? " 현재 주제" : " 중심으로 보기"}`}
        onClick={() => {
          if (isCurrentFocus) {
            onClearSelectedEdge();
            onSelectNode(card.slug);
            return;
          }
          // MouseEvent type is only needed by the navigation helper, so use a synthetic button click path below.
        }}
        onKeyDown={handleKeyDown}
        className={`group relative h-full w-full overflow-hidden rounded-[28px] border shadow-[0_18px_40px_rgba(15,23,42,0.08)] outline-none transition-transform duration-200 ease-out hover:-translate-y-1 ${tone.shell}`}
      >
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{ backgroundColor: tone.accent }}
        />
        <button
          type="button"
          className="absolute inset-0 z-10 cursor-pointer rounded-[28px] bg-transparent text-left"
          aria-label={`${normalizeKnowledgeLabel(card.title)}${isCurrentFocus ? " 선택" : " 중심으로 보기"}`}
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            if (isCurrentFocus) {
              onClearSelectedEdge();
              onSelectNode(card.slug);
              return;
            }
            onFocusNavigate(event, card.slug, card.title);
          }}
        />
        <div className="relative z-20 flex h-full flex-col p-6 pointer-events-none">
          <h3
            className={`break-words font-semibold leading-[1.3] text-[#1B2430] dark:text-[#E6EDF3] ${
              card.kind === "focus" ? "text-[22px]" : "text-[18px]"
            }`}
          >
            {normalizeKnowledgeLabel(card.title)}
          </h3>
          <p
            className={`mt-4 break-words text-sm leading-6 text-[#526072] dark:text-[#A9B4C2] ${
              card.kind === "focus" ? "line-clamp-[6]" : "line-clamp-4"
            }`}
          >
            {summary}
          </p>
          <div className="mt-auto flex items-end justify-between gap-3 pt-4">
            <div className="text-xs text-[#667085] dark:text-[#98A2B3]">
              이 주제를 다룬 글 {formatCount(card.postCount)}개
            </div>
            <Link
              href={buildNodeHref(blogSlug, card.slug)}
              data-node-detail={card.slug}
              aria-label={`${normalizeKnowledgeLabel(card.title)} 위키 상세 보기`}
              onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                event.stopPropagation();
                onClearSelectedEdge();
                onSelectNode(card.slug);
              }}
              className="pointer-events-auto inline-flex rounded-full border border-[#D9E0EA] bg-[#F8FBFD] px-3 py-1.5 text-xs font-semibold text-[#264653] transition-colors hover:bg-[#EEF3F8] dark:border-[#2A3645] dark:bg-[#111923] dark:text-[#9FE2D7] dark:hover:bg-[#1A232E]"
            >
              위키 보기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightCard({
  card,
  isVisible,
}: {
  card: CanvasInsightCard;
  isVisible: boolean;
}) {
  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="absolute"
      style={{
        left: `${card.x}px`,
        top: `${card.y}px`,
        width: `${card.width}px`,
        height: `${card.height}px`,
        zIndex: 12,
      }}
    >
      <div className="h-full rounded-[24px] border border-dashed border-[#E7B56B] bg-[#FFF7E8] p-4 shadow-sm dark:border-[#A96F1B] dark:bg-[#2A2112]">
        <div className="inline-flex rounded-full bg-[#FFE7B3] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A5B00] dark:bg-[#4F3813] dark:text-[#F6C972]">
          LLM 인사이트
        </div>
        <p className="mt-3 line-clamp-2 text-sm font-semibold text-[#6A4300] dark:text-[#F3D27A]">
          {card.title}
        </p>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#8A5B00] dark:text-[#DDB96E]">
          {card.reason}
        </p>
      </div>
    </div>
  );
}

export function KnowledgeMapCanvas({
  blogSlug,
  data,
  layout,
  showInsights,
  selectedNodeSlug,
  selectedEdge,
  onSelectNode,
  onSelectEdge,
  handleFocusNavigate,
}: KnowledgeMapCanvasProps) {
  const wrapperRef = useRef<ReactZoomPanPinchRef | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const minimapRef = useRef<SVGSVGElement | null>(null);
  const [transformState, setTransformState] = useState<TransformStateSnapshot>({
    scale: 0.7,
    positionX: 0,
    positionY: 0,
  });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);
  const [isMinimapDragging, setIsMinimapDragging] = useState(false);

  const focusCard = data.focusNode ? layout.nodeMap.get(data.focusNode.slug) ?? null : null;

  const fitCanvas = useCallback(() => {
    const wrapper = viewportRef.current;
    const transform = wrapperRef.current;
    if (!wrapper || !transform) {
      return;
    }

    const scale = Math.min(
      1,
      Math.max(
        0.42,
        Math.min(
          (wrapper.clientWidth - 48) / layout.width,
          (wrapper.clientHeight - 48) / layout.height,
        ),
      ),
    );
    const positionX = (wrapper.clientWidth - layout.width * scale) / 2;
    const positionY = (wrapper.clientHeight - layout.height * scale) / 2;
    transform.setTransform(positionX, positionY, scale, 280);
  }, [layout.height, layout.width]);

  const centerOnFocus = useCallback(() => {
    const wrapper = viewportRef.current;
    const transform = wrapperRef.current;
    if (!wrapper || !transform || !focusCard) {
      return;
    }

    const scale = Math.min(
      0.78,
      Math.max(
        0.48,
        Math.min(
          (wrapper.clientWidth - 180) / (focusCard.width + 520),
          (wrapper.clientHeight - 180) / (focusCard.height + 360),
        ),
      ),
    );
    const focusCenter = cardCenter(focusCard);
    const positionX = wrapper.clientWidth * 0.34 - focusCenter.x * scale;
    const positionY = wrapper.clientHeight / 2 - focusCenter.y * scale;
    transform.setTransform(positionX, positionY, scale, 260);
  }, [focusCard]);

  const moveViewportToMinimapPoint = useCallback(
    (clientX: number, clientY: number) => {
      const minimapElement = minimapRef.current;
      const wrapper = viewportRef.current;
      const transform = wrapperRef.current;
      if (!minimapElement || !wrapper || !transform || transformState.scale <= 0) {
        return;
      }

      const rect = minimapElement.getBoundingClientRect();
      const localX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      const localY = Math.min(Math.max(clientY - rect.top, 0), rect.height);
      const viewportWidth = Math.min(
        layout.width,
        wrapper.clientWidth / transformState.scale,
      );
      const viewportHeight = Math.min(
        layout.height,
        wrapper.clientHeight / transformState.scale,
      );
      const nextViewportX = Math.min(
        Math.max((localX / rect.width) * layout.width - viewportWidth / 2, 0),
        Math.max(layout.width - viewportWidth, 0),
      );
      const nextViewportY = Math.min(
        Math.max((localY / rect.height) * layout.height - viewportHeight / 2, 0),
        Math.max(layout.height - viewportHeight, 0),
      );

      transform.setTransform(
        -nextViewportX * transformState.scale,
        -nextViewportY * transformState.scale,
        transformState.scale,
        90,
      );
    },
    [layout.height, layout.width, transformState.scale],
  );

  useEffect(() => {
    centerOnFocus();
  }, [centerOnFocus]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setIsSpacePressed(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }
      setIsSpacePressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!isMinimapDragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      moveViewportToMinimapPoint(event.clientX, event.clientY);
    };
    const handlePointerUp = () => {
      setIsMinimapDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isMinimapDragging, moveViewportToMinimapPoint]);

  const minimap = useMemo(() => {
    const width = 220;
    const height = Math.max(120, Math.round((layout.height / layout.width) * width));
    const scaleX = width / layout.width;
    const scaleY = height / layout.height;
    const wrapper = viewportRef.current;
    const viewportWidth =
      wrapper && transformState.scale > 0
        ? Math.min(layout.width, wrapper.clientWidth / transformState.scale)
        : layout.width;
    const viewportHeight =
      wrapper && transformState.scale > 0
        ? Math.min(layout.height, wrapper.clientHeight / transformState.scale)
        : layout.height;
    const viewportX =
      wrapper && transformState.scale > 0
        ? Math.max(0, -transformState.positionX / transformState.scale)
        : 0;
    const viewportY =
      wrapper && transformState.scale > 0
        ? Math.max(0, -transformState.positionY / transformState.scale)
        : 0;

    return {
      width,
      height,
      scaleX,
      scaleY,
      viewportX,
      viewportY,
      viewportWidth,
      viewportHeight,
    };
  }, [layout.height, layout.width, transformState]);

  const canvasCursorClass = isMinimapDragging || isCanvasPanning
    ? "cursor-grabbing"
    : isSpacePressed
      ? "cursor-grab"
      : "cursor-default";
  const selectedEdgeDescription = describeSelectedEdge(selectedEdge);
  const selectedEdgePosts =
    selectedEdge?.kind === "fact"
      ? data.provenance.edges.find(
          (item) => item.edgeKey === selectedEdge.edge.edgeKey,
        )?.posts ?? []
      : selectedEdge?.kind === "tree"
        ? data.provenance.nodes[selectedEdge.edge.toSlug]?.posts ?? []
        : [];

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-[#D9E0EA] bg-[#F8FBFD] dark:border-[#2A3645] dark:bg-[#0F1720]">
      <div className="flex items-center justify-between border-b border-[#E3EAF1] px-5 py-3 dark:border-[#1D2A38]">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085] dark:text-[#98A2B3]">
          <span>스페이스바를 누른 채 드래그하면 이동합니다</span>
          <span>스크롤로 확대/축소합니다</span>
          {isSpacePressed ? (
            <span className="inline-flex rounded-full border border-[#D8E6EA] bg-[#EAF5F3] px-3 py-1 font-semibold text-[#264653] dark:border-[#295562] dark:bg-[#18353D] dark:text-[#9FE2D7]">
              이동 모드 활성
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={centerOnFocus}
            className="rounded-full border border-[#D9E0EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#264653] transition-colors hover:bg-[#EEF3F8] dark:border-[#2A3645] dark:bg-[#131A22] dark:text-[#9FE2D7] dark:hover:bg-[#18222D]"
          >
            포커스로
          </button>
          <button
            type="button"
            onClick={fitCanvas}
            className="rounded-full border border-[#D9E0EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#264653] transition-colors hover:bg-[#EEF3F8] dark:border-[#2A3645] dark:bg-[#131A22] dark:text-[#9FE2D7] dark:hover:bg-[#18222D]"
          >
            전체 맞춤
          </button>
          <button
            type="button"
            onClick={() => wrapperRef.current?.resetTransform(260)}
            className="rounded-full border border-[#D9E0EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#264653] transition-colors hover:bg-[#EEF3F8] dark:border-[#2A3645] dark:bg-[#131A22] dark:text-[#9FE2D7] dark:hover:bg-[#18222D]"
          >
            리셋
          </button>
        </div>
      </div>

      <div className="grid min-h-[900px] lg:grid-cols-[minmax(0,1fr)_320px]">
        <div ref={viewportRef} className={`relative min-h-[900px] overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(108,195,178,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(38,70,83,0.14),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.9),_rgba(247,250,252,1))] dark:bg-[radial-gradient(circle_at_top_left,_rgba(108,195,178,0.15),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(38,70,83,0.24),_transparent_24%),linear-gradient(180deg,_rgba(15,23,32,1),_rgba(11,18,25,1))] ${canvasCursorClass}`}>
          <TransformWrapper
            ref={wrapperRef}
            initialScale={0.7}
            minScale={0.32}
            maxScale={1.8}
            centerOnInit={false}
            wheel={{ step: 0.035, smoothStep: 0.006, wheelDisabled: false }}
            doubleClick={{ mode: "reset" }}
            panning={{
              disabled: !isSpacePressed,
              allowLeftClickPan: true,
              allowMiddleClickPan: true,
              allowRightClickPan: false,
              wheelPanning: false,
            }}
            onPanningStart={() => setIsCanvasPanning(true)}
            onPanningStop={() => setIsCanvasPanning(false)}
            onTransformed={(_, state) => {
              setTransformState({
                scale: state.scale,
                positionX: state.positionX,
                positionY: state.positionY,
              });
            }}
          >
            <TransformComponent
              wrapperStyle={{ width: "100%", height: "900px" }}
              contentStyle={{
                width: `${layout.width}px`,
                height: `${layout.height}px`,
                position: "relative",
              }}
            >
              <div
                className="relative"
                style={{ width: `${layout.width}px`, height: `${layout.height}px` }}
              >
                <svg
                  width={layout.width}
                  height={layout.height}
                  className="absolute inset-0 h-full w-full"
                  aria-hidden="true"
                >
                  <defs>
                    <marker
                      id="knowledge-arrow-prerequisite"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#264653" />
                    </marker>
                    <marker
                      id="knowledge-arrow-followup"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#2A9D8F" />
                    </marker>
                  </defs>
                  {data.treeEdges.map((edge) => {
                    const from = layout.nodeMap.get(edge.fromSlug);
                    const to = layout.nodeMap.get(edge.toSlug);
                    if (!from || !to) {
                      return null;
                    }
                    const points = getUnifiedEdgeEndpoints(from, to);
                    const currentTreeEdgeKey = treeEdgeKey(edge);
                    const selectedTreeEdge =
                      selectedEdge?.kind === "tree" &&
                      selectedEdge.edgeKey === currentTreeEdgeKey;
                    return (
                      <g key={currentTreeEdgeKey}>
                        <path
                          d={buildBezierPath(points.from, points.to, 0.25)}
                          fill="none"
                          stroke={selectedTreeEdge ? "rgba(38, 70, 83, 0.72)" : "rgba(169, 180, 194, 0.4)"}
                          strokeWidth={selectedTreeEdge ? 3 : 2}
                          strokeLinecap="round"
                        />
                        <path
                          d={buildBezierPath(points.from, points.to, 0.25)}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={18}
                          strokeLinecap="round"
                          onClick={() =>
                            onSelectEdge({
                              kind: "tree",
                              edgeKey: currentTreeEdgeKey,
                              edge,
                            })
                          }
                          style={{ pointerEvents: "stroke", cursor: "pointer" }}
                        />
                      </g>
                    );
                  })}

                  {data.factEdges.map((edge) => {
                    const from = layout.nodeMap.get(edge.fromSlug);
                    const to = layout.nodeMap.get(edge.toSlug);
                    if (!from || !to) {
                      return null;
                    }
                    const points = getUnifiedEdgeEndpoints(from, to);
                    const meta = relationMeta(edge.relationType);
                    const currentFactEdgeKey = factEdgeKey(edge);
                    const selected =
                      selectedEdge?.kind === "fact" &&
                      selectedEdge.edgeKey === currentFactEdgeKey;
                    return (
                      <g key={currentFactEdgeKey}>
                        <path
                          d={buildBezierPath(points.from, points.to, 0.12)}
                          fill="none"
                          stroke={meta.stroke}
                          strokeWidth={selected ? 5.5 : 4}
                          strokeLinecap="round"
                          strokeOpacity={selected ? 0.95 : 0.82}
                          strokeDasharray={
                            edge.relationType === "duplicate_of" ? "10 8" : undefined
                          }
                          markerEnd={
                            edge.relationType === "prerequisite_of"
                              ? "url(#knowledge-arrow-prerequisite)"
                              : edge.relationType === "followup_to"
                                ? "url(#knowledge-arrow-followup)"
                                : undefined
                          }
                        />
                        <path
                          d={buildBezierPath(points.from, points.to, 0.12)}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={18}
                          strokeLinecap="round"
                          onClick={() =>
                            onSelectEdge({
                              kind: "fact",
                              edgeKey: currentFactEdgeKey,
                              edge,
                            })
                          }
                          style={{ pointerEvents: "stroke", cursor: "pointer" }}
                        />
                      </g>
                    );
                  })}

                  {showInsights && data.focusNode
                    ? layout.insights.map((card) => {
                        const focus = layout.nodeMap.get(data.focusNode!.slug);
                        if (!focus) {
                          return null;
                        }
                        const focusCenter = cardCenter(focus);
                        const target = {
                          x: card.x,
                          y: card.y + card.height / 2,
                        };
                        return (
                          <path
                            key={`insight-${card.id}`}
                            d={buildBezierPath(
                              {
                                x: focusCenter.x + focus.width / 2 - 16,
                                y: focusCenter.y,
                              },
                              target,
                              0.2,
                            )}
                            fill="none"
                            stroke="#D9A441"
                            strokeDasharray="10 10"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeOpacity={0.9}
                          />
                        );
                      })
                    : null}
                </svg>

                {layout.nodes.map((card) => (
                  <NodeCard
                    key={card.slug}
                    blogSlug={blogSlug}
                    card={card}
                    isSelected={selectedNodeSlug === card.slug}
                    isCurrentFocus={data.focusNode?.slug === card.slug}
                    onSelectNode={onSelectNode}
                    onClearSelectedEdge={() => onSelectEdge(null)}
                    onFocusNavigate={handleFocusNavigate}
                  />
                ))}

                {layout.insights.map((card) => (
                  <InsightCard
                    key={card.id}
                    card={card}
                    isVisible={showInsights}
                  />
                ))}
              </div>
            </TransformComponent>
          </TransformWrapper>

          <div className="absolute bottom-5 left-5 z-30 rounded-[24px] border border-[#D9E0EA] bg-white/92 p-3 shadow-lg backdrop-blur dark:border-[#2A3645] dark:bg-[#111923]/92">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#667085] dark:text-[#98A2B3]">
              Mini Map · 드래그 이동
            </div>
            <svg
              ref={minimapRef}
              width={minimap.width}
              height={minimap.height}
              className={`overflow-visible ${isMinimapDragging ? "cursor-grabbing" : "cursor-grab"}`}
              onPointerDown={(event: ReactPointerEvent<SVGSVGElement>) => {
                event.preventDefault();
                setIsMinimapDragging(true);
                moveViewportToMinimapPoint(event.clientX, event.clientY);
              }}
            >
              <rect
                x={0}
                y={0}
                width={minimap.width}
                height={minimap.height}
                rx={16}
                fill="#F8FBFD"
                stroke="#D9E0EA"
              />
              {layout.nodes.map((card) => (
                <rect
                  key={`mini-${card.slug}`}
                  x={card.x * minimap.scaleX}
                  y={card.y * minimap.scaleY}
                  width={Math.max(4, card.width * minimap.scaleX)}
                  height={Math.max(4, card.height * minimap.scaleY)}
                  rx={2}
                  fill={card.slug === data.focusNode?.slug ? "#264653" : "#9DB2BF"}
                  opacity={card.isOnFocusPath ? 0.95 : 0.7}
                />
              ))}
              <rect
                x={minimap.viewportX * minimap.scaleX}
                y={minimap.viewportY * minimap.scaleY}
                width={minimap.viewportWidth * minimap.scaleX}
                height={minimap.viewportHeight * minimap.scaleY}
                rx={10}
                fill="rgba(108, 195, 178, 0.15)"
                stroke="#2A9D8F"
                strokeWidth={1.5}
              />
            </svg>
          </div>
        </div>

        <aside className="border-t border-[#E3EAF1] bg-white/95 p-5 dark:border-[#1D2A38] dark:bg-[#111923]/95 lg:border-l lg:border-t-0">
          <div className="inline-flex rounded-full border border-[#D8E6EA] bg-[#EAF5F3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#264653] dark:border-[#295562] dark:bg-[#18353D] dark:text-[#9FE2D7]">
            {selectedEdge ? "선택한 연결" : "선택한 주제"}
          </div>

          {selectedEdge ? (
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
                  {selectedEdgeDescription?.title}
                </h3>
              </div>
              <div className="rounded-[24px] border border-[#E4EAF1] bg-[#F8FBFD] p-4 dark:border-[#223040] dark:bg-[#0F1720]">
                <p className="text-sm font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
                  {normalizeKnowledgeLabel(selectedEdge.edge.fromSlug)} → {normalizeKnowledgeLabel(selectedEdge.edge.toSlug)}
                </p>
                <p className="mt-3 text-xs text-[#667085] dark:text-[#98A2B3]">
                  {selectedEdge.kind === "fact"
                    ? `이 연결을 뒷받침한 근거 ${formatCount(selectedEdge.edge.evidenceCount)}건`
                    : `하위 주제에 연결된 공개 글 ${formatCount(
                        data.provenance.nodes[selectedEdge.edge.toSlug]?.postCount ?? 0,
                      )}개`}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
                  관련 글
                </p>
                <div className="mt-3 space-y-3">
                  {selectedEdgePosts.length === 0 ? (
                    <p className="text-sm text-[#667085] dark:text-[#98A2B3]">
                      공개 가능한 관련 글이 없습니다.
                    </p>
                  ) : (
                    selectedEdgePosts.slice(0, 4).map((post) => (
                      <Link
                        key={post.id}
                        href={`/${blogSlug}/${post.slug}`}
                        className="block rounded-2xl border border-[#E4EAF1] bg-[#FBFDFE] px-4 py-3 text-sm font-medium text-[#1B2430] transition-colors hover:bg-white dark:border-[#223040] dark:bg-[#16212C] dark:text-[#E6EDF3] dark:hover:bg-[#1B2733]"
                      >
                        {post.title}
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {data.focusNode ? (
                <>
                  <div>
                    <h2 className="text-2xl font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
                      {normalizeKnowledgeLabel(data.focusNode.title)}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-[#526072] dark:text-[#A9B4C2]">
                      {buildKnowledgeCardSummary(
                        data.focusNode.summary,
                        `${normalizeKnowledgeLabel(data.focusNode.canonicalPath)} · 이 주제를 다룬 글 ${formatCount(data.focusNode.postCount)}개`,
                        160,
                      )}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-[#E4EAF1] bg-[#F8FBFD] p-4 dark:border-[#223040] dark:bg-[#0F1720]">
                    <div className="flex flex-wrap gap-2 text-xs text-[#667085] dark:text-[#98A2B3]">
                      <span>이 주제를 다룬 글 {formatCount(data.focusNode.postCount)}개</span>
                      <span>·</span>
                      <span>연결 근거 {formatCount(data.focusNode.evidenceCount)}건</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
                      이 주제를 다룬 글
                    </p>
                    <div className="mt-3 space-y-3">
                      {(data.provenance.nodes[data.focusNode.slug]?.posts ?? []).length === 0 ? (
                        <p className="text-sm text-[#667085] dark:text-[#98A2B3]">
                          연결된 공개 글이 아직 없습니다.
                        </p>
                      ) : (
                        (data.provenance.nodes[data.focusNode.slug]?.posts ?? [])
                          .slice(0, 5)
                          .map((post) => (
                            <Link
                              key={post.id}
                              href={`/${blogSlug}/${post.slug}`}
                              className="block rounded-2xl border border-[#E4EAF1] bg-[#FBFDFE] px-4 py-3 text-sm font-medium text-[#1B2430] transition-colors hover:bg-white dark:border-[#223040] dark:bg-[#16212C] dark:text-[#E6EDF3] dark:hover:bg-[#1B2733]"
                            >
                              {post.title}
                            </Link>
                          ))
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
