'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Toast, { ToastProps } from '@/components/ui/Toast';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { useUserBlogV2 } from '@/hooks/useUserBlogV2';
import { CheckCircle2, AlertTriangle, Lightbulb, ChevronRight, ChevronDown, Copy } from 'lucide-react';

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

interface McpApiKey {
  id: string;
  keyHint: string;
  name: string;
  blogId: string;
  blogName: string;
  isActive: boolean;
  requestCount: number;
  postsCreated: number;
  expiresAt: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function ApiKeysPage() {
  const router = useRouter();
  const { blog, loading: blogLoading } = useUserBlogV2();
  const [keys, setKeys] = useState<McpApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{
    apiKey: string;
    keyHint: string;
    expiresAt: string;
  } | null>(null);
  const [selectedBlogId, setSelectedBlogId] = useState<string>('');
  const [keyName, setKeyName] = useState('My MCP Key');
  const [expandedEnv, setExpandedEnv] = useState<string | null>(null);

  // Toast 상태
  const [toast, setToast] = useState<ToastProps | null>(null);

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

  // API Keys 조회
  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await axios.get(`${API_URL}/mcp/keys`, {
        withCredentials: true,
      });

      setKeys(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const createKey = async () => {
    if (!selectedBlogId) {
      setToast({
        message: '블로그를 선택해주세요.',
        type: 'error',
      });
      return;
    }

    try {
      setCreating(true);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await axios.post(
        `${API_URL}/mcp/keys`,
        {
          blogId: selectedBlogId,
          name: keyName,
        },
        {
          withCredentials: true,
        }
      );

      setNewKey(response.data.data);
      fetchKeys(); // 목록 갱신
      setToast({
        message: 'API Key가 생성되었습니다!',
        type: 'success',
      });
    } catch (error: any) {
      console.error('Failed to create API key:', error);
      setToast({
        message: 'API Key 생성 실패: ' + (error.response?.data?.message || error.message),
        type: 'error',
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteKey = async () => {
    if (!deleteDialog.keyId) return;

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      await axios.delete(`${API_URL}/mcp/keys/${deleteDialog.keyId}`, {
        withCredentials: true,
      });

      fetchKeys(); // 목록 갱신
      setToast({
        message: 'API Key가 삭제되었습니다.',
        type: 'success',
      });
      setDeleteDialog({ isOpen: false, keyId: null, keyName: '' });
    } catch (error: any) {
      console.error('Failed to delete API key:', error);
      setToast({
        message: 'API Key 삭제 실패: ' + (error.response?.data?.message || error.message),
        type: 'error',
      });
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
    setToast({
      message: '클립보드에 복사되었습니다!',
      type: 'success',
    });
  };

  const toggleEnv = (env: string) => {
    setExpandedEnv(expandedEnv === env ? null : env);
  };

  const getMcpJsonConfig = (apiKey: string) => {
    return `{
  "mcpServers": {
    "codebase-blog-mcp": {
      "type": "http",
      "url": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`;
  };

  const getCursorConfig = (apiKey: string) => {
    return `// 설정 위치: ~/.cursor/mcp.json
{
  "mcpServers": {
    "codebase-blog-mcp": {
      "url": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`;
  };

  const getClaudeCodeConfig = (apiKey: string) => {
    return `# 터미널에서 실행
claude mcp add codebase-blog-mcp --url https://mcp.codebase.blog/mcp --header "Authorization: Bearer ${apiKey}"`;
  };

  const getWindsurfConfig = (apiKey: string) => {
    return `// 설정 위치: ~/.windsurf/mcp.json
{
  "mcpServers": {
    "codebase-blog-mcp": {
      "serverUrl": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`;
  };

  const getVSCodeConfig = (apiKey: string) => {
    return `// 설정 위치: 프로젝트 루트/.mcp.json
{
  "mcpServers": {
    "codebase-blog-mcp": {
      "url": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`;
  };

  const getGeminiConfig = (apiKey: string) => {
    return `// 설정 위치: ~/.gemini/mcp.json
{
  "mcpServers": {
    "codebase-blog-mcp": {
      "httpUrl": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}",
        "Accept": "application/json"
      }
    }
  }
}`;
  };

  const getQwenConfig = (apiKey: string) => {
    return `// 설정 위치: ~/.qwen/mcp.json
{
  "mcpServers": {
    "codebase-blog-mcp": {
      "httpUrl": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}",
        "Accept": "application/json"
      }
    }
  }
}`;
  };

  const getCodexConfig = (apiKey: string) => {
    return `# 설정 위치: ~/.config/openai/config.toml
# Streamable HTTP 서버 활성화
experimental_use_rmcp_client = true

[mcp_servers.codebase-blog-mcp]
url = "https://mcp.codebase.blog/mcp"
bearer_token = "${apiKey}"`;
  };

  // 블로그 로딩 중
  if (blogLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-6"></div>
        <div className="h-4 w-96 bg-gray-100 dark:bg-gray-600 rounded animate-pulse mb-8"></div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4"></div>
          <div className="space-y-4">
            <div className="h-10 w-full bg-gray-100 dark:bg-gray-600 rounded animate-pulse"></div>
            <div className="h-10 w-full bg-gray-100 dark:bg-gray-600 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-gray-100">MCP API Keys</h1>
      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8">
        AI 에이전트가 블로그 포스트를 자동으로 작성하기 위한 API Key를 관리합니다.
      </p>

      {/* Writing Styles 가이드 배너 */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
              Writing Styles 가이드
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
              MCP 자동포스팅 시 사용할 수 있는 다양한 글쓰기 스타일을 확인하세요.
            </p>
            <button
              onClick={() => router.push('/docs/writing-styles')}
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              스타일 가이드 보기 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* API Key 생성 섹션 */}
      {blog && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">새 API Key 생성</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                블로그 선택
              </label>
              <select
                value={selectedBlogId}
                onChange={(e) => setSelectedBlogId(e.target.value)}
                className="w-full px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-gray-500"
              >
                {userBlogs.map((blog) => (
                  <option key={blog.id} value={blog.id}>
                    {blog.name} (@{blog.slug})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                선택된 블로그: {userBlogs.find(b => b.id === selectedBlogId)?.name || '없음'}
              </p>
            </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Key 이름
            </label>
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="예: My MCP Key"
              className="w-full px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-gray-500"
            />
          </div>

          <button
            onClick={createKey}
            disabled={creating || !selectedBlogId || keys.length > 0}
            className="w-full px-4 py-2 min-h-[44px] bg-black dark:bg-gray-700 text-white rounded-md hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating
              ? '생성 중...'
              : keys.length > 0
                ? '이미 생성됨 (기존 키 삭제 후 재생성 가능)'
                : 'API Key 생성'}
          </button>

          <div className="space-y-2 mt-3">
            <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-500" />
              <p>사용자당 1개만 생성 가능합니다. 기존 키를 먼저 삭제해주세요.</p>
            </div>
            <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-500" />
              <p>API Key는 90일 후 자동 만료됩니다. 만료 전에 새 키를 생성하세요.</p>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* 새로 생성된 키 표시 (1회만) */}
      {newKey && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-start sm:items-center gap-2 mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              API Key가 생성되었습니다!
            </h2>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">API Key (1회만 표시됩니다)</p>
            <div className="relative bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded">
              <code className="block pr-12 text-xs sm:text-sm font-mono break-all text-gray-900 dark:text-gray-100">
                {newKey.apiKey}
              </code>
              <button
                onClick={() => copyToClipboard(newKey.apiKey)}
                className="absolute top-1/2 -translate-y-1/2 right-2 p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center bg-gray-700 dark:bg-gray-600 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-500 transition"
                title="복사"
                aria-label="API Key 복사"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">.mcp.json 설정 예시</p>
            <div className="relative bg-gray-900 dark:bg-gray-950 rounded overflow-hidden">
              <pre className="text-gray-100 p-3 sm:p-4 pr-12 font-mono text-[10px] sm:text-xs overflow-x-auto -webkit-overflow-scrolling-touch">{getMcpJsonConfig('[YOUR-API-KEY]')}</pre>
              <button
                onClick={() => copyToClipboard(getMcpJsonConfig(newKey.apiKey))}
                className="absolute top-2 right-2 p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center bg-gray-700 dark:bg-gray-600 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-500 transition"
                title="복사"
                aria-label="설정 복사"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 기존 키 목록 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">내 API Keys</h2>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">로딩 중...</p>
        ) : keys.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">생성된 API Key가 없습니다.</p>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {keys.map((key) => (
              <div
                key={key.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 hover:border-gray-300 dark:hover:border-gray-600 transition bg-white dark:bg-gray-800"
              >
                <div className="flex flex-col sm:flex-row items-start justify-between mb-3 gap-2 sm:gap-0">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{key.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {key.blogName} • blog_sk_{key.keyHint}_***
                    </p>
                  </div>
                  <button
                    onClick={() => openDeleteDialog(key.id, key.name)}
                    className="w-full sm:w-auto px-3 py-2 min-h-[44px] text-sm text-red-600 dark:text-red-400 border border-red-600 dark:border-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    삭제
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">총 도구 호출</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{key.requestCount.toLocaleString()}회</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">생성된 포스트</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{key.postsCreated.toLocaleString()}개</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">만료일</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {new Date(key.expiresAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">마지막 사용</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleDateString('ko-KR')
                        : '사용 안 함'}
                    </p>
                  </div>
                </div>

                {!key.isActive && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">⚠️ 비활성화됨</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MCP 설정 가이드 (항상 표시) */}
      <div className="mt-6 sm:mt-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          MCP 설정 가이드
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
          사용 중인 AI 에이전트를 선택하여 설정 방법을 확인하세요. 생성한 API Key를 <code className="bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 text-xs rounded">[YOUR-API-KEY]</code> 위치에 입력하세요.
        </p>

        <div className="space-y-2">
          {/* Cursor */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleEnv('cursor')}
              className={`w-full flex items-center justify-between p-3 sm:p-4 min-h-[44px] transition ${
                expandedEnv === 'cursor'
                  ? 'bg-orange-500 dark:bg-orange-500'
                  : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {expandedEnv === 'cursor' ? (
                  <ChevronDown className={`w-5 h-5 ${expandedEnv === 'cursor' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${expandedEnv === 'cursor' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                )}
                <span className={`font-semibold ${expandedEnv === 'cursor' ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>Cursor</span>
              </div>
            </button>
            {expandedEnv === 'cursor' && (
              <div className="relative bg-gray-900 dark:bg-gray-900 p-3 sm:p-4 overflow-hidden">
                <pre className="text-gray-100 pr-12 font-mono text-[10px] sm:text-xs overflow-x-auto -webkit-overflow-scrolling-touch">{getCursorConfig('[YOUR-API-KEY]')}</pre>
                <button
                  onClick={() => copyToClipboard(getCursorConfig('[YOUR-API-KEY]'))}
                  className="absolute top-2 right-2 p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center bg-gray-700 dark:bg-gray-700 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition"
                  title="복사"
                  aria-label="Cursor 설정 복사"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Claude Code */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleEnv('claude-code')}
              className={`w-full flex items-center justify-between p-3 sm:p-4 min-h-[44px] transition ${
                expandedEnv === 'claude-code'
                  ? 'bg-orange-500 dark:bg-orange-500'
                  : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {expandedEnv === 'claude-code' ? (
                  <ChevronDown className={`w-5 h-5 ${expandedEnv === 'claude-code' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${expandedEnv === 'claude-code' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                )}
                <span className={`font-semibold ${expandedEnv === 'claude-code' ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>Claude Code</span>
              </div>
            </button>
            {expandedEnv === 'claude-code' && (
              <div className="relative bg-gray-900 dark:bg-gray-900 p-3 pb-4 sm:p-4 sm:pb-6 overflow-hidden">
                <pre className="text-gray-100 pr-12 pb-3 font-mono text-[10px] sm:text-xs overflow-x-auto -webkit-overflow-scrolling-touch [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-gray-800 [&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-500">{getClaudeCodeConfig('[YOUR-API-KEY]')}</pre>
                <button
                  onClick={() => copyToClipboard(getClaudeCodeConfig('[YOUR-API-KEY]'))}
                  className="absolute top-2 right-2 p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center bg-gray-700 dark:bg-gray-700 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition"
                  title="복사"
                  aria-label="Claude Code 설정 복사"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Windsurf */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleEnv('windsurf')}
              className={`w-full flex items-center justify-between p-3 sm:p-4 min-h-[44px] transition ${
                expandedEnv === 'windsurf'
                  ? 'bg-orange-500 dark:bg-orange-500'
                  : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {expandedEnv === 'windsurf' ? (
                  <ChevronDown className={`w-5 h-5 ${expandedEnv === 'windsurf' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${expandedEnv === 'windsurf' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                )}
                <span className={`font-semibold ${expandedEnv === 'windsurf' ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>Windsurf</span>
              </div>
            </button>
            {expandedEnv === 'windsurf' && (
              <div className="relative bg-gray-900 dark:bg-gray-900 p-3 sm:p-4 overflow-hidden">
                <pre className="text-gray-100 pr-12 font-mono text-[10px] sm:text-xs overflow-x-auto -webkit-overflow-scrolling-touch">{getWindsurfConfig('[YOUR-API-KEY]')}</pre>
                <button
                  onClick={() => copyToClipboard(getWindsurfConfig('[YOUR-API-KEY]'))}
                  className="absolute top-2 right-2 p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center bg-gray-700 dark:bg-gray-700 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition"
                  title="복사"
                  aria-label="Windsurf 설정 복사"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* VS Code */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleEnv('vscode')}
              className={`w-full flex items-center justify-between p-3 sm:p-4 min-h-[44px] transition ${
                expandedEnv === 'vscode'
                  ? 'bg-orange-500 dark:bg-orange-500'
                  : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {expandedEnv === 'vscode' ? (
                  <ChevronDown className={`w-5 h-5 ${expandedEnv === 'vscode' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${expandedEnv === 'vscode' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                )}
                <span className={`font-semibold ${expandedEnv === 'vscode' ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>VS Code (Cline, Continue 등)</span>
              </div>
            </button>
            {expandedEnv === 'vscode' && (
              <div className="relative bg-gray-900 dark:bg-gray-900 p-3 sm:p-4 overflow-hidden">
                <pre className="text-gray-100 pr-12 font-mono text-[10px] sm:text-xs overflow-x-auto -webkit-overflow-scrolling-touch">{getVSCodeConfig('[YOUR-API-KEY]')}</pre>
                <button
                  onClick={() => copyToClipboard(getVSCodeConfig('[YOUR-API-KEY]'))}
                  className="absolute top-2 right-2 p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center bg-gray-700 dark:bg-gray-700 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition"
                  title="복사"
                  aria-label="VS Code 설정 복사"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Gemini CLI */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleEnv('gemini')}
              className={`w-full flex items-center justify-between p-3 sm:p-4 min-h-[44px] transition ${
                expandedEnv === 'gemini'
                  ? 'bg-orange-500 dark:bg-orange-500'
                  : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {expandedEnv === 'gemini' ? (
                  <ChevronDown className={`w-5 h-5 ${expandedEnv === 'gemini' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${expandedEnv === 'gemini' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                )}
                <span className={`font-semibold ${expandedEnv === 'gemini' ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>Gemini CLI</span>
              </div>
            </button>
            {expandedEnv === 'gemini' && (
              <div className="relative bg-gray-900 dark:bg-gray-900 p-3 sm:p-4 overflow-hidden">
                <pre className="text-gray-100 pr-12 font-mono text-[10px] sm:text-xs overflow-x-auto -webkit-overflow-scrolling-touch">{getGeminiConfig('[YOUR-API-KEY]')}</pre>
                <button
                  onClick={() => copyToClipboard(getGeminiConfig('[YOUR-API-KEY]'))}
                  className="absolute top-2 right-2 p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center bg-gray-700 dark:bg-gray-700 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition"
                  title="복사"
                  aria-label="Gemini CLI 설정 복사"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Qwen Coder */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleEnv('qwen')}
              className={`w-full flex items-center justify-between p-3 sm:p-4 min-h-[44px] transition ${
                expandedEnv === 'qwen'
                  ? 'bg-orange-500 dark:bg-orange-500'
                  : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {expandedEnv === 'qwen' ? (
                  <ChevronDown className={`w-5 h-5 ${expandedEnv === 'qwen' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${expandedEnv === 'qwen' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                )}
                <span className={`font-semibold ${expandedEnv === 'qwen' ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>Qwen Coder</span>
              </div>
            </button>
            {expandedEnv === 'qwen' && (
              <div className="relative bg-gray-900 dark:bg-gray-900 p-3 sm:p-4 overflow-hidden">
                <pre className="text-gray-100 pr-12 font-mono text-[10px] sm:text-xs overflow-x-auto -webkit-overflow-scrolling-touch">{getQwenConfig('[YOUR-API-KEY]')}</pre>
                <button
                  onClick={() => copyToClipboard(getQwenConfig('[YOUR-API-KEY]'))}
                  className="absolute top-2 right-2 p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center bg-gray-700 dark:bg-gray-700 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition"
                  title="복사"
                  aria-label="Qwen Coder 설정 복사"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* OpenAI Codex */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleEnv('codex')}
              className={`w-full flex items-center justify-between p-3 sm:p-4 min-h-[44px] transition ${
                expandedEnv === 'codex'
                  ? 'bg-orange-500 dark:bg-orange-500'
                  : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {expandedEnv === 'codex' ? (
                  <ChevronDown className={`w-5 h-5 ${expandedEnv === 'codex' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${expandedEnv === 'codex' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                )}
                <span className={`font-semibold ${expandedEnv === 'codex' ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>OpenAI Codex</span>
              </div>
            </button>
            {expandedEnv === 'codex' && (
              <div className="relative bg-gray-900 dark:bg-gray-900 p-3 pb-4 sm:p-4 sm:pb-6 overflow-hidden">
                <pre className="text-gray-100 pr-12 font-mono text-[10px] sm:text-xs overflow-x-auto -webkit-overflow-scrolling-touch">{getCodexConfig('[YOUR-API-KEY]')}</pre>
                <button
                  onClick={() => copyToClipboard(getCodexConfig('[YOUR-API-KEY]'))}
                  className="absolute top-2 right-2 p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center bg-gray-700 dark:bg-gray-700 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition"
                  title="복사"
                  aria-label="OpenAI Codex 설정 복사"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast 알림 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => setToast(null)}
        />
      )}

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
