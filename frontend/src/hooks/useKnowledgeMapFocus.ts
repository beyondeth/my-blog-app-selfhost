"use client";

import type { MouseEvent } from "react";
import { useEffect, useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BlogKnowledgeMapResponse,
  getBlogKnowledgeMap,
} from "@/services/api/knowledge.service";
import { buildMapHref } from "@/lib/knowledge-ui";

interface UseKnowledgeMapFocusOptions {
  blogSlug: string;
  initialData: BlogKnowledgeMapResponse;
  focusSlug?: string;
}

export function useKnowledgeMapFocus({
  blogSlug,
  initialData,
  focusSlug,
}: UseKnowledgeMapFocusOptions) {
  const [isNavigating, startNavigation] = useTransition();
  const [selectedFocusSlug, setSelectedFocusSlug] = useState<string | undefined>(
    initialData.resolvedFocusSlug ?? focusSlug,
  );

  useEffect(() => {
    setSelectedFocusSlug(initialData.resolvedFocusSlug ?? focusSlug);
  }, [initialData.resolvedFocusSlug, focusSlug]);

  useEffect(() => {
    const handlePopState = () => {
      const currentUrl = new URL(window.location.href);
      setSelectedFocusSlug(currentUrl.searchParams.get("focus") ?? undefined);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const query = useQuery({
    queryKey: ["blog-knowledge-map", blogSlug, selectedFocusSlug ?? "__default__"],
    queryFn: () => getBlogKnowledgeMap(blogSlug, selectedFocusSlug, 12),
    initialData,
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 5,
  });

  const mapData = query.data ?? initialData;
  const focusNode = mapData.focusNode;
  const activeFocusSlug =
    mapData.resolvedFocusSlug ?? focusNode?.slug ?? selectedFocusSlug ?? focusSlug;

  const handleFocusNavigate = (
    event: MouseEvent<HTMLAnchorElement>,
    nextSlug: string,
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

    if (nextSlug === activeFocusSlug) {
      return;
    }

    startNavigation(() => {
      setSelectedFocusSlug(nextSlug);
      window.history.replaceState(
        window.history.state,
        "",
        buildMapHref(blogSlug, nextSlug),
      );
    });
  };

  return {
    mapData,
    focusNode,
    activeFocusSlug,
    isPending: isNavigating || query.isFetching,
    handleFocusNavigate,
  };
}
