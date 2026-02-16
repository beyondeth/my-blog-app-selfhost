'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { useUserBlogV2 } from '@/hooks/useUserBlogV2';
import { CheckCircle2, AlertTriangle, Lightbulb, ChevronRight, ChevronDown, Copy, X } from 'lucide-react';
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_INPUT_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
  SETTINGS_SUBTLE_BUTTON_CLASS,
  SETTINGS_BUTTON_BASE_CLASS,
} from '@/app/settings/theme';
import { DESTRUCTIVE_ACTION_CLASS, DESTRUCTIVE_BORDER_CLASS } from '@/constants/accessibility';
import { useMcpApiKeys } from './useMcpApiKeys';
import type { CreateMcpApiKeyResponse, McpApiKey } from '@/services/api/mcp.service';
import { createMcpApiKey, deleteMcpApiKey } from '@/services/api/mcp.service';
import {
  getClaudeCodeConfig,
  getCodexConfig,
  getCodexEnvSnippet,
  getMcporterOAuthSnippet,
  getMcporterSetupSnippet,
  getMcporterUsageSnippet,
  getCodexWindowsEnvSnippet,
  getCodexWindowsPersistentSnippet,
  getCursorConfig,
  getGeminiConfig,
  getMcpJsonConfig,
  getQwenConfig,
  getVSCodeConfig,
  getWindsurfConfig,
} from './configSnippets';
import { CodeSnippetBlock } from './CodeSnippetBlock';

/**
 * MCP API Key 관리 페이지
 *
 * 기능:
 * - API Key 생성 (1회만 표시)
 * - 기존 키 목록 (hint만 표시)
 * - 키 삭제
 * - 사용 통계 (requestCount, postsCreated)
 * - .mcp.json 설정 가이드
 */

export default function ApiKeysPage() {
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
  const [keyName, setKeyName] = useState('My MCP Key');
  const [expandedEnv, setExpandedEnv] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newKeyCopied, setNewKeyCopied] = useState(false);
  const copyFeedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showStatusMessage = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
  };

  // 삭제 확인 다이얼로그 상태
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    keyId: string | null;
    keyName: string;
  }>({
    isOpen: false,
    keyId: null,
    keyName: '',
  });

  // 블로그 데이터를 배열로 변환 (기존 코드 호환성)
  const userBlogs = blog ? [blog] : [];

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
    setNewKeyCopied(false);
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

  const createKey = async () => {
    if (!selectedBlogId) {
      showStatusMessage('error', '블로그를 선택해주세요.');
      return;
    }

    try {
      setCreating(true);
      const created = await createMcpApiKey({
        blogId: selectedBlogId,
        name: keyName,
      });
      setNewKey(created);
      await refreshKeys();
      showStatusMessage('success', 'API Key가 생성되었습니다! 생성된 키는 이 화면에서만 다시 확인할 수 있습니다.');
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

  const deleteKey = async () => {
    if (!deleteDialog.keyId) return;

    try {
      await deleteMcpApiKey(deleteDialog.keyId);
      removeKeyLocally(deleteDialog.keyId);
      showStatusMessage('success', 'API Key가 삭제되었습니다.');
      setDeleteDialog({ isOpen: false, keyId: null, keyName: '' });
    } catch (error: any) {
      console.error('Failed to delete API key:', error);
      const message =
        error?.message ||
        error?.response?.data?.message ||
        '알 수 없는 오류가 발생했습니다.';
      showStatusMessage('error', 'API Key 삭제 실패: ' + message);
    }
  };

  const openDeleteDialog = (keyId: string, keyName: string) => {
    setDeleteDialog({
      isOpen: true,
      keyId,
      keyName,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const copyNewKeyToClipboard = (text: string) => {
    copyToClipboard(text);
    setNewKeyCopied(true);
    if (copyFeedbackTimeout.current) {
      clearTimeout(copyFeedbackTimeout.current);
    }
    copyFeedbackTimeout.current = setTimeout(() => {
      setNewKeyCopied(false);
      copyFeedbackTimeout.current = null;
    }, 2000);
  };

  const toggleEnv = (env: string) => {
    setExpandedEnv(expandedEnv === env ? null : env);
  };

  const closeNewKey = () => {
    setNewKey(null);
  };

  // 현재 사용 가능한 API Key 가져오기 (newKey 우선, 없으면 placeholder)
  const getCurrentApiKey = () => {
    return newKey?.apiKey || '[YOUR-API-KEY]';
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">MCP API Keys</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">
            AI 에이전트용 API Key를 생성하고 사용 가이드를 확인하세요.
          </p>
        </div>

        {/* Writing Styles 가이드 배너 */}
        <div className={`${SETTINGS_CARD_CLASS} flex items-start gap-3 p-4 sm:p-5`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/10">
            <Lightbulb className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Writing Styles 가이드</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300 mb-3">MCP 자동 포스팅에 활용할 수 있는 글쓰기 스타일을 확인하세요.</p>
            <button
              onClick={() => router.push('/docs/writing-styles')}
              className={`${SETTINGS_SUBTLE_BUTTON_CLASS} w-full sm:w-auto`}
            >
              스타일 가이드 보기
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
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

        {/* API Key 생성 섹션 */}
        {blog && (
          <div className={`${SETTINGS_CARD_CLASS} p-4 sm:p-6 space-y-4`}>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">새 API Key 생성</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300 mt-1">한 번에 하나의 키만 발급할 수 있습니다.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">블로그 선택</label>
                <select
                  value={selectedBlogId}
                  onChange={(e) => setSelectedBlogId(e.target.value)}
                  className={`${SETTINGS_INPUT_CLASS} appearance-none pr-10`}
                >
                  {userBlogs.map((blog) => (
                    <option key={blog.id} value={blog.id}>
                      {blog.name} (@{blog.alias || blog.slug})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-300 dark:text-gray-300 mt-1">
                  선택된 블로그: {userBlogs.find(b => b.id === selectedBlogId)?.name || '없음'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Key 이름</label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="예: My MCP Key"
                  className={SETTINGS_INPUT_CLASS}
                />
              </div>

              <button
                onClick={createKey}
                disabled={creating || !selectedBlogId || keys.length > 0}
                className={`${SETTINGS_PRIMARY_BUTTON_CLASS} w-full`}
              >
                {creating ? '생성 중...' : keys.length > 0 ? '이미 생성됨 (기존 키 삭제 후 재생성 가능)' : 'API Key 생성'}
              </button>

              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                  <p>사용자당 1개만 생성 가능합니다. 기존 키를 먼저 삭제해주세요.</p>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">
                  <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-500" />
                  <p>API Key는 90일 후 자동 만료되며, 만료 전에 새 키를 생성할 수 있습니다.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 새로 생성된 키 표시 (1회만) */}
        {newKey && (
          <div className={`${SETTINGS_CARD_CLASS} p-4 sm:p-6 space-y-4`}>
            <div className="flex items-start sm:items-center justify-between gap-2">
              <div className="flex items-start sm:items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">API Key가 생성되었습니다!</h2>
              </div>
              <button
                onClick={closeNewKey}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-300 transition"
                title="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300 mb-2">API Key</p>
              <div className="relative rounded-xl border border-gray-200 dark:border-[#2F3440] bg-gray-50 dark:bg-[#1F1F27] px-3 py-2">
                <code className="block pr-12 text-xs sm:text-sm font-mono break-all text-gray-900 dark:text-gray-100">{newKey.apiKey}</code>
                <button
                  onClick={() => copyNewKeyToClipboard(newKey.apiKey)}
                  className={`${SETTINGS_SUBTLE_BUTTON_CLASS} absolute top-1/2 right-2 -translate-y-1/2 min-w-[36px] min-h-[36px] px-2 flex items-center justify-center ${
                    newKeyCopied ? 'bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-500 transition-none' : ''
                  }`}
                  title={newKeyCopied ? '복사 완료' : '복사'}
                  aria-label={newKeyCopied ? 'API Key 복사 완료' : 'API Key 복사'}
                >
                  {newKeyCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300 mb-2">.mcp.json 설정 예시</p>
                <CodeSnippetBlock
                  code={getMcpJsonConfig(getCurrentApiKey())}
                  onCopy={() => copyToClipboard(getMcpJsonConfig(getCurrentApiKey()))}
                  containerClassName="rounded-2xl bg-[#11111A] dark:bg-black overflow-hidden"
                  preClassName="sm:p-4 text-[11px] sm:text-xs"
                  buttonClassName="rounded-lg bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20 transition"
                  buttonContent="복사"
                  copyTitle="복사"
                  copyAriaLabel="설정 복사"
                />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300 mb-2">.claude.json 설정 예시</p>
                <CodeSnippetBlock
                  code={getMcpJsonConfig(getCurrentApiKey())}
                  onCopy={() => copyToClipboard(getMcpJsonConfig(getCurrentApiKey()))}
                  containerClassName="rounded-2xl bg-[#11111A] dark:bg-black overflow-hidden"
                  preClassName="sm:p-4 text-[11px] sm:text-xs"
                  buttonClassName="rounded-lg bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20 transition"
                  buttonContent="복사"
                  copyTitle="복사"
                  copyAriaLabel="설정 복사"
                />
              </div>
            </div>
          </div>
        )}

      {/* 기존 키 목록 */}
        <div className={`${SETTINGS_CARD_CLASS} p-4 sm:p-6 space-y-4`}>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">내 API Keys</h2>

          {keysLoading ? (
            <p className="text-gray-500 dark:text-gray-300 dark:text-gray-300">로딩 중...</p>
          ) : keys.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-300 dark:text-gray-300">생성된 API Key가 없습니다.</p>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] dark:bg-[#141c2b] dark:border-[#242a38] hover:border-gray-200 dark:hover:border-[#30394c] transition"
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{key.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">
                        {key.blogName} • blog_sk_{key.keyHint}_***
                      </p>
                    </div>
                    <button
                      onClick={() => openDeleteDialog(key.id, key.name)}
                      className={`${SETTINGS_BUTTON_BASE_CLASS} w-full sm:w-auto ${DESTRUCTIVE_BORDER_CLASS} ${DESTRUCTIVE_ACTION_CLASS}`}
                    >
                      삭제
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-300 dark:text-gray-300">총 도구 호출</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{key.requestCount.toLocaleString()}회</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-300 dark:text-gray-300">생성된 포스트</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{key.postsCreated.toLocaleString()}개</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-300 dark:text-gray-300">만료일</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{new Date(key.expiresAt).toLocaleDateString('ko-KR')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-300 dark:text-gray-300">마지막 사용</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString('ko-KR') : '사용 안 함'}
                      </p>
                    </div>
                  </div>

                  {!key.isActive && <p className="mt-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">⚠️ 비활성화됨</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      {/* MCP 설정 가이드 (항상 표시) */}
      <div className={`${SETTINGS_CARD_CLASS} p-4 sm:p-6 space-y-4`}>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">MCP 설정 가이드</h2>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300 mb-4">
          사용 중인 AI 에이전트를 선택하여 설정 방법을 확인하세요. API Key가 자동으로 입력됩니다. 복사 버튼을 클릭하여 설정을 복사하세요.
        </p>

        <div className="space-y-2">
          {/* Cursor */}
          <div className="border border-gray-200 dark:border-[#2F3440] rounded-lg overflow-hidden">
            <button
              onClick={() => toggleEnv('cursor')}
              className={`w-full flex items-center justify-between p-3 sm:p-4 min-h-[44px] transition ${
                expandedEnv === 'cursor'
                  ? 'bg-gray-900 text-white dark:bg-[#6D79FF] dark:text-white'
                  : 'bg-gray-50 dark:bg-[#1F2229] hover:bg-gray-100 dark:hover:bg-[#272C36] text-gray-900 dark:text-gray-100'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {expandedEnv === 'cursor' ? (
                  <ChevronDown className={`w-5 h-5 ${expandedEnv === 'cursor' ? 'text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${expandedEnv === 'cursor' ? 'text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'}`} />
                )}
                <span className={`font-semibold ${expandedEnv === 'cursor' ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>Cursor</span>
              </div>
            </button>
            {expandedEnv === 'cursor' && (
              <CodeSnippetBlock
                code={getCursorConfig(getCurrentApiKey())}
                onCopy={() => copyToClipboard(getCursorConfig(getCurrentApiKey(), false))}
                containerClassName="bg-gray-900 dark:bg-gray-900 p-3 sm:p-4 overflow-hidden"
                copyTitle="복사"
                copyAriaLabel="Cursor 설정 복사"
              />
            )}
          </div>

          {/* Claude Code */}
          <div className="border border-gray-200 dark:border-[#2F3440] rounded-lg overflow-hidden">
            <button
              onClick={() => toggleEnv('claude-code')}
              className={`w-full flex items-center justify-between p-3 sm:p-4 min-h-[44px] transition ${
                expandedEnv === 'claude-code'
                  ? 'bg-gray-900 text-white dark:bg-[#6D79FF] dark:text-white'
                  : 'bg-gray-50 dark:bg-[#1F2229] hover:bg-gray-100 dark:hover:bg-[#272C36] text-gray-900 dark:text-gray-100'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {expandedEnv === 'claude-code' ? (
                  <ChevronDown className={`w-5 h-5 ${expandedEnv === 'claude-code' ? 'text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${expandedEnv === 'claude-code' ? 'text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'}`} />
                )}
                <span className={`font-semibold ${expandedEnv === 'claude-code' ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>Claude Code</span>
              </div>
            </button>
            {expandedEnv === 'claude-code' && (
              <CodeSnippetBlock
                code={getClaudeCodeConfig(getCurrentApiKey())}
                onCopy={() => copyToClipboard(getClaudeCodeConfig(getCurrentApiKey(), false))}
                containerClassName="bg-gray-900 dark:bg-gray-900 p-3 pb-4 sm:p-4 sm:pb-6 overflow-hidden"
                preClassName="pb-3 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-gray-800 [&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-500"
                copyTitle="복사"
                copyAriaLabel="Claude Code 설정 복사"
              />
            )}
          </div>

          {/* Windsurf */}
          <div className="border border-gray-200 dark:border-[#2F3440] rounded-lg overflow-hidden">
            <button
              onClick={() => toggleEnv('windsurf')}
              className={`w-full flex items-center justify-between p-3 sm:p-4 min-h-[44px] transition ${
                expandedEnv === 'windsurf'
                  ? 'bg-gray-900 text-white dark:bg-[#6D79FF] dark:text-white'
                  : 'bg-gray-50 dark:bg-[#1F2229] hover:bg-gray-100 dark:hover:bg-[#272C36] text-gray-900 dark:text-gray-100'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {expandedEnv === 'windsurf' ? (
                  <ChevronDown className={`w-5 h-5 ${expandedEnv === 'windsurf' ? 'text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${expandedEnv === 'windsurf' ? 'text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'}`} />
                )}
                <span className={`font-semibold ${expandedEnv === 'windsurf' ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>Windsurf</span>
              </div>
            </button>
            {expandedEnv === 'windsurf' && (
              <CodeSnippetBlock
                code={getWindsurfConfig(getCurrentApiKey())}
                onCopy={() => copyToClipboard(getWindsurfConfig(getCurrentApiKey(), false))}
                containerClassName="bg-gray-900 dark:bg-gray-900 p-3 sm:p-4 overflow-hidden"
                copyTitle="복사"
                copyAriaLabel="Windsurf 설정 복사"
              />
            )}
          </div>

          {/* VS Code */}
          <div className="border border-gray-200 dark:border-[#2F3440] rounded-lg overflow-hidden">
            <button
              onClick={() => toggleEnv('vscode')}
              className={`w-full flex items-center justify-between p-3 sm:p-4 min-h-[44px] transition ${
                expandedEnv === 'vscode'
                  ? 'bg-gray-900 text-white dark:bg-[#6D79FF] dark:text-white'
                  : 'bg-gray-50 dark:bg-[#1F2229] hover:bg-gray-100 dark:hover:bg-[#272C36] text-gray-900 dark:text-gray-100'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {expandedEnv === 'vscode' ? (
                  <ChevronDown className={`w-5 h-5 ${expandedEnv === 'vscode' ? 'text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${expandedEnv === 'vscode' ? 'text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'}`} />
                )}
                <span className={`font-semibold ${expandedEnv === 'vscode' ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>VS Code (Cline, Continue 등)</span>
              </div>
            </button>
            {expandedEnv === 'vscode' && (
              <CodeSnippetBlock
                code={getVSCodeConfig(getCurrentApiKey())}
                onCopy={() => copyToClipboard(getVSCodeConfig(getCurrentApiKey(), false))}
                containerClassName="bg-gray-900 dark:bg-gray-900 p-3 sm:p-4 overflow-hidden"
                copyTitle="복사"
                copyAriaLabel="VS Code 설정 복사"
              />
            )}
          </div>

          {/* Gemini CLI */}
          <div className="border border-gray-200 dark:border-[#2F3440] rounded-lg overflow-hidden">
            <button
              onClick={() => toggleEnv('gemini')}
              className={`w-full flex items-center justify-between p-3 sm:p-4 min-h-[44px] transition ${
                expandedEnv === 'gemini'
                  ? 'bg-gray-900 text-white dark:bg-[#6D79FF] dark:text-white'
                  : 'bg-gray-50 dark:bg-[#1F2229] hover:bg-gray-100 dark:hover:bg-[#272C36] text-gray-900 dark:text-gray-100'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {expandedEnv === 'gemini' ? (
                  <ChevronDown className={`w-5 h-5 ${expandedEnv === 'gemini' ? 'text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${expandedEnv === 'gemini' ? 'text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'}`} />
                )}
                <span className={`font-semibold ${expandedEnv === 'gemini' ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>Gemini CLI</span>
              </div>
            </button>
            {expandedEnv === 'gemini' && (
              <CodeSnippetBlock
                code={getGeminiConfig(getCurrentApiKey())}
                onCopy={() => copyToClipboard(getGeminiConfig(getCurrentApiKey(), false))}
                containerClassName="bg-gray-900 dark:bg-gray-900 p-3 sm:p-4 overflow-hidden"
                copyTitle="복사"
                copyAriaLabel="Gemini CLI 설정 복사"
              />
            )}
          </div>

          {/* Qwen Coder */}
          <div className="border border-gray-200 dark:border-[#2F3440] rounded-lg overflow-hidden">
            <button
              onClick={() => toggleEnv('qwen')}
              className={`w-full flex items-center justify-between p-3 sm:p-4 min-h-[44px] transition ${
                expandedEnv === 'qwen'
                  ? 'bg-gray-900 text-white dark:bg-[#6D79FF] dark:text-white'
                  : 'bg-gray-50 dark:bg-[#1F2229] hover:bg-gray-100 dark:hover:bg-[#272C36] text-gray-900 dark:text-gray-100'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {expandedEnv === 'qwen' ? (
                  <ChevronDown className={`w-5 h-5 ${expandedEnv === 'qwen' ? 'text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${expandedEnv === 'qwen' ? 'text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'}`} />
                )}
                <span className={`font-semibold ${expandedEnv === 'qwen' ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>Qwen Coder</span>
              </div>
            </button>
            {expandedEnv === 'qwen' && (
              <CodeSnippetBlock
                code={getQwenConfig(getCurrentApiKey())}
                onCopy={() => copyToClipboard(getQwenConfig(getCurrentApiKey(), false))}
                containerClassName="bg-gray-900 dark:bg-gray-900 p-3 sm:p-4 overflow-hidden"
                copyTitle="복사"
                copyAriaLabel="Qwen Coder 설정 복사"
              />
            )}
          </div>

          {/* MCPorter */}
          <div className="border border-gray-200 dark:border-[#2F3440] rounded-lg overflow-hidden">
            <button
              onClick={() => toggleEnv('mcporter')}
              className={`w-full flex items-center justify-between p-3 sm:p-4 min-h-[44px] transition ${
                expandedEnv === 'mcporter'
                  ? 'bg-gray-900 text-white dark:bg-[#6D79FF] dark:text-white'
                  : 'bg-gray-50 dark:bg-[#1F2229] hover:bg-gray-100 dark:hover:bg-[#272C36] text-gray-900 dark:text-gray-100'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {expandedEnv === 'mcporter' ? (
                  <ChevronDown className={`w-5 h-5 ${expandedEnv === 'mcporter' ? 'text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${expandedEnv === 'mcporter' ? 'text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'}`} />
                )}
                <span className={`font-semibold ${expandedEnv === 'mcporter' ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>MCPorter (CLI)</span>
              </div>
            </button>
            {expandedEnv === 'mcporter' && (
              <div className="bg-gray-900 dark:bg-gray-900 p-3 sm:p-4 space-y-5 overflow-hidden">
                <p className="text-xs sm:text-sm text-gray-400">
                  MCPorter는 MCP 서버를 일반 명령어처럼 다루는 CLI입니다. OAuth 1회 연결 후에는 `mcporter call ...`만으로 자동포스팅을 실행할 수 있습니다.
                  로그인 화면이 보이지 않으면 기존 codebase.blog 로그인 세션으로 자동 승인된 상태일 수 있습니다.
                </p>
                <div>
                  <p className="text-xs sm:text-sm text-gray-300 mb-2">
                    1. OAuth 초기 설정 (서버 등록 + 브라우저 인증)
                  </p>
                  <CodeSnippetBlock
                    code={getMcporterSetupSnippet(getCurrentApiKey())}
                    onCopy={() => copyToClipboard(getMcporterSetupSnippet(getCurrentApiKey(), false))}
                    containerClassName="bg-gray-950 dark:bg-black rounded"
                    preClassName="p-3"
                    copyTitle="초기 설정 복사"
                    copyAriaLabel="MCPorter 초기 설정 복사"
                  />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-300 mb-2">
                    2. 실제 사용 명령
                  </p>
                  <CodeSnippetBlock
                    code={getMcporterUsageSnippet()}
                    onCopy={() => copyToClipboard(getMcporterUsageSnippet(false))}
                    containerClassName="bg-gray-950 dark:bg-black rounded"
                    preClassName="p-3"
                    copyTitle="사용 명령 복사"
                    copyAriaLabel="MCPorter 사용 명령 복사"
                  />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-300 mb-2">
                    3. API Key 모드가 필요한 경우 (선택)
                  </p>
                  <CodeSnippetBlock
                    code={getMcporterOAuthSnippet(getCurrentApiKey())}
                    onCopy={() => copyToClipboard(getMcporterOAuthSnippet(getCurrentApiKey(), false))}
                    containerClassName="bg-gray-950 dark:bg-black rounded"
                    preClassName="p-3"
                    copyTitle="API Key 설정 복사"
                    copyAriaLabel="MCPorter API Key 설정 복사"
                  />
                </div>
              </div>
            )}
          </div>

          {/* OpenAI Codex */}
          <div className="border border-gray-200 dark:border-[#2F3440] rounded-lg overflow-hidden">
            <button
              onClick={() => toggleEnv('codex')}
              className={`w-full flex items-center justify-between p-3 sm:p-4 min-h-[44px] transition ${
                expandedEnv === 'codex'
                  ? 'bg-gray-900 text-white dark:bg-[#6D79FF] dark:text-white'
                  : 'bg-gray-50 dark:bg-[#1F2229] hover:bg-gray-100 dark:hover:bg-[#272C36] text-gray-900 dark:text-gray-100'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {expandedEnv === 'codex' ? (
                  <ChevronDown className={`w-5 h-5 ${expandedEnv === 'codex' ? 'text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${expandedEnv === 'codex' ? 'text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-300'}`} />
                )}
                <span className={`font-semibold ${expandedEnv === 'codex' ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>OpenAI Codex</span>
              </div>
            </button>
            {expandedEnv === 'codex' && (
              <div className="bg-gray-900 dark:bg-gray-900 p-3 sm:p-4 space-y-5 overflow-hidden">
                <p className="text-xs sm:text-sm text-gray-400">
                  아래 단계 중 <span className="text-gray-100 font-medium">사용 중인 OS 한 가지</span>에 해당하는 환경 변수 설정만 적용하면 됩니다.
                </p>
                <div>
                  <p className="text-xs sm:text-sm text-gray-300 mb-2">
                    1. <span className="text-white font-medium">macOS / Linux 사용자 전용</span> (~/.zshrc 또는 ~/.bashrc). 아래 코드 블록 전체를 해당 파일에 붙여넣고 저장한 뒤 새 터미널을 열거나{' '}
                    <span className="font-mono">source ~/.zshrc</span>로 반영하세요.
                  </p>
                  <CodeSnippetBlock
                    code={getCodexEnvSnippet(getCurrentApiKey())}
                    onCopy={() => copyToClipboard(getCodexEnvSnippet(getCurrentApiKey(), false))}
                    containerClassName="bg-gray-950 dark:bg-black rounded"
                    preClassName="p-3"
                    copyTitle="환경 변수 복사"
                    copyAriaLabel="코덱스 환경 변수 설정 복사"
                  />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-300 mb-2">
                    2. <span className="text-white font-medium">Windows 사용자 전용</span>. PowerShell을 관리자 없이 실행한 뒤, 아래 두 명령을 순서대로 붙여넣어 실행하세요. 첫 블록은 현재 세션에서 즉시 사용하도록 하고, 두 번째 블록(<span className="font-mono">setx</span>)은 새 터미널에서도 유지되도록 시스템 환경 변수에 등록합니다.
                  </p>
                  <div className="space-y-3">
                    <CodeSnippetBlock
                      code={getCodexWindowsEnvSnippet(getCurrentApiKey())}
                      onCopy={() => copyToClipboard(getCodexWindowsEnvSnippet(getCurrentApiKey(), false))}
                      containerClassName="bg-gray-950 dark:bg-black rounded"
                      preClassName="p-3"
                      copyTitle="Windows 현재 세션 명령 복사"
                      copyAriaLabel="OpenAI Codex Windows 현재 세션 명령 복사"
                    />
                    <CodeSnippetBlock
                      code={getCodexWindowsPersistentSnippet(getCurrentApiKey())}
                      onCopy={() => copyToClipboard(getCodexWindowsPersistentSnippet(getCurrentApiKey(), false))}
                      containerClassName="bg-gray-950 dark:bg-black rounded"
                      preClassName="p-3"
                      copyTitle="Windows setx 명령 복사"
                      copyAriaLabel="OpenAI Codex Windows setx 명령 복사"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-300 mb-2">
                    3. 모든 OS 공통: Codex CLI 설정 (~/.codex/config.toml). 기존 파일이 있다면 아래 블록만 추가하면 됩니다.
                  </p>
                  <CodeSnippetBlock
                    code={getCodexConfig(getCurrentApiKey())}
                    onCopy={() => copyToClipboard(getCodexConfig(getCurrentApiKey(), false))}
                    containerClassName="bg-gray-950 dark:bg-black rounded"
                    preClassName="p-3"
                    copyTitle="Codex 설정 복사"
                    copyAriaLabel="OpenAI Codex 설정 복사"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, keyId: null, keyName: '' })}
        onConfirm={deleteKey}
        title="API Key를 삭제하시겠어요?"
        description={`"${deleteDialog.keyName}" 키를 삭제하면 복원할 수 없습니다. 계속하시겠습니까?`}
        confirmText="삭제"
        cancelText="취소"
      />
    </div>
  );
}
