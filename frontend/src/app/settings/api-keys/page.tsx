'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { useUserBlogV2 } from '@/hooks/useUserBlogV2';
import { CheckCircle2, AlertTriangle, Copy, Trash2, X, Github } from 'lucide-react';
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_SUBTLE_BUTTON_CLASS,
} from '@/app/settings/theme';
import { useMcpApiKeys } from './useMcpApiKeys';
import type { CreateMcpApiKeyResponse, McpApiKey } from '@/services/api/mcp.service';
import { createMcpApiKey, deleteMcpApiKey, revealMcpApiKey } from '@/services/api/mcp.service';
import {
  getClaudeCodeConfig,
  getAntigravityConfig,
  getCodexConfig,
  getCodexConfigOpenCommand,
  getSkillsInstallSnippet,
  getSkillsPerAgentInstallSnippet,
  getCursorConfig,
  getGeminiConfig,
  getQwenConfig,
  getVSCodeConfig,
  getWindsurfConfig,
} from './configSnippets';
import { APP_CONNECTION_DOCS } from '@/lib/app-connection-docs';

/**
 * MCP API Key 관리 페이지
 *
 * 기능:
 * - API Key 생성 (최대 3개)
 * - 기존 키 목록 (hint만 표시)
 * - 키 삭제
 * - 사용 통계 (requestCount, postsCreated)
 * - .mcp.json 설정 가이드
 */

export default function ApiKeysPage() {
  type SetupMode = 'web-app' | 'skills' | 'mcp' | 'agents';

  const maxApiKeys = 3;
  const router = useRouter();
  const { blog, loading: blogLoading } = useUserBlogV2();
  const {
    keys,
    loading: keysLoading,
    refreshKeys,
    removeKeyLocally,
  } = useMcpApiKeys();
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<CreateMcpApiKeyResponse | null>(null);
  const [selectedBlogId, setSelectedBlogId] = useState<string>('');
  const [runtimeApiKeys, setRuntimeApiKeys] = useState<Record<string, string>>({});
  const [setupMode, setSetupMode] = useState<SetupMode>('web-app');
  const [selectedSkillAgent, setSelectedSkillAgent] = useState<'codex' | 'claude-code' | 'gemini-cli' | 'antigravity'>('codex');
  const [selectedMcpClient, setSelectedMcpClient] = useState<'codex' | 'claude-code' | 'gemini' | 'antigravity' | 'cursor' | 'windsurf' | 'vscode' | 'qwen'>('codex');
  const [selectedCodexOpenTarget, setSelectedCodexOpenTarget] = useState<'mac-linux' | 'windows' | 'wsl'>('mac-linux');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [revealingKeyId, setRevealingKeyId] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState<{
    isOpen: boolean;
    keyName: string;
  }>({
    isOpen: false,
    keyName: '',
  });
  const copyFeedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showStatusMessage = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
  };

  // 삭제 확인 다이얼로그 상태
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    keyId: string | null;
    keyName: string;
    keyHint: string | null;
  }>({
    isOpen: false,
    keyId: null,
    keyName: '',
    keyHint: null,
  });

  // 블로그가 로드되면 자동 선택
  useEffect(() => {
    if (blog && !selectedBlogId) {
      setSelectedBlogId(blog.id);
    }
  }, [blog, selectedBlogId]);

  useEffect(() => {
    refreshKeys();
  }, [refreshKeys]);

  useEffect(() => {
    if (copyFeedbackTimeout.current) {
      clearTimeout(copyFeedbackTimeout.current);
      copyFeedbackTimeout.current = null;
    }
  }, [newKey]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeout.current) {
        clearTimeout(copyFeedbackTimeout.current);
      }
    };
  }, []);

  const saveRuntimeApiKey = (keyHint: string, apiKey: string) => {
    setRuntimeApiKeys((prev) => ({
      ...prev,
      [keyHint]: apiKey,
    }));
  };

  const removeRuntimeApiKey = (keyHint: string) => {
    setRuntimeApiKeys((prev) => {
      const next = { ...prev };
      delete next[keyHint];
      return next;
    });
  };

  const getRuntimeApiKey = (keyHint: string) => {
    return runtimeApiKeys[keyHint];
  };

  const keyLimitReached = keys.length >= maxApiKeys;

  const createKey = async (keyName: string) => {
    if (!selectedBlogId) {
      showStatusMessage('error', 'Select a blog first.');
      return;
    }

    if (keyLimitReached) {
      showStatusMessage('error', `You can create up to ${maxApiKeys} API keys.`);
      return;
    }

    const normalizedName = keyName.trim();
    if (!normalizedName) {
      showStatusMessage('error', 'Enter an API key name.');
      return;
    }

    try {
      setCreating(true);
      const created = await createMcpApiKey({
        blogId: selectedBlogId,
        name: normalizedName,
      });
      setNewKey(created);
      saveRuntimeApiKey(created.keyHint, created.apiKey);
      await refreshKeys();
      setCreateModal({ isOpen: false, keyName: '' });
      showStatusMessage('success', 'API key created. You can copy it again anytime.');
    } catch (error: any) {
      console.error('Failed to create API key:', error);
      const message =
        error?.message ||
        error?.response?.data?.message ||
        'An unknown error occurred.';
      showStatusMessage('error', `Failed to create API key: ${message}`);
    } finally {
      setCreating(false);
    }
  };

  const openCreateModal = () => {
    if (!selectedBlogId) {
      showStatusMessage('error', 'Select a blog first.');
      return;
    }
    if (keyLimitReached) {
      showStatusMessage('error', `You can create up to ${maxApiKeys} API keys.`);
      return;
    }
    setCreateModal({ isOpen: true, keyName: '' });
  };

  const closeCreateModal = () => {
    if (creating) return;
    setCreateModal({ isOpen: false, keyName: '' });
  };

  const submitCreateModal = async () => {
    await createKey(createModal.keyName);
  };

  const deleteKey = async () => {
    if (!deleteDialog.keyId) return;

    try {
      await deleteMcpApiKey(deleteDialog.keyId);
      if (deleteDialog.keyHint) {
        removeRuntimeApiKey(deleteDialog.keyHint);
      }
      removeKeyLocally(deleteDialog.keyId);
      showStatusMessage('success', 'API key deleted.');
      setDeleteDialog({ isOpen: false, keyId: null, keyName: '', keyHint: null });
    } catch (error: any) {
      console.error('Failed to delete API key:', error);
      const message =
        error?.message ||
        error?.response?.data?.message ||
        'An unknown error occurred.';
      showStatusMessage('error', 'Failed to delete API key: ' + message);
    }
  };

  const openDeleteDialog = (keyId: string, keyName: string, keyHint: string) => {
    setDeleteDialog({
      isOpen: true,
      keyId,
      keyName,
      keyHint,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const copyAndNotify = (text: string) => {
    copyToClipboard(text);
    showStatusMessage('success', 'API key copied.');
    if (copyFeedbackTimeout.current) {
      clearTimeout(copyFeedbackTimeout.current);
    }
    copyFeedbackTimeout.current = setTimeout(() => {
      setStatusMessage(null);
      copyFeedbackTimeout.current = null;
    }, 2000);
  };

  const copyKeyValue = async (key: McpApiKey) => {
    try {
      let fullApiKey = getRuntimeApiKey(key.keyHint);

      if (!fullApiKey) {
        setRevealingKeyId(key.id);
        const revealed = await revealMcpApiKey(key.id);
        fullApiKey = revealed.apiKey;
        saveRuntimeApiKey(revealed.keyHint, revealed.apiKey);
      }

      if (!fullApiKey) {
        throw new Error('API key payload is empty');
      }

      copyAndNotify(fullApiKey);
    } catch (error: any) {
      console.error('Failed to reveal API key:', error);
      const message =
        error?.message ||
        error?.response?.data?.message ||
        'An unknown error occurred.';
      showStatusMessage('error', `Failed to copy API key: ${message}`);
    } finally {
      setRevealingKeyId((current) => (current === key.id ? null : current));
    }
  };

  const selectSetupMode = (mode: SetupMode) => {
    setSetupMode(mode);
  };

  // 현재 사용 가능한 API Key 가져오기 (newKey 우선, 없으면 placeholder)
  const getCurrentApiKey = () => {
    if (keys.length > 0) {
      const persisted = getRuntimeApiKey(keys[0].keyHint);
      if (persisted) return persisted;
    }
    return newKey?.apiKey || '[YOUR-API-KEY]';
  };

  const skillsGlobalInstallCommand = getSkillsInstallSnippet(false, true);
  const skillsPerAgentCommands = getSkillsPerAgentInstallSnippet(false, false)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const skillsVerifyGlobalByAgentsCommand =
    'npx -y skills list -g -a codex -a claude-code -a gemini-cli -a antigravity';
  const llmAgentsInstallGuideFetchCommand =
    'curl -s https://raw.githubusercontent.com/beyondeth/codebase-skills/refs/heads/main/docs/guide/installation.md';
  const codexConfigOpenCommand = getCodexConfigOpenCommand(selectedCodexOpenTarget);
  const codexMcpVerifyCommand = 'codex mcp get codebase-blog-mcp';
  const codexOpenTargetCards: Array<{
    id: 'mac-linux' | 'windows' | 'wsl';
    title: string;
    description: string;
  }> = [
    { id: 'mac-linux', title: 'macOS / Linux', description: '~/.codex/config.toml' },
    { id: 'windows', title: 'Windows', description: '%USERPROFILE%\\.codex\\config.toml' },
    { id: 'wsl', title: 'WSL2', description: 'Linux home directory: ~/.codex/config.toml' },
  ];

  const mcpClientCards: Array<{
    id: 'codex' | 'claude-code' | 'gemini' | 'antigravity' | 'cursor' | 'windsurf' | 'vscode' | 'qwen';
    title: string;
    description: string;
    configPath: string;
  }> = [
    { id: 'codex', title: 'OpenAI Codex', description: 'Codex CLI', configPath: '~/.codex/config.toml' },
    { id: 'claude-code', title: 'Claude Code', description: 'CLI command', configPath: 'Terminal' },
    { id: 'gemini', title: 'Gemini CLI', description: 'JSON config', configPath: '~/.gemini/settings.json' },
    { id: 'antigravity', title: 'Antigravity', description: 'JSON config', configPath: 'mcp_config.json' },
    { id: 'cursor', title: 'Cursor', description: 'JSON config', configPath: '~/.cursor/mcp.json' },
    { id: 'windsurf', title: 'Windsurf', description: 'JSON config', configPath: '~/.windsurf/mcp.json' },
    { id: 'vscode', title: 'VS Code', description: 'Workspace config', configPath: '.mcp.json' },
    { id: 'qwen', title: 'Qwen Coder', description: 'JSON config', configPath: '~/.qwen/mcp.json' },
  ];

  const mcpConfigByClient = {
    codex: getCodexConfig(getCurrentApiKey(), false),
    'claude-code': getClaudeCodeConfig(getCurrentApiKey(), false),
    gemini: getGeminiConfig(getCurrentApiKey(), false),
    antigravity: getAntigravityConfig(getCurrentApiKey(), false),
    cursor: getCursorConfig(getCurrentApiKey(), false),
    windsurf: getWindsurfConfig(getCurrentApiKey(), false),
    vscode: getVSCodeConfig(getCurrentApiKey(), false),
    qwen: getQwenConfig(getCurrentApiKey(), false),
  } as const;

  const selectedMcpCard = mcpClientCards.find((card) => card.id === selectedMcpClient) ?? mcpClientCards[0];
  const skillAgentCards = [
    {
      id: 'codex' as const,
      title: 'Codex',
      description: 'CLI install',
      targetPath: 'Global Skill',
      command: skillsPerAgentCommands[0] ?? '',
    },
    {
      id: 'claude-code' as const,
      title: 'Claude Code',
      description: 'CLI install',
      targetPath: 'Global Skill',
      command: skillsPerAgentCommands[1] ?? '',
    },
    {
      id: 'gemini-cli' as const,
      title: 'Gemini CLI',
      description: 'CLI install',
      targetPath: 'Global Skill',
      command: skillsPerAgentCommands[2] ?? '',
    },
    {
      id: 'antigravity' as const,
      title: 'Antigravity',
      description: 'CLI install',
      targetPath: 'Global Skill',
      command: skillsPerAgentCommands[3] ?? '',
    },
  ].filter((card) => card.command);
  const selectedSkillAgentCard =
    skillAgentCards.find((card) => card.id === selectedSkillAgent) ?? skillAgentCards[0];
  const webAppCards = APP_CONNECTION_DOCS.map((doc) => ({
    id: doc.slug,
    title: doc.shortTitle,
    description: doc.summary,
    docsHref: `/docs/apps/${doc.slug}`,
    statusLabel: doc.statusLabel,
    statusClassName:
      doc.status === 'manual-verify'
        ? 'border-[#F5D08A] bg-[#FFF8E8] text-[#8A5B00] dark:border-[#5E4720] dark:bg-[#261D0C] dark:text-[#F6D58A]'
        : 'border-[#CFE2FF] bg-[#EEF5FF] text-[#1A56B5] dark:border-[#24406A] dark:bg-[#101A2A] dark:text-[#93C5FD]',
  }));

  const formatRelativeTime = (iso: string | null) => {
    if (!iso) return 'Never used';
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / (1000 * 60));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  };

  const compactApiKey = (apiKey: string) => {
    if (apiKey.length <= 16) return apiKey;
    return `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`;
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US');
  };

  // 블로그 로딩 중
  if (blogLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-[#2A2F3A] rounded animate-pulse" />
        <div className="h-4 w-64 bg-gray-100 dark:bg-[#1F2229] rounded animate-pulse" />
        <div className={`${SETTINGS_CARD_CLASS} p-6 space-y-3`}>
          <div className="h-6 w-32 bg-gray-200 dark:bg-[#2A2F3A] rounded animate-pulse" />
          <div className="space-y-3">
            <div className="h-10 w-full bg-gray-100 dark:bg-[#1F2229] rounded animate-pulse" />
            <div className="h-10 w-full bg-gray-100 dark:bg-[#1F2229] rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-2">
        <div className="mb-2 space-y-1 pt-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">Autoposting setup</h2>
        </div>

        {statusMessage && (
          <div
            className={`flex items-start gap-3 rounded-lg border p-3 sm:p-4 text-sm ${
              statusMessage.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100'
            }`}
          >
            {statusMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            )}
            <p className="flex-1">{statusMessage.text}</p>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="p-1 text-current opacity-80 hover:opacity-100"
              aria-label="Close status message"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

      <div className={`${SETTINGS_CARD_CLASS} space-y-4 p-4 sm:p-6`}>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Choose a setup path</h2>
        <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-[#2F3440]">
          <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-4">
            <button
              onClick={() => selectSetupMode('web-app')}
              className={`border-b border-gray-200 px-4 py-4 text-center transition sm:border-r xl:border-b-0 dark:border-[#2F3440] ${
                setupMode === 'web-app'
                  ? 'bg-gray-900 text-white dark:bg-[#6D79FF]'
                  : 'bg-white text-gray-900 hover:bg-gray-50 dark:bg-[#1F2229] dark:text-gray-100 dark:hover:bg-[#242a38]'
              }`}
            >
              <p className="text-sm font-semibold">Web & apps</p>
              <p className={`mt-1 text-xs ${setupMode === 'web-app' ? 'text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>ChatGPT · Claude · Perplexity</p>
            </button>
            <button
              onClick={() => selectSetupMode('skills')}
              className={`border-b border-gray-200 px-4 py-4 text-center transition xl:border-b-0 xl:border-r dark:border-[#2F3440] ${
                setupMode === 'skills'
                  ? 'bg-gray-900 text-white dark:bg-[#6D79FF]'
                  : 'bg-white text-gray-900 hover:bg-gray-50 dark:bg-[#1F2229] dark:text-gray-100 dark:hover:bg-[#242a38]'
              }`}
            >
              <p className="text-sm font-semibold">Install with Skills</p>
              <p className={`mt-1 text-xs ${setupMode === 'skills' ? 'text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>Beginner</p>
            </button>
            <button
              onClick={() => selectSetupMode('mcp')}
              className={`border-b border-gray-200 px-4 py-4 text-center transition sm:border-r xl:border-b-0 xl:border-r dark:border-[#2F3440] ${
                setupMode === 'mcp'
                  ? 'bg-gray-900 text-white dark:bg-[#6D79FF]'
                  : 'bg-white text-gray-900 hover:bg-gray-50 dark:bg-[#1F2229] dark:text-gray-100 dark:hover:bg-[#242a38]'
              }`}
            >
              <p className="text-sm font-semibold">Direct MCP setup</p>
              <p className={`mt-1 text-xs ${setupMode === 'mcp' ? 'text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>Advanced</p>
            </button>
            <button
              onClick={() => selectSetupMode('agents')}
              className={`px-4 py-4 text-center transition ${
                setupMode === 'agents'
                  ? 'bg-gray-900 text-white dark:bg-[#6D79FF]'
                  : 'bg-white text-gray-900 hover:bg-gray-50 dark:bg-[#1F2229] dark:text-gray-100 dark:hover:bg-[#242a38]'
              }`}
            >
              <p className="text-sm font-semibold">Install for LLM agents</p>
              <p className={`mt-1 text-xs ${setupMode === 'agents' ? 'text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>Guided</p>
            </button>
          </div>
        </div>
      </div>

      {setupMode === 'web-app' && (
        <div className={`${SETTINGS_CARD_CLASS} space-y-5 p-4 sm:p-6`}>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Web & app connections</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Review the connection flow for environments like ChatGPT, Claude, and Perplexity.
              The step-by-step guidance follows official docs, and screenshots can be updated by replacing the files in the docs asset path.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">1</div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Choose your environment</h4>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Pick the web or app environment you use and open the matching guide.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">2</div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Stay aligned with official docs</h4>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Each guide is maintained against the official documentation. Screenshot slots update automatically when you replace files inside <code>frontend/public/docs/apps/...</code>.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">3</div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Manage existing connections</h4>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Review or remove approved OAuth and app connections from the connected apps screen.
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {webAppCards.map((card) => (
              <div
                key={card.id}
                className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-[#2F3440] dark:bg-[#1F2229] dark:shadow-none"
              >
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${card.statusClassName}`}>
                  {card.statusLabel}
                </span>
                <h4 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {card.title}
                </h4>
                <p className="mt-2 text-sm leading-7 text-gray-600 dark:text-gray-300">
                  {card.description}
                </p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => router.push(card.docsHref)}
                    className="inline-flex flex-1 items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-[#6D79FF] dark:hover:bg-[#5A66E4]"
                  >
                    Open guide
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/settings/connected-apps')}
                    className={`${SETTINGS_SUBTLE_BUTTON_CLASS} flex-1`}
                  >
                    Manage connections
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {setupMode === 'skills' && (
        <div className={`${SETTINGS_CARD_CLASS} space-y-5 p-4 sm:p-6`}>
          <div className="space-y-1">
            <a
              href="https://github.com/beyondeth/codebase-skills"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            >
              <Github className="h-4 w-4" />
              <span>Install source</span>
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400">github.com/beyondeth/codebase-skills</span>
            </a>
          </div>

          <div className="grid gap-3 grid-cols-1">
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">1</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Global install</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Use the integration across all projects. (Codex, Claude Code, Gemini CLI, Antigravity)</p>
              <QuickCommandBar
                command={skillsGlobalInstallCommand}
                copyLabel="Copy install command"
                onCopy={() => {
                  copyToClipboard(skillsGlobalInstallCommand);
                  showStatusMessage('success', 'Install command copied.');
                }}
              />
            </div>

            <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">2</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Per-agent install</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Install only the agents you need for the current project.</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {skillAgentCards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => setSelectedSkillAgent(card.id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      selectedSkillAgent === card.id
                        ? 'border-gray-900 bg-gray-900 text-white dark:border-[#6D79FF] dark:bg-[#6D79FF]'
                        : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-[#2F3440] dark:bg-[#1F2229] dark:text-gray-100 dark:hover:bg-[#242a38]'
                    }`}
                  >
                    <p className="text-sm font-semibold">{card.title}</p>
                    <p className={`mt-1 text-xs ${selectedSkillAgent === card.id ? 'text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>{card.description}</p>
                    <p className={`mt-1 text-xs ${selectedSkillAgent === card.id ? 'text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>{card.targetPath}</p>
                  </button>
                ))}
              </div>
              {selectedSkillAgentCard && (
                <div className="mt-3 rounded-xl border border-gray-200 p-3 dark:border-[#2F3440]">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedSkillAgentCard.title} install command</p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{selectedSkillAgentCard.targetPath}</span>
                  </div>
                  <QuickCommandBar
                    command={selectedSkillAgentCard.command}
                    copyLabel={`Copy ${selectedSkillAgentCard.title} install command`}
                    onCopy={() => {
                      copyToClipboard(selectedSkillAgentCard.command);
                      showStatusMessage('success', `${selectedSkillAgentCard.title} install command copied.`);
                    }}
                  />
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">3</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Verify agent install</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Check agent link status after global installation.</p>
              <QuickCommandBar
                command={skillsVerifyGlobalByAgentsCommand}
                copyLabel="Copy verification command"
                onCopy={() => {
                  copyToClipboard(skillsVerifyGlobalByAgentsCommand);
                  showStatusMessage('success', 'Verification command copied.');
                }}
              />
            </div>
          </div>
        </div>
      )}

      {setupMode === 'agents' && (
        <div className={`${SETTINGS_CARD_CLASS} space-y-5 p-4 sm:p-6`}>
          <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">1</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">For LLM Agents</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Share the guide below with another agent and it can read the document and follow the setup steps automatically.
            </p>
            <QuickCommandBar
              command={llmAgentsInstallGuideFetchCommand}
              copyLabel="Copy LLM agent guide fetch command"
              onCopy={() => {
                copyToClipboard(llmAgentsInstallGuideFetchCommand);
                showStatusMessage('success', 'LLM agent guide fetch command copied.');
              }}
            />
          </div>
        </div>
      )}

      {setupMode === 'mcp' && (
        <>
        <div className="mb-1 space-y-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">MCP API key management</h3>
        </div>

        <div className={`${SETTINGS_CARD_CLASS} overflow-hidden p-0`}>
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 dark:border-[#2F3440] sm:px-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">API keys</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                You can create up to {maxApiKeys} keys per account.
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Created {keys.length}/{maxApiKeys}
              </p>
            </div>
            <button
              onClick={openCreateModal}
              disabled={creating || !selectedBlogId || keyLimitReached}
              className="rounded-lg bg-[#1f8e9a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#187882] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? 'Creating...' : keyLimitReached ? 'Limit reached' : '+ Create API key'}
            </button>
          </div>

          {keysLoading ? (
            <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-300 sm:px-6">Loading...</p>
          ) : keys.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-300 sm:px-6">No API keys created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[22%]" />
                  <col className="w-[18%]" />
                  <col className="w-[12%]" />
                  <col className="w-[18%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-[#2F3440] dark:text-gray-400">
                    <th className="px-4 py-3 font-medium whitespace-nowrap sm:px-6">Name</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Secret</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Usage</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Expires</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Last used</th>
                    <th className="px-4 py-3 text-right font-medium whitespace-nowrap sm:px-6">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => {
                    const persistedApiKey = getRuntimeApiKey(key.keyHint);
                    const isRevealing = revealingKeyId === key.id;
                    const usageText = `${key.requestCount.toLocaleString()} requests · ${key.postsCreated.toLocaleString()} posts`;
                    const expiresText = formatDate(key.expiresAt);
                    const lastUsedText = formatRelativeTime(key.lastUsedAt);

                    return (
                      <tr key={key.id} className="border-b border-gray-50 dark:border-[#242a38]">
                        <td className="px-4 py-4 font-medium text-gray-900 dark:text-gray-100 sm:px-6">
                          <span className="block truncate" title={key.name}>
                            {key.name}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-mono text-gray-700 dark:text-gray-200">
                          <span
                            className="block truncate"
                            title={persistedApiKey ? persistedApiKey : `blog_sk_${key.keyHint}_••••`}
                          >
                            {persistedApiKey ? compactApiKey(persistedApiKey) : `blog_sk_${key.keyHint}_••••`}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-700 dark:text-gray-200">
                          <span className="block truncate" title={usageText}>
                            {usageText}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-700 dark:text-gray-200">
                          <span className="block truncate" title={expiresText}>
                            {expiresText}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-700 dark:text-gray-200">
                          <span className="block truncate" title={lastUsedText}>
                            {lastUsedText}
                          </span>
                        </td>
                        <td className="px-4 py-4 sm:px-6">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => copyKeyValue(key)}
                              className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-[#2A2F3A] dark:hover:text-white"
                              title={isRevealing ? 'Revealing...' : 'Copy full key'}
                              aria-label={isRevealing ? 'Revealing' : 'Copy full key'}
                              disabled={isRevealing}
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openDeleteDialog(key.id, key.name, key.keyHint)}
                              className="rounded-md p-2 text-gray-600 hover:bg-red-50 hover:text-red-600 dark:text-gray-300 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                              title="Delete"
                              aria-label="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={`${SETTINGS_CARD_CLASS} space-y-5 p-4 sm:p-6`}>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">MCP setup</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Copy the JSON or CLI configuration below to connect manually.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">1</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Select</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Choose your current client from the cards below.</p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">2</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Copy</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Copy and paste the {selectedMcpCard.title} configuration.</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{selectedMcpCard.configPath}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">3</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Restart</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Restart the client and test an MCP call.</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {mcpClientCards.map((card) => (
              <button
                key={card.id}
                onClick={() => setSelectedMcpClient(card.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  selectedMcpClient === card.id
                    ? 'border-gray-900 bg-gray-900 text-white dark:border-[#6D79FF] dark:bg-[#6D79FF]'
                    : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-[#2F3440] dark:bg-[#1F2229] dark:text-gray-100 dark:hover:bg-[#242a38]'
                }`}
              >
                <p className="text-sm font-semibold">{card.title}</p>
                <p className={`mt-1 text-sm ${selectedMcpClient === card.id ? 'text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>{card.description}</p>
                <p className={`mt-1 text-xs ${selectedMcpClient === card.id ? 'text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>{card.configPath}</p>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{selectedMcpCard.title} configuration</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">{selectedMcpCard.configPath}</span>
            </div>

            {selectedMcpClient === 'codex' && (
              <div className="mb-3 rounded-xl border border-gray-200 p-3 dark:border-[#2F3440]">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  In the official OpenAI Codex docs, <code>codex mcp add</code> is the generic CLI for MCP registration,
                  but there is no official one-line install that injects a static <code>Authorization</code> header directly.
                </p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  For this server, the supported path is to edit <code>http_headers</code> directly inside <code>~/.codex/config.toml</code>.
                  If you already have a <code>codebase-blog-mcp</code> block, replace it with the configuration below and restart Codex.
                </p>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Official docs:{' '}
                  <a
                    href="https://developers.openai.com/codex/mcp"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Model Context Protocol
                  </a>
                  {' · '}
                  <a
                    href="https://developers.openai.com/codex/config-reference"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Config Reference
                  </a>
                </p>
                <div className="mt-4 rounded-xl border border-gray-200 p-3 dark:border-[#2F3440]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Open `config.toml`</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Choose the path that matches the environment where Codex is running.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    {codexOpenTargetCards.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => setSelectedCodexOpenTarget(card.id)}
                        className={`rounded-xl border p-3 text-left transition ${
                          selectedCodexOpenTarget === card.id
                            ? 'border-gray-900 bg-gray-900 text-white dark:border-[#6D79FF] dark:bg-[#6D79FF]'
                            : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-[#2F3440] dark:bg-[#1F2229] dark:text-gray-100 dark:hover:bg-[#242a38]'
                        }`}
                        type="button"
                      >
                        <p className="text-sm font-semibold">{card.title}</p>
                        <p className={`mt-1 text-xs ${selectedCodexOpenTarget === card.id ? 'text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                          {card.description}
                        </p>
                      </button>
                    ))}
                  </div>
                  <QuickCommandBar
                    command={codexConfigOpenCommand}
                    copyLabel="Copy Codex config open command"
                    onCopy={() => {
                      copyToClipboard(codexConfigOpenCommand);
                      showStatusMessage('success', 'Copied the Codex config open command.');
                    }}
                  />
                  {selectedCodexOpenTarget === 'windows' && (
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      This command assumes PowerShell. If Codex is running inside WSL2, open the Linux path from the WSL2 tab instead of the Windows path.
                    </p>
                  )}
                  {selectedCodexOpenTarget === 'wsl' && (
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      Codex running inside WSL2 reads <code>~/.codex/config.toml</code> from the Linux home directory, not the Windows <code>%USERPROFILE%\\.codex</code> path.
                    </p>
                  )}
                </div>
              </div>
            )}

            <QuickCodeBlock
              code={mcpConfigByClient[selectedMcpClient]}
              onCopy={() => {
                copyToClipboard(mcpConfigByClient[selectedMcpClient]);
                showStatusMessage('success', `Copied the ${selectedMcpCard.title} configuration.`);
              }}
              copyLabel={`Copy ${selectedMcpCard.title} configuration`}
            />

            {selectedMcpClient === 'codex' && (
              <div className="mt-3 rounded-xl border border-gray-200 p-3 dark:border-[#2F3440]">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  After saving, reopen Codex and verify the registration with the command below.
                </p>
                <div className="mt-3">
                  <QuickCommandBar
                    command={codexMcpVerifyCommand}
                    copyLabel="Copy Codex MCP verify command"
                    onCopy={() => {
                      copyToClipboard(codexMcpVerifyCommand);
                      showStatusMessage('success', 'Copied the Codex MCP verify command.');
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        </>
      )}

      <div className={`${SETTINGS_CARD_CLASS} p-4 sm:p-5`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-[#2F3440] dark:bg-[#1F2229] dark:text-gray-300">
              Guide
            </span>
            <h3 className="mt-2 text-base font-semibold text-gray-900 dark:text-white">Learn how it works</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              See autoposting examples and the 8 writing styles currently available in one place.
            </p>
          </div>
          <button
            onClick={() => router.push('/docs/writing-styles')}
            className={`${SETTINGS_SUBTLE_BUTTON_CLASS} w-full sm:w-auto`}
          >
            Open guide
          </button>
        </div>
      </div>

      {createModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            onClick={closeCreateModal}
            aria-label="Close"
          />
          <div className="relative z-10 w-full max-w-[560px] rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#1F2229] sm:p-8">
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Create API key</h3>
            <div className="mt-7">
              <label
                htmlFor="api-key-name"
                className="block text-base font-medium text-gray-600 dark:text-gray-300"
              >
                Key name
              </label>
              <input
                id="api-key-name"
                type="text"
                value={createModal.keyName}
                onChange={(event) =>
                  setCreateModal((prev) => ({ ...prev, keyName: event.target.value }))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    submitCreateModal();
                  }
                }}
                placeholder="Enter a name for this API key"
                className="mt-3 h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-[#1f8e9a] focus:bg-white focus:outline-none dark:border-[#2F3440] dark:bg-[#161A22] dark:text-gray-100 dark:placeholder:text-gray-500"
                autoFocus
                maxLength={100}
              />
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creating}
                className="rounded-xl bg-gray-200 px-5 py-2.5 text-base font-medium text-gray-900 transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#2F3440] dark:text-gray-100 dark:hover:bg-[#3A4150]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitCreateModal}
                disabled={creating || !createModal.keyName.trim()}
                className="rounded-xl bg-gray-900 px-5 py-2.5 text-base font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#6D79FF] dark:hover:bg-[#5A66E4]"
              >
                {creating ? 'Creating...' : 'Create key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, keyId: null, keyName: '', keyHint: null })}
        onConfirm={deleteKey}
        title="Delete this API key?"
        description={`"${deleteDialog.keyName}" will be permanently deleted and cannot be restored. Continue?`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}

type QuickCommandBarProps = {
  command: string;
  onCopy: () => void;
  copyLabel: string;
};

function QuickCommandBar({ command, onCopy, copyLabel }: QuickCommandBarProps) {
  return (
    <div className="mt-3 flex overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-[#2F3440] dark:bg-[#161A22]">
      <code className="flex-1 overflow-x-auto whitespace-nowrap px-3 py-2.5 font-mono text-[13px] leading-6 text-gray-800 dark:text-gray-100 sm:text-sm">
        {command}
      </code>
      <button
        onClick={onCopy}
        className="flex h-11 w-11 items-center justify-center border-l border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-[#2F3440] dark:text-gray-300 dark:hover:bg-[#242a38] dark:hover:text-white"
        aria-label={copyLabel}
        title={copyLabel}
        type="button"
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );
}

type QuickCodeBlockProps = {
  code: string;
  onCopy: () => void;
  copyLabel: string;
};

function QuickCodeBlock({ code, onCopy, copyLabel }: QuickCodeBlockProps) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-[#2F3440] dark:bg-[#161A22]">
      <div className="flex justify-end border-b border-gray-200 px-2 py-2 dark:border-[#2F3440]">
        <button
          onClick={onCopy}
          className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-[#2F3440] dark:text-gray-300 dark:hover:bg-[#242a38] dark:hover:text-white"
          aria-label={copyLabel}
          title={copyLabel}
          type="button"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
      <pre className="max-h-[320px] overflow-auto px-3 py-3 font-mono text-[13px] leading-6 text-gray-800 dark:text-gray-100 sm:text-sm">{code}</pre>
    </div>
  );
}
