'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, User, Shield, AlertCircle } from 'lucide-react';

interface OAuthClient {
  client_id: string;
  client_name: string;
  client_description?: string;
}

interface Blog {
  id: string;
  name: string;
  slug: string;
}

interface AuthorizeData {
  client: OAuthClient;
  requested_scopes: string[];
  blogs: Blog[];
  user_email: string;
}

/**
 * OAuth 승인 페이지 컴포넌트
 * 사용자가 MCP 클라이언트에 권한을 부여하는 화면
 */
export default function OAuthAuthorizePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<AuthorizeData | null>(null);
  const [selectedBlogId, setSelectedBlogId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // URL 파라미터 추출
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');
  const scope = searchParams.get('scope');
  const codeChallenge = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method');

  useEffect(() => {
    // 클라이언트 정보 및 사용자 정보 가져오기
    const fetchAuthorizeData = async () => {
      try {
        // API Route Handler를 사용하여 쿠키 전달
        const response = await fetch(
          `/api/oauth/authorize-data?${searchParams.toString()}`,
          {
            credentials: 'include',
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            // 로그인이 필요한 경우
            const returnUrl = `/oauth/authorize?${searchParams.toString()}`;
            router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
            return;
          }
          throw new Error('Failed to fetch authorization data');
        }

        const result = await response.json();
        setData(result);

        // 블로그가 하나만 있으면 자동 선택
        if (result.blogs?.length === 1) {
          setSelectedBlogId(result.blogs[0].id);
        }
      } catch (err) {
        console.error('Error fetching authorize data:', err);
        setError('승인 정보를 가져오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (clientId) {
      fetchAuthorizeData();
    } else {
      setError('필수 파라미터가 누락되었습니다.');
      setLoading(false);
    }
  }, [clientId, searchParams, router]);

  /**
   * 승인 처리 함수
   */
  const handleApprove = async () => {
    if (!selectedBlogId) {
      alert('블로그를 선택해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      // API Route Handler를 사용하여 쿠키 전달
      const response = await fetch('/api/oauth/authorize', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          state,
          scope,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          blog_id: selectedBlogId,
          approved: true,
        }),
      });

      if (!response.ok) {
        // 401이면 로그인 필요
        if (response.status === 401) {
          const returnUrl = `/oauth/authorize?${searchParams.toString()}`;
          router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
          return;
        }

        throw new Error(`승인 처리 중 오류가 발생했습니다. (${response.status})`);
      }

      // 백엔드가 리다이렉트 URL을 반환
      const result = await response.json();
      if (result.redirect_url) {
        window.location.href = result.redirect_url;
      }
    } catch (err) {
      console.error('Error approving:', err);
      setError('승인 처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 거부 처리 함수
   */
  const handleDeny = async () => {
    setSubmitting(true);
    try {
      // API Route Handler를 사용하여 쿠키 전달
      const response = await fetch('/api/oauth/authorize', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          state,
          approved: false,
        }),
      });

      if (!response.ok) {
        // 401이면 로그인 필요
        if (response.status === 401) {
          const returnUrl = `/oauth/authorize?${searchParams.toString()}`;
          router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
          return;
        }
        throw new Error('거부 처리 중 오류가 발생했습니다.');
      }

      // 백엔드가 리다이렉트 URL을 반환
      const result = await response.json();
      if (result.redirect_url) {
        // MCP 클라이언트로 에러를 전달하지만,
        // 사용자에게는 친화적인 메시지를 보여주고 홈으로 리다이렉트
        window.location.href = result.redirect_url;

        // 2초 후 홈으로 리다이렉트 (MCP가 에러를 처리할 시간을 줌)
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
    } catch (err) {
      console.error('Error denying:', err);
      // 에러 발생 시 홈으로 리다이렉트
      window.location.href = '/';
    }
  };

  /**
   * 계정 전환 처리
   */
  const handleSwitchAccount = () => {
    // 백엔드 OAuth 엔드포인트로 리다이렉트하여 계정 전환 처리
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('switch_account', 'true');
    // 백엔드 API로 리다이렉트 (백엔드에서 쿠키 삭제 후 로그인 페이지로 이동)
    window.location.href = `/api/v1/oauth/authorize?${newParams.toString()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-red-600 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <Shield className="mx-auto h-12 w-12 text-blue-600" />
          <h2 className="mt-4 text-2xl font-bold text-gray-900">권한 승인</h2>
          <p className="mt-2 text-sm text-gray-600">
            애플리케이션이 귀하의 계정에 접근하려고 합니다
          </p>
        </div>

        {/* 클라이언트 정보 */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-2">
            {data.client.client_name}
          </h3>
          {data.client.client_description && (
            <p className="text-sm text-gray-600">{data.client.client_description}</p>
          )}
        </div>

        {/* 요청된 권한 */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            이 앱이 요청하는 권한:
          </h4>
          <ul className="space-y-2">
            {data.requested_scopes.map((scope) => (
              <li key={scope} className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">
                  {scope === 'mcp:post:create' && '블로그에 포스트 작성'}
                  {scope === 'read' && '블로그 정보 읽기'}
                  {scope === 'write' && '블로그 정보 수정'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* 블로그 선택 */}
        {data.blogs.length > 0 && (
          <div className="mb-6">
            <label htmlFor="blog" className="block text-sm font-semibold text-gray-900 mb-2">
              사용할 블로그 선택:
            </label>
            <select
              id="blog"
              value={selectedBlogId}
              onChange={(e) => setSelectedBlogId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
            >
              <option value="">블로그를 선택하세요</option>
              {data.blogs.map((blog) => (
                <option key={blog.id} value={blog.id}>
                  {blog.name} ({blog.slug})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 현재 계정 표시 */}
        <div className="mb-6 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-gray-700">{data.user_email}</span>
            </div>
            <button
              onClick={handleSwitchAccount}
              className="text-sm text-blue-600 hover:underline"
              disabled={submitting}
            >
              계정 전환
            </button>
          </div>
        </div>

        {/* 액션 버튼 - 승인 버튼이 위, 거부 버튼이 아래 */}
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleApprove}
            className="w-full py-3"
            size="lg"
            disabled={submitting || !selectedBlogId}
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            승인
          </Button>
          <Button
            onClick={handleDeny}
            variant="outline"
            className="w-full py-2"
            disabled={submitting}
          >
            <XCircle className="h-4 w-4 mr-2" />
            거부
          </Button>
        </div>

        {/* 보안 안내 */}
        <p className="mt-6 text-xs text-center text-gray-500">
          이 앱을 신뢰하는 경우에만 승인하세요.
          승인 후 설정에서 언제든지 접근 권한을 취소할 수 있습니다.
        </p>
      </div>
    </div>
  );
}