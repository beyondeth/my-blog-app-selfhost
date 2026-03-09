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
  getCodexEnvSnippet,
  getCodexWindowsPersistentSnippet,
  getSkillsInstallSnippet,
  getSkillsPerAgentInstallSnippet,
  getCodexWindowsEnvSnippet,
  getCursorConfig,
  getGeminiConfig,
  getQwenConfig,
  getVSCodeConfig,
  getWindsurfConfig,
} from './configSnippets';

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
  const [setupMode, setSetupMode] = useState<'skills' | 'mcp' | 'agents'>('skills');
  const [selectedSkillAgent, setSelectedSkillAgent] = useState<'codex' | 'claude-code' | 'gemini-cli' | 'antigravity'>('codex');
  const [selectedMcpClient, setSelectedMcpClient] = useState<'codex' | 'claude-code' | 'gemini' | 'antigravity' | 'cursor' | 'windsurf' | 'vscode' | 'qwen'>('codex');
  const [codexOs, setCodexOs] = useState<'mac-linux' | 'windows'>('mac-linux');
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
      showStatusMessage('error', '블로그를 선택해주세요.');
      return;
    }

    if (keyLimitReached) {
      showStatusMessage('error', `API Key는 최대 ${maxApiKeys}개까지 생성할 수 있습니다.`);
      return;
    }

    const normalizedName = keyName.trim();
    if (!normalizedName) {
      showStatusMessage('error', 'API 키 이름을 입력해주세요.');
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
      showStatusMessage('success', 'API Key가 생성되었습니다. 언제든 다시 복사할 수 있습니다.');
    } catch (error: any) {
      console.error('Failed to create API key:', error);
      const message =
        error?.message ||
        error?.response?.data?.message ||
        '알 수 없는 오류가 발생했습니다.';
      showStatusMessage('error', `API Key 생성 실패: ${message}`);
    } finally {
      setCreating(false);
    }
  };

  const openCreateModal = () => {
    if (!selectedBlogId) {
      showStatusMessage('error', '블로그를 선택해주세요.');
      return;
    }
    if (keyLimitReached) {
      showStatusMessage('error', `API Key는 최대 ${maxApiKeys}개까지 생성할 수 있습니다.`);
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
      showStatusMessage('success', 'API Key가 삭제되었습니다.');
      setDeleteDialog({ isOpen: false, keyId: null, keyName: '', keyHint: null });
    } catch (error: any) {
      console.error('Failed to delete API key:', error);
      const message =
        error?.message ||
        error?.response?.data?.message ||
        '알 수 없는 오류가 발생했습니다.';
      showStatusMessage('error', 'API Key 삭제 실패: ' + message);
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
    showStatusMessage('success', 'API Key를 복사했습니다.');
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
        '알 수 없는 오류가 발생했습니다.';
      showStatusMessage('error', `API Key 복사 실패: ${message}`);
    } finally {
      setRevealingKeyId((current) => (current === key.id ? null : current));
    }
  };

  const selectSetupMode = (mode: 'skills' | 'mcp' | 'agents') => {
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
  const codexEnvSessionCommand =
    codexOs === 'mac-linux'
      ? getCodexEnvSnippet(getCurrentApiKey(), false)
      : getCodexWindowsEnvSnippet(getCurrentApiKey(), false);
  const codexEnvPersistentCommand =
    codexOs === 'mac-linux'
      ? `echo 'export CODEBASE_MCP_TOKEN="${getCurrentApiKey()}"' >> ~/.zshrc && source ~/.zshrc`
      : getCodexWindowsPersistentSnippet(getCurrentApiKey(), false);
  const codexMcpAddCommand =
    'codex mcp add codebase-blog-mcp --url https://mcp.codebase.blog/mcp --bearer-token-env-var CODEBASE_MCP_TOKEN';
  const codexMcpVerifyCommand = 'codex mcp get codebase-blog-mcp';

  const mcpClientCards: Array<{
    id: 'codex' | 'claude-code' | 'gemini' | 'antigravity' | 'cursor' | 'windsurf' | 'vscode' | 'qwen';
    title: string;
    description: string;
    configPath: string;
  }> = [
    { id: 'codex', title: 'OpenAI Codex', description: 'Codex CLI', configPath: '~/.codex/config.toml' },
    { id: 'claude-code', title: 'Claude Code', description: 'CLI 명령', configPath: '터미널' },
    { id: 'gemini', title: 'Gemini CLI', description: 'JSON 설정', configPath: '~/.gemini/settings.json' },
    { id: 'antigravity', title: 'Antigravity', description: 'JSON 설정', configPath: 'mcp_config.json' },
    { id: 'cursor', title: 'Cursor', description: 'JSON 설정', configPath: '~/.cursor/mcp.json' },
    { id: 'windsurf', title: 'Windsurf', description: 'JSON 설정', configPath: '~/.windsurf/mcp.json' },
    { id: 'vscode', title: 'VS Code', description: '워크스페이스 설정', configPath: '.mcp.json' },
    { id: 'qwen', title: 'Qwen Coder', description: 'JSON 설정', configPath: '~/.qwen/mcp.json' },
  ];

  const mcpConfigByClient = {
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
      description: 'CLI 설치',
      targetPath: 'Global Skill',
      command: skillsPerAgentCommands[0] ?? '',
    },
    {
      id: 'claude-code' as const,
      title: 'Claude Code',
      description: 'CLI 설치',
      targetPath: 'Global Skill',
      command: skillsPerAgentCommands[1] ?? '',
    },
    {
      id: 'gemini-cli' as const,
      title: 'Gemini CLI',
      description: 'CLI 설치',
      targetPath: 'Global Skill',
      command: skillsPerAgentCommands[2] ?? '',
    },
    {
      id: 'antigravity' as const,
      title: 'Antigravity',
      description: 'CLI 설치',
      targetPath: 'Global Skill',
      command: skillsPerAgentCommands[3] ?? '',
    },
  ].filter((card) => card.command);
  const selectedSkillAgentCard =
    skillAgentCards.find((card) => card.id === selectedSkillAgent) ?? skillAgentCards[0];

  const formatRelativeTime = (iso: string | null) => {
    if (!iso) return '사용 안 함';
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / (1000 * 60));
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  };

  const compactApiKey = (apiKey: string) => {
    if (apiKey.length <= 16) return apiKey;
    return `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`;
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ko-KR');
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">자동포스팅 연결</h2>
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
              aria-label="상태 메시지 닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

      {/* 설치 방법 선택 */}
      <div className={`${SETTINGS_CARD_CLASS} space-y-4 p-4 sm:p-6`}>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">설치 방법 선택</h2>
        <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-[#2F3440]">
          <div className="grid gap-0 sm:grid-cols-3">
            <button
              onClick={() => selectSetupMode('skills')}
              className={`border-b border-gray-200 px-4 py-4 text-center transition sm:border-b-0 sm:border-r dark:border-[#2F3440] ${
                setupMode === 'skills'
                  ? 'bg-gray-900 text-white dark:bg-[#6D79FF]'
                  : 'bg-white text-gray-900 hover:bg-gray-50 dark:bg-[#1F2229] dark:text-gray-100 dark:hover:bg-[#242a38]'
              }`}
            >
              <p className="text-sm font-semibold">SKILLS 설치</p>
              <p className={`mt-1 text-xs ${setupMode === 'skills' ? 'text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>초보자</p>
            </button>
            <button
              onClick={() => selectSetupMode('mcp')}
              className={`border-b border-gray-200 px-4 py-4 text-center transition sm:border-b-0 sm:border-r dark:border-[#2F3440] ${
                setupMode === 'mcp'
                  ? 'bg-gray-900 text-white dark:bg-[#6D79FF]'
                  : 'bg-white text-gray-900 hover:bg-gray-50 dark:bg-[#1F2229] dark:text-gray-100 dark:hover:bg-[#242a38]'
              }`}
            >
              <p className="text-sm font-semibold">MCP 직접 설정</p>
              <p className={`mt-1 text-xs ${setupMode === 'mcp' ? 'text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>고급 사용자</p>
            </button>
            <button
              onClick={() => selectSetupMode('agents')}
              className={`px-4 py-4 text-center transition ${
                setupMode === 'agents'
                  ? 'bg-gray-900 text-white dark:bg-[#6D79FF]'
                  : 'bg-white text-gray-900 hover:bg-gray-50 dark:bg-[#1F2229] dark:text-gray-100 dark:hover:bg-[#242a38]'
              }`}
            >
              <p className="text-sm font-semibold">LLM Agents 설치</p>
              <p className={`mt-1 text-xs ${setupMode === 'agents' ? 'text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>자동 안내</p>
            </button>
          </div>
        </div>
      </div>

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
              <span>설치 소스</span>
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400">github.com/beyondeth/codebase-skills</span>
            </a>
          </div>

          <div className="grid gap-3 grid-cols-1">
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">1</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Global 설치</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">모든 프로젝트에서 공통으로 사용합니다. (Codex, Claude Code, Gemini CLI, Antigravity)</p>
              <QuickCommandBar
                command={skillsGlobalInstallCommand}
                copyLabel="설치 명령 복사"
                onCopy={() => {
                  copyToClipboard(skillsGlobalInstallCommand);
                  showStatusMessage('success', '설치 명령을 복사했습니다.');
                }}
              />
            </div>

            <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">2</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Agent별 설치</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">현재 프로젝트에서 필요한 Agent만 설치합니다.</p>
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
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedSkillAgentCard.title} 설치 명령</p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{selectedSkillAgentCard.targetPath}</span>
                  </div>
                  <QuickCommandBar
                    command={selectedSkillAgentCard.command}
                    copyLabel={`${selectedSkillAgentCard.title} 설치 명령 복사`}
                    onCopy={() => {
                      copyToClipboard(selectedSkillAgentCard.command);
                      showStatusMessage('success', `${selectedSkillAgentCard.title} 설치 명령을 복사했습니다.`);
                    }}
                  />
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">3</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Agent 설치 확인</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">전역 설치 기준으로 에이전트별 링크 상태를 확인합니다.</p>
              <QuickCommandBar
                command={skillsVerifyGlobalByAgentsCommand}
                copyLabel="Agent 설치 확인 명령 복사"
                onCopy={() => {
                  copyToClipboard(skillsVerifyGlobalByAgentsCommand);
                  showStatusMessage('success', 'Agent 설치 확인 명령을 복사했습니다.');
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
              아래 설치 가이드를 에이전트에게 전달하면, 문서를 읽고 설치 절차를 따라 자동으로 진행할 수 있습니다.
            </p>
            <QuickCommandBar
              command={llmAgentsInstallGuideFetchCommand}
              copyLabel="LLM Agents 설치 가이드 fetch 명령 복사"
              onCopy={() => {
                copyToClipboard(llmAgentsInstallGuideFetchCommand);
                showStatusMessage('success', 'LLM Agents 설치 가이드 fetch 명령을 복사했습니다.');
              }}
            />
          </div>
        </div>
      )}

      {setupMode === 'mcp' && (
        <>
        <div className="mb-1 space-y-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">MCP API Key 관리</h3>
        </div>

        <div className={`${SETTINGS_CARD_CLASS} overflow-hidden p-0`}>
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 dark:border-[#2F3440] sm:px-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">API 키</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                계정당 최대 {maxApiKeys}개까지 생성할 수 있습니다.
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                생성됨 {keys.length}/{maxApiKeys}
              </p>
            </div>
            <button
              onClick={openCreateModal}
              disabled={creating || !selectedBlogId || keyLimitReached}
              className="rounded-lg bg-[#1f8e9a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#187882] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? '생성 중...' : keyLimitReached ? '최대 3개 도달' : '+ API 키 생성'}
            </button>
          </div>

          {keysLoading ? (
            <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-300 sm:px-6">로딩 중...</p>
          ) : keys.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-300 sm:px-6">생성된 API 키가 없습니다.</p>
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
                    <th className="px-4 py-3 font-medium whitespace-nowrap sm:px-6">이름</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">비밀 키</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">사용량</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">만료</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">최근에 사용됨</th>
                    <th className="px-4 py-3 text-right font-medium whitespace-nowrap sm:px-6">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => {
                    const persistedApiKey = getRuntimeApiKey(key.keyHint);
                    const isRevealing = revealingKeyId === key.id;
                    const usageText = `요청 ${key.requestCount.toLocaleString()}회 · 포스트 ${key.postsCreated.toLocaleString()}개`;
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
                              title={isRevealing ? '복호화 중...' : '전체 키 복사'}
                              aria-label={isRevealing ? '복호화 중' : '전체 키 복사'}
                              disabled={isRevealing}
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openDeleteDialog(key.id, key.name, key.keyHint)}
                              className="rounded-md p-2 text-gray-600 hover:bg-red-50 hover:text-red-600 dark:text-gray-300 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                              title="삭제"
                              aria-label="삭제"
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
              상세 JSON/CLI 설정을 복사해서 직접 연결합니다.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">1</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Select</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">아래 클라이언트 카드에서 사용 환경을 선택합니다.</p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">2</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Copy</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{selectedMcpCard.title} 설정을 복사해 붙여넣습니다.</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{selectedMcpCard.configPath}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#2F3440]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">3</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Restart</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">클라이언트를 재시작한 뒤 MCP 호출을 테스트합니다.</p>
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
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{selectedMcpCard.title} 설정</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">{selectedMcpCard.configPath}</span>
            </div>

            {selectedMcpClient === 'codex' && (
              <div className="mb-3 inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-[#2F3440] dark:bg-[#1F2229]">
                <button
                  onClick={() => setCodexOs('mac-linux')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    codexOs === 'mac-linux'
                      ? 'bg-white text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  macOS/Linux
                </button>
                <button
                  onClick={() => setCodexOs('windows')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    codexOs === 'windows'
                      ? 'bg-white text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Windows
                </button>
              </div>
            )}

            {selectedMcpClient === 'codex' && (
              <div className="space-y-3">
                <div className="rounded-xl border border-gray-200 p-3 dark:border-[#2F3440]">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">1</span>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">토큰 등록 (터미널)</p>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    Codex는 보안상 키를 설정 파일에 직접 넣지 않습니다. 먼저 환경 변수로 등록하세요.
                  </p>
                  <QuickCommandBar
                    command={codexEnvSessionCommand}
                    copyLabel="현재 세션 토큰 명령 복사"
                    onCopy={() => {
                      copyToClipboard(codexEnvSessionCommand);
                      showStatusMessage('success', '현재 세션 토큰 명령을 복사했습니다.');
                    }}
                  />
                  <QuickCommandBar
                    command={codexEnvPersistentCommand}
                    copyLabel="지속 토큰 명령 복사"
                    onCopy={() => {
                      copyToClipboard(codexEnvPersistentCommand);
                      showStatusMessage('success', '지속 토큰 명령을 복사했습니다.');
                    }}
                  />
                </div>

                <div className="rounded-xl border border-gray-200 p-3 dark:border-[#2F3440]">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-900 dark:bg-[#2A2F3A] dark:text-gray-100">2</span>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">MCP 서버 등록 및 확인</p>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    공식 권장 방식으로 CLI에서 바로 등록한 뒤 정상 등록 여부를 확인하세요.
                  </p>
                  <QuickCommandBar
                    command={codexMcpAddCommand}
                    copyLabel="Codex MCP 추가 명령 복사"
                    onCopy={() => {
                      copyToClipboard(codexMcpAddCommand);
                      showStatusMessage('success', 'Codex MCP 추가 명령을 복사했습니다.');
                    }}
                  />
                  <QuickCommandBar
                    command={codexMcpVerifyCommand}
                    copyLabel="Codex MCP 확인 명령 복사"
                    onCopy={() => {
                      copyToClipboard(codexMcpVerifyCommand);
                      showStatusMessage('success', 'Codex MCP 확인 명령을 복사했습니다.');
                    }}
                  />
                </div>
              </div>
            )}

            {selectedMcpClient !== 'codex' && (
              <QuickCodeBlock
                code={mcpConfigByClient[selectedMcpClient as Exclude<typeof selectedMcpClient, 'codex'>]}
                onCopy={() => {
                  copyToClipboard(mcpConfigByClient[selectedMcpClient as Exclude<typeof selectedMcpClient, 'codex'>]);
                  showStatusMessage('success', `${selectedMcpCard.title} 설정을 복사했습니다.`);
                }}
                copyLabel={`${selectedMcpCard.title} 설정 복사`}
              />
            )}
          </div>
        </div>
        </>
      )}

      <div className={`${SETTINGS_CARD_CLASS} p-4 sm:p-5`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-[#2F3440] dark:bg-[#1F2229] dark:text-gray-300">
              가이드
            </span>
            <h3 className="mt-2 text-base font-semibold text-gray-900 dark:text-white">사용법 알아보기</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              자동포스팅 예시와 현재 제공 중인 8개 스타일 가이드를 한 화면에서 확인할 수 있습니다.
            </p>
          </div>
          <button
            onClick={() => router.push('/docs/writing-styles')}
            className={`${SETTINGS_SUBTLE_BUTTON_CLASS} w-full sm:w-auto`}
          >
            사용법 보기
          </button>
        </div>
      </div>

      {createModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            onClick={closeCreateModal}
            aria-label="닫기"
          />
          <div className="relative z-10 w-full max-w-[560px] rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#1F2229] sm:p-8">
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">API 키 생성</h3>
            <div className="mt-7">
              <label
                htmlFor="api-key-name"
                className="block text-base font-medium text-gray-600 dark:text-gray-300"
              >
                키 이름
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
                placeholder="API 키의 이름을 입력하세요"
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
                취소
              </button>
              <button
                type="button"
                onClick={submitCreateModal}
                disabled={creating || !createModal.keyName.trim()}
                className="rounded-xl bg-gray-900 px-5 py-2.5 text-base font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#6D79FF] dark:hover:bg-[#5A66E4]"
              >
                {creating ? '생성 중...' : '키 생성'}
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
        title="API Key를 삭제하시겠어요?"
        description={`"${deleteDialog.keyName}" 키를 삭제하면 복원할 수 없습니다. 계속하시겠습니까?`}
        confirmText="삭제"
        cancelText="취소"
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
