"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { KnowledgeCanvasResponse } from "@/services/api/knowledge.service";
import {
  buildBlogHomeHref,
  buildTreeHref,
  formatKnowledgeUpdatedLabel,
  normalizeKnowledgeLabel,
} from "@/lib/knowledge-ui";
import { KnowledgeMapCanvas } from "./knowledge-map/KnowledgeMapCanvas";
import {
  buildCanvasLayout,
  formatCount,
  type CanvasSelectedEdge,
} from "./knowledge-map/shared";
import { useKnowledgeMapFocus } from "./knowledge-map/useKnowledgeMapFocus";

interface KnowledgeMapSectionProps {
  blogSlug: string;
  data: KnowledgeCanvasResponse;
  focusSlug?: string;
  className?: string;
}

export default function KnowledgeMapSection({
  blogSlug,
  data,
  focusSlug,
  className,
}: KnowledgeMapSectionProps) {
  const {
    mapData,
    focusNode,
    activeFocusSlug,
    focusTrail,
    handleFocusNavigate,
    isNavigating,
  } = useKnowledgeMapFocus({
    blogSlug,
    initialData: data,
    initialFocusSlug: focusSlug,
  });
  const [showInsights, setShowInsights] = useState(false);
  const [selectedNodeSlug, setSelectedNodeSlug] = useState<string | null>(
    activeFocusSlug ?? null,
  );
  const [selectedEdge, setSelectedEdge] = useState<CanvasSelectedEdge | null>(
    null,
  );

  useEffect(() => {
    setSelectedNodeSlug(activeFocusSlug ?? null);
    setSelectedEdge(null);
  }, [activeFocusSlug]);

  useEffect(() => {
    if (!mapData.viewerCanSeeInsights && showInsights) {
      setShowInsights(false);
    }
  }, [mapData.viewerCanSeeInsights, showInsights]);

  const layout = useMemo(
    () => buildCanvasLayout(mapData, showInsights && mapData.viewerCanSeeInsights),
    [mapData, showInsights],
  );

  if (!focusNode) {
    return (
      <section className={className}>
        <div className="rounded-[32px] border border-[#D9E0EA] bg-white p-8 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22]">
          <h1 className="text-2xl font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
            공개된 지식 캔버스가 아직 없습니다
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#667085] dark:text-[#98A2B3]">
            포스트가 쌓이면 실제 노드와 연결선, 그리고 그 연결을 뒷받침하는 글 근거가 이 화면에 그대로 나타납니다.
          </p>
        </div>
      </section>
    );
  }

  const explicitRelationCount = mapData.factEdges.length;
  const focusPosts = mapData.provenance.nodes[focusNode.slug]?.postCount ?? 0;

  return (
    <section className={className}>
      <div className="space-y-6">
        <div className="rounded-[32px] border border-[#D9E0EA] bg-white p-6 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22] md:p-8">
          <div className="flex flex-col gap-6 border-b border-[#E3EAF1] pb-6 dark:border-[#223040] xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#264653] dark:text-[#6CC3B2]">
                Truth-First Knowledge Canvas
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#1B2430] dark:text-[#E6EDF3] md:text-[2.35rem]">
                가장 왼쪽의 첫 단추에서 시작해 오른쪽으로 지식이 파생되는 흐름을 그대로 보여줍니다
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#4B5563] dark:text-[#A9B4C2] md:text-[15px]">
                카드 전체를 누르면 현재 중심 주제가 바뀌고, 더 자세한 내용은 카드 안의{" "}
                <span className="font-semibold text-[#264653] dark:text-[#9FE2D7]">
                  위키 보기
                </span>
                에서 확인합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildTreeHref(blogSlug)}
                className="inline-flex items-center justify-center rounded-full border border-[#D9E0EA] bg-[#F8FBFD] px-4 py-2 text-sm font-semibold text-[#1B2430] transition-colors hover:bg-[#EEF3F8] dark:border-[#2A3645] dark:bg-[#111923] dark:text-[#E6EDF3] dark:hover:bg-[#1A232E]"
              >
                WIKI TREE
              </Link>
              <Link
                href={buildBlogHomeHref(blogSlug)}
                className="inline-flex items-center justify-center rounded-full border border-[#D9E0EA] bg-[#264653] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2F5B6B] dark:border-[#6CC3B2] dark:bg-[#6CC3B2] dark:text-[#0E141B] dark:hover:bg-[#7DD1C0]"
              >
                블로그 홈
              </Link>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <div className="rounded-full border border-[#D9E0EA] bg-[#F8FBFD] px-4 py-2 text-sm text-[#264653] dark:border-[#2A3645] dark:bg-[#111923] dark:text-[#9FE2D7]">
              현재 주제 · {normalizeKnowledgeLabel(focusNode.title)}
            </div>
            <div className="rounded-full border border-[#D9E0EA] bg-[#F8FBFD] px-4 py-2 text-sm text-[#526072] dark:border-[#2A3645] dark:bg-[#111923] dark:text-[#A9B4C2]">
              이 주제를 다룬 글 {formatCount(focusPosts)}개 · 직접 연결 {formatCount(explicitRelationCount)}개
            </div>
            <div className="rounded-full border border-[#D9E0EA] bg-[#F8FBFD] px-4 py-2 text-sm text-[#526072] dark:border-[#2A3645] dark:bg-[#111923] dark:text-[#A9B4C2]">
              마지막 갱신 {formatKnowledgeUpdatedLabel(mapData.lastUpdatedAt)}
            </div>
            {mapData.requestedFocusSlug && mapData.requestedFocusFound === false ? (
              <div className="rounded-full border border-[#E7D7A2] bg-[#FFF8E1] px-4 py-2 text-sm text-[#8A5B00] dark:border-[#6B5620] dark:bg-[#2C2410] dark:text-[#F3D27A]">
                요청한 주제가 없어 {normalizeKnowledgeLabel(focusNode.title)} 기준으로 보여줍니다
              </div>
            ) : null}
            {isNavigating ? (
              <div className="rounded-full border border-[#D8E6EA] bg-[#EAF5F3] px-4 py-2 text-sm font-semibold text-[#264653] dark:border-[#295562] dark:bg-[#18353D] dark:text-[#9FE2D7]">
                다른 주제로 이동 중...
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085] dark:text-[#98A2B3]">
                탐색 경로
              </span>
              {focusTrail.map((entry, index) => (
                <button
                  key={entry.slug}
                  type="button"
                  onClick={(event) =>
                    handleFocusNavigate(event, entry.slug, entry.title)
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    entry.slug === activeFocusSlug
                      ? "bg-[#264653] text-white dark:bg-[#6CC3B2] dark:text-[#0E141B]"
                      : "border border-[#D9E0EA] bg-[#F8FBFD] text-[#526072] hover:bg-[#EEF3F8] dark:border-[#2A3645] dark:bg-[#111923] dark:text-[#A9B4C2] dark:hover:bg-[#1A232E]"
                  }`}
                >
                  {normalizeKnowledgeLabel(entry.title)}
                  {index < focusTrail.length - 1 ? " →" : ""}
                </button>
              ))}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {mapData.hotNodes.slice(0, 5).map((node) => (
                <button
                  key={node.slug}
                  type="button"
                  onClick={(event) =>
                    handleFocusNavigate(event, node.slug, node.title)
                  }
                  className="rounded-full border border-[#D9E0EA] bg-[#F8FBFD] px-3 py-1.5 text-xs font-semibold text-[#264653] transition-colors hover:bg-[#EEF3F8] dark:border-[#2A3645] dark:bg-[#111923] dark:text-[#9FE2D7] dark:hover:bg-[#1A232E]"
                >
                  {normalizeKnowledgeLabel(node.title)}
                </button>
              ))}
              {mapData.viewerCanSeeInsights ? (
                <button
                  type="button"
                  onClick={() => setShowInsights((previous) => !previous)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    showInsights
                      ? "border-[#E7B56B] bg-[#FFF2D7] text-[#8A5B00] dark:border-[#A96F1B] dark:bg-[#2A2112] dark:text-[#F3D27A]"
                      : "border-[#D9E0EA] bg-[#F8FBFD] text-[#264653] hover:bg-[#EEF3F8] dark:border-[#2A3645] dark:bg-[#111923] dark:text-[#9FE2D7] dark:hover:bg-[#1A232E]"
                  }`}
                >
                  {showInsights ? "LLM 인사이트 숨기기" : "LLM 인사이트 보기"}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <KnowledgeMapCanvas
          blogSlug={blogSlug}
          data={mapData}
          layout={layout}
          showInsights={showInsights && mapData.viewerCanSeeInsights}
          selectedNodeSlug={selectedNodeSlug}
          selectedEdge={selectedEdge}
          onSelectNode={setSelectedNodeSlug}
          onSelectEdge={setSelectedEdge}
          handleFocusNavigate={handleFocusNavigate}
        />
      </div>
    </section>
  );
}
