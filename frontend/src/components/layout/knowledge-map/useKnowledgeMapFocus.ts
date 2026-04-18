"use client";

import type { MouseEvent } from "react";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type KnowledgeCanvasResponse } from "@/services/api/knowledge.service";
import { buildMapHref } from "@/lib/knowledge-ui";

interface UseKnowledgeMapFocusParams {
  blogSlug: string;
  initialData: KnowledgeCanvasResponse;
  initialFocusSlug?: string;
}

export interface FocusTrailEntry {
  slug: string;
  title: string;
}

function normalizeTrail(entries: FocusTrailEntry[]) {
  const unique: FocusTrailEntry[] = [];

  for (const entry of entries) {
    if (!entry.slug) {
      continue;
    }

    const existingIndex = unique.findIndex((item) => item.slug === entry.slug);
    if (existingIndex >= 0) {
      unique.splice(existingIndex + 1);
      unique[existingIndex] = entry;
      continue;
    }

    unique.push(entry);
  }

  return unique.slice(-8);
}

function extendTrail(previous: FocusTrailEntry[], nextEntry: FocusTrailEntry) {
  const existingIndex = previous.findIndex((entry) => entry.slug === nextEntry.slug);
  if (existingIndex >= 0) {
    const trimmed = previous.slice(0, existingIndex + 1);
    trimmed[existingIndex] = nextEntry;
    return trimmed;
  }

  return [...previous, nextEntry].slice(-8);
}

export function useKnowledgeMapFocus({
  blogSlug,
  initialData,
  initialFocusSlug,
}: UseKnowledgeMapFocusParams) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startNavigation] = useTransition();
  const routeFocusSlug = searchParams.get("focus") ?? initialFocusSlug;
  const mapData = initialData;
  const focusNode = mapData.focusNode;
  const activeFocusSlug =
    mapData.resolvedFocusSlug ?? focusNode?.slug ?? routeFocusSlug;
  const initialTrailEntry =
    activeFocusSlug && focusNode
      ? [{ slug: activeFocusSlug, title: focusNode.title }]
      : [];
  const [focusTrail, setFocusTrail] = useState<FocusTrailEntry[]>(initialTrailEntry);

  useEffect(() => {
    if (
      routeFocusSlug &&
      mapData.requestedFocusFound === false &&
      mapData.resolvedFocusSlug &&
      routeFocusSlug !== mapData.resolvedFocusSlug
    ) {
      router.replace(buildMapHref(blogSlug, mapData.resolvedFocusSlug), {
        scroll: false,
      });
    }
  }, [
    blogSlug,
    mapData.requestedFocusFound,
    mapData.resolvedFocusSlug,
    routeFocusSlug,
    router,
  ]);

  useEffect(() => {
    if (!focusNode || !activeFocusSlug) {
      return;
    }

    setFocusTrail((previous) => {
      const currentEntry = { slug: activeFocusSlug, title: focusNode.title };
      if (previous.length === 0) {
        return [currentEntry];
      }

      const lastEntry = previous[previous.length - 1];
      if (lastEntry?.slug === currentEntry.slug && lastEntry.title === currentEntry.title) {
        return previous;
      }

      return extendTrail(previous, currentEntry);
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

    if (nextSlug === activeFocusSlug) {
      return;
    }

    startNavigation(() => {
      const nextTrail = extendTrail(focusTrail, {
        slug: nextSlug,
        title: nextTitle ?? nextSlug,
      });
      setFocusTrail(normalizeTrail(nextTrail));
      router.push(buildMapHref(blogSlug, nextSlug), { scroll: false });
    });
  };

  return {
    mapData,
    focusNode,
    activeFocusSlug,
    focusTrail,
    handleFocusNavigate,
    isNavigating,
    isFetching: false,
  };
}
