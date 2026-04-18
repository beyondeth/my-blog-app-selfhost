"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { PanelRightOpen, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FiTag } from "react-icons/fi";
import type {
  BlogKnowledgeTreeResponse,
  KnowledgeFlowBoardResponse,
} from "@/services/api/knowledge.service";
import {
  formatKnowledgeUpdatedLabel,
  normalizeKnowledgeLabel,
} from "@/lib/knowledge-ui";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useBlogCategories } from "@/hooks/useBlogs";
import CategorySection from "./CategorySection";
import SidebarSection from "./SidebarSection";
import SidebarViewTabs, { type SidebarViewTabOption } from "./SidebarViewTabs";
import { KnowledgeFlowBoardD2View } from "./knowledge-flow-board/KnowledgeFlowBoardD2View";
import { KnowledgeMapTreeSidebar } from "./knowledge-flow-board/KnowledgeMapTreeSidebar";
import { useKnowledgeFlowBoardFocus } from "./knowledge-flow-board/useKnowledgeFlowBoardFocus";

interface KnowledgeFlowBoardSectionProps {
  blogSlug: string;
  data: KnowledgeFlowBoardResponse;
  treeData: BlogKnowledgeTreeResponse | null;
  className?: string;
}

export default function KnowledgeFlowBoardSection({
  blogSlug,
  data,
  treeData,
  className,
}: KnowledgeFlowBoardSectionProps) {
  const router = useRouter();
  const [isSidebarDrawerOpen, setIsSidebarDrawerOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"categories" | "knowledge">(
    "knowledge",
  );
  const [hasOpenedCategories, setHasOpenedCategories] = useState(false);
  const isMobileViewport = useMediaQuery("(max-width: 1023px)");
  const {
    boardData,
    focusNode,
    activeFocusSlug,
    focusTrail,
    handleFocusNavigate,
    isNavigating,
  } = useKnowledgeFlowBoardFocus({
    blogSlug,
    initialData: data,
  });
  const {
    data: categoryPagesData,
    isLoading: isCategoriesLoading,
    error: categoriesError,
    fetchNextPage: fetchNextCategories,
    hasNextPage: hasMoreCategories,
    isFetchingNextPage: isFetchingNextCategories,
    refetch: refetchCategories,
  } = useBlogCategories(blogSlug, {
    enabled: hasOpenedCategories,
  });
  const categoryItems = useMemo(() => {
    if (!categoryPagesData?.pages) {
      return [];
    }

    return categoryPagesData.pages.flatMap((page) => page.items);
  }, [categoryPagesData?.pages]);
  const sidebarTabOptions = useMemo<
    SidebarViewTabOption<"categories" | "knowledge">[]
  >(
    () => [
      { value: "categories", label: "카테고리" },
      { value: "knowledge", label: "지식 지도" },
    ],
    [],
  );

  const handleSidebarTabChange = (nextTab: "categories" | "knowledge") => {
    setSidebarTab(nextTab);
    if (nextTab === "categories") {
      setHasOpenedCategories(true);
    }
  };

  const handleDrawerFocusNavigate = (
    event: MouseEvent<HTMLElement>,
    nextSlug: string,
    nextTitle?: string,
  ) => {
    const shouldClose =
      !event.defaultPrevented &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey;
    handleFocusNavigate(event, nextSlug, nextTitle);
    if (shouldClose) {
      setIsSidebarDrawerOpen(false);
    }
  };

  const handleCategoryNavigate = (category: string) => {
    const params = new URLSearchParams();
    params.set("category", category);
    params.set("page", "1");
    router.push(`/${blogSlug}?${params.toString()}`);
  };

  const renderCategoryPanel = () => {
    if (isCategoriesLoading && categoryItems.length === 0) {
      return (
        <SidebarSection
          title={
            <div className="flex items-center gap-2">
              <FiTag className="h-4 w-4 text-gray-700 dark:text-gray-300" />
              <span>카테고리</span>
            </div>
          }
        >
          <div className="space-y-2" data-map-category-panel>
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-10 animate-pulse rounded-xl bg-[#EEF3F8] dark:bg-[#1A232E]"
              />
            ))}
          </div>
        </SidebarSection>
      );
    }

    if (categoriesError) {
      return (
        <SidebarSection
          title={
            <div className="flex items-center gap-2">
              <FiTag className="h-4 w-4 text-gray-700 dark:text-gray-300" />
              <span>카테고리</span>
            </div>
          }
        >
          <div className="space-y-3" data-map-category-panel>
            <p className="text-sm text-[#4B5563] dark:text-[#C7D1DD]">
              카테고리를 불러오지 못했습니다.
            </p>
            <button
              type="button"
              onClick={() => {
                void refetchCategories();
              }}
              className="inline-flex rounded-full border border-[#D9E0EA] px-4 py-2 text-sm font-semibold text-[#264653] transition-colors hover:bg-[#F8FBFD] dark:border-[#35506A] dark:text-[#9FE2D7] dark:hover:bg-[#1A232E]"
            >
              다시 시도
            </button>
          </div>
        </SidebarSection>
      );
    }

    return (
      <div data-map-category-panel>
        <CategorySection
          categories={categoryItems}
          onCategoryClick={handleCategoryNavigate}
          selectedCategory={null}
          hasMore={Boolean(hasMoreCategories)}
          onLoadMore={
            hasMoreCategories ? () => void fetchNextCategories() : undefined
          }
          isLoadingMore={isFetchingNextCategories}
        />
      </div>
    );
  };

  const renderDesktopSidebar = () => (
    <div className="sticky top-8 space-y-4">
      <SidebarViewTabs
        value={sidebarTab}
        onChange={handleSidebarTabChange}
        options={sidebarTabOptions}
      />
      {sidebarTab === "knowledge" ? (
        <KnowledgeMapTreeSidebar
          treeData={treeData}
          activeFocusSlug={activeFocusSlug}
          activeFocusTitle={focusNode?.title}
          onFocusNavigate={handleFocusNavigate}
          sticky={false}
        />
      ) : (
        renderCategoryPanel()
      )}
    </div>
  );

  const renderDrawerSidebar = () => (
    <aside className="flex h-full flex-col bg-[#F5F7FA] p-4 dark:bg-[#0B1117]">
      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setIsSidebarDrawerOpen(false)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#DFE6EF] bg-white text-[#5E6B7D] transition-colors hover:bg-[#F5F8FC] dark:border-[#263645] dark:bg-[#111C26] dark:text-[#AAB7C7] dark:hover:bg-[#15202A]"
          aria-label="사이드바 닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <SidebarViewTabs
          value={sidebarTab}
          onChange={handleSidebarTabChange}
          options={sidebarTabOptions}
        />
        {sidebarTab === "knowledge" ? (
          <KnowledgeMapTreeSidebar
            treeData={treeData}
            activeFocusSlug={activeFocusSlug}
            activeFocusTitle={focusNode?.title}
            onFocusNavigate={handleDrawerFocusNavigate}
            variant="drawer"
            sticky={false}
          />
        ) : (
          renderCategoryPanel()
        )}
      </div>
    </aside>
  );

  if (!focusNode) {
    return (
      <section className={className}>
        <div className="rounded-2xl bg-white px-8 py-10 shadow-[0_24px_80px_rgba(15,23,42,0.06)] dark:bg-[#101821]">
          <h1 className="text-2xl font-semibold text-[#1B2430] dark:text-[#E6EDF3]">
            공개된 지식 지도가 아직 없습니다
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667085] dark:text-[#98A2B3]">
            포스트가 축적되면 현재 주제를 중심으로 연결 관계를 읽는 D2 지도가 여기에 구성됩니다.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={className}>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#CFE2E8] bg-[#F2F8FA] px-4 py-2.5 text-[14px] font-bold tracking-[0.06em] text-[#1E6B7F] dark:border-[#2A4456] dark:bg-[#13212B] dark:text-[#7FD6CA]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/></svg>
              지식 지도
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[#6A7788] dark:text-[#9AA7B7]">
              <h1 className="text-[36px] font-semibold tracking-[-0.04em] text-[#17212B] dark:text-[#F2F5F8]">
                {normalizeKnowledgeLabel(focusNode.title)}
              </h1>
              <span>업데이트 {formatKnowledgeUpdatedLabel(boardData.lastUpdatedAt)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setIsSidebarDrawerOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-[#D8E1EC] bg-white px-4 py-2 text-sm font-semibold text-[#20303C] shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition-colors hover:bg-[#F8FBFF] dark:border-[#26394B] dark:bg-[#101923] dark:text-[#E6EDF3] dark:hover:bg-[#13202B]"
            >
              <PanelRightOpen className="h-4 w-4" />
              구조 보기
            </button>
          </div>
        </div>

        {(boardData.requestedFocusSlug && boardData.requestedFocusFound === false) || isNavigating ? (
          <div className="flex flex-wrap gap-2">
            {boardData.requestedFocusSlug && boardData.requestedFocusFound === false ? (
              <div className="rounded-full bg-[#FFF3D6] px-4 py-2 text-sm font-medium text-[#8A5B00] dark:bg-[#31240C] dark:text-[#F1D089]">
                요청한 주제가 없어 {normalizeKnowledgeLabel(focusNode.title)} 기준으로 보여줍니다
              </div>
            ) : null}
            {isNavigating ? (
              <div className="rounded-full bg-[#E7F5F2] px-4 py-2 text-sm font-semibold text-[#204E58] dark:bg-[#17343A] dark:text-[#9FE2D7]">
                새 지식 지도로 이동 중...
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <KnowledgeFlowBoardD2View
              blogSlug={blogSlug}
              data={boardData}
              focusTrail={focusTrail}
              handleFocusNavigate={handleFocusNavigate}
            />
          </div>

          <div className="hidden xl:block">
            {renderDesktopSidebar()}
          </div>
        </div>
      </div>

      <Dialog
        open={isMobileViewport && isSidebarDrawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsSidebarDrawerOpen(false);
          }
        }}
      >
        <DialogContent
          hideClose
          className="left-auto right-0 top-0 z-[10001] h-dvh w-[min(92vw,380px)] max-w-none translate-x-0 translate-y-0 rounded-none border-l border-[#D8E1EC] bg-[#F5F7FA] p-0 shadow-[0_24px_64px_rgba(15,23,42,0.18)] dark:border-[#223142] dark:bg-[#0B1117]"
        >
          <DialogTitle className="sr-only">전체 주제 구조</DialogTitle>
          {renderDrawerSidebar()}
        </DialogContent>
      </Dialog>
    </section>
  );
}
