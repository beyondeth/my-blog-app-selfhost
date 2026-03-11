/* ── OpenAI Widget Bridge Types ── */

export interface OpenAIBridge {
  callTool?: (name: string, args: Record<string, unknown>) => Promise<ToolResponse>;
  sendFollowUpMessage?: (msg: { prompt: string }) => Promise<void>;
  setWidgetState?: (state: WidgetPersistedState) => void;
  notifyIntrinsicHeight?: (height: number) => void;
  openExternal?: (opts: { href: string }) => Promise<void>;
  requestDisplayMode?: (opts: { mode: string }) => Promise<void>;
  widgetState?: WidgetPersistedState | null;
  toolOutput?: ToolOutput;
  toolResult?: ToolOutput;
  result?: ToolOutput;
  output?: ToolOutput;
  latestToolOutput?: ToolOutput;
  toolInput?: Record<string, unknown>;
  toolResponseMetadata?: Record<string, unknown>;
  state?: { toolOutput?: ToolOutput; result?: ToolOutput };
}

export interface WidgetPersistedState {
  modelContent?: string;
  privateContent?: { confirmedStyle?: string; progressStage?: string };
}

export interface ToolResponse {
  structuredContent?: ToolOutput;
  _meta?: Record<string, unknown>;
  content?: Array<{ type: string; text: string }>;
}

export interface ToolOutput {
  status?: string;
  summary?: string;
  tool?: string;
  username?: string;
  blogName?: string;
  blogSlug?: string;
  blogUrl?: string;
  authMode?: string;
  workflowStage?: string;
  connectionHint?: string;
  capabilities?: string[];
  style?: string;
  styleLabel?: string;
  styleDescription?: string;
  hasCustomMarkdown?: boolean;
  styleOptions?: StyleOption[];
  canSelectStyle?: boolean;
  selectionNonce?: string;
  styleSelectionNonce?: string;
  title?: string;
  category?: string;
  writingStyle?: string;
  tags?: string[];
  postUrl?: string;
  contentPreview?: string;
  estimatedWordCount?: number;
  publishedAt?: string;
  reason?: string;
  requiresExplicitConfirmation?: boolean;
  confirmInstruction?: string;
  message?: string;
  toolName?: string;
  [key: string]: unknown;
}

export interface StyleOption {
  id: string;
  label: string;
  description: string;
  emoji?: string;
}

export type WidgetStatus =
  | 'connected'
  | 'published'
  | 'blocked'
  | 'error'
  | 'drafting'
  | 'guide_ready'
  | 'style_confirmed'
  | 'awaiting_style_selection'
  | 'ready';

export interface MetaEntry {
  label: string;
  value: string;
}
