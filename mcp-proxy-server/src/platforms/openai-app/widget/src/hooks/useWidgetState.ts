import { useState, useEffect, useCallback } from 'react';
import { bridge } from './useOpenAI';
import type { ToolOutput, StyleOption } from '../types';

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Extract structured payload from the OpenAI bridge. */
function extractPayload(): { out: ToolOutput; meta: Record<string, unknown>; content: unknown[] } {
  try {
    const api = bridge();
    const candidates = [
      api?.toolOutput,
      api?.toolResult,
      api?.result,
      api?.output,
      api?.latestToolOutput,
      isObject(api?.state) ? api.state.toolOutput : null,
      isObject(api?.state) ? api.state.result : null,
    ];
    let raw: unknown = null;
    for (const c of candidates) {
      if (isObject(c)) { raw = c; break; }
    }
    if (!isObject(raw)) raw = {};
    const r = raw as Record<string, unknown>;

    const out: ToolOutput = isObject(r.structuredContent)
      ? (r.structuredContent as ToolOutput)
      : (r as ToolOutput);

    const content = Array.isArray(r.content) ? r.content : [];

    const meta: Record<string, unknown> = {
      ...(isObject(r._meta) ? r._meta : {}),
      ...(isObject(api?.toolResponseMetadata) ? api.toolResponseMetadata : {}),
    };

    return { out, meta, content };
  } catch (err) {
    console.error('[Widget] Failed to extract payload', err);
    return { out: {} as ToolOutput, meta: {}, content: [] };
  }
}

export interface WidgetState {
  status: string;
  out: ToolOutput;
  meta: Record<string, unknown>;
  content: unknown[];
  input: Record<string, unknown>;
  styleSelectionNonce: string;
  styleOptions: StyleOption[];
  isStyleSelectionStage: boolean;
}

export function useWidgetState(): WidgetState {
  const [state, setState] = useState<WidgetState>(() => computeState());

  function computeState(): WidgetState {
    const { out, meta, content } = extractPayload();
    const api = bridge();
    const input = api.toolInput || {};
    const status = String(out.status || (meta.status as string) || 'ready').toLowerCase();

    const nonceCandidate =
      (typeof meta.styleSelectionNonce === 'string' && meta.styleSelectionNonce) ||
      (typeof out.styleSelectionNonce === 'string' && out.styleSelectionNonce) ||
      (typeof out.selectionNonce === 'string' && out.selectionNonce) ||
      '';

    const styleOptions: StyleOption[] =
      Array.isArray(out.styleOptions) ? out.styleOptions :
      Array.isArray(meta.styleOptions) ? (meta.styleOptions as StyleOption[]) :
      [];

    const isStyleSelectionStage = status === 'blocked' || status === 'awaiting_style_selection';

    return {
      status,
      out,
      meta,
      content,
      input,
      styleSelectionNonce: nonceCandidate,
      styleOptions,
      isStyleSelectionStage,
    };
  }

  const refresh = useCallback(() => {
    setState(computeState());
  }, []);

  // Re-compute on mount and when toolOutput changes
  useEffect(() => {
    refresh();
    // Poll for updates periodically (bridge doesn't emit events)
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [refresh]);

  return state;
}
