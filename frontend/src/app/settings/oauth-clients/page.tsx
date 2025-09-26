'use client';

import { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiEdit2, FiEye, FiEyeOff, FiCopy, FiExternalLink } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

/**
 * OAuth 클라이언트 타입 정의
 * 백엔드 응답 형식 (snake_case)
 */
interface OAuthClientResponse {
  id?: string;
  client_id: string;
  client_secret?: string;
  client_name: string;
  description?: string;
  redirect_uris: string[];
  allowed_scopes: string[];
  is_active: boolean;
  is_trusted?: boolean;
  last_used_at?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * OAuth 앱 관리 페이지
 * 사용자가 등록한 OAuth2 클라이언트 앱들을 관리할 수 있는 페이지
 *
 * 주요 기능:
 * - OAuth 클라이언트 목록 조회
 * - 새 클라이언트 생성
 * - 클라이언트 정보 수정
 * - 클라이언트 삭제
 * - 클라이언트 시크릿 재생성
 */
export default function OAuthClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<OAuthClientResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<OAuthClientResponse | null>(null);

  /**
   * OAuth 클라이언트 목록 조회
   */
  const fetchClients = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/oauth/clients`,
        {
          credentials: 'include',
        }
      );

      if (response.ok) {
        const data = await response.json();
        setClients(data);
      } else if (response.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error('OAuth 클라이언트 목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  /**
   * 클라이언트 시크릿 표시/숨기기 토글
   */
  const toggleSecretVisibility = (clientId: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [clientId]: !prev[clientId]
    }));
  };

  /**
   * 클립보드에 복사
   */
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    // TODO: 토스트 메시지로 복사 완료 알림
    alert(`${label}이(가) 클립보드에 복사되었습니다.`);
  };

  /**
   * 클라이언트 삭제
   */
  const deleteClient = async (clientId: string) => {
    if (!confirm('정말로 이 OAuth 클라이언트를 삭제하시겠습니까? 이 앱을 사용하는 모든 연결이 끊어집니다.')) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/oauth/clients/${clientId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (response.ok) {
        setClients(clients.filter(c => (c.id || c.client_id) !== clientId));
        alert('OAuth 클라이언트가 삭제되었습니다.');
      }
    } catch (error) {
      console.error('OAuth 클라이언트 삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  /**
   * 새 클라이언트 생성 모달
   */
  const NewClientModal = () => {
    const [formData, setFormData] = useState({
      clientName: '',
      description: '',
      redirectUris: '',
      allowedScopes: 'mcp:post:create',
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/oauth/clients`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              ...formData,
              redirectUris: formData.redirectUris.split('\n').filter(uri => uri.trim()),
              allowedScopes: formData.allowedScopes.split(' ').filter(scope => scope.trim()),
            }),
          }
        );

        if (response.ok) {
          const newClient = await response.json();
          setClients([...clients, newClient]);
          setShowNewClientModal(false);
          alert('OAuth 클라이언트가 생성되었습니다. 클라이언트 시크릿을 안전하게 보관하세요.');
        } else {
          // 422 에러 등의 상세 정보를 표시
          const errorData = await response.json();
          console.error('OAuth 클라이언트 생성 실패:', errorData);

          // 422 에러인 경우 유효성 검사 오류 메시지 표시
          if (response.status === 422 && errorData.message) {
            // 메시지가 배열인 경우 각 에러를 표시
            if (Array.isArray(errorData.message)) {
              alert(`유효성 검사 오류:\n${errorData.message.join('\n')}`);
            } else {
              alert(`유효성 검사 오류: ${errorData.message}`);
            }
          } else {
            alert(`생성 중 오류가 발생했습니다: ${errorData.message || '알 수 없는 오류'}`);
          }
        }
      } catch (error) {
        console.error('OAuth 클라이언트 생성 실패:', error);
        alert('생성 중 오류가 발생했습니다.');
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">새 OAuth 앱 등록</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">앱 이름 *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                placeholder="예: My Blog MCP Client"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">설명</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="이 앱의 용도를 설명해주세요"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">리다이렉트 URI *</label>
              <textarea
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                rows={3}
                value={formData.redirectUris}
                onChange={(e) => setFormData({ ...formData, redirectUris: e.target.value })}
                placeholder="http://localhost:7777/callback&#10;http://localhost:8080/callback"
              />
              <p className="text-xs text-gray-500 mt-1">한 줄에 하나씩 입력하세요</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">권한 스코프</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                value={formData.allowedScopes}
                onChange={(e) => setFormData({ ...formData, allowedScopes: e.target.value })}
                placeholder="mcp:post:create"
              />
              <p className="text-xs text-gray-500 mt-1">공백으로 구분하여 입력하세요</p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowNewClientModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                생성
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-100 rounded"></div>
            <div className="h-20 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">OAuth 앱 관리</h2>
          <p className="text-sm text-gray-600 mt-1">
            블로그 API에 접근할 수 있는 OAuth2 클라이언트 앱을 관리합니다
          </p>
        </div>
        <button
          onClick={() => setShowNewClientModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <FiPlus />
          새 앱 등록
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">등록된 OAuth 앱이 없습니다</p>
          <button
            onClick={() => setShowNewClientModal(true)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            첫 번째 OAuth 앱을 등록하세요
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => (
            <div key={client.id || client.client_id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{client.client_name}</h3>
                  {client.description && (
                    <p className="text-sm text-gray-600 mt-1">{client.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    client.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {client.is_active ? '활성' : '비활성'}
                  </span>
                  {client.is_trusted && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                      신뢰됨
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-24">Client ID:</span>
                  <code className="flex-1 font-mono bg-gray-100 px-2 py-1 rounded">
                    {client.client_id}
                  </code>
                  <button
                    onClick={() => copyToClipboard(client.client_id, 'Client ID')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FiCopy />
                  </button>
                </div>

                {client.client_secret && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-24">Secret:</span>
                    <code className="flex-1 font-mono bg-gray-100 px-2 py-1 rounded">
                      {showSecrets[client.id || client.client_id]
                        ? client.client_secret
                        : '••••••••••••••••••••••••'}
                    </code>
                    <button
                      onClick={() => toggleSecretVisibility(client.id || client.client_id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {showSecrets[client.id || client.client_id] ? <FiEyeOff /> : <FiEye />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(client.client_secret || '', 'Client Secret')}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <FiCopy />
                    </button>
                  </div>
                )}

                <div>
                  <span className="text-gray-500">리다이렉트 URI:</span>
                  <ul className="mt-1 space-y-1">
                    {(client.redirect_uris || []).map((uri, idx) => (
                      <li key={idx} className="flex items-center gap-1">
                        <code className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {uri}
                        </code>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <span className="text-gray-500">권한:</span>
                  <div className="flex gap-2 mt-1">
                    {(client.allowed_scopes || []).map((scope, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 text-xs rounded">
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>

                {client.last_used_at && (
                  <div className="text-xs text-gray-500">
                    마지막 사용: {new Date(client.last_used_at).toLocaleString('ko-KR')}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setEditingClient(client)}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  <FiEdit2 className="h-4 w-4" />
                  수정
                </button>
                <button
                  onClick={() => deleteClient(client.id || client.client_id)}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700"
                >
                  <FiTrash2 className="h-4 w-4" />
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewClientModal && <NewClientModal />}

      {/* OAuth 인증 테스트 섹션 */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">OAuth2 인증 테스트</h3>
        <p className="text-sm text-blue-800 mb-3">
          등록된 OAuth 앱을 테스트하려면 아래 URL을 사용하세요:
        </p>
        <div className="bg-white p-3 rounded border border-blue-200">
          <code className="text-xs break-all">
            {`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/oauth/authorize?response_type=code&client_id=[YOUR_CLIENT_ID]&redirect_uri=[YOUR_REDIRECT_URI]&scope=mcp:post:create&state=[RANDOM_STATE]&code_challenge=[PKCE_CHALLENGE]&code_challenge_method=S256`}
          </code>
        </div>
        <a
          href="https://www.oauth.com/playground/authorization-code-with-pkce.html"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:text-blue-700"
        >
          OAuth Playground에서 테스트
          <FiExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}