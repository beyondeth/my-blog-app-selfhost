'use client';

import { useState, useEffect } from 'react';
import { FiUser, FiTrash2, FiDatabase, FiFile, FiMessageSquare, FiKey, FiAlertTriangle, FiCheck, FiX, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface DebugInfo {
  timestamp: Date;
  userId: string;
  username: string;
  email: string;
  authProvider: string;
  
  beforeDeletion: {
    blogs: { count: number; items: any[] };
    posts: { count: number; items: any[] };
    comments: { count: number; items: any[] };
    files: { count: number; items: any[] };
    apiKeys: { count: number; items: any[] };
    reports: { count: number; items: any[] };
    totalDataSize: number;
  };
  
  deletionSteps: Array<{
    step: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    message: string;
    timestamp: Date;
    details?: any;
  }>;
  
  afterDeletion: {
    userExists: boolean;
    orphanedData: any[];
    verificationStatus: string;
  };
}

export default function AdminDebugPage() {
  const [userIdOrEmail, setUserIdOrEmail] = useState('');
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [realDeletionResult, setRealDeletionResult] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  // 인증 상태 확인
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const user = await response.json();
          setCurrentUser(user);
          
          // Admin 권한 확인
          if (user.role !== 'admin') {
            toast.error('관리자 권한이 필요합니다');
            router.push('/');
          }
        } else {
          toast.error('로그인이 필요합니다');
          router.push('/login');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        toast.error('인증 확인 실패');
        router.push('/login');
      } finally {
        setAuthChecked(true);
      }
    };

    checkAuth();
  }, [API_URL, router]);

  // 삭제 전 데이터 미리보기
  const previewDeletion = async () => {
    if (!userIdOrEmail) {
      toast.error('사용자 ID 또는 이메일을 입력하세요');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/debug/deletion/${encodeURIComponent(userIdOrEmail)}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (response.status === 404) {
          throw new Error(`사용자를 찾을 수 없습니다: ${userIdOrEmail}`);
        }
        throw new Error(errorData?.message || 'Failed to fetch debug info');
      }

      const data = await response.json();
      setDebugInfo(data.data);
      toast.success('삭제 예정 데이터를 불러왔습니다');
    } catch (error: any) {
      toast.error(error.message || '데이터 로드 실패');
      console.error(error);
      setDebugInfo(null);
      setSimulationResult(null);
      setRealDeletionResult(null);
    } finally {
      setLoading(false);
    }
  };

  // 삭제 시뮬레이션
  const simulateDeletion = async () => {
    if (!userIdOrEmail) {
      toast.error('사용자 ID 또는 이메일을 입력하세요');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/debug/deletion/${encodeURIComponent(userIdOrEmail)}/simulate`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (response.status === 404) {
          throw new Error(`사용자를 찾을 수 없습니다: ${userIdOrEmail}`);
        }
        throw new Error(errorData?.message || 'Failed to simulate deletion');
      }

      const data = await response.json();
      setSimulationResult(data);
      setDebugInfo(data.debugInfo);
      toast.success('시뮬레이션 완료');
    } catch (error: any) {
      toast.error(error.message || '시뮬레이션 실패');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 실제 삭제 실행
  const executeRealDeletion = async (softDelete: boolean = false) => {
    if (!userIdOrEmail) {
      toast.error('사용자 ID 또는 이메일을 입력하세요');
      return;
    }

    const confirmed = window.confirm(
      `정말로 사용자 ${debugInfo?.username || userIdOrEmail}를 ${softDelete ? '소프트' : '완전'} 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!`
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/debug/deletion/${encodeURIComponent(userIdOrEmail)}/execute`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          confirm: true,
          softDelete,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to delete user');
      }

      const data = await response.json();
      setRealDeletionResult(data);
      setDebugInfo(data.debugInfo);
      toast.success(`사용자 ${softDelete ? '소프트' : '완전'} 삭제 완료`);
    } catch (error: any) {
      toast.error(error.message || '삭제 실패');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 사용자 검색
  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      toast.error('검색어를 입력하세요');
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `${API_URL}/admin/users?search=${encodeURIComponent(searchQuery)}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to search users');
      }

      const data = await response.json();
      setSearchResults(data.data || []);
      toast.success(`${data.data?.length || 0}명의 사용자를 찾았습니다`);
    } catch (error) {
      toast.error('사용자 검색 실패');
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const selectUser = (user: any) => {
    setUserIdOrEmail(user.email || user.id);
    setSearchResults([]);
    setSearchQuery('');
    toast.success(`선택됨: ${user.username}`);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <FiCheck className="text-green-600" />;
      case 'failed':
        return <FiX className="text-red-600" />;
      case 'in-progress':
        return <FiRefreshCw className="text-blue-600 animate-spin" />;
      default:
        return <FiAlertTriangle className="text-yellow-600" />;
    }
  };

  // 인증 확인 중 로딩 화면
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FiRefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>인증 확인 중...</p>
        </div>
      </div>
    );
  }

  // Admin이 아닌 경우 (이미 리다이렉트되지만 안전장치)
  if (authChecked && (!currentUser || currentUser.role !== 'admin')) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">계정 삭제 디버그 콘솔</h1>
        {currentUser && (
          <div className="text-sm text-gray-600">
            로그인: {currentUser.email} ({currentUser.role})
          </div>
        )}
      </div>
      
      {/* 사용자 검색 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FiSearch /> 사용자 검색
        </h2>
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
            placeholder="사용자명 또는 이메일로 검색"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={searchUsers}
            disabled={searching}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            검색
          </button>
        </div>
        
        {/* 검색 결과 */}
        {searchResults.length > 0 && (
          <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
            {searchResults.map((user) => (
              <div
                key={user.id}
                onClick={() => selectUser(user)}
                className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              >
                <div className="font-medium">{user.username}</div>
                <div className="text-sm text-gray-600">{user.email}</div>
                <div className="text-xs text-gray-500">
                  ID: {user.id} | 가입일: {new Date(user.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 사용자 ID 직접 입력 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex gap-4">
          <input
            type="text"
            value={userIdOrEmail}
            onChange={(e) => setUserIdOrEmail(e.target.value)}
            placeholder="사용자 ID (UUID) 또는 이메일 입력"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={previewDeletion}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            데이터 미리보기
          </button>
          <button
            onClick={simulateDeletion}
            disabled={loading || !debugInfo}
            className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
          >
            시뮬레이션
          </button>
        </div>
      </div>

      {/* 사용자 정보 */}
      {debugInfo && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiUser /> 사용자 정보
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">ID:</span> {debugInfo.userId}
            </div>
            <div>
              <span className="text-gray-600">Username:</span> {debugInfo.username}
            </div>
            <div>
              <span className="text-gray-600">Email:</span> {debugInfo.email}
            </div>
            <div>
              <span className="text-gray-600">Auth Provider:</span> {debugInfo.authProvider}
            </div>
          </div>
        </div>
      )}

      {/* 삭제 예정 데이터 */}
      {debugInfo && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiDatabase /> 삭제 예정 데이터
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-2xl font-bold text-blue-600">
                {debugInfo.beforeDeletion.blogs.count}
              </div>
              <div className="text-sm text-gray-600">블로그</div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-2xl font-bold text-green-600">
                {debugInfo.beforeDeletion.posts.count}
              </div>
              <div className="text-sm text-gray-600">포스트</div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-2xl font-bold text-purple-600">
                {debugInfo.beforeDeletion.comments.count}
              </div>
              <div className="text-sm text-gray-600">댓글</div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-2xl font-bold text-orange-600">
                {debugInfo.beforeDeletion.files.count}
              </div>
              <div className="text-sm text-gray-600">파일</div>
              <div className="text-xs text-gray-500">
                {formatBytes(debugInfo.beforeDeletion.totalDataSize)}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-2xl font-bold text-red-600">
                {debugInfo.beforeDeletion.apiKeys.count}
              </div>
              <div className="text-sm text-gray-600">API 키</div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-2xl font-bold text-yellow-600">
                {debugInfo.beforeDeletion.reports.count}
              </div>
              <div className="text-sm text-gray-600">신고</div>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 단계 */}
      {debugInfo && debugInfo.deletionSteps.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">삭제 진행 상황</h2>
          <div className="space-y-2">
            {debugInfo.deletionSteps.map((step, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                {getStatusIcon(step.status)}
                <div className="flex-1">
                  <div className="font-medium">{step.step}</div>
                  <div className="text-sm text-gray-600">{step.message}</div>
                  {step.details && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer">상세 정보</summary>
                      <pre className="text-xs mt-2 p-2 bg-white rounded overflow-x-auto">
                        {JSON.stringify(step.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(step.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 실제 삭제 버튼 */}
      {debugInfo && !realDeletionResult && (
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800 mb-4 flex items-center gap-2">
            <FiAlertTriangle /> 위험 구역 - 실제 삭제
          </h2>
          <p className="text-sm text-red-700 mb-4">
            아래 버튼을 클릭하면 실제로 사용자 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다!
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => executeRealDeletion(false)}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              완전 삭제 실행
            </button>
            <button
              onClick={() => executeRealDeletion(true)}
              disabled={loading}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
            >
              소프트 삭제 실행 (30일 후 삭제)
            </button>
          </div>
        </div>
      )}

      {/* 삭제 결과 */}
      {realDeletionResult && (
        <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-green-800 mb-4">삭제 완료</h2>
          <pre className="text-xs p-4 bg-white rounded overflow-x-auto">
            {JSON.stringify(realDeletionResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}