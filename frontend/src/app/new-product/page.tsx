'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { ArrowLeft, Tag } from 'lucide-react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useMyBlogs } from '@/hooks/useBlogs';
import { useCreatePost } from '@/hooks/usePosts';
// ProductCategory type은 백엔드 전송 시 사용

// 에디터 동적 로드 (SSR 비활성화)
const BlogSimpleEditor = dynamic(
  () => import('@/editor').then(mod => ({ default: mod.BlogSimpleEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 animate-pulse" />
    ),
  }
);

const CATEGORIES = [
  { value: 'ai_prompts', label: 'AI / 프롬프트' },
  { value: 'coding_templates', label: '개발 / 템플릿' },
  { value: 'tech_guides', label: '가이드 / 튜토리얼' },
  { value: 'data_analytics', label: '데이터 / 분석' },
  { value: 'others', label: '기타' },
  { value: '_custom', label: '직접 입력' },
] as const;

/**
 * 상품 등록 전용 페이지
 *
 * 3-Layer 콘텐츠 모델:
 *   - 상품 소개 (공개 마케팅 설명) → Post.content + ProductDetail.descriptionHtml
 *   - 미리보기 → ProductDetail.previewContent
 *   - 판매 콘텐츠 (구매자 전용) → DeliveryItem.contentHtml
 */
export default function NewProductPage() {
  const router = useRouter();
  const { user, authStatus } = useAuth();
  const { data: blogs, isLoading: isBlogsLoading } = useMyBlogs();
  const createPostMutation = useCreatePost();

  // 상품 정보
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<string>('');
  const [category, setCategory] = useState<string>('ai_prompts');
  const [customCategory, setCustomCategory] = useState('');

  // 에디터 콘텐츠 (2개: 공개 설명 + 구매자 전용)
  const [descriptionContent, setDescriptionContent] = useState('');
  const [deliveryContent, setDeliveryContent] = useState('');

  // 미리보기 설정
  const [previewMode, setPreviewMode] = useState<'auto' | 'custom'>('auto');
  const [customPreview, setCustomPreview] = useState('');

  // 제출 상태
  const [isSubmitting, setIsSubmitting] = useState(false);

  const blog = blogs ?? null;

  // 인증 체크
  useEffect(() => {
    if (authStatus !== 'loading' && !user) {
      toast.error('로그인이 필요합니다.');
      router.push('/login?redirect=/new-product');
    }
  }, [user, authStatus, router]);

  useEffect(() => {
    if (!isBlogsLoading && user && !blog) {
      toast.error('블로그를 먼저 생성해주세요.');
      router.push('/');
    }
  }, [blog, isBlogsLoading, user, router]);

  // 제출 핸들러
  const handleSubmit = async (asDraft = false) => {
    if (isSubmitting) return;

    // 유효성 검증
    if (!title.trim()) {
      toast.error('상품명을 입력해주세요');
      return;
    }
    if (!price || Number(price) < 100) {
      toast.error('가격은 최소 100원 이상이어야 합니다');
      return;
    }
    if (!descriptionContent.trim()) {
      toast.error('상품 소개를 작성해주세요');
      return;
    }
    if (!deliveryContent.trim()) {
      toast.error('판매 콘텐츠를 작성해주세요');
      return;
    }

    setIsSubmitting(true);
    try {
      const postData: Record<string, unknown> = {
        title: title.trim(),
        content: descriptionContent,
        postType: 'product',
        price: Number(price),
        productCategory: category === '_custom' ? (customCategory.trim() || 'others') : category,
        deliveryContent,
        isPublished: !asDraft,
        ...(previewMode === 'custom' && customPreview.trim()
          ? { previewContent: customPreview }
          : {}),
      };

      const result = await createPostMutation.mutateAsync(postData);
      toast.success(asDraft ? '초안이 저장되었습니다' : '상품이 등록되었습니다');

      if (asDraft) {
        router.push('/drafts');
      } else {
        router.push(`/marketplace/${(result as { slug: string }).slug}`);
      }
    } catch (error: unknown) {
      toast.error(
        (error as { message?: string })?.message || '상품 등록에 실패했습니다',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 로딩 상태
  if (authStatus === 'loading' || isBlogsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 dark:border-zinc-700 border-t-gray-900 dark:border-t-zinc-100 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !blog) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-[#0E141B]">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 border-b border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-[#0E141B]/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
            돌아가기
          </button>
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">상품 등록</span>
          </div>
          <div className="w-20" /> {/* 균형용 */}
        </div>
      </header>

      {/* 메인 폼 */}
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 space-y-8">

        {/* 상품명 */}
        <div className="pb-6 border-b border-gray-100 dark:border-zinc-800/50">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="상품명을 입력하세요"
            className="w-full text-2xl font-bold text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-zinc-600 bg-transparent border-none outline-none"
            maxLength={100}
          />
          <div className="flex justify-end mt-1">
            <span className={`text-xs ${title.length > 80 ? 'text-red-500' : 'text-gray-300 dark:text-zinc-600'}`}>
              {title.length}/100
            </span>
          </div>
        </div>

        {/* 상품 정보 카드 */}
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 p-5 space-y-4">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
            상품 정보
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 카테고리 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                카테고리
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-zinc-100/10 focus:border-gray-400 dark:focus:border-zinc-500 outline-none transition-colors"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {category === '_custom' && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="카테고리를 직접 입력하세요"
                  maxLength={30}
                  className="w-full h-10 px-3 mt-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-zinc-100/10 focus:border-gray-400 dark:focus:border-zinc-500 outline-none transition-colors"
                />
              )}
            </div>

            {/* 가격 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                가격
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-zinc-500">
                  ₩
                </span>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="최소 100"
                  min={100}
                  className="w-full h-10 pl-8 pr-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-zinc-100/10 focus:border-gray-400 dark:focus:border-zinc-500 outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              {price && Number(price) > 0 && (
                <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
                  판매자 수익: ₩{Math.floor(Number(price) * 0.8).toLocaleString()} (수수료 20%)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 에디터 툴바 줄바꿈 스타일 — overflow-x: auto를 flex-wrap: wrap으로 오버라이드 */}
        <style jsx global>{`
          .product-editor .tiptap-toolbar[data-variant="fixed"] {
            overflow-x: visible !important;
            flex-wrap: wrap !important;
            height: auto !important;
            min-height: var(--tt-toolbar-height);
            padding-top: 0.25rem;
            padding-bottom: 0.25rem;
            gap: 2px 0;
          }
          .product-editor .tiptap-toolbar-group {
            flex-wrap: nowrap;
          }
        `}</style>

        {/* 섹션 1: 상품 소개 (공개) */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              상품 소개
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              구매 전 모든 사용자에게 보이는 마케팅 설명입니다
            </p>
          </div>
          <div className="product-editor rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
            <BlogSimpleEditor
              content={descriptionContent}
              onChange={setDescriptionContent}
              placeholder="상품의 특징과 가치를 설명해주세요..."
            />
          </div>
        </div>

        {/* 섹션 2: 판매 콘텐츠 (구매자 전용) */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              판매 콘텐츠
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                구매자 전용
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              구매 완료 후에만 열람할 수 있는 실제 상품 콘텐츠입니다
            </p>
          </div>
          <div className="product-editor rounded-xl border border-green-200 dark:border-green-900/50 overflow-hidden">
            <BlogSimpleEditor
              content={deliveryContent}
              onChange={setDeliveryContent}
              placeholder="구매자에게 전달할 콘텐츠를 작성해주세요..."
            />
          </div>
        </div>

        {/* 미리보기 설정 */}
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 p-5 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
            미리보기 설정
          </h3>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="radio"
                name="previewMode"
                checked={previewMode === 'auto'}
                onChange={() => setPreviewMode('auto')}
                className="accent-gray-900 dark:accent-zinc-100"
              />
              자동 추출 (상품 소개 앞부분)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="radio"
                name="previewMode"
                checked={previewMode === 'custom'}
                onChange={() => setPreviewMode('custom')}
                className="accent-gray-900 dark:accent-zinc-100"
              />
              직접 작성
            </label>
          </div>
          {previewMode === 'custom' && (
            <textarea
              value={customPreview}
              onChange={(e) => setCustomPreview(e.target.value)}
              placeholder="미구매자에게 보여줄 미리보기 텍스트를 작성해주세요..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 resize-none"
            />
          )}
        </div>
      </main>

      {/* 하단 액션 바 */}
      <footer className="sticky bottom-0 border-t border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-[#0E141B]/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* 작성 진행도 */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400 dark:text-zinc-500">
            <span className={title.trim() ? 'text-green-600 dark:text-green-400' : ''}>
              {title.trim() ? '1' : '0'} 상품명
            </span>
            <span className="text-gray-200 dark:text-zinc-700">/</span>
            <span className={price && Number(price) >= 100 ? 'text-green-600 dark:text-green-400' : ''}>
              {price && Number(price) >= 100 ? '2' : '0'} 가격
            </span>
            <span className="text-gray-200 dark:text-zinc-700">/</span>
            <span className={descriptionContent.trim() ? 'text-green-600 dark:text-green-400' : ''}>
              {descriptionContent.trim() ? '3' : '0'} 소개
            </span>
            <span className="text-gray-200 dark:text-zinc-700">/</span>
            <span className={deliveryContent.trim() ? 'text-green-600 dark:text-green-400' : ''}>
              {deliveryContent.trim() ? '4' : '0'} 콘텐츠
            </span>
          </div>
          <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            초안 저장
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-lg bg-gray-900 dark:bg-white text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? '등록 중...' : '상품 등록'}
          </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
