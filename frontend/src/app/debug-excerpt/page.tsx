'use client';

import { useEffect, useState } from 'react';

export default function DebugExcerptPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 직접 API 호출 (React Query 우회)
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts?limit=5`, {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        console.log('📊 Direct API Response:', data);
        setPosts(data.posts || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('❌ API Error:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">🔍 Excerpt 필드 디버깅 페이지</h1>

      <div className="mb-4 p-4 bg-blue-50 rounded">
        <p className="font-semibold">API URL: {process.env.NEXT_PUBLIC_API_URL}/posts</p>
        <p className="text-sm text-gray-600">직접 API 호출 (React Query 우회)</p>
      </div>

      <div className="space-y-6">
        {posts.map((post, index) => (
          <div key={post.id} className="border p-4 rounded-lg">
            <div className="mb-2">
              <span className="text-xs text-gray-500">Post #{index + 1}</span>
              <h2 className="text-lg font-bold">{post.title}</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-gray-700">✅ Has excerpt?</p>
                <p className={post.excerpt ? "text-green-600" : "text-red-600"}>
                  {post.excerpt ? "YES" : "NO"}
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-700">📏 Excerpt length:</p>
                <p>{post.excerpt?.length || 0} characters</p>
              </div>

              <div className="col-span-2">
                <p className="font-semibold text-gray-700">📝 Excerpt preview:</p>
                <div className="mt-1 p-2 bg-gray-50 rounded text-xs">
                  {post.excerpt ? (
                    <span>{post.excerpt.substring(0, 150)}...</span>
                  ) : (
                    <span className="text-red-500">No excerpt field!</span>
                  )}
                </div>
              </div>

              <div className="col-span-2">
                <p className="font-semibold text-gray-700">🔧 Raw excerpt value:</p>
                <pre className="mt-1 p-2 bg-gray-900 text-green-400 rounded text-xs overflow-x-auto">
                  {JSON.stringify(post.excerpt, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="font-semibold text-yellow-800">💡 디버깅 정보:</p>
        <ul className="mt-2 text-sm text-gray-700 space-y-1">
          <li>• 이 페이지는 React Query를 우회하고 직접 API를 호출합니다</li>
          <li>• 브라우저 콘솔에서 "📊 Direct API Response"를 확인하세요</li>
          <li>• excerpt 필드가 있다면 백엔드는 정상입니다</li>
          <li>• excerpt가 없다면 백엔드 재시작이 필요할 수 있습니다</li>
        </ul>
      </div>
    </div>
  );
}