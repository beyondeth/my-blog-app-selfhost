"use client";

import type { MouseEvent } from "react";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { KnowledgeFlowBoardResponse } from "@/services/api/knowledge.service";
import { buildMapHref } from "@/lib/knowledge-ui";

interface UseKnowledgeFlowBoardFocusParams {
  blogSlug: string;
  initialData: KnowledgeFlowBoardResponse;
}

export interface FlowTrailEntry {
  slug: string;
  title: string;
}

function extendTrail(previous: FlowTrailEntry[], nextEntry: FlowTrailEntry) {
  const existingIndex = previous.findIndex((entry) => entry.slug === nextEntry.slug);
  if (existingIndex >= 0) {
    const trimmed = previous.slice(0, existingIndex + 1);
    trimmed[existingIndex] = nextEntry;
    return trimmed;
  }

  return [...previous, nextEntry].slice(-8);
}

export function useKnowledgeFlowBoardFocus({
  blogSlug,
  initialData,
}: UseKnowledgeFlowBoardFocusParams) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startNavigation] = useTransition();
  const currentPanelParam = searchParams.get("panel");
  const routeDetailSlug = searchParams.get("detail");
  const routeFocusSlug = searchParams.get("focus") ?? routeDetailSlug;
  const requestedView = searchParams.get("view");
  const boardData = initialData;
  const focusNode = boardData.focus;
  const activeFocusSlug =
    boardData.resolvedFocusSlug ?? focusNode?.slug ?? routeFocusSlug ?? null;
  const [focusTrail, setFocusTrail] = useState<FlowTrailEntry[]>(
    focusNode && activeFocusSlug
      ? [{ slug: activeFocusSlug, title: focusNode.title }]
      : [],
  );

  useEffect(() => {
    const normalizedFocusSlug =
      boardData.resolvedFocusSlug ?? focusNode?.slug ?? routeFocusSlug ?? routeDetailSlug ?? null;

    if (
      requestedView ||
      currentPanelParam ||
      routeDetailSlug ||
      (
        routeFocusSlug &&
        boardData.requestedFocusFound === false &&
        boardData.resolvedFocusSlug &&
        routeFocusSlug !== boardData.resolvedFocusSlug
      )
    ) {
      router.replace(
        buildMapHref(blogSlug, normalizedFocusSlug ?? undefined),
        {
          scroll: false,
        },
      );
    }
  }, [
    blogSlug,
    boardData.requestedFocusFound,
    boardData.resolvedFocusSlug,
    currentPanelParam,
    focusNode?.slug,
    routeDetailSlug,
    requestedView,
    routeFocusSlug,
    router,
  ]);

  useEffect(() => {
    if (!focusNode || !activeFocusSlug) {
      return;
    }

    setFocusTrail((previous) => {
      const nextEntry = {
        slug: activeFocusSlug,
        title: focusNode.title,
      };
      const lastEntry = previous[previous.length - 1];
      if (lastEntry?.slug === nextEntry.slug && lastEntry.title === nextEntry.title) {
        return previous;
      }
      return extendTrail(previous, nextEntry);
    });
  }, [activeFocusSlug, focusNode]);

  const handleFocusNavigate = (
    event: MouseEvent<HTMLElement>,
    nextSlug: string,
    nextTitle?: string,
  ) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();

    if (!nextSlug) {
      return;
    }

    if (nextSlug === activeFocusSlug) {
      return;
    }

    startNavigation(() => {
      if (nextSlug !== activeFocusSlug) {
        setFocusTrail((previous) =>
          extendTrail(previous, {
            slug: nextSlug,
            title: nextTitle ?? nextSlug,
          }),
        );
      }
      router.push(buildMapHref(blogSlug, nextSlug), {
        scroll: false,
      });
    });
  };

  return {
    boardData,
    focusNode,
    activeFocusSlug,
    focusTrail,
    handleFocusNavigate,
    isNavigating,
  };
}
