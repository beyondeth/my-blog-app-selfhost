"use client";

import React from 'react';
import PostArticle from '@/components/posts/PostArticle';
import { Post } from '@/types';

export default function TestYouTubePage() {
  // Test post with YouTube thumbnail
  const testPost: Post = {
    id: 'test-1',
    title: 'Test YouTube Video Post',
    slug: 'test-youtube-video',
    content: '<p>This is a test post with a YouTube video thumbnail</p>',
    // Standard YouTube thumbnail URL format
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    isPublished: true,
    viewCount: 100,
    likeCount: 10,
    commentCount: 5,
    liked: false,
    tags: ['test', 'youtube'],
    category: 'Testing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    author: {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
      profileImage: undefined,
      bio: 'Test user',
      role: 'user' as const,
      authProvider: 'local' as const,
      isEmailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    blog: {
      id: 'blog-1',
      slug: 'test-blog',
      name: 'Test Blog',
      description: 'A test blog',
      thumbnailUrl: undefined,
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  };

  // Test post with regular image thumbnail
  const regularPost: Post = {
    ...testPost,
    id: 'test-2',
    title: 'Regular Post with Image',
    slug: 'regular-post',
    thumbnail: '/api/v1/files/some-file-id/download',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">YouTube Detection Test Page</h1>
      
      <div className="mb-8 p-4 bg-blue-50 rounded">
        <h2 className="font-semibold mb-2">Test Instructions:</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Open browser console to see debug logs</li>
          <li>Check if YouTube video is detected and displayed correctly</li>
          <li>The first post should show as a Reddit-style video player</li>
          <li>The second post should show as a regular article with thumbnail on the right</li>
        </ol>
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold mb-4">YouTube Video Post (Should show video player):</h2>
          <div className="border rounded p-4">
            <PostArticle
              post={testPost}
              isAdmin={false}
              isAuthenticated={false}
              onEdit={() => console.log('Edit clicked')}
              onDelete={() => console.log('Delete clicked')}
            />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Regular Post (Should show normal layout):</h2>
          <div className="border rounded p-4">
            <PostArticle
              post={regularPost}
              isAdmin={false}
              isAuthenticated={false}
              onEdit={() => console.log('Edit clicked')}
              onDelete={() => console.log('Delete clicked')}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded">
        <h3 className="font-semibold mb-2">Expected Console Output for YouTube Post:</h3>
        <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
{`[PostArticle] Post data: {
  id: 'test-1',
  title: 'Test YouTube Video Post',
  thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  hasContent: true,
  contentLength: [number]
}
[PostArticle] Analyzing thumbnail URL: https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg
[PostArticle] ✅ YouTube video DETECTED! Pattern matched: [pattern]
[PostArticle] Video ID extracted: dQw4w9WgXcQ`}
        </pre>
      </div>
    </div>
  );
}