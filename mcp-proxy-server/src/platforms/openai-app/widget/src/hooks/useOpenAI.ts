import { useCallback, useRef } from 'react';
import type { OpenAIBridge, ToolResponse, WidgetPersistedState } from '../types';

declare global {
  interface Window {
    openai?: OpenAIBridge;
  }
}

/** Get the OpenAI bridge (window.openai or empty fallback). */
export function bridge(): OpenAIBridge {
  return (typeof window !== 'undefined' && window.openai) || {};
}

// ── JSON-RPC over postMessage (MCP Apps bridge) ──
let rpcIdCounter = 0;

function rpcRequest(method: string, params: Record<string, unknown>): string {
  const id = String(++rpcIdCounter);
  window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
  return id;
}

/** Call an MCP tool via bridge or JSON-RPC fallback. */
export async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResponse> {
  const api = bridge();
  if (typeof api.callTool === 'function') {
    return api.callTool(name, args);
  }
  // JSON-RPC fallback
  return new Promise((resolve) => {
    const id = rpcRequest('tools/call', { name, arguments: args });
    const handler = (ev: MessageEvent) => {
      if (ev.data?.jsonrpc === '2.0' && ev.data?.id === id) {
        window.removeEventListener('message', handler);
        resolve(ev.data.result || {});
      }
    };
    window.addEventListener('message', handler);
  });
}

/** Update model context (structured, replaces sendFollowUpMessage). */
export async function updateModelContext(text: string): Promise<void> {
  const api = bridge();
  rpcRequest('ui/update-model-context', {
    content: [{ type: 'text', text }],
  });
}

/** Send a follow-up user message to resume the model loop. */
export async function sendUserMessage(text: string): Promise<void> {
  const api = bridge();
  if (typeof api.sendFollowUpMessage === 'function') {
    await api.sendFollowUpMessage({ prompt: text });
    return;
  }
  window.parent.postMessage(
    {
      jsonrpc: '2.0',
      method: 'ui/message',
      params: {
        role: 'user',
        content: [{ type: 'text', text }],
      },
    },
    '*'
  );
}

/** Save widget state for persistence. */
export function saveWidgetState(state: WidgetPersistedState): void {
  const api = bridge();
  if (typeof api.setWidgetState === 'function') {
    api.setWidgetState(state);
  }
}

/** Restore previously saved widget state. */
export function restoreWidgetState(): WidgetPersistedState | null {
  const api = bridge();
  return api.widgetState || null;
}

/** Notify ChatGPT of widget height changes. */
export function useNotifyHeight() {
  const ref = useRef<HTMLDivElement>(null);

  const notify = useCallback(() => {
    const api = bridge();
    if (typeof api.notifyIntrinsicHeight === 'function' && ref.current) {
      const h = ref.current.scrollHeight;
      api.notifyIntrinsicHeight(h);
      setTimeout(() => api.notifyIntrinsicHeight!(h), 80);
    }
  }, []);

  return { ref, notify };
}

/** Request fullscreen display mode. */
export async function requestFullscreen(): Promise<void> {
  const api = bridge();
  if (typeof api.requestDisplayMode === 'function') {
    await api.requestDisplayMode({ mode: 'fullscreen' });
  }
}

/** Open an external URL. */
export async function openExternal(href: string): Promise<void> {
  const api = bridge();
  if (typeof api.openExternal === 'function') {
    try {
      await api.openExternal({ href });
      return;
    } catch {
      // fallback
    }
  }
  window.open(href, '_blank', 'noopener');
}

/** Check if callTool is available. */
export function canCallTool(): boolean {
  if (typeof bridge().callTool === 'function') {
    return true;
  }
  return typeof window !== 'undefined' && window.parent !== null;
}
