'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export default function CreateBlogPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSlugAvailable, setIsSlugAvailable] = useState<boolean | null>(null);
  const [hasExistingBlog, setHasExistingBlog] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  // Check if user already has a blog
  useEffect(() => {
    if (user) {
      checkExistingBlog();
    } else {
      setCheckingExisting(false);
    }
  }, [user]);

  const checkExistingBlog = async () => {
    if (!user) {
      setCheckingExisting(false);
      return;
    }
    
    setCheckingExisting(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/blogs/my-blogs`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const blogs = await response.json();
        if (blogs && blogs.length > 0) {
          setHasExistingBlog(true);
          toast.info(`이미 블로그가 있습니다: ${blogs[0].name}`);
          // 이미 블로그가 있으면 그 블로그로 리다이렉트
          router.push(`/blog/${blogs[0].slug}`);
          return;
        }
      }
    } catch (error) {
      console.error('Failed to check existing blog:', error);
    } finally {
      setCheckingExisting(false);
    }
  };

  const checkSlugAvailability = async () => {
    if (!slug || slug.length < 3) {
      toast.error('블로그 주소는 3자 이상이어야 합니다.');
      return;
    }

    setIsChecking(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/blogs/check-slug/${slug}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          // 404는 API 엔드포인트 자체를 못 찾은 것이므로 에러
          throw new Error('API endpoint not found');
        }
        throw new Error('Failed to check slug');
      }
      
      const data = await response.json();
      setIsSlugAvailable(data.available);
      
      if (data.available) {
        toast.success('사용 가능한 주소입니다!');
      } else {
        toast.error('이미 사용 중인 주소입니다.');
      }
    } catch (error) {
      console.error('Failed to check slug:', error);
      toast.error('주소 확인 중 오류가 발생했습니다.');
      setIsSlugAvailable(null);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(value);
    setIsSlugAvailable(null); // Reset availability status when user types
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isSlugAvailable) {
      toast.error('이미 사용 중인 블로그 주소입니다.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/blogs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          slug,
          name,
          description
        }),
      });

      if (response.ok) {
        const blog = await response.json();
        console.log('✅ [CreateBlog] Blog created successfully:', blog);
        toast.success('블로그가 생성되었습니다!');
        
        // Trigger a window event to notify other components
        console.log('🔄 [CreateBlog] Triggering blog refresh event...');
        window.dispatchEvent(new CustomEvent('userBlogRefresh'));
        
        router.push(`/blog/${blog.slug}`);
      } else {
        const error = await response.json();
        toast.error(error.message || '블로그 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create blog:', error);
      toast.error('블로그 생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 로그인 체크
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">로그인이 필요합니다</h2>
          <Link 
            href="/login" 
            className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
          >
            로그인하기
          </Link>
        </div>
      </div>
    );
  }

  // 기존 블로그 체크 중
  if (checkingExisting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center text-white/70 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            돌아가기
          </Link>

          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <h1 className="text-3xl font-bold text-white">블로그 만들기</h1>
              <p className="text-gray-300 mt-2">
                나만의 블로그를 만들어 글을 작성하고 공유해보세요
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="slug" className="text-white mb-2 block">
                    블로그 주소 *
                  </Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">localhost:3001/blog/</span>
                      <Input
                        id="slug"
                        value={slug}
                        onChange={handleSlugChange}
                        placeholder="my-awesome-blog"
                        pattern="[a-z0-9-]+"
                        required
                        minLength={3}
                        maxLength={50}
                        className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 flex-1"
                      />
                      <Button
                        type="button"
                        onClick={checkSlugAvailability}
                        disabled={!slug || slug.length < 3 || isChecking}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {isChecking ? '확인 중...' : '주소 확인'}
                      </Button>
                    </div>
                    {isSlugAvailable !== null && (
                      <p className={`text-sm ${
                        isSlugAvailable ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {isSlugAvailable ? '✓ 사용 가능한 주소입니다' : '✗ 이미 사용 중인 주소입니다'}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    영문 소문자, 숫자, 하이픈만 사용 가능 (3-50자)
                  </p>
                </div>

                <div>
                  <Label htmlFor="name" className="text-white mb-2 block">
                    블로그 이름 *
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="나의 개발 블로그"
                    required
                    maxLength={100}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-white mb-2 block">
                    블로그 설명
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="이 블로그는 개발 경험과 학습 내용을 공유하는 공간입니다..."
                    maxLength={500}
                    className="min-h-[100px] bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {description.length}/500
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !isSlugAvailable || !slug || !name}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isLoading ? '생성 중...' : '블로그 생성'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}