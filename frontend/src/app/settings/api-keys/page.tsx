'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Toast, { ToastProps } from '@/components/ui/Toast';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { useUserBlogV2 } from '@/hooks/useUserBlogV2';

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

  const getMcpJsonConfig = (apiKey: string) => {
    return `{
  "mcpServers": {
    "codebase-blog-mcp": {
      "type": "http",
      "url": "http://localhost:3002/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`;
  };

  // 블로그 로딩 중
  if (blogLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
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
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">MCP API Keys</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Claude Code에서 블로그 포스트를 자동으로 작성하기 위한 API Key를 관리합니다.
      </p>

      {/* API Key 생성 섹션 */}
      {blog && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">새 API Key 생성</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                블로그 선택
              </label>
              <select
                value={selectedBlogId}
                onChange={(e) => setSelectedBlogId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-gray-500"
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-gray-500"
            />
          </div>

          <button
            onClick={createKey}
            disabled={creating || !selectedBlogId || keys.length > 0}
            className="w-full px-4 py-2 bg-black dark:bg-gray-700 text-white rounded-md hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating
              ? '생성 중...'
              : keys.length > 0
                ? '이미 생성됨 (기존 키 삭제 후 재생성 가능)'
                : 'API Key 생성'}
          </button>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              ⚠️ 사용자당 1개만 생성 가능합니다.
              {keys.length > 0
                ? '기존 키를 먼저 삭제해주세요.'
                : '새 키 생성 시 기존 키가 자동 삭제됩니다.'}
            </p>
          </div>
        </div>
      )}

      {/* 새로 생성된 키 표시 (1회만) */}
      {newKey && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-green-800 dark:text-green-300 mb-4">
            ✅ API Key가 생성되었습니다!
          </h2>

          <div className="bg-white dark:bg-gray-800 p-4 rounded border border-green-300 dark:border-green-700 mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">API Key (1회만 표시됩니다)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded text-sm font-mono break-all text-gray-900 dark:text-gray-100">
                {newKey.apiKey}
              </code>
              <button
                onClick={() => copyToClipboard(newKey.apiKey)}
                className="px-3 py-2 bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 text-sm"
              >
                복사
              </button>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">.mcp.json 설정</p>
            <div className="bg-gray-900 dark:bg-gray-950 text-gray-100 dark:text-gray-200 p-4 rounded font-mono text-xs overflow-x-auto">
              <pre>{getMcpJsonConfig(newKey.apiKey)}</pre>
            </div>
            <button
              onClick={() => copyToClipboard(getMcpJsonConfig(newKey.apiKey))}
              className="mt-2 px-3 py-1 bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 text-sm"
            >
              .mcp.json 복사
            </button>
          </div>

          <p className="text-sm text-green-700 dark:text-green-400">
            💡 위 API Key를 안전한 곳에 보관하세요. 재조회가 불가능합니다.
          </p>

          <button
            onClick={() => setNewKey(null)}
            className="mt-4 px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-600"
          >
            확인
          </button>
        </div>
      )}

      {/* 기존 키 목록 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">내 API Keys</h2>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">로딩 중...</p>
        ) : keys.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">생성된 API Key가 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {keys.map((key) => (
              <div
                key={key.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition bg-white dark:bg-gray-800"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{key.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {key.blogName} • blog_sk_{key.keyHint}_***
                    </p>
                  </div>
                  <button
                    onClick={() => openDeleteDialog(key.id, key.name)}
                    className="px-3 py-1 text-sm text-red-600 dark:text-red-400 border border-red-600 dark:border-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    삭제
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">사용 횟수</p>
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

      {/* 사용 가이드 */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-blue-800 dark:text-blue-300 mb-4">
          📖 Claude Code 설정 가이드
        </h2>

        <ol className="space-y-3 text-sm text-blue-900 dark:text-blue-200">
          <li>
            <strong>1. API Key 생성:</strong> 위에서 블로그를 선택하고 API Key를 생성하세요.
          </li>
          <li>
            <strong>2. .mcp.json 파일 생성:</strong> 생성된 설정을 복사하여{' '}
            <code className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">~/.claude/mcp.json</code> 파일에 저장하세요.
          </li>
          <li>
            <strong>3. Claude Code 재시작:</strong> Claude Code를 재시작하면 MCP 서버가 자동으로 연결됩니다.
          </li>
          <li>
            <strong>4. 자동 포스팅:</strong> Claude Code에서 "블로그 포스트 작성해줘"라고 요청하면 자동으로 포스트가 생성됩니다.
          </li>
        </ol>

        <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            💡 <strong>Tip:</strong> API Key는 90일 후 자동 만료됩니다. 만료 전에 새 키를 생성하세요.
          </p>
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
