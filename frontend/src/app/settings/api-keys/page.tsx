'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserBlog } from '@/hooks/useUserBlog';
import { FiKey, FiCopy, FiTrash2, FiPlus, FiToggleLeft, FiToggleRight, FiClock, FiActivity, FiAlertCircle, FiInfo, FiChevronDown, FiChevronUp, FiCheckCircle } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ApiKey {
  id: string;
  name: string;
  description?: string;
  key?: string; // Optional since backend doesn't return it
  keyPrefix?: string; // For display purposes
  blogId: string;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
  expiresAt?: string;
}

export default function ApiKeysPage() {
  const { user } = useAuth();
  const { blog } = useUserBlog();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKey, setNewKey] = useState<{ plainKey: string } | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [showMcpGuide, setShowMcpGuide] = useState(true);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    if (user) {
      fetchApiKeys();
    }
  }, [user]);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/api-keys`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('API 키를 불러오는데 실패했습니다');
      }

      const data = await response.json();
      // Add key prefix for display
      const keysWithPrefix = data.map((key: ApiKey) => ({
        ...key,
        keyPrefix: `sk_${key.id.substring(0, 8)}` // Use ID prefix for display
      }));
      setApiKeys(keysWithPrefix);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!blog) {
      setError('먼저 블로그를 생성해주세요');
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/api-keys`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            blogId: blog.id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('API 키 생성에 실패했습니다');
      }

      const data = await response.json();
      if (data.plainKey) {
        setNewKey({ plainKey: data.plainKey });
      }
      setShowCreateModal(false);
      setFormData({ name: '', description: '' });
      await fetchApiKeys();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleKey = async (id: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/api-keys/${id}/toggle`,
        {
          method: 'PUT',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('API 키 상태 변경에 실패했습니다');
      }

      await fetchApiKeys();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('정말 이 API 키를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/api-keys/${id}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('API 키 삭제에 실패했습니다');
      }

      await fetchApiKeys();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyToClipboard = async (text: string, keyId?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (keyId) {
        setCopiedKeyId(keyId);
        setTimeout(() => setCopiedKeyId(null), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyMcpConfig = async () => {
    const config = `{
  "mcp": {
    "servers": {
      "blog-mcp": {
        "type": "stdio",
        "command": "node",
        "args": ["/path/to/mcp-blog-server/index.js"],
        "env": {
          "BLOG_API_KEY": "여기에_생성한_API_키를_넣으세요",
          "BLOG_API_URL": "${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}"
        }
      }
    }
  }
}`;
    try {
      await navigator.clipboard.writeText(config);
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 3000);
    } catch (err) {
      console.error('Failed to copy config:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">로그인이 필요합니다</p>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="p-8">
        <div className="text-center py-8">
          <FiKey className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">블로그가 필요합니다</h3>
          <p className="text-sm text-gray-600 mb-4">
            블로그를 찾을 수 없습니다. 새로고침을 시도해보세요.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 bg-amber-700 text-white font-medium rounded-md hover:bg-amber-800"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">API 키 관리</h2>
            <p className="text-sm text-gray-600 mt-1">
              블로그 API에 접근할 수 있는 키를 관리하세요
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-amber-700 text-white font-medium rounded-md hover:bg-amber-800 transition-colors"
          >
            <FiPlus className="mr-2" />
            새 API 키
          </button>
        </div>
      </div>

      {/* MCP Configuration Guide - Improved */}
      <div className="mb-6">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 overflow-hidden">
          <button
            onClick={() => setShowMcpGuide(!showMcpGuide)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100/50 transition-colors"
          >
            <div className="flex items-center">
              <FiInfo className="h-5 w-5 text-blue-600 mr-2" />
              <span className="font-medium text-blue-900">MCP 서버 설정 가이드</span>
            </div>
            {showMcpGuide ? (
              <FiChevronUp className="h-5 w-5 text-blue-600" />
            ) : (
              <FiChevronDown className="h-5 w-5 text-blue-600" />
            )}
          </button>
          
          {showMcpGuide && (
            <div className="px-4 pb-4 border-t border-blue-200/50">
              <div className="mt-4 space-y-4">
                {/* Step 1 */}
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    1
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">API 키 생성</p>
                    <p className="text-sm text-gray-600 mt-1">위의 "새 API 키" 버튼을 클릭하여 API 키를 생성하세요.</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    2
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">설정 파일 수정</p>
                    <p className="text-sm text-gray-600 mt-1 mb-2">
                      Claude Desktop 설정 파일에 아래 구성을 추가하세요:
                    </p>
                    <div className="relative">
                      <div className="absolute top-2 right-2 z-10">
                        <button
                          onClick={copyMcpConfig}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                            copiedConfig
                              ? 'bg-green-600 text-white'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {copiedConfig ? (
                            <>
                              <FiCheckCircle className="inline-block mr-1" />
                              복사됨!
                            </>
                          ) : (
                            <>
                              <FiCopy className="inline-block mr-1" />
                              복사
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                        <code>{`{
  "mcp": {
    "servers": {
      "blog-mcp": {
        "type": "stdio",
        "command": "node",
        "args": ["/path/to/mcp-blog-server/index.js"],
        "env": {
          "BLOG_API_KEY": "여기에_생성한_API_키를_넣으세요",
          "BLOG_API_URL": "${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}"
        }
      }
    }
  }
}`}</code>
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    3
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">설정 파일 경로</p>
                    <div className="mt-1 space-y-1">
                      <p className="text-sm text-gray-600">
                        • <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">macOS</span>: ~/Library/Application Support/Claude/claude_desktop_config.json
                      </p>
                      <p className="text-sm text-gray-600">
                        • <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">Windows</span>: %APPDATA%\Claude\claude_desktop_config.json
                      </p>
                    </div>
                  </div>
                </div>

                {/* Important Notes */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start">
                    <FiAlertCircle className="h-4 w-4 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-900 mb-1">중요 사항</p>
                      <ul className="text-amber-700 space-y-0.5">
                        <li>• MCP 서버는 로그인 인증과 API 키 인증이 모두 필요합니다</li>
                        <li>• args 경로를 실제 MCP 서버 경로로 변경하세요</li>
                        <li>• Claude Desktop을 재시작해야 변경사항이 적용됩니다</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Key Alert */}
      {newKey && newKey.plainKey && (
        <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-lg">
          <div className="flex items-start">
            <FiAlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 mb-1">
                API 키가 생성되었습니다
              </p>
              <p className="text-sm text-amber-700 mb-3">
                이 키는 지금만 볼 수 있습니다. 안전한 곳에 복사해서 저장하세요.
              </p>
              <div className="flex items-center space-x-2 bg-white p-3 rounded border border-amber-200">
                <code className="flex-1 text-xs font-mono break-all select-all">
                  {newKey.plainKey}
                </code>
                <button
                  onClick={() => {
                    copyToClipboard(newKey.plainKey);
                    setNewKey(null); // Clear after copy
                  }}
                  className="px-3 py-1 bg-amber-600 text-white text-sm font-medium rounded hover:bg-amber-700 transition-colors"
                >
                  복사하고 닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-3 text-sm text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <FiKey className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">아직 생성된 API 키가 없습니다</p>
          </div>
        ) : (
          apiKeys.map((key) => (
            <div key={key.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium text-gray-900">{key.name}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      key.isActive 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {key.isActive ? '활성' : '비활성'}
                    </span>
                  </div>
                  {key.description && (
                    <p className="text-sm text-gray-600 mt-1">{key.description}</p>
                  )}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center text-xs text-gray-500">
                      <FiClock className="mr-1" />
                      생성: {formatDistanceToNow(new Date(key.createdAt), { addSuffix: true, locale: ko })}
                    </div>
                    {key.lastUsedAt && (
                      <div className="flex items-center text-xs text-gray-500">
                        <FiActivity className="mr-1" />
                        마지막 사용: {formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true, locale: ko })}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center space-x-2">
                    <code className="px-3 py-1 bg-gray-100 text-sm font-mono rounded text-gray-600">
                      {key.keyPrefix}...****
                    </code>
                    {copiedKeyId === key.id && (
                      <span className="text-xs text-green-600 font-medium">
                        ID 복사됨!
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => copyToClipboard(key.id, key.id)}
                    className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                    title="ID 복사"
                  >
                    <FiCopy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleKey(key.id)}
                    className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                    title={key.isActive ? '비활성화' : '활성화'}
                  >
                    {key.isActive ? <FiToggleRight className="w-5 h-5 text-green-600" /> : <FiToggleLeft className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    className="p-2 text-red-500 hover:text-red-700 transition-colors"
                    title="삭제"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">새 API 키 생성</h3>
            <form onSubmit={handleCreateKey}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    이름 *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    설명
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-700 text-white font-medium rounded-md hover:bg-amber-800"
                >
                  생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}